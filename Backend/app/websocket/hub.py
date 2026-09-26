import asyncio
import secrets
import time
import logging
from fastapi import WebSocket, WebSocketDisconnect
from fastapi.encoders import jsonable_encoder
from sqlalchemy import select
from ..core.database import SessionLocal
from ..models import Session, ConversationMember, now

class Hub:
    def __init__(self):
        self.connections = {}
        self.tickets = {}

    def ticket(self, user_id, session_id):
        self.tickets = {k:v for k,v in self.tickets.items() if v[2] > time.time()}
        raw = secrets.token_urlsafe(32)
        self.tickets[raw] = (user_id, session_id, time.time()+30)
        return raw

    async def deliver(self, socket, lock, event):
        async with lock:
            await socket.send_json(jsonable_encoder(event))

    async def emit_session(self, user_id, session_id, event):
        await self.emit(user_id, event, session_id)

    async def emit(self, user_id, event, target_session=None):
        failed = []
        for socket, (session_id, loop, lock) in tuple(self.connections.get(user_id, {}).items()):
            if target_session and session_id != target_session:
                continue
            try:
                if not self.active(session_id):
                    failed.append(socket)
                    continue
                operation = self.deliver(socket, lock, event)
                if loop is asyncio.get_running_loop():
                    await operation
                else:
                    await asyncio.wrap_future(asyncio.run_coroutine_threadsafe(operation, loop))
            except WebSocketDisconnect:
                failed.append(socket)
            except Exception:
                logging.getLogger(__name__).exception('Live event delivery failed')
                failed.append(socket)
        for socket in failed:
            self.connections.get(user_id, {}).pop(socket, None)

    async def broadcast(self, event):
        for user_id in tuple(self.connections):
            await self.emit(user_id, event)

    def active(self, session_id):
        with SessionLocal() as db:
            session = db.get(Session, session_id)
            return bool(session and not session.revoked and not session.locked
                and session.expires_at > now() and session.unlock_until > now())

    async def serve(self, socket: WebSocket, ticket):
        identity = self.tickets.pop(ticket, None)
        if not identity or identity[2] <= time.time() or not self.active(identity[1]):
            await socket.close(code=4401)
            return
        user_id, session_id, _ = identity
        await socket.accept()
        was_online = bool(self.connections.get(user_id))
        self.connections.setdefault(user_id, {})[socket] = (session_id, asyncio.get_running_loop(), asyncio.Lock())
        await socket.send_json({"type":"connection", "online_users": [uid for uid, sockets in self.connections.items() if sockets]})
        if not was_online:
            await self.broadcast({"type":"user:online", "user_id":user_id})
        last_typing = 0
        try:
            while True:
                if not self.active(session_id):
                    await socket.close(code=4423)
                    break
                try:
                    data = await asyncio.wait_for(socket.receive_json(), timeout=15)
                except asyncio.TimeoutError:
                    await socket.send_json({"type":"heartbeat"})
                    continue
                if not self.active(session_id):
                    await socket.close(code=4423)
                    break
                if data.get("type") not in ("message:typing", "message:stop_typing") or time.monotonic()-last_typing < .15:
                    continue
                last_typing = time.monotonic()
                conversation_id = str(data.get("conversation_id", ""))[:36]
                with SessionLocal() as db:
                    if not db.get(ConversationMember, (conversation_id,user_id)):
                        continue
                    members = db.scalars(select(ConversationMember.user_id).where(
                        ConversationMember.conversation_id == conversation_id)).all()
                for member in members:
                    if member != user_id:
                        await self.emit(member, {"type":data["type"],"conversation_id":conversation_id,"user_id":user_id})
        except Exception:
            pass
        finally:
            self.connections.get(user_id, {}).pop(socket, None)
            if not self.connections.get(user_id):
                self.connections.pop(user_id, None)
                await self.broadcast({"type":"user:offline", "user_id":user_id})

hub = Hub()



