from datetime import timedelta
import secrets
from fastapi import APIRouter, Depends, HTTPException
from pydantic import Field
from typing import Literal
from sqlalchemy import select, or_, func, update
from ..core.database import get_db
from ..core.config import get_settings
from ..dependencies import current_user, authenticated
from ..models import User, CallSession, Session, now
from ..schemas import Input
from ..services.security import digest
from ..websocket.hub import hub

router = APIRouter(prefix='/calls', tags=['Calls and desktop collaboration'])
TERMINAL = ('ENDED', 'DECLINED', 'EXPIRED')

class CallInput(Input):
    kind: Literal['AUDIO', 'VIDEO', 'DESKTOP']
    user_id: str | None = Field(default=None, min_length=36, max_length=36)

class JoinInput(Input):
    code: str = Field(min_length=8, max_length=12)

class SignalInput(Input):
    type: Literal['offer', 'answer', 'candidate']
    sdp: str = Field(default='', max_length=100000)
    candidate: dict | None = None

class ControlInput(Input):
    enabled: bool

def find(db, call_id, user):
    call = db.get(CallSession, call_id)
    if not call or user.id not in (call.initiator_id, call.recipient_id):
        raise HTTPException(404, 'Session could not be found.')
    if call.state not in TERMINAL and (call.expires_at<=now() or not hub.active(call.initiator_session_id) or call.recipient_session_id and not hub.active(call.recipient_session_id)):
        call.state='EXPIRED' if call.expires_at<=now() else 'ENDED';call.control_allowed=False;call.code_hash=None;call.ended_at=now();db.commit()
    return call

def call_view(db, call):
    host = db.get(User, call.initiator_id)
    other = db.get(User, call.recipient_id) if call.recipient_id else None
    return {'id': call.id, 'kind': call.kind, 'state': call.state,
        'initiator': {'id': host.id, 'full_name': host.full_name},
        'recipient': {'id': other.id, 'full_name': other.full_name} if other else None,
        'control_allowed': call.control_allowed, 'created_at': call.created_at,
        'expires_at': call.expires_at, 'ended_at': call.ended_at}

async def changed(db, call, event='call:changed'):
    body = {'type': event, 'call': call_view(db, call)}
    for uid in (call.initiator_id, call.recipient_id):
        if uid: await hub.emit(uid, body)

@router.get('/config')
def config(user=Depends(current_user)):
    settings = get_settings()
    servers = [{'urls': url.strip()} for url in settings.webrtc_stun_urls.split(',') if url.strip()]
    if settings.webrtc_turn_url and settings.webrtc_turn_username and settings.webrtc_turn_password:
        servers.append({'urls': settings.webrtc_turn_url, 'username': settings.webrtc_turn_username, 'credential': settings.webrtc_turn_password})
    relay_configured = bool(settings.webrtc_turn_url and settings.webrtc_turn_username and settings.webrtc_turn_password)
    relay_host = settings.webrtc_turn_url.split(':', 1)[-1].lstrip('/').split('?')[0]
    relay_local = relay_host.startswith(('127.', 'localhost:', '[::1]:'))
    return {'ice_servers': servers, 'relay_configured': relay_configured, 'relay_local': relay_configured and relay_local}

@router.get('')
def history(user=Depends(current_user), db=Depends(get_db)):
    calls = db.scalars(select(CallSession).where(or_(CallSession.initiator_id == user.id, CallSession.recipient_id == user.id)).order_by(CallSession.created_at.desc()).limit(40)).all()
    for call in calls:
        if call.state not in TERMINAL and call.expires_at <= now(): call.state = 'EXPIRED'; call.control_allowed = False
    db.commit()
    return {'items': [call_view(db, call) for call in calls]}

@router.post('', status_code=201)
async def create(data: CallInput, identity=Depends(authenticated), db=Depends(get_db)):
    user, session = identity
    from ..services.security import require_unlocked
    require_unlocked(session)
    count = db.scalar(select(func.count()).select_from(CallSession).where(CallSession.initiator_id == user.id, CallSession.state.not_in(TERMINAL), CallSession.expires_at > now()))
    if count >= 3: raise HTTPException(409, 'End an existing session before starting another.')
    if data.user_id == user.id or (data.user_id and not db.get(User, data.user_id)):
        raise HTTPException(400, 'Choose another workspace member.')
    code = ''.join(secrets.choice('ABCDEFGHJKLMNPQRSTUVWXYZ23456789') for _ in range(8))
    call = CallSession(initiator_id=user.id, initiator_session_id=session.id, recipient_id=data.user_id,
        kind=data.kind, state='RINGING' if data.user_id else 'WAITING', code_hash=digest(code), expires_at=now()+timedelta(minutes=10))
    db.add(call); db.commit()
    await changed(db, call, 'call:invite' if data.user_id else 'call:changed')
    return {**call_view(db, call), 'code': code}

@router.post('/join')
async def join(data: JoinInput, identity=Depends(authenticated), db=Depends(get_db)):
    user, session = identity
    from ..services.security import require_unlocked
    require_unlocked(session)
    code = data.code.upper().replace('-', '').replace(' ', '')
    call = db.scalar(select(CallSession).where(CallSession.code_hash == digest(code)))
    if not call or call.state != 'WAITING' or call.expires_at <= now():
        raise HTTPException(404, 'This code is invalid, expired, or already in use.')
    if call.initiator_id == user.id: raise HTTPException(400, 'Open the code from a different account on the other computer.')
    claimed=db.execute(update(CallSession).where(CallSession.id==call.id,CallSession.state=='WAITING',CallSession.expires_at>now()).values(recipient_id=user.id,recipient_session_id=session.id,state='REQUESTED'))
    if claimed.rowcount!=1: raise HTTPException(409, 'This code has already been claimed.')
    db.commit(); db.refresh(call); await changed(db, call, 'call:invite')
    return call_view(db, call)

@router.get('/{call_id}')
def detail(call_id: str, user=Depends(current_user), db=Depends(get_db)):
    return call_view(db, find(db, call_id, user))

@router.post('/{call_id}/accept')
async def accept(call_id: str, identity=Depends(authenticated), db=Depends(get_db)):
    user, session = identity
    from ..services.security import require_unlocked
    require_unlocked(session)
    call = find(db, call_id, user)
    if call.state == 'RINGING' and user.id == call.recipient_id:
        recipient_session_id = session.id
    elif call.state == 'REQUESTED' and user.id == call.initiator_id and session.id == call.initiator_session_id:
        pass
    else: raise HTTPException(409, 'Only the invited person or sharing host can approve this request.')
    claimed=db.execute(update(CallSession).where(CallSession.id==call.id,CallSession.state==call.state).values(state='ACTIVE',code_hash=None,recipient_session_id=recipient_session_id if call.state=='RINGING' else call.recipient_session_id,expires_at=now()+timedelta(hours=2)))
    if claimed.rowcount!=1:raise HTTPException(409,'This request has already been answered.')
    db.commit();db.refresh(call);await changed(db, call)
    return call_view(db, call)

@router.post('/{call_id}/end')
async def end(call_id: str, user=Depends(current_user), db=Depends(get_db)):
    call = find(db, call_id, user)
    if call.state not in TERMINAL:
        call.state = 'DECLINED' if call.state in ('RINGING', 'REQUESTED') else 'ENDED'
        call.control_allowed = False; call.code_hash = None; call.ended_at = now(); db.commit(); await changed(db, call)
    return call_view(db, call)

@router.post('/{call_id}/control')
async def control(call_id: str, data: ControlInput, identity=Depends(authenticated), db=Depends(get_db)):
    user, session = identity
    from ..services.security import require_unlocked
    require_unlocked(session)
    call = find(db, call_id, user)
    if call.kind != 'DESKTOP' or call.state != 'ACTIVE' or call.initiator_id != user.id or call.initiator_session_id != session.id:
        raise HTTPException(403, 'Only the sharing host can change desktop control.')
    call.control_allowed = data.enabled; db.commit(); await changed(db, call)
    return call_view(db, call)

@router.post('/{call_id}/signal')
async def signal(call_id: str, data: SignalInput, identity=Depends(authenticated), db=Depends(get_db)):
    user, session = identity
    from ..services.security import require_unlocked
    require_unlocked(session)
    call = find(db, call_id, user)
    if call.state != 'ACTIVE': raise HTTPException(409, 'Both people must approve before connecting.')
    expected = call.initiator_session_id if user.id == call.initiator_id else call.recipient_session_id
    if session.id != expected: raise HTTPException(403, 'This call is active in a different browser session.')
    if data.type=='offer' and user.id!=call.initiator_id or data.type=='answer' and user.id!=call.recipient_id:raise HTTPException(403,'Only the designated peer can send this session description.')
    if data.type in ('offer', 'answer') and not data.sdp: raise HTTPException(422, 'A session description is required.')
    if data.type == 'candidate':
        import json
        if not data.candidate or len(json.dumps(data.candidate)) > 4096: raise HTTPException(422, 'Invalid ICE candidate.')
        if set(data.candidate)-{'candidate','sdpMid','sdpMLineIndex','usernameFragment'}: raise HTTPException(422, 'Invalid ICE candidate fields.')
    other = call.recipient_id if user.id == call.initiator_id else call.initiator_id
    other_session = call.recipient_session_id if user.id == call.initiator_id else call.initiator_session_id
    await hub.emit_session(other, other_session, {'type': 'call:signal', 'call_id': call.id, 'sender_id': user.id, 'signal': data.model_dump()})
    return {'ok': True}

