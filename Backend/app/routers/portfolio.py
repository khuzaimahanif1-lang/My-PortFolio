"""Owner-only editing of personal portfolio projects, including unpublished drafts."""
from fastapi import APIRouter
from ..dependencies import owner
from ..models import Project
from ..schemas import ProjectInput
from .workspace import register_resource

router = APIRouter(tags=["Portfolio editor"])
register_resource("portfolio/projects", Project, ProjectInput, "project", target_router=router,
                  user_dependency=owner, portfolio=True)
