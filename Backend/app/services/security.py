import hashlib
import secrets
from datetime import timedelta
from jose import jwt
from passlib.context import CryptContext
from fastapi import HTTPException, Response, Request
from sqlalchemy import select, update
from ..models import User, Session, RefreshToken, CallSession, now
from ..core.config import get_settings

passwords = CryptContext(schemes=["bcrypt"], deprecated="auto", bcrypt__rounds=12)
settings = get_settings()

def hash_password(value):
    return passwords.hash(value)

def verify_password(value, digest):
    try:
        return passwords.verify(value, digest)
    except (ValueError, TypeError):
        return False

def digest(value):
    return hashlib.sha256(value.encode()).hexdigest()

def user_view(user):
    return {key: getattr(user, key) for key in
        ("id", "full_name", "email", "role", "bio", "title", "location", "avatar_url", "preferences", "created_at")}

def access_token(user, session):
    return jwt.encode({"sub": user.id, "sid": session.id, "type": "access",
        "exp": now() + timedelta(minutes=settings.access_minutes)}, settings.jwt_secret, algorithm="HS256")

def set_cookie(response, raw, session):
    response.set_cookie("king_refresh", raw, httponly=True, secure=settings.cookie_secure,
        samesite="lax", path="/api/auth",
        max_age=settings.refresh_days * 86400 if session.remember else None)

def rotate(db, response, user, session):
    raw = secrets.token_urlsafe(48)
    db.add(RefreshToken(token_hash=digest(raw), session_id=session.id, expires_at=session.expires_at))
    session.last_seen = now()
    db.commit()
    set_cookie(response, raw, session)
    return {"access_token": access_token(user, session), "token_type": "bearer",
        "expires_in": settings.access_minutes * 60, "user": user_view(user),
        "unlock_until": session.unlock_until.isoformat() + "Z"}

def new_session(db, response, request, user, remember=False):
    # A browser cookie identifies one account. Revoke the replaced session so
    # another tab cannot continue using a bearer token from the previous account.
    raw = request.cookies.get("king_refresh")
    previous = db.get(RefreshToken, digest(raw)) if raw else None
    if previous:
        old = db.get(Session, previous.session_id)
        if old:
            old.revoked = True
            db.execute(update(CallSession).where((CallSession.initiator_session_id==old.id)|(CallSession.recipient_session_id==old.id)).values(state="ENDED",control_allowed=False,code_hash=None,ended_at=now()))
    session = Session(user_id=user.id, expires_at=now() + timedelta(days=settings.refresh_days if remember else 1),
        unlock_until=now() + timedelta(hours=settings.workspace_hours), remember=remember,
        device=request.headers.get("user-agent", "Browser")[:250])
    db.add(session)
    db.flush()
    return rotate(db, response, user, session)

def cookie_session(db, request, allow_used=False):
    raw = request.cookies.get("king_refresh")
    token = db.get(RefreshToken, digest(raw)) if raw else None
    if not token or token.expires_at <= now():
        raise HTTPException(401, "Your session has expired. Please sign in.")
    session = db.get(Session, token.session_id)
    if not session or session.revoked or session.expires_at <= now():
        raise HTTPException(401, "Your session has expired. Please sign in.")
    if token.used and not allow_used:
        session.revoked = True
        db.commit()
        raise HTTPException(401, "Session revoked after refresh token reuse.")
    user = db.get(User, session.user_id)
    return user, session, token

def consume_refresh(db, token):
    result = db.execute(update(RefreshToken).where(
        RefreshToken.token_hash == token.token_hash, RefreshToken.used == False).values(used=True))
    if result.rowcount != 1:
        raise HTTPException(401, "Refresh token already used.")

def require_unlocked(session):
    if session.locked or session.unlock_until <= now():
        raise HTTPException(423, "Your workspace is locked. Enter your password to continue.")

