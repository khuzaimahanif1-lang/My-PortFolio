from fastapi import APIRouter,Depends,Query
from sqlalchemy import select,or_
from ..core.database import get_db
from ..dependencies import current_user
from ..models import Project,Task,Note,Goal,Message,ConversationMember
router=APIRouter(tags=["Search"])
@router.get("/search")
def search(q: str = Query(...,min_length=2,max_length=100),user=Depends(current_user),db=Depends(get_db)):
    term="%"+q.replace("%","\\%").replace("_","\\_")+"%"
    results=[]
    for model,kind,path in [(Project,"Project","projects"),(Task,"Task","tasks"),(Note,"Note","notes"),(Goal,"Goal","goals")]:
        label=model.name if model is Project else model.title
        content=model.description if model in (Project,Task,Goal) else model.content
        query=select(model).where(model.owner_id==user.id,or_(label.ilike(term,escape="\\"),content.ilike(term,escape="\\")))
        if model is Project:
            query=select(model).where(model.owner_id==user.id,or_(label.ilike(term,escape="\\"),content.ilike(term,escape="\\"),
                Project.documentation.ilike(term,escape="\\")))
        for item in db.scalars(query.limit(10)).all():
            results.append({"id":item.id,"title":getattr(item,"name",getattr(item,"title","")),"kind":kind,
                "link":"/workspace/"+path+("/"+item.id if model is Project else "")})
    messages=db.scalars(select(Message).join(ConversationMember,
        Message.conversation_id==ConversationMember.conversation_id).where(ConversationMember.user_id==user.id,
        Message.content.ilike(term,escape="\\")).limit(10)).all()
    results.extend({"id":m.id,"title":m.content[:100],"kind":"Message","link":"/workspace/messages"} for m in messages)
    return {"items":results}
