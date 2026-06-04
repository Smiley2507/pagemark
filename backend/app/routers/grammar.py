"""
grammar.py — API router for grammar/spelling checking.

POST /projects/{id}/grammar/check  → check text grammar via LanguageTool
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.database import get_db
from app.dependencies import get_current_user
from app.models.project import Project
from app.models.organization import OrgMemberStatus, OrganizationMember
from app.schemas.grammar import GrammarCheckRequest, GrammarCheckResponse
from app.services.grammar_service import check_grammar

router = APIRouter(prefix="/projects", tags=["grammar"])


async def _get_project_or_404(project_id: int, db: AsyncSession, user) -> Project:
    result = await db.execute(
        select(Project).where(
            Project.id == project_id,
            Project.deleted_at.is_(None),
        )
    )
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    member_res = await db.execute(
        select(OrganizationMember).where(
            OrganizationMember.org_id == project.org_id,
            OrganizationMember.user_id == user.id,
            OrganizationMember.status == OrgMemberStatus.ACTIVE,
        )
    )
    if not member_res.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Project not found")

    return project


@router.post("/{project_id}/grammar/check", response_model=GrammarCheckResponse)
async def grammar_check(
    project_id: int,
    body: GrammarCheckRequest,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Check grammar/spelling for the given text."""
    await _get_project_or_404(project_id, db, current_user)
    result = await check_grammar(body.text, body.language)
    return result
