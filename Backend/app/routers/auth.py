from datetime import timedelta
import secrets
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from sqlalchemy import select, update
from ..core.database import get_db
from ..dependencies import authenticated
from ..models import User, Session, ResetToken, now
from ..schemas import Signup, Login, PasswordInput, Recovery, Reset, Input
from pydantic import Field

class RefreshInput(Input):
    user_id: str | None = Field(default=None, min_length=36, max_length=36)

class UnlockInput(PasswordInput):
    user_id: str | None = Field(default=None, min_length=36, max_length=36)
from ..services.security import (hash_password, verify_password, new_session, cookie_session,
    consume_refresh, require_unlocked, rotate, digest, user_view)
from ..repositories.resources import log
from ..services.mail import send_reset

router = APIRouter(prefix="/auth", tags=["Authentication"])

@router.post("/signup", status_code=201)
def signup(data: Signup, request: Request, response: Response, db=Depends(get_db)):
    email = str(data.email).lower()
    if db.scalar(select(User).where(User.email == email)):
        raise HTTPException(409, "An account with this email already exists.")
    user = User(full_name=data.full_name.strip(), email=email, password_hash=hash_password(data.password))
    db.add(user)
    db.flush()
    log(db, user, "Welcome to your private workspace", "account")
    return new_session(db, response, request, user)

@router.post("/login")
def login(data: Login, request: Request, response: Response, db=Depends(get_db)):
    user = db.scalar(select(User).where(User.email == str(data.email).lower()))
    if not user or not verify_password(data.password, user.password_hash):
        raise HTTPException(401, "Email or password is incorrect.")
    log(db, user, "Signed in to your workspace", "security", notify=False)
    return new_session(db, response, request, user, data.remember)

@router.get("/session")
def session(request: Request, db=Depends(get_db)):
    try:
        user, session, _ = cookie_session(db, request, allow_used=True)
    except HTTPException as error:
        if error.status_code == 401:
            return {"authenticated": False, "user": None, "locked": False}
        raise
    return {"authenticated": True, "user": user_view(user), "locked": session.locked or session.unlock_until <= now()}

@router.post("/refresh")
def refresh(request: Request, response: Response, data: RefreshInput | None = None, db=Depends(get_db)):
    user, session, token = cookie_session(db, request)
    if data and data.user_id and data.user_id != user.id:
        raise HTTPException(409, "The account changed in another tab. Please sign in again.")
    require_unlocked(session)
    consume_refresh(db, token)
    return rotate(db, response, user, session)

@router.post("/unlock")
def unlock(data: UnlockInput, request: Request, response: Response, db=Depends(get_db)):
    user, session, token = cookie_session(db, request)
    if data.user_id and data.user_id != user.id:
        raise HTTPException(409, "The account changed. Please sign in again.")
    if not verify_password(data.password, user.password_hash):
        raise HTTPException(401, "Password is incorrect.")
    consume_refresh(db, token)
    from ..core.config import get_settings
    session.locked = False
    session.unlock_until = now() + timedelta(hours=get_settings().workspace_hours)
    log(db, user, "Workspace unlocked", "security", notify=False)
    return rotate(db, response, user, session)

@router.post("/lock")
def lock(identity=Depends(authenticated), db=Depends(get_db)):
    user, session = identity
    db.execute(update(Session).where(Session.user_id==user.id,Session.revoked==False,Session.expires_at>now()).values(locked=True))
    log(db, user, "Workspace locked", "security", notify=False)
    db.commit()
    return {"ok": True}

@router.post("/logout")
def logout(request: Request, response: Response, db=Depends(get_db)):
    try:
        _, session, _ = cookie_session(db, request, allow_used=True)
        session.revoked = True
        db.commit()
    except HTTPException:
        pass
    response.delete_cookie("king_refresh", path="/api/auth")
    return {"ok": True}

@router.post("/forgot-password")
def forgot(data: Recovery, db=Depends(get_db)):
    user = db.scalar(select(User).where(User.email == str(data.email).lower()))
    if user:
        db.execute(update(ResetToken).where(ResetToken.user_id == user.id).values(used=True))
        raw = secrets.token_urlsafe(48)
        db.add(ResetToken(token_hash=digest(raw), user_id=user.id, expires_at=now() + timedelta(minutes=20)))
        db.commit()
        send_reset(user.email, raw)
    return {"message": "If that account exists, password reset instructions have been sent."}

@router.post("/reset-password")
def reset(data: Reset, db=Depends(get_db)):
    token = db.get(ResetToken, digest(data.token))
    if not token or token.used or token.expires_at <= now():
        raise HTTPException(400, "This reset link has expired or has already been used.")
    consumed = db.execute(update(ResetToken).where(ResetToken.token_hash == token.token_hash,
        ResetToken.used == False).values(used=True))
    if consumed.rowcount != 1:
        raise HTTPException(400, "This reset link has already been used.")
    user = db.get(User, token.user_id)
    user.password_hash = hash_password(data.password)
    db.execute(update(Session).where(Session.user_id == user.id).values(revoked=True))
    log(db, user, "Password reset; existing sessions signed out", "security", notify=True)
    db.commit()
    return {"message": "Password reset. You can now sign in."}

