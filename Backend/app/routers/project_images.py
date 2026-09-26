from fastapi import APIRouter,Depends,HTTPException,UploadFile,File
from fastapi.responses import FileResponse
from ..core.database import get_db
from ..core.config import get_settings
from ..dependencies import current_user,authenticated,bearer
from ..models import Project,User,uid,now
from ..repositories.resources import owned,view,log
from ..services.images import encode_image,project_path,IMAGE_NAME
router=APIRouter(tags=["Project screenshots"])
@router.post("/projects/{project_id}/screenshots",status_code=201)
async def upload(project_id:str,file:UploadFile=File(...),user=Depends(current_user),db=Depends(get_db)):
    project=owned(db,Project,project_id,user)
    if len(project.screenshots)>=12:raise HTTPException(413,"A project can contain up to 12 screenshots.")
    encoded=encode_image(await file.read(get_settings().upload_max_bytes+1))
    filename=uid()+".webp";path=project_path(project.id,filename)
    path.parent.mkdir(parents=True,exist_ok=True);path.write_bytes(encoded)
    project.screenshots=project.screenshots+["/api/project-images/"+project.id+"/"+filename]
    project.updated_at=now();log(db,user,"Added screenshot to "+project.name,"project",project.id)
    try:db.commit()
    except Exception:
        db.rollback();path.unlink(missing_ok=True);raise
    return view(project)
@router.get("/project-images/{project_id}/{filename}")
def download(project_id:str,filename:str,credentials=Depends(bearer),db=Depends(get_db)):
    project=db.get(Project,project_id)
    if not project or not IMAGE_NAME.fullmatch(filename) or "/api/project-images/"+project_id+"/"+filename not in project.screenshots:raise HTTPException(404,"Screenshot could not be found.")
    owner=db.get(User,project.owner_id)
    if not (project.is_public and project.is_portfolio and owner and owner.role=="OWNER"):
        user,_=authenticated(credentials,db)
        if user.id!=project.owner_id:raise HTTPException(404,"Screenshot could not be found.")
    path=project_path(project.id,filename)
    if not path.is_file():raise HTTPException(404,"Screenshot could not be found.")
    return FileResponse(path,media_type="image/webp",headers={"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"})
@router.delete("/projects/{project_id}/screenshots/{filename}")
def remove(project_id:str,filename:str,user=Depends(current_user),db=Depends(get_db)):
    project=owned(db,Project,project_id,user);url="/api/project-images/"+project_id+"/"+filename
    if not IMAGE_NAME.fullmatch(filename) or url not in project.screenshots:raise HTTPException(404,"Screenshot could not be found.")
    project.screenshots=[image for image in project.screenshots if image!=url];project.updated_at=now()
    log(db,user,"Removed screenshot from "+project.name,"project",project.id);db.commit()
    project_path(project.id,filename).unlink(missing_ok=True)
    return view(project)

