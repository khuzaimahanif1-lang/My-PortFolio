import io
import warnings
from pathlib import Path
from PIL import Image, UnidentifiedImageError
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, WebSocket, Query
from fastapi.responses import FileResponse
from sqlalchemy import select, update, delete, func, or_
from sqlalchemy.exc import IntegrityError
from ..core.database import get_db
from ..core.config import get_settings, ROOT
from ..dependencies import current_user, authenticated
from ..models import User, Conversation, ConversationMember, Message, Attachment, Notification, now, uid
from ..schemas import ConversationInput, MessageInput
from ..repositories.resources import view, owned, log
from ..websocket.hub import hub
from ..services.images import encode_image

router = APIRouter(tags=["Messages and notifications"])
Image.MAX_IMAGE_PIXELS = 20_000_000

def member(db, conversation_id, user):
    if not db.get(ConversationMember, (conversation_id,user.id)):
        raise HTTPException(404, "Conversation could not be found.")

def message_view(message):
    result = view(message)
    if message.attachment_id:
        result["attachment_url"] = "/api/uploads/" + message.attachment_id
    return result

@router.get("/users")
def users(q: str = Query("", max_length=100), user=Depends(current_user), db=Depends(get_db)):
    records = db.scalars(select(User).where(User.id != user.id, User.full_name.ilike("%"+q+"%")).limit(50)).all()
    return {"items":[{"id":u.id,"full_name":u.full_name,"title":u.title,"online":bool(hub.connections.get(u.id))} for u in records]}

@router.post("/conversations", status_code=201)
def create_conversation(data: ConversationInput, user=Depends(current_user), db=Depends(get_db)):
    if data.user_id == user.id or not db.get(User,data.user_id):
        raise HTTPException(400, "Choose another workspace member.")
    pair = ":".join(sorted([user.id,data.user_id]))
    conversation = db.scalar(select(Conversation).where(Conversation.pair_key==pair))
    if not conversation:
        conversation = Conversation(pair_key=pair)
        db.add(conversation)
        db.flush()
        db.add_all([ConversationMember(conversation_id=conversation.id,user_id=uid) for uid in (user.id,data.user_id)])
        try:
            db.commit()
        except IntegrityError:
            db.rollback()
            conversation = db.scalar(select(Conversation).where(Conversation.pair_key==pair))
    return view(conversation)

@router.get("/conversations")
def conversations(user=Depends(current_user), db=Depends(get_db)):
    records = db.scalars(select(Conversation).join(ConversationMember).where(ConversationMember.user_id==user.id)
        .order_by(Conversation.updated_at.desc())).all()
    items = []
    for c in records:
        other = db.scalar(select(User).join(ConversationMember).where(
            ConversationMember.conversation_id==c.id, User.id!=user.id))
        last = db.scalar(select(Message).where(Message.conversation_id==c.id).order_by(Message.created_at.desc()).limit(1))
        unread = db.scalar(select(func.count()).select_from(Message).where(
            Message.conversation_id==c.id, Message.sender_id!=user.id, Message.read_at==None))
        items.append({**view(c), "member":{"id":other.id,"full_name":other.full_name,"online":bool(hub.connections.get(other.id))},
            "last_message":message_view(last) if last else None,"unread":unread})
    return {"items":items}

@router.get("/conversations/{conversation_id}/messages")
def history(conversation_id: str, before: str = "", limit: int = Query(50,ge=1,le=100),
            user=Depends(current_user), db=Depends(get_db)):
    member(db,conversation_id,user)
    query = select(Message).where(Message.conversation_id==conversation_id)
    if before:
        reference = db.get(Message,before)
        if not reference or reference.conversation_id != conversation_id:
            raise HTTPException(400,"Invalid message cursor.")
        query = query.where(Message.created_at < reference.created_at)
    messages = list(db.scalars(query.order_by(Message.created_at.desc()).limit(limit)).all())
    return {"items":[message_view(m) for m in reversed(messages)],"has_more":len(messages)==limit}

@router.post("/conversations/{conversation_id}/messages", status_code=201)
async def send(conversation_id: str, data: MessageInput, user=Depends(current_user), db=Depends(get_db)):
    member(db,conversation_id,user)
    if data.attachment_id:
        attachment = db.get(Attachment,data.attachment_id)
        if not attachment or attachment.owner_id != user.id or attachment.conversation_id != conversation_id:
            raise HTTPException(400,"Image does not belong to this conversation.")
        if db.scalar(select(Message).where(Message.attachment_id==attachment.id)):
            raise HTTPException(400,"Image has already been sent.")
    message = Message(conversation_id=conversation_id,sender_id=user.id,**data.model_dump())
    db.add(message)
    db.get(Conversation,conversation_id).updated_at=now()
    db.flush()
    members = db.scalars(select(ConversationMember.user_id).where(ConversationMember.conversation_id==conversation_id)).all()
    notifications=[]
    for other in members:
        if other != user.id:
            recipient=db.get(User,other)
            if not recipient.preferences.get("message_notifications", True):
                continue
            link="/workspace/messages?conversation="+conversation_id
            item=db.scalar(select(Notification).where(Notification.owner_id==other,
                Notification.kind=="message",Notification.link==link,Notification.is_read==False))
            if not item:
                item=Notification(owner_id=other,title="Message from "+user.full_name,kind="message",link=link)
                db.add(item)
            item.body=data.content[:200] or "Sent an image"
            item.created_at=now()
            notifications.append((other,item))
    log(db,user,"Sent a message","message",message.id,notify=False)
    db.commit()
    result=message_view(message)
    for other in members:
        await hub.emit(other,{"type":"message:new","message":result})
    for other,item in notifications:
        await hub.emit(other,{"type":"notification:new","notification":view(item)})
    await hub.emit(user.id,{"type":"message:delivered","message_id":message.id})
    return result

@router.post("/conversations/{conversation_id}/read")
async def read(conversation_id: str, user=Depends(current_user), db=Depends(get_db)):
    member(db,conversation_id,user)
    db.execute(update(Message).where(Message.conversation_id==conversation_id,
        Message.sender_id!=user.id,Message.read_at==None).values(read_at=now()))
    db.execute(update(Notification).where(Notification.owner_id==user.id,Notification.kind=="message",Notification.link=="/workspace/messages?conversation="+conversation_id).values(is_read=True))
    db.commit()
    members=db.scalars(select(ConversationMember.user_id).where(ConversationMember.conversation_id==conversation_id)).all()
    for other in members:
        await hub.emit(other,{"type":"message:read","conversation_id":conversation_id,"reader_id":user.id})
    return {"ok":True}

@router.post("/uploads", status_code=201)
async def upload(file: UploadFile = File(...), conversation_id: str = Form(...),
                 user=Depends(current_user), db=Depends(get_db)):
    member(db,conversation_id,user)
    total_size = db.scalar(select(func.coalesce(func.sum(Attachment.size), 0)).where(Attachment.owner_id == user.id))
    if total_size >= 100 * 1024 * 1024:
        raise HTTPException(413,"Your image storage quota has been reached.")
    raw=await file.read(get_settings().upload_max_bytes+1)
    encoded=encode_image(raw)
    filename=uid()+".webp"
    ROOT.joinpath("storage","uploads",filename).write_bytes(encoded)
    item=Attachment(owner_id=user.id,conversation_id=conversation_id,filename=filename,mime_type="image/webp",size=len(encoded))
    db.add(item)
    db.commit()
    return {"id":item.id,"url":"/api/uploads/"+item.id,"size":item.size}

@router.get("/uploads/{attachment_id}")
def download(attachment_id: str,user=Depends(current_user),db=Depends(get_db)):
    item=db.get(Attachment,attachment_id)
    if not item:
        raise HTTPException(404,"Image could not be found.")
    member(db,item.conversation_id,user)
    if item.owner_id != user.id and not db.scalar(select(Message).where(Message.attachment_id==item.id)):
        raise HTTPException(404,"Image could not be found.")
    return FileResponse(ROOT.joinpath("storage","uploads",item.filename),media_type=item.mime_type,
        headers={"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"})

@router.get("/notifications")
def notifications(user=Depends(current_user),db=Depends(get_db)):
    # Older builds emitted a notification for every routine resource edit.
    # Remove only this account's recognizable CRUD noise, preserving messages/security.
    db.execute(delete(Notification).where(Notification.owner_id==user.id,
        or_(Notification.title.in_(("Signed in to your workspace","Workspace unlocked","Workspace locked","Welcome to your private workspace")),
            (Notification.kind.in_(("project","task","note","goal","learning","account"))) &
            or_(Notification.title.like("Created %"),Notification.title.like("Updated %"),Notification.title.like("Deleted %")))))
    db.commit()
    query=select(Notification).where(Notification.owner_id==user.id)
    items=db.scalars(query.order_by(Notification.created_at.desc()).limit(100)).all()
    return {"items":[view(i) for i in items],"unread":db.scalar(select(func.count()).select_from(Notification).where(
        Notification.owner_id==user.id,Notification.is_read==False))}

async def notification_changed(user_id):
    await hub.emit(user_id,{"type":"notification:changed"})

@router.post("/notifications/read-all")
async def read_all(user=Depends(current_user),db=Depends(get_db)):
    db.execute(update(Notification).where(Notification.owner_id==user.id).values(is_read=True))
    db.commit()
    await notification_changed(user.id)
    return {"ok":True}

@router.delete("/notifications")
async def clear_notifications(read_only: bool=False,user=Depends(current_user),db=Depends(get_db)):
    query=delete(Notification).where(Notification.owner_id==user.id)
    if read_only:query=query.where(Notification.is_read==True)
    result=db.execute(query);db.commit()
    await notification_changed(user.id)
    return {"ok":True,"deleted":result.rowcount}

@router.delete("/notifications/{notification_id}")
async def delete_notification(notification_id: str,user=Depends(current_user),db=Depends(get_db)):
    item=owned(db,Notification,notification_id,user)
    db.delete(item);db.commit()
    await notification_changed(user.id)
    return {"ok":True}

@router.post("/notifications/{notification_id}/read")
async def read_notification(notification_id: str,user=Depends(current_user),db=Depends(get_db)):
    item=owned(db,Notification,notification_id,user)
    item.is_read=True;db.commit()
    await notification_changed(user.id)
    return view(item)

@router.post("/realtime/ticket")
def ticket(identity=Depends(authenticated)):
    return {"ticket":hub.ticket(identity[0].id,identity[1].id)}

@router.websocket("/ws")
async def websocket(socket: WebSocket,ticket: str = ""):
    if socket.headers.get("origin") not in get_settings().origins:
        await socket.close(code=4403)
        return
    await hub.serve(socket,ticket)
