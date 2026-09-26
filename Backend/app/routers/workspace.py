from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, func
from sqlalchemy.exc import IntegrityError
from ..core.database import get_db
from ..dependencies import current_user
from ..models import Project, Task, Note, Goal, LearningEntry, now
from ..schemas import ProjectInput, TaskInput, NoteInput, GoalInput, CommentInput, LearningInput
from ..repositories.resources import owned, view, log

from ..services.images import remove_project_images

router = APIRouter(tags=["Workspace"])
RESOURCES = {"projects": (Project, ProjectInput, "project"), "tasks": (Task, TaskInput, "task"),
    "notes": (Note, NoteInput, "note"), "goals": (Goal, GoalInput, "goal")}

def validate_relations(db, user, kind, data):
    if kind == "project" and data.get("is_public") and user.role != "OWNER":
        raise HTTPException(403, "Only the portfolio owner can publish projects.")
    if kind == "project" and data.get("is_public"):
        data["is_portfolio"] = True
    if kind == "task" and data.get("project_id"):
        owned(db, Project, data["project_id"], user)
    if kind == "task" and data.get("status") == "COMPLETED":
        data["progress"] = 100

def register_resource(path, model, schema, kind, *, target_router=router, user_dependency=current_user, portfolio=False):
    def resource_for(db, resource_id, user):
        resource = owned(db, model, resource_id, user)
        if portfolio and not resource.is_portfolio:
            raise HTTPException(404, "This portfolio project could not be found.")
        return resource
    def listing(q: str = Query("", max_length=100), status: str = "", page: int = Query(1, ge=1),
                limit: int = Query(50, ge=1, le=100), user=Depends(user_dependency), db=Depends(get_db)):
        query = select(model).where(model.owner_id == user.id)
        if portfolio:
            query = query.where(Project.is_portfolio == True)
        label = model.name if model is Project else model.title
        if q:
            query = query.where(label.ilike("%" + q.replace("%", "\\%").replace("_", "\\_") + "%", escape="\\"))
        if status and hasattr(model, "status"):
            query = query.where(model.status == status)
        total = db.scalar(select(func.count()).select_from(query.subquery()))
        records = db.scalars(query.order_by(model.updated_at.desc()).offset((page-1)*limit).limit(limit)).all()
        return {"items": [view(x) for x in records], "total": total, "page": page}

    def get_one(resource_id: str, user=Depends(user_dependency), db=Depends(get_db)):
        return view(resource_for(db, resource_id, user))

    def create(data, user=Depends(user_dependency), db=Depends(get_db)):
        values = data.model_dump()
        validate_relations(db, user, kind, values)
        if portfolio:
            values["is_portfolio"] = True
        resource = model(owner_id=user.id, **values)
        db.add(resource)
        try:
            db.flush()
            label = values.get("name", values.get("title", kind))
            log(db, user, "Created " + label, kind, resource.id)
            db.commit()
        except IntegrityError:
            db.rollback()
            raise HTTPException(409, "A project with this URL slug already exists. Choose another slug.")
        return view(resource)

    def update_one(resource_id: str, data, user=Depends(user_dependency), db=Depends(get_db)):
        resource = resource_for(db, resource_id, user)
        previous_images=list(resource.screenshots) if kind=='project' else []
        values = data.model_dump()
        validate_relations(db, user, kind, values)
        for key, value in values.items():
            setattr(resource, key, value)
        try:
            log(db, user, "Updated " + values.get("name", values.get("title", kind)), kind, resource.id, notify=False)
            db.commit()
        except IntegrityError:
            db.rollback()
            raise HTTPException(409, "A project with this URL slug already exists. Choose another slug.")
        if kind=="project":remove_project_images(resource,resource.screenshots,previous_images)
        return view(resource)

    def delete_one(resource_id: str, user=Depends(user_dependency), db=Depends(get_db)):
        resource = resource_for(db, resource_id, user)
        log(db, user, "Deleted " + getattr(resource, "name", getattr(resource, "title", kind)), kind, resource.id)
        db.delete(resource)
        db.commit()
        if kind=="project":remove_project_images(resource)
        return {"ok": True}

    create.__annotations__["data"] = schema
    update_one.__annotations__["data"] = schema
    for endpoint, method, suffix in [(listing, "GET", ""), (create, "POST", ""),
        (get_one, "GET", "/{resource_id}"), (update_one, "PUT", "/{resource_id}"), (delete_one, "DELETE", "/{resource_id}")]:
        endpoint.__name__ = kind + "_" + endpoint.__name__
        target_router.add_api_route("/" + path + suffix, endpoint, methods=[method], status_code=201 if method=="POST" else 200)

for path, (model, schema, kind) in RESOURCES.items():
    register_resource(path, model, schema, kind)

@router.post("/tasks/{resource_id}/comments", status_code=201)
def comment(resource_id: str, data: CommentInput, user=Depends(current_user), db=Depends(get_db)):
    task = owned(db, Task, resource_id, user)
    task.comments = task.comments + [{"content": data.content, "author": user.full_name, "created_at": now().isoformat()+"Z"}]
    log(db, user, "Commented on " + task.title, "task", task.id, notify=False)
    db.commit()
    return view(task)

@router.post("/learning", status_code=201)
def learning(data: LearningInput, user=Depends(current_user), db=Depends(get_db)):
    entry = LearningEntry(owner_id=user.id, **data.model_dump())
    db.add(entry)
    log(db, user, f"Logged {data.minutes} minutes: {data.topic}", "learning", notify=False)
    db.commit()
    return view(entry)

