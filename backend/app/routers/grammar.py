"""
grammar.py — API router for grammar/spelling checking.

POST /projects/{id}/grammar/check  → check text grammar via LanguageTool
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.database import get_db
from app.dependencies import get_current_user
from app.models.document import Document, Section
from app.models.project import Project
from app.models.organization import OrgMemberStatus, OrganizationMember
from app.schemas.grammar import GrammarCheckRequest, GrammarCheckResponse
from app.services.grammar_service import check_grammar
from app.services import quality_findings_service

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
    project = await _get_project_or_404(project_id, db, current_user)
    result = await check_grammar(body.text, body.language)
    if body.document_id is not None and body.section_id is not None:
        section_result = await db.execute(
            select(Section)
            .join(Document, Document.id == Section.document_id)
            .where(
                Document.id == body.document_id,
                Document.project_id == project.id,
                Section.id == body.section_id,
            )
        )
        section = section_result.scalar_one_or_none()
        if not section:
            raise HTTPException(status_code=404, detail="Section not found")
        payloads = [
            quality_findings_service.grammar_match_to_finding_payload(
                document_id=body.document_id,
                section=section,
                text=body.text,
                match=match,
            )
            for match in result.matches
        ]
        await quality_findings_service.persist_findings_async(db, payloads)
        await db.commit()
    return result
