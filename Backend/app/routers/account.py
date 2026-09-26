from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select,update
from ..core.database import get_db
from ..dependencies import current_user,authenticated,owner
from ..models import Session,User,PortfolioContent,ContactMessage
from ..schemas import ProfileInput,PreferencesInput,ChangePassword,PortfolioInput
from ..repositories.resources import view,log
from ..services.security import user_view,verify_password,hash_password
router=APIRouter(tags=["Account"])
@router.get("/account")
def account(user=Depends(current_user)):
    return user_view(user)
@router.put("/account/profile")
def profile(data: ProfileInput,user=Depends(current_user),db=Depends(get_db)):
    for key,value in data.model_dump().items():
        setattr(user,key,value)
    log(db,user,"Updated your profile","account",notify=False)
    db.commit()
    return user_view(user)
@router.put("/account/preferences")
def preferences(data: PreferencesInput,user=Depends(current_user),db=Depends(get_db)):
    user.preferences=data.model_dump()
    db.commit()
    return user_view(user)
@router.post("/account/password")
def password(data: ChangePassword,identity=Depends(authenticated),db=Depends(get_db)):
    user,session=identity
    if not verify_password(data.current_password,user.password_hash):
        raise HTTPException(400,"Current password is incorrect.")
    user.password_hash=hash_password(data.password)
    db.execute(update(Session).where(Session.user_id==user.id,Session.id!=session.id).values(revoked=True))
    log(db,user,"Changed password and signed out other sessions","security",notify=True)
    db.commit()
    return {"message":"Password changed. Other sessions have been signed out."}
@router.get("/account/sessions")
def sessions(identity=Depends(authenticated),db=Depends(get_db)):
    user,current=identity
    records=db.scalars(select(Session).where(Session.user_id==user.id,Session.revoked==False).order_by(Session.created_at.desc())).all()
    return {"items":[{**view(s),"current":s.id==current.id} for s in records]}
@router.delete("/account/sessions/{session_id}")
def revoke(session_id: str,identity=Depends(authenticated),db=Depends(get_db)):
    user,current=identity
    item=db.get(Session,session_id)
    if not item or item.user_id!=user.id:
        raise HTTPException(404,"Session could not be found.")
    item.revoked=True
    db.commit()
    return {"ok":True,"current":item.id==current.id}
@router.get("/owner/content")
def content(user=Depends(owner),db=Depends(get_db)):
    item=db.get(PortfolioContent,"profile")
    return item.data if item else {}
@router.put("/owner/content")
def update_content(data: PortfolioInput,user=Depends(owner),db=Depends(get_db)):
    item=db.get(PortfolioContent,"profile")
    if not item:
        item=PortfolioContent(key="profile")
        db.add(item)
    item.data=data.model_dump()
    log(db,user,"Updated public portfolio content","portfolio")
    db.commit()
    return item.data
@router.get("/owner/contacts")
def contacts(user=Depends(owner),db=Depends(get_db)):
    records=db.scalars(select(ContactMessage).order_by(ContactMessage.created_at.desc()).limit(100)).all()
    return {"items":[view(i) for i in records]}

