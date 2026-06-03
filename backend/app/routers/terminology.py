from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel
from typing import List

from app.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
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
    project_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await terminology_service.check_terminology_consistency(db, project_id)

@router.post("/projects/{project_id}/resolve")
async def resolve_terminology(
    project_id: int,
    body: TerminologyResolveRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    count = await terminology_service.resolve_terminology(
        db, project_id, body.term_to_replace, body.correct_term
    )
    return {"message": f"Replaced {count} occurrences across sections."}
