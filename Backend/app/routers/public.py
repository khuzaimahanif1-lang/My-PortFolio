from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from ..core.database import get_db
from ..models import Project, User, PortfolioContent, ContactMessage, Notification
from ..schemas import ContactInput
from ..repositories.resources import view

router = APIRouter(prefix="/public", tags=["Public portfolio"])
@router.get("/profile")
def profile(db=Depends(get_db)):
    content = db.get(PortfolioContent, "profile")
    return content.data if content else {"name": "Khuzaima Hanif", "title": "AI Engineer · Full-Stack Developer",
        "bio": "Building thoughtful digital experiences at the intersection of AI and the web.",
        "skills": ["Angular", "TypeScript", "Python", "FastAPI", "MySQL", "Machine Learning"],
        "journey": [], "achievements": [], "vision": "Build. Learn. Grow.", "email": "", "github_url": "", "linkedin_url": ""}

def public_query():
    return select(Project).join(User, Project.owner_id == User.id).where(Project.is_public == True, Project.is_portfolio == True, User.role == "OWNER")

@router.get("/projects")
def projects(db=Depends(get_db)):
    return {"items": [{key: value for key, value in view(p).items() if key != "owner_id"}
                      for p in db.scalars(public_query().order_by(Project.created_at.desc())).all()]}

@router.get("/projects/{slug}")
def project(slug: str, db=Depends(get_db)):
    item = db.scalar(public_query().where(Project.slug == slug))
    if not item:
        raise HTTPException(404, "This public project could not be found.")
    result = view(item)
    result.pop("owner_id", None)
    return result

@router.post("/contact", status_code=201)
def contact(data: ContactInput, db=Depends(get_db)):
    item = ContactMessage(**data.model_dump())
    db.add(item)
    for owner in db.scalars(select(User).where(User.role=="OWNER")).all():
        db.add(Notification(owner_id=owner.id, title="New portfolio inquiry", body=data.name,
            kind="contact", link="/workspace/settings"))
    db.commit()
    return {"message": "Your message has been saved. Thank you for reaching out."}

