from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.schemas.section import SectionTreeResponse
from app.services import section_service

router = APIRouter(prefix="/projects", tags=["documents"])


@router.get("/{project_id}/document", response_model=SectionTreeResponse)
async def get_project_document_tree(
    project_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    document = await section_service.get_document_for_project(
        db, project_id, current_user.id
    )
    sections = await section_service.list_sections_for_project(
        db, project_id, current_user.id
    )
    tree = section_service.build_section_tree(sections)
    return SectionTreeResponse(document_id=document.id, sections=tree)
