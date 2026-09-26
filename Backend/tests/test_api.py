"""Integration/security tests use a separate temporary database and synthetic users."""
import os
import secrets
import tempfile
import unittest
import io
from pathlib import Path
_temp=tempfile.TemporaryDirectory(prefix="king-ai-tests-")
os.environ["DATABASE_URL"]="sqlite:///"+(Path(_temp.name)/"test.db").as_posix()
os.environ["JWT_SECRET"]=secrets.token_urlsafe(48)
os.environ["SMTP_HOST"]=""
os.environ["AI_BASE_URL"]=""
os.environ["AI_API_KEY"]=""
os.environ["ENVIRONMENT"]="development"
from fastapi.testclient import TestClient
from sqlalchemy import select
from PIL import Image
from passlib.context import CryptContext
from app.main import app,attempts
from app.routers import messages as message_router
from app.services import mail,images
images.ROOT=Path(_temp.name)
message_router.ROOT=Path(_temp.name)
mail.ROOT=Path(_temp.name)
Path(_temp.name,"storage","uploads").mkdir(parents=True)
from app.core.database import Base,engine,SessionLocal
from app.models import User,Session,ResetToken,now
from app.services import security
security.passwords=CryptContext(schemes=["bcrypt"],bcrypt__rounds=4)
class ApiTests(unittest.TestCase):
    @classmethod
    def tearDownClass(cls):
        engine.dispose(); _temp.cleanup()
    def setUp(self):
        Base.metadata.drop_all(engine)
        Base.metadata.create_all(engine)
        attempts.clear()
        self.client=TestClient(app)
        self.other=TestClient(app)
        self.a=self.signup(self.client,"Alice","alice@example.com")
        self.b=self.signup(self.other,"Bob","bob@example.com")
        self.headers={"Authorization":"Bearer "+self.a["access_token"]}
        self.other_headers={"Authorization":"Bearer "+self.b["access_token"]}
    def tearDown(self):
        self.client.close();self.other.close()
    def signup(self,client,name,email):
        response=client.post("/api/auth/signup",json={"full_name":name,"email":email,"password":"TestPassword123","confirm_password":"TestPassword123"})
        self.assertEqual(response.status_code,201,response.text)
        return response.json()
    def post(self,path,data):
        return self.client.post("/api/"+path,json=data,headers=self.headers)
    def project(self,**extra):
        response=self.post("projects",{"name":"Research app","slug":"research-app","technologies":["Python"],**extra})
        self.assertEqual(response.status_code,201,response.text)
        return response.json()
    def conversation(self):
        response=self.post("conversations",{"user_id":self.b["user"]["id"]})
        self.assertEqual(response.status_code,201,response.text)
        return response.json()["id"]
    def test_password_hashed_and_roles_not_assignable(self):
        with SessionLocal() as db:
            user=db.get(User,self.a["user"]["id"])
            self.assertNotEqual(user.password_hash,"TestPassword123")
            self.assertTrue(security.verify_password("TestPassword123",user.password_hash))
            self.assertEqual(user.role,"USER")
        response=self.client.post("/api/auth/signup",json={"full_name":"Mallory","email":"m@example.com","password":"TestPassword123","confirm_password":"TestPassword123","role":"OWNER"})
        self.assertEqual(response.status_code,422)
    def test_requires_authentication_and_rejects_invalid_tokens(self):
        self.assertEqual(self.client.get("/api/notes").status_code,401)
        self.assertEqual(self.client.get("/api/notes",headers={"Authorization":"Bearer invalid"}).status_code,401)
    def test_owner_isolation_all_resources(self):
        for path,payload in [("projects",{"name":"Private","slug":"private"}),("tasks",{"title":"Private task"}),("notes",{"title":"Private note","content":"secret"}),("goals",{"title":"Private goal"})]:
            item=self.post(path,payload).json()
            for method in ("get","put","delete"):
                kwargs={"headers":self.other_headers}
                if method=="put":kwargs["json"]=payload
                response=getattr(self.other,method)("/api/"+path+"/"+item["id"],**kwargs)
                self.assertEqual(response.status_code,404,(path,method,response.text))
            self.assertEqual(self.other.get("/api/"+path,headers=self.other_headers).json()["total"],0)
    def test_project_relations_public_visibility_and_validation(self):
        project=self.project()
        response=self.other.post("/api/tasks",json={"title":"Bad link","project_id":project["id"]},headers=self.other_headers)
        self.assertEqual(response.status_code,404)
        self.assertEqual(self.post("projects",{"name":"Bad","slug":"bad","progress":101}).status_code,422)
        self.assertEqual(self.post("projects",{"name":"Bad","slug":"bad","github_url":"javascript:alert(1)"}).status_code,422)
        self.assertEqual(self.post("projects",{"name":"Public","slug":"public","is_public":True}).status_code,403)
        self.assertEqual(self.client.get("/api/public/projects").json()["items"],[])
    def test_refresh_cookie_rotation_and_reuse_revocation(self):
        raw=self.client.cookies.get("king_refresh")
        response=self.client.post("/api/auth/refresh")
        self.assertEqual(response.status_code,200,response.text)
        self.assertNotEqual(raw,self.client.cookies.get("king_refresh"))
        self.assertIn("HttpOnly",response.headers["set-cookie"])
        replay=TestClient(app)
        response=replay.post("/api/auth/refresh",headers={"Cookie":"king_refresh="+raw})
        self.assertEqual(response.status_code,401)
        self.assertEqual(self.client.get("/api/projects",headers=self.headers).status_code,401)
        replay.close()
    def test_workspace_lock_and_password_only_unlock(self):
        self.assertEqual(self.post("auth/lock",{}).status_code,200)
        self.assertEqual(self.client.get("/api/notes",headers=self.headers).status_code,423)
        self.assertEqual(self.client.post("/api/auth/refresh").status_code,423)
        self.assertEqual(self.client.post("/api/auth/unlock",json={"password":"WrongPassword"}).status_code,401)
        response=self.client.post("/api/auth/unlock",json={"password":"TestPassword123"})
        self.assertEqual(response.status_code,200,response.text)
        self.assertEqual(self.client.get("/api/notes",headers={"Authorization":"Bearer "+response.json()["access_token"]}).status_code,200)
    def test_reset_one_time_and_revokes_sessions(self):
        from datetime import timedelta
        token=secrets.token_urlsafe(48)
        with SessionLocal() as db:
            db.add(ResetToken(token_hash=security.digest(token),user_id=self.a["user"]["id"],expires_at=now()+timedelta(minutes=5)));db.commit()
        payload={"token":token,"password":"NewPassword123"}
        self.assertEqual(self.client.post("/api/auth/reset-password",json=payload).status_code,200)
        self.assertEqual(self.client.post("/api/auth/reset-password",json=payload).status_code,400)
        self.assertEqual(self.client.get("/api/notes",headers=self.headers).status_code,401)
        self.assertEqual(self.client.post("/api/auth/login",json={"email":"alice@example.com","password":"NewPassword123"}).status_code,200)
    def test_expired_access_and_reset_tokens(self):
        from datetime import timedelta
        from jose import jwt
        from app.core.config import get_settings
        expired=jwt.encode({"sub":self.a["user"]["id"],"sid":"missing","type":"access","exp":now()-timedelta(minutes=1)},get_settings().jwt_secret,algorithm="HS256")
        self.assertEqual(self.client.get("/api/tasks",headers={"Authorization":"Bearer "+expired}).status_code,401)
        token=secrets.token_urlsafe(48)
        with SessionLocal() as db:
            db.add(ResetToken(token_hash=security.digest(token),user_id=self.a["user"]["id"],expires_at=now()-timedelta(minutes=1)));db.commit()
        self.assertEqual(self.client.post("/api/auth/reset-password",json={"token":token,"password":"NewPassword123"}).status_code,400)
    def test_reports_search_and_task_completion_use_database(self):
        self.project()
        task=self.post("tasks",{"title":"Ship the app","status":"COMPLETED"}).json()
        self.assertEqual(task["progress"],100)
        self.post("learning",{"topic":"Python","minutes":90})
        report=self.client.get("/api/reports",headers=self.headers).json()
        self.assertEqual(report["kpis"]["total_projects"],1)
        self.assertEqual(report["kpis"]["completed_tasks"],1)
        self.assertEqual(report["kpis"]["learning_hours"],1.5)
        self.assertEqual(report["technologies"],[{"name":"Python","count":1}])
        results=self.client.get("/api/search?q=Research",headers=self.headers).json()["items"]
        self.assertEqual(len(results),1)
        self.assertEqual(self.other.get("/api/search?q=Research",headers=self.other_headers).json()["items"],[])
        self.assertEqual(self.client.get("/api/reports/export",headers=self.headers).status_code,200)
    def test_message_membership_history_read_and_notifications(self):
        cid=self.conversation()
        outsider=TestClient(app);outsider_auth=self.signup(outsider,"Charlie","charlie@example.com")
        outsider_headers={"Authorization":"Bearer "+outsider_auth["access_token"]}
        self.assertEqual(outsider.get("/api/conversations/"+cid+"/messages",headers=outsider_headers).status_code,404)
        sent=self.post("conversations/"+cid+"/messages",{"content":"Hello https://example.com"}).json()
        history=self.other.get("/api/conversations/"+cid+"/messages",headers=self.other_headers).json()
        self.assertEqual(history["items"][0]["content"],sent["content"])
        self.assertEqual(self.other.post("/api/conversations/"+cid+"/read",headers=self.other_headers).status_code,200)
        self.assertIsNotNone(self.client.get("/api/conversations/"+cid+"/messages",headers=self.headers).json()["items"][0]["read_at"])
        notification=self.other.get("/api/notifications",headers=self.other_headers).json()["items"][0]
        self.assertEqual(notification["kind"],"message")
        self.assertEqual(self.client.post("/api/notifications/"+notification["id"]+"/read",headers=self.headers).status_code,404)
        outsider.close()
    def test_upload_signatures_sizes_and_access(self):
        cid=self.conversation()
        response=self.client.post("/api/uploads",headers=self.headers,data={"conversation_id":cid},
            files={"file":("fake.png",b"<script>bad</script>","image/png")})
        self.assertEqual(response.status_code,400)
        image=io.BytesIO();Image.new("RGB",(20,20),(200,150,20)).save(image,"PNG")
        response=self.client.post("/api/uploads",headers=self.headers,data={"conversation_id":cid},
            files={"file":("../../image.png",image.getvalue(),"image/png")})
        self.assertEqual(response.status_code,201,response.text)
        aid=response.json()["id"]
        self.assertEqual(self.other.get("/api/uploads/"+aid,headers=self.other_headers).status_code,404)
        self.assertEqual(self.post("conversations/"+cid+"/messages",{"attachment_id":aid}).status_code,201)
        self.assertEqual(self.other.get("/api/uploads/"+aid,headers=self.other_headers).status_code,200)
        self.assertEqual(self.client.get("/api/uploads/"+aid).status_code,401)
    def test_websocket_one_time_ticket_and_live_delivery(self):
        cid=self.conversation()
        ticket=self.post("realtime/ticket",{}).json()["ticket"]
        with TestClient(app) as shared, shared.websocket_connect("/api/ws?ticket="+ticket,headers={"origin":"http://localhost:4200"}) as ws:
            self.assertEqual(ws.receive_json()["type"],"connection")
            self.assertEqual(ws.receive_json()["type"],"user:online")
            result=shared.post("/api/conversations/"+cid+"/messages",json={"content":"Live hello"},headers=self.other_headers)
            self.assertEqual(result.status_code,201,result.text)
            event=ws.receive_json()
            self.assertEqual(event["type"],"message:new")
            self.assertEqual(event["message"]["content"],"Live hello")
    def test_project_screenshot_privacy_publish_cleanup_and_limits(self):
        project=self.project()
        image=io.BytesIO();Image.new("RGB",(20,20),(190,150,40)).save(image,"PNG")
        path="/api/projects/"+project["id"]+"/screenshots"
        response=self.other.post(path,headers=self.other_headers,files={"file":("image.png",image.getvalue(),"image/png")})
        self.assertEqual(response.status_code,404)
        response=self.client.post(path,headers=self.headers,files={"file":("fake.png",b"<script>fake</script>","image/png")})
        self.assertEqual(response.status_code,400)
        response=self.client.post(path,headers=self.headers,files={"file":("../../image.png",image.getvalue(),"image/png")})
        self.assertEqual(response.status_code,201,response.text)
        screenshot=response.json()["screenshots"][0];filename=screenshot.split("/")[-1]
        self.assertEqual(self.client.get(screenshot).status_code,401)
        self.assertEqual(self.other.get(screenshot,headers=self.other_headers).status_code,404)
        self.assertEqual(self.client.get(screenshot,headers=self.headers).status_code,200)
        with SessionLocal() as db:
            db.get(User,self.a["user"]["id"]).role="OWNER";db.commit()
        response=self.client.put("/api/projects/"+project["id"],headers=self.headers,json={"name":project["name"],"slug":project["slug"],"screenshots":[screenshot],"is_public":True})
        self.assertEqual(response.status_code,200,response.text)
        self.assertEqual(self.client.get(screenshot).status_code,200)
        response=self.client.delete(path+"/"+filename,headers=self.headers)
        self.assertEqual(response.status_code,200,response.text)
        self.assertFalse(images.project_path(project["id"],filename).exists())
        self.assertEqual(self.client.get(screenshot).status_code,404)
        self.client.put("/api/projects/"+project["id"],headers=self.headers,json={"name":project["name"],"slug":project["slug"],"screenshots":["https://example.com/"+str(i)+".png" for i in range(12)]})
        response=self.client.post(path,headers=self.headers,files={"file":("image.png",image.getvalue(),"image/png")})
        self.assertEqual(response.status_code,413)
    def test_unconfigured_assistant_is_explicit_and_validates_inputs(self):
        self.assertFalse(self.client.get("/api/assistant/status",headers=self.headers).json()["available"])
        self.assertEqual(self.post("assistant/summarize",{"kind":"note","text":"A real note with enough text."}).status_code,503)
        self.assertEqual(self.post("assistant/summarize",{"kind":"invalid","text":"A real note with enough text."}).status_code,422)
    def test_manual_lock_covers_active_sessions_after_second_login(self):
        second=TestClient(app)
        login=second.post("/api/auth/login",json={"email":"alice@example.com","password":"TestPassword123"}).json()
        new_headers={"Authorization":"Bearer "+login["access_token"]}
        self.assertEqual(self.post("auth/lock",{}).status_code,200)
        self.assertEqual(self.client.get("/api/notes",headers=self.headers).status_code,423)
        self.assertEqual(self.client.get("/api/notes",headers=new_headers).status_code,423)
        self.assertTrue(self.client.get("/api/auth/session").json()["locked"])
        unlocked=second.post("/api/auth/unlock",json={"password":"TestPassword123"}).json()
        self.assertEqual(second.get("/api/notes",headers={"Authorization":"Bearer "+unlocked["access_token"]}).status_code,200)
        self.assertEqual(self.client.get("/api/notes",headers=self.headers).status_code,423)
        second.close()
    def test_role_checks_origin_protection_and_rate_limit(self):
        self.assertEqual(self.client.get("/api/owner/content",headers=self.headers).status_code,403)
        self.assertEqual(self.client.post("/api/auth/refresh",headers={"Origin":"https://evil.example"}).status_code,403)
        for _ in range(10):
            self.client.post("/api/auth/login",json={"email":"alice@example.com","password":"IncorrectPassword"})
        self.assertEqual(self.client.post("/api/auth/login",json={"email":"alice@example.com","password":"IncorrectPassword"}).status_code,429)
    def test_password_change_signs_out_other_sessions_and_logout(self):
        login=self.client.post("/api/auth/login",json={"email":"alice@example.com","password":"TestPassword123"}).json()
        new_headers={"Authorization":"Bearer "+login["access_token"]}
        response=self.client.post("/api/account/password",headers=new_headers,json={"current_password":"TestPassword123","password":"UpdatedPassword123"})
        self.assertEqual(response.status_code,200,response.text)
        self.assertEqual(self.client.get("/api/notes",headers=self.headers).status_code,401)
        self.assertEqual(self.client.post("/api/auth/logout").status_code,200)
        self.assertEqual(self.client.get("/api/notes",headers=new_headers).status_code,401)
    def test_guest_session_and_cross_account_refresh_binding(self):
        guest=TestClient(app)
        self.assertEqual(guest.get("/api/auth/session").json()["authenticated"],False)
        current=self.client.cookies.get("king_refresh")
        response=self.client.post("/api/auth/refresh",json={"user_id":self.b["user"]["id"]})
        self.assertEqual(response.status_code,409)
        self.assertEqual(self.client.cookies.get("king_refresh"),current)
        self.assertEqual(self.client.post("/api/auth/refresh",json={"user_id":self.a["user"]["id"]}).status_code,200)
        guest.close()
    def test_account_workspaces_and_preferences_are_separate(self):
        self.project();self.post("notes",{"title":"Alice's note"})
        response=self.client.put("/api/account/preferences",headers=self.headers,json={"workspace_name":"Alice's studio","workspace_accent":"blue"})
        self.assertEqual(response.status_code,200,response.text)
        alice=self.client.get("/api/reports",headers=self.headers).json()
        bob=self.other.get("/api/reports",headers=self.other_headers).json()
        self.assertEqual(alice["kpis"]["total_projects"],1);self.assertEqual(bob["kpis"]["total_projects"],0)
        self.assertEqual(bob["kpis"]["notes"],0)
        self.assertNotEqual(self.other.get("/api/account",headers=self.other_headers).json()["preferences"].get("workspace_name"),"Alice's studio")
    def test_notifications_delete_clear_read_and_quiet_activity(self):
        from app.models import Notification
        with SessionLocal() as db:
            a=Notification(owner_id=self.a["user"]["id"],title="Important update",kind="security")
            b=Notification(owner_id=self.b["user"]["id"],title="Other account",kind="security")
            noise=Notification(owner_id=self.a["user"]["id"],title="Updated project",kind="project")
            login_noise=Notification(owner_id=self.a["user"]["id"],title="Signed in to your workspace",kind="security")
            db.add_all([a,b,noise,login_noise]);db.commit();aid=a.id;bid=b.id
        result=self.client.get("/api/notifications",headers=self.headers).json()
        self.assertEqual([n["id"] for n in result["items"]],[aid])
        self.assertEqual(self.client.delete("/api/notifications/"+bid,headers=self.headers).status_code,404)
        self.assertEqual(self.client.delete("/api/notifications?read_only=true",headers=self.headers).json()["deleted"],0)
        self.client.post("/api/notifications/"+aid+"/read",headers=self.headers)
        self.assertEqual(self.client.delete("/api/notifications?read_only=true",headers=self.headers).json()["deleted"],1)
        self.assertEqual(self.other.get("/api/notifications",headers=self.other_headers).json()["unread"],1)
        self.assertEqual(self.other.delete("/api/notifications/"+bid,headers=self.other_headers).status_code,200)
    def test_desktop_code_requires_host_approval_and_is_single_use(self):
        response=self.post("calls",{"kind":"DESKTOP"});self.assertEqual(response.status_code,201,response.text);call=response.json()
        self.assertEqual(len(call["code"]),8)
        joined=self.other.post("/api/calls/join",json={"code":call["code"]},headers=self.other_headers)
        self.assertEqual(joined.status_code,200,joined.text);self.assertEqual(joined.json()["state"],"REQUESTED")
        self.assertEqual(self.other.post("/api/calls/"+call["id"]+"/accept",headers=self.other_headers).status_code,409)
        self.assertEqual(self.post("calls/"+call["id"]+"/signal",{"type":"offer","sdp":"v=0"}).status_code,409)
        approved=self.post("calls/"+call["id"]+"/accept",{});self.assertEqual(approved.json()["state"],"ACTIVE")
        self.assertEqual(self.other.post("/api/calls/join",json={"code":call["code"]},headers=self.other_headers).status_code,404)
        self.assertEqual(self.other.post("/api/calls/"+call["id"]+"/control",json={"enabled":True},headers=self.other_headers).status_code,403)
        self.assertTrue(self.post("calls/"+call["id"]+"/control",{"enabled":True}).json()["control_allowed"])
        ended=self.post("calls/"+call["id"]+"/end",{}).json();self.assertFalse(ended["control_allowed"])
        self.assertEqual(self.post("calls/"+call["id"]+"/signal",{"type":"offer","sdp":"v=0"}).status_code,409)
    def test_call_expiry_privacy_and_signaling_session_binding(self):
        from app.models import CallSession
        from datetime import timedelta
        call=self.post("calls",{"kind":"VIDEO","user_id":self.b["user"]["id"]}).json()
        stranger=TestClient(app);third=self.signup(stranger,"Carol","carol@example.com");headers={"Authorization":"Bearer "+third["access_token"]}
        self.assertEqual(stranger.get("/api/calls/"+call["id"],headers=headers).status_code,404)
        self.assertEqual(stranger.get("/api/calls",headers=headers).json()["items"],[])
        self.assertEqual(self.post("calls/"+call["id"]+"/accept",{}).status_code,409)
        self.assertEqual(self.other.post("/api/calls/"+call["id"]+"/accept",headers=self.other_headers).status_code,200)
        second=TestClient(app);login=second.post("/api/auth/login",json={"email":"alice@example.com","password":"TestPassword123"}).json()
        self.assertEqual(second.post("/api/calls/"+call["id"]+"/signal",headers={"Authorization":"Bearer "+login["access_token"]},json={"type":"offer","sdp":"v=0"}).status_code,403)
        pending=self.post("calls",{"kind":"AUDIO"}).json()
        with SessionLocal() as db:db.get(CallSession,pending["id"]).expires_at=now()-timedelta(seconds=1);db.commit()
        self.assertEqual(self.other.post("/api/calls/join",json={"code":pending["code"]},headers=self.other_headers).status_code,404)
        second.close();stranger.close()
    def test_call_stops_after_sharing_session_is_locked(self):
        call=self.post("calls",{"kind":"DESKTOP","user_id":self.b["user"]["id"]}).json()
        self.other.post("/api/calls/"+call["id"]+"/accept",headers=self.other_headers)
        self.post("calls/"+call["id"]+"/control",{"enabled":True})
        self.post("auth/lock",{})
        detail=self.other.get("/api/calls/"+call["id"],headers=self.other_headers).json()
        self.assertEqual(detail["state"],"ENDED");self.assertFalse(detail["control_allowed"])
    def test_call_signaling_reaches_only_the_approved_recipient(self):
        with TestClient(app) as live:
            ticket=live.post("/api/realtime/ticket",headers=self.other_headers).json()["ticket"]
            with live.websocket_connect("/api/ws?ticket="+ticket,headers={"Origin":"http://127.0.0.1:4300"}) as ws:
                ws.receive_json();ws.receive_json()
                call=self.post("calls",{"kind":"AUDIO","user_id":self.b["user"]["id"]}).json()
                self.assertEqual(ws.receive_json()["type"],"call:invite")
                live.post("/api/calls/"+call["id"]+"/accept",headers=self.other_headers)
                self.assertEqual(ws.receive_json()["call"]["state"],"ACTIVE")
                response=self.post("calls/"+call["id"]+"/signal",{"type":"offer","sdp":"v=0"})
                self.assertEqual(response.status_code,200,response.text)
                event=ws.receive_json();self.assertEqual(event["type"],"call:signal");self.assertEqual(event["sender_id"],self.a["user"]["id"])
                self.post("calls/"+call["id"]+"/end",{})
                self.assertEqual(ws.receive_json()["call"]["state"],"ENDED")
    def make_owner(self, user_id):
        with SessionLocal() as db:
            db.get(User, user_id).role = "OWNER"
            db.commit()

    def test_portfolio_editor_persistence_publication_images_and_delete(self):
        self.make_owner(self.a["user"]["id"])
        payload = {"name": "Personal demo", "slug": "personal-demo", "description": "My project",
                   "technologies": ["Angular", "FastAPI"], "live_url": "https://example.com/demo",
                   "github_url": "https://example.com/source", "is_public": False}
        response = self.post("portfolio/projects", payload)
        self.assertEqual(response.status_code, 201, response.text)
        project = response.json()
        self.assertTrue(project["is_portfolio"])
        path = "/api/portfolio/projects/" + project["id"]
        self.assertEqual(self.client.get("/api/public/projects/personal-demo").status_code, 404)
        self.assertEqual(self.client.get(path, headers=self.headers).json()["description"], "My project")
        image = io.BytesIO()
        Image.new("RGB", (30, 20), (220, 170, 30)).save(image, "PNG")
        uploaded = self.client.post("/api/projects/" + project["id"] + "/screenshots",
            headers=self.headers, files={"file": ("demo.png", image.getvalue(), "image/png")})
        self.assertEqual(uploaded.status_code, 201, uploaded.text)
        url = uploaded.json()["screenshots"][0]
        self.assertEqual(self.client.get(url).status_code, 401)
        payload.update(name="Updated personal demo", slug="updated-personal-demo",
                       description="A presentation-ready description", is_public=True, screenshots=[url])
        response = self.client.put(path, json=payload, headers=self.headers)
        self.assertEqual(response.status_code, 200, response.text)
        with SessionLocal() as db:
            from app.models import Project
            stored = db.get(Project, project["id"])
            self.assertEqual(stored.description, payload["description"])
            self.assertEqual(stored.live_url, payload["live_url"])
            self.assertTrue(stored.is_portfolio)
        self.assertEqual(self.client.get("/api/public/projects/personal-demo").status_code, 404)
        public = self.client.get("/api/public/projects/updated-personal-demo").json()
        self.assertEqual(public["screenshots"], [url])
        self.assertEqual(public["live_url"], payload["live_url"])
        self.assertNotIn("owner_id", public)
        self.assertNotIn("owner_id", self.client.get("/api/public/projects").json()["items"][0])
        self.assertEqual(self.client.get(url).status_code, 200)
        payload["is_public"] = False
        self.assertEqual(self.client.put(path, json=payload, headers=self.headers).status_code, 200)
        self.assertEqual(self.client.get("/api/public/projects/updated-personal-demo").status_code, 404)
        self.assertEqual(self.client.get(url).status_code, 401)
        self.assertEqual(self.client.get(path, headers=self.headers).json()["name"], payload["name"])
        self.assertEqual(self.client.delete(path, headers=self.headers).status_code, 200)
        self.assertEqual(self.client.get(path, headers=self.headers).status_code, 404)
        self.assertFalse(images.project_path(project["id"], url.split("/")[-1]).exists())

    def test_portfolio_roles_ownership_and_workspace_draft_separation(self):
        self.make_owner(self.a["user"]["id"])
        private = self.project(slug="workspace-only")
        personal = self.post("portfolio/projects", {"name": "Portfolio draft", "slug": "portfolio-draft"}).json()
        listing = self.client.get("/api/portfolio/projects", headers=self.headers).json()
        self.assertEqual([p["id"] for p in listing["items"]], [personal["id"]])
        self.assertEqual(self.client.get("/api/portfolio/projects").status_code, 401)
        self.assertEqual(self.other.get("/api/portfolio/projects", headers=self.other_headers).status_code, 403)
        self.assertEqual(self.other.post("/api/portfolio/projects", json={"name":"Bad","slug":"bad"},
            headers=self.other_headers).status_code, 403)
        self.make_owner(self.b["user"]["id"])
        for resource in [personal, private]:
            path = "/api/portfolio/projects/" + resource["id"]
            for method in ["get", "put", "delete"]:
                kwargs = {"headers": self.other_headers}
                if method == "put":
                    kwargs["json"] = {"name":"Stolen", "slug":"stolen"}
                self.assertEqual(getattr(self.other, method)(path, **kwargs).status_code, 404)
        self.assertEqual(self.client.get("/api/portfolio/projects/" + private["id"], headers=self.headers).status_code, 404)
        duplicate = self.post("portfolio/projects", {"name":"Duplicate","slug":"portfolio-draft"})
        self.assertEqual(duplicate.status_code, 409)
        self.assertEqual(self.post("auth/lock", {}).status_code, 200)
        self.assertEqual(self.client.get("/api/portfolio/projects", headers=self.headers).status_code, 423)

    def test_legacy_portfolio_migration_preserves_data_and_runs_once(self):
        from sqlalchemy import create_engine, text
        from app.core.migrations import migrate_portfolio
        legacy = create_engine("sqlite://")
        try:
            with legacy.begin() as db:
                db.execute(text("CREATE TABLE users (id TEXT PRIMARY KEY, role TEXT)"))
                db.execute(text("INSERT INTO users VALUES ('owner', 'OWNER'), ('member', 'USER')"))
                db.execute(text("CREATE TABLE projects (id TEXT PRIMARY KEY, owner_id TEXT, is_public BOOLEAN, name TEXT)"))
                db.execute(text("INSERT INTO projects VALUES ('published','owner',1,'Existing work'), ('private','owner',0,'Private work'), ('member','member',1,'Member work')"))
            migrate_portfolio(legacy)
            with legacy.begin() as db:
                rows = db.execute(text("SELECT id, name, is_portfolio FROM projects ORDER BY id")).all()
                self.assertEqual(rows, [('member','Member work',0), ('private','Private work',0), ('published','Existing work',1)])
                db.execute(text("UPDATE projects SET is_public = 0 WHERE id = 'published'"))
            migrate_portfolio(legacy)
            with legacy.connect() as db:
                self.assertEqual(db.execute(text("SELECT is_portfolio FROM projects WHERE id = 'published'")).scalar(), 1)
        finally:
            legacy.dispose()

if __name__=="__main__":
    unittest.main()



