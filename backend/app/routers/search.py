from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from app.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.models.project import Project
from app.models.document import Document, LifecycleStatus, Section
from app.models.organization import Organization, OrganizationMember, OrgMemberStatus
from pydantic import BaseModel
from typing import List, Optional

router = APIRouter(prefix="/projects", tags=["search"])


class SearchResultItem(BaseModel):
    type: str
    id: int
    title: str
    subtitle: Optional[str] = None
    content_excerpt: Optional[str] = None
    status: Optional[str] = None
    tags: list[str] = []
    last_opened_at: Optional[str] = None
    last_added_at: str
    last_modified_at: str
    project_id: int
    project_name: str
    document_id: Optional[int] = None
    document_title: Optional[str] = None
    section_id: Optional[int] = None
    section_heading: Optional[str] = None


class SearchResults(BaseModel):
    results: List[SearchResultItem]
    total: int


async def _resolve_org(request: Request, current_user: User, db: AsyncSession) -> int:
    header_val = request.headers.get("X-Organization-ID")
    if header_val:
        try:
            return int(header_val)
        except ValueError:
            pass

    res = await db.execute(
        select(Organization)
        .join(OrganizationMember, OrganizationMember.org_id == Organization.id)
        .where(
            OrganizationMember.user_id == current_user.id,
            OrganizationMember.status == OrgMemberStatus.ACTIVE,
            Organization.personal == True,
        )
        .limit(1)
    )
    org = res.scalar_one_or_none()
    if org:
        return org.id

    res2 = await db.execute(
        select(OrganizationMember).where(
            OrganizationMember.user_id == current_user.id,
            OrganizationMember.status == OrgMemberStatus.ACTIVE,
        ).limit(1)
    )
    member = res2.scalar_one_or_none()
    if not member:
        raise HTTPException(status_code=400, detail="User has no organization")
    return member.org_id


@router.get("/search", response_model=SearchResults)
async def search_sections(
    request: Request,
    q: Optional[str] = Query(None),
    tag: Optional[str] = Query(None),
    status_filter: Optional[str] = Query(None, alias="status"),
    type_filter: str = Query("all", alias="type"),
    sort: str = Query("last_modified"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    org_id = await _resolve_org(request, current_user, db)
    normalized_query = (q or "").strip().lower()
    normalized_tag = (tag or "").strip().lower()
    normalized_status = (status_filter or "").strip().lower()
    requested_type = type_filter if type_filter in {"all", "project", "document", "section"} else "all"

    results: list[SearchResultItem] = []

    def matches_text(parts: list[str | None]) -> bool:
        if not normalized_query:
            return True
        return normalized_query in " ".join(part or "" for part in parts).lower()

    def matches_tags(tags: list[str]) -> bool:
        if not normalized_tag:
            return True
        return any(item.lower() == normalized_tag for item in tags)

    def matches_status(value: str | None) -> bool:
        if not normalized_status:
            return True
        return normalized_status in (value or "").lower()

    def excerpt(value: str | None) -> str:
        raw = value or ""
        if not normalized_query:
            return raw[:200]
        idx = raw.lower().find(normalized_query)
        if idx > 60:
            return "..." + raw[idx - 40:idx + 160]
        return raw[:200]

    if requested_type in {"all", "project"}:
        project_query = (
            select(Project)
            .where(Project.org_id == org_id, Project.deleted_at.is_(None))
        )
        project_result = await db.execute(project_query)
        for project in project_result.scalars().all():
            tags = project.tags or []
            status_value = project.status.value
            if not matches_text([project.name, project.description, " ".join(tags)]):
                continue
            if not matches_tags(tags) or not matches_status(status_value):
                continue
            results.append(SearchResultItem(
                type="project",
                id=project.id,
                title=project.name,
                subtitle=project.description,
                content_excerpt=project.description,
                status=status_value,
                tags=tags,
                last_added_at=project.created_at.isoformat(),
                last_modified_at=project.updated_at.isoformat(),
                project_id=project.id,
                project_name=project.name,
            ))

    if requested_type in {"all", "document"}:
        document_query = (
            select(Document, Project)
            .join(Project, Project.id == Document.project_id)
            .where(Project.org_id == org_id, Project.deleted_at.is_(None))
        )
        document_result = await db.execute(document_query)
        for doc, project in document_result.all():
            tags = list(doc.tags or []) + list(project.tags or [])
            status_value = doc.freshness_state or doc.status.value
            if not matches_text([doc.title, doc.purpose, doc.audience, doc.context, project.name, " ".join(tags)]):
                continue
            if not matches_tags(tags) or not matches_status(status_value):
                continue
            results.append(SearchResultItem(
                type="document",
                id=doc.id,
                title=doc.title,
                subtitle=project.name,
                content_excerpt=doc.purpose or doc.context,
                status=status_value,
                tags=tags,
                last_added_at=doc.created_at.isoformat(),
                last_modified_at=doc.updated_at.isoformat(),
                project_id=project.id,
                project_name=project.name,
                document_id=doc.id,
                document_title=doc.title,
            ))

    if requested_type in {"all", "section"}:
        section_query = (
            select(Section, Document, Project)
            .join(Document, Document.id == Section.document_id)
            .join(Project, Project.id == Document.project_id)
            .where(
                Project.org_id == org_id,
                Project.deleted_at.is_(None),
                Section.lifecycle_status == LifecycleStatus.ACTIVE,
            )
        )
        section_result = await db.execute(section_query)
        for section, doc, project in section_result.all():
            tags = list(doc.tags or []) + list(project.tags or [])
            status_value = "potentially_stale" if section.is_potentially_stale else section.status.value
            if not matches_text([section.heading, section.title, section.content_md, doc.title, project.name, " ".join(tags)]):
                continue
            if not matches_tags(tags) or not matches_status(status_value):
                continue
            results.append(SearchResultItem(
                type="section",
                id=section.id,
                title=section.title or section.heading,
                subtitle=f"{project.name} / {doc.title}",
                content_excerpt=excerpt(section.content_md),
                status=status_value,
                tags=tags,
                last_added_at=section.created_at.isoformat(),
                last_modified_at=section.updated_at.isoformat(),
                project_id=project.id,
                project_name=project.name,
                document_id=doc.id,
                document_title=doc.title,
                section_id=section.id,
                section_heading=section.heading,
            ))

    if sort == "name":
        results.sort(key=lambda item: item.title.lower())
    elif sort == "last_added":
        results.sort(key=lambda item: item.last_added_at, reverse=True)
    else:
        results.sort(key=lambda item: item.last_modified_at, reverse=True)
    results = results[:50]

    return SearchResults(results=results, total=len(results))
