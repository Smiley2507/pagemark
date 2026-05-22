from collections import defaultdict
from typing import Optional

from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.models.document import Document, Section, SectionStatus
from app.models.project import Project
from app.schemas.section import SectionResponse, SectionStatusEnum


def compute_completion_pct(sections: list[Section]) -> float:
    if not sections:
        return 0.0
    finalized = sum(1 for s in sections if s.status == SectionStatus.FINALIZED)
    return round(finalized / len(sections) * 100, 1)


def section_to_response(section: Section, children: Optional[list[SectionResponse]] = None) -> SectionResponse:
    return SectionResponse(
        id=section.id,
        document_id=section.document_id,
        parent_id=section.parent_id,
        order_index=section.order_index,
        heading=section.heading,
        content_md=section.content_md or "",
        status=SectionStatusEnum(section.status.value),
        children=children or [],
    )


def build_section_tree(sections: list[Section]) -> list[SectionResponse]:
    """Build nested section tree from flat rows ordered by parent_id."""
    by_parent: dict[Optional[int], list[Section]] = defaultdict(list)
    for section in sections:
        by_parent[section.parent_id].append(section)

    for children in by_parent.values():
        children.sort(key=lambda s: s.order_index)

    def build_node(section: Section) -> SectionResponse:
        child_sections = by_parent.get(section.id, [])
        return section_to_response(
            section,
            children=[build_node(child) for child in child_sections],
        )

    roots = by_parent.get(None, [])
    return [build_node(root) for root in roots]


async def get_project_for_user(
    db: AsyncSession,
    project_id: int,
    user_id: int,
) -> Project:
    result = await db.execute(
        select(Project).where(
            Project.id == project_id,
            Project.owner_id == user_id,
            Project.deleted_at.is_(None),
        )
    )
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


async def get_document_for_project(
    db: AsyncSession,
    project_id: int,
    user_id: int,
) -> Document:
    await get_project_for_user(db, project_id, user_id)
    result = await db.execute(
        select(Document).where(Document.project_id == project_id)
    )
    document = result.scalar_one_or_none()
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    return document


async def get_section_for_user(
    db: AsyncSession,
    section_id: int,
    user_id: int,
) -> Section:
    result = await db.execute(
        select(Section)
        .join(Document)
        .join(Project)
        .where(
            Section.id == section_id,
            Project.owner_id == user_id,
            Project.deleted_at.is_(None),
        )
    )
    section = result.scalar_one_or_none()
    if not section:
        raise HTTPException(status_code=404, detail="Section not found")
    return section


async def list_sections_for_project(
    db: AsyncSession,
    project_id: int,
    user_id: int,
) -> list[Section]:
    await get_project_for_user(db, project_id, user_id)
    result = await db.execute(
        select(Section)
        .join(Document)
        .where(Document.project_id == project_id)
        .order_by(Section.order_index)
    )
    return list(result.scalars().all())


async def recompute_project_completion(
    db: AsyncSession,
    project_id: int,
) -> float:
    result = await db.execute(
        select(Section)
        .join(Document)
        .where(Document.project_id == project_id)
    )
    sections = list(result.scalars().all())
    pct = compute_completion_pct(sections)

    proj_result = await db.execute(select(Project).where(Project.id == project_id))
    project = proj_result.scalar_one()
    project.completion_pct = pct
    return pct
