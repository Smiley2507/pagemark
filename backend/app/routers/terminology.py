from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel
from typing import List

from app.database import get_db
from app.dependencies import get_current_user, verify_project_ownership, require_project
from app.models.user import User
from app.models.project import Project
from app.authz import CONTENT_WRITE
from app.services import terminology_service

router = APIRouter(prefix="/terminology", tags=["terminology"])

class TerminologyConflict(BaseModel):
    term_a: str
    term_b: str
    conflicts: List[dict]

class TerminologyResolveRequest(BaseModel):
    term_to_replace: str
    correct_term: str

@router.get("/projects/{project_id}/check", response_model=List[TerminologyConflict])
async def check_terminology(
    project: Project = Depends(verify_project_ownership),
    db: AsyncSession = Depends(get_db),
):
    return await terminology_service.check_terminology_consistency(db, project.id)

@router.post("/projects/{project_id}/resolve")
async def resolve_terminology(
    body: TerminologyResolveRequest,
    project: Project = Depends(require_project(CONTENT_WRITE)),
    db: AsyncSession = Depends(get_db),
):
    count = await terminology_service.resolve_terminology(
        db, project.id, body.term_to_replace, body.correct_term
    )
    return {"message": f"Replaced {count} occurrences across sections."}
