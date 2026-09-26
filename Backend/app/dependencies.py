from fastapi import Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt, JWTError
from .core.database import get_db
from .core.config import get_settings
from .models import User, Session, now
from .services.security import require_unlocked

bearer = HTTPBearer(auto_error=False)

def authenticated(credentials: HTTPAuthorizationCredentials = Depends(bearer), db=Depends(get_db)):
    if not credentials:
        raise HTTPException(401, "Sign in to continue.")
    try:
        data = jwt.decode(credentials.credentials, get_settings().jwt_secret, algorithms=["HS256"])
        if data.get("type") != "access":
            raise JWTError()
        session = db.get(Session, data["sid"])
        user = db.get(User, data["sub"])
        if not session or not user or session.user_id != user.id or session.revoked or session.expires_at <= now():
            raise JWTError()
        require_unlocked(session)
        return user, session
    except (JWTError, KeyError):
        raise HTTPException(401, "Your access token has expired.")

def current_user(identity=Depends(authenticated)):
    return identity[0]

def owner(user=Depends(current_user)):
    if user.role != "OWNER":
        raise HTTPException(403, "Only the portfolio owner can publish portfolio content.")
    return user

