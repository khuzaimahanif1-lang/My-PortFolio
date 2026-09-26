"""Verify the running same-origin server using disposable local records."""
import sys,secrets,asyncio,json,io
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/"Backend"))
import httpx
from websockets.asyncio.client import connect
from PIL import Image
from sqlalchemy import delete,select
from app.core.database import SessionLocal
from app.models import User
BASE=sys.argv[1] if len(sys.argv)>1 else "http://127.0.0.1:4000"
nonce=secrets.token_hex(8);password=secrets.token_urlsafe(18)
emails=["qa-"+nonce+"-"+str(i)+"@example.com" for i in range(2)]
clients=[httpx.Client(base_url=BASE,timeout=90,headers={"Origin":BASE}) for _ in range(2)]
checks=0
def check(value,label):
 global checks
 if not value: raise AssertionError(label)
 checks+=1;print("PASS "+label,flush=True)
def call(client,method,path,payload=None,status=200,**kwargs):
 response=client.request(method,"/api/"+path,json=payload,**kwargs)
 if response.status_code!=status:raise AssertionError(path+" returned "+str(response.status_code)+": "+response.text[:300])
 return response
try:
 c,b=clients
 check(call(c,"GET","health").json()["status"]=="ok","same-origin API proxy")
 for path in ("/","/about","/skills","/experience","/journey","/achievements","/goals","/contact","/blog","/research","/ai","/ml","/technology","/timeline","/projects","/login","/signup"):
  response=c.get(path)
  check(response.status_code==200 and "<app-root" in response.text,"SSR route "+path+" (HTTP "+str(response.status_code)+")")
 users=[]
 for index,client in enumerate(clients):
  data=call(client,"POST","auth/signup",{"full_name":"Disposable QA "+str(index),"email":emails[index],"password":password,"confirm_password":password},201).json()
  client.headers["Authorization"]="Bearer "+data["access_token"];users.append(data["user"])
 check(all(client.cookies.get("king_refresh") for client in clients),"proxied HttpOnly session cookies")
 p=call(c,"POST","projects",{"name":"Disposable QA project","slug":"qa-"+nonce,"documentation":"# Architecture\nA disposable verification record.","technologies":["Angular","Python"]},201).json()
 p=call(c,"PUT","projects/"+p["id"],{"name":p["name"],"slug":p["slug"],"status":"IN_PROGRESS","progress":25,"technologies":["Angular","Python"]}).json()
 check(p["progress"]==25,"persisted project editing")
 check(b.get("/api/projects/"+p["id"]).status_code==404,"live cross-user isolation")
 screenshot=io.BytesIO();Image.new("RGB",(20,20),(170,120,50)).save(screenshot,"PNG")
 response=c.post("/api/projects/"+p["id"]+"/screenshots",files={"file":("qa.png",screenshot.getvalue(),"image/png")})
 check(response.status_code==201,"production project screenshot upload")
 screenshot_url=response.json()["screenshots"][0]
 check(c.get(screenshot_url).status_code==200 and b.get(screenshot_url).status_code==404,"project screenshot privacy")
 response=c.delete("/api/projects/"+p["id"]+"/screenshots/"+screenshot_url.split("/")[-1])
 check(response.status_code==200 and c.get(screenshot_url).status_code==404,"project screenshot removal")
 task=call(c,"POST","tasks",{"title":"Disposable QA task","project_id":p["id"],"subtasks":[{"title":"Check persistence","done":False}]},201).json()
 task=call(c,"PUT","tasks/"+task["id"],{"title":task["title"],"project_id":p["id"],"status":"COMPLETED","subtasks":[{"title":"Check persistence","done":True}]}).json()
 check(task["progress"]==100,"task completion and subtasks")
 note=call(c,"POST","notes",{"title":"Disposable QA note","content":"# Safe Markdown\nA saved test thought."},201).json()
 call(c,"PUT","notes/"+note["id"],{"title":note["title"],"content":"# Updated thought\nPersisted through the production proxy.","pinned":True})
 check(call(c,"GET","notes/"+note["id"]).json()["pinned"],"note editing and persistence")
 goal=call(c,"POST","goals",{"title":"Disposable QA goal","milestones":[{"title":"Verify","done":True}],"progress":100},201).json()
 check(goal["progress"]==100,"goal milestones")
 report=call(c,"GET","reports").json()
 check(report["kpis"]["completed_tasks"]==1 and report["kpis"]["total_projects"]==1,"database-derived reports")
 check("text/csv" in call(c,"GET","reports/export").headers["content-type"],"CSV download through production proxy")
 check(call(c,"GET","search?q=Disposable").json()["items"],"workspace search")
 cid=call(c,"POST","conversations",{"user_id":users[1]["id"]},201).json()["id"]
 ticket=call(b,"POST","realtime/ticket",{}).json()["ticket"]
 async def live():
  url=BASE.replace("http://","ws://").replace("https://","wss://")+"/api/ws?ticket="+ticket
  async with connect(url,origin=BASE,open_timeout=30) as ws:
   await asyncio.wait_for(ws.recv(),30);await asyncio.wait_for(ws.recv(),30)
   message=await asyncio.to_thread(call,c,"POST","conversations/"+cid+"/messages",{"content":"Disposable live verification"},201)
   event=json.loads(await asyncio.wait_for(ws.recv(),30))
   check(event["type"]=="message:new" and event["message"]["id"]==message.json()["id"],"production WebSocket proxy and two-user delivery")
 asyncio.run(live())
 image=io.BytesIO();Image.new("RGB",(20,20),(200,170,70)).save(image,"PNG")
 upload=c.post("/api/uploads",data={"conversation_id":cid},files={"file":("qa.png",image.getvalue(),"image/png")})
 check(upload.status_code==201,"production image upload")
 attachment=upload.json()
 call(c,"POST","conversations/"+cid+"/messages",{"attachment_id":attachment["id"]},201)
 check(call(b,"GET","uploads/"+attachment["id"]).headers["content-type"]=="image/webp","authorized private image download")
 call(b,"POST","conversations/"+cid+"/read",{})
 check(call(c,"GET","conversations/"+cid+"/messages").json()["items"][0]["read_at"],"message read receipt")
 call(c,"POST","auth/lock",{})
 check(c.get("/api/notes").status_code==423,"server-enforced workspace lock")
 unlocked=call(c,"POST","auth/unlock",{"password":password}).json()
 c.headers["Authorization"]="Bearer "+unlocked["access_token"]
 check(call(c,"GET","notes").json()["total"]==1,"password-only unlock")
 check(call(c,"GET","assistant/status").json()["available"] is False,"honest unconfigured AI state")
 check(c.post("/api/assistant/summarize",json={"kind":"note","text":"Disposable QA content"}).status_code==503,"AI unavailable error")
 call(c,"POST","public/contact",{"name":"Disposable QA "+nonce,"email":emails[0],"message":"Disposable production contact form verification."},201)
 check(True,"public contact submission")
 print(str(checks)+" production smoke checks passed.",flush=True)
finally:
 for client in clients:client.close()
 # Remove only identities and artifacts bearing this run's random email addresses.
 from app.models import Attachment,ContactMessage,Notification,Conversation
 from app.core.config import ROOT
 with SessionLocal() as db:
  ids=db.scalars(select(User.id).where(User.email.in_(emails))).all()
  images=db.scalars(select(Attachment).where(Attachment.owner_id.in_(ids))).all()
  for image in images:ROOT.joinpath("storage","uploads",image.filename).unlink(missing_ok=True)
  contacts=db.scalars(select(ContactMessage).where(ContactMessage.email.in_(emails))).all()
  for contact in contacts:
   db.execute(delete(Notification).where(Notification.body==contact.name,Notification.kind=="contact"))
   db.delete(contact)
  if len(ids)==2:db.execute(delete(Conversation).where(Conversation.pair_key==":".join(sorted(ids))))
  db.execute(delete(User).where(User.email.in_(emails)));db.commit()
 print("Removed disposable QA records.",flush=True)

