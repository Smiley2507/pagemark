from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.database import get_db
from app.dependencies import get_current_user
from app.models.document import Document
from app.models.user import User
from app.models.version import AuthorType, SectionVersion
from app.schemas.section import SectionResponse
from app.schemas.version import AuthorTypeEnum, SectionVersionResponse, VersionDiffResponse
from app.services import section_service
from app.services.version_service import (
    build_diff_lines,
    create_version_snapshot,
    get_previous_version_content,
)

router = APIRouter(tags=["versions"])


def _version_to_response(version: SectionVersion) -> SectionVersionResponse:
    return SectionVersionResponse(
        id=version.id,
        section_id=version.section_id,
        author_type=AuthorTypeEnum(version.author_type.value),
        summary=version.summary,
        added=version.added,
        removed=version.removed,
        modified=version.modified,
        created_at=version.created_at,
    )


@router.get("/sections/{section_id}/versions", response_model=list[SectionVersionResponse])
async def list_section_versions(
    section_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    await section_service.get_section_for_user(db, section_id, current_user.id)
    result = await db.execute(
        select(SectionVersion)
        .where(SectionVersion.section_id == section_id)
        .order_by(SectionVersion.created_at.desc())
    )
    versions = result.scalars().all()
    return [_version_to_response(v) for v in versions]


@router.get("/versions/{version_id}/diff", response_model=VersionDiffResponse)
async def get_version_diff(
    version_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(SectionVersion).where(SectionVersion.id == version_id)
    )
    version = result.scalar_one_or_none()
    if not version:
        raise HTTPException(status_code=404, detail="Version not found")

    await section_service.get_section_for_user(db, version.section_id, current_user.id)

    content_new = version.content_md
    content_old = await get_previous_version_content(db, version.section_id, version.id)
    diff_lines = build_diff_lines(content_old, content_new)

    return VersionDiffResponse(
        version_id=version.id,
        content_old=content_old,
        content_new=content_new,
        diff_lines=diff_lines,
    )


@router.post("/versions/{version_id}/restore", response_model=SectionResponse)
async def restore_version(
    version_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(SectionVersion).where(SectionVersion.id == version_id)
    )
    version = result.scalar_one_or_none()
    if not version:
        raise HTTPException(status_code=404, detail="Version not found")

    section = await section_service.get_section_for_user(
        db, version.section_id, current_user.id
    )
    current_content = section.content_md or ""
    restore_content = version.content_md

    if restore_content != current_content:
        await create_version_snapshot(
            db,
            section_id=section.id,
            old_content=current_content,
            new_content=restore_content,
            author_type=AuthorType.USER,
            summary=f"Restored to version {version.id}",
        )
        section.content_md = restore_content
        section.updated_at = datetime.utcnow()
        doc_result = await db.execute(
            select(Document).where(Document.id == section.document_id)
        )
        document = doc_result.scalar_one()
        await section_service.recompute_project_completion(db, document.project_id)

    await db.commit()
    await db.refresh(section)
    return section_service.section_to_response(section)
