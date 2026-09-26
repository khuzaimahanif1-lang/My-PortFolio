from fastapi import HTTPException
from sqlalchemy import select
from ..models import Activity, Notification, now

def owned(db, model, resource_id, user):
    resource = db.scalar(select(model).where(model.id == resource_id, model.owner_id == user.id))
    if not resource:
        raise HTTPException(404, "This resource could not be found.")
    return resource

def view(resource):
    return {column.name: getattr(resource, column.name) for column in resource.__table__.columns
        if column.name not in ("password_hash", "token_hash", "pair_key")}

def log(db, user, action, kind="", resource_id="", notify=False):
    db.add(Activity(owner_id=user.id, action=action[:200], resource_type=kind, resource_id=resource_id))
    if notify:
        db.add(Notification(owner_id=user.id, title=action[:200], kind=kind or "activity",
            link="/workspace/" + {"project": "projects", "task": "tasks", "note": "notes", "goal": "goals"}.get(kind, "notifications")))

