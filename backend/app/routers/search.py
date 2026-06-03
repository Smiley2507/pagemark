from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func
from app.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.models.project import Project
from app.models.document import Document
from app.models.organization import Organization, OrganizationMember, OrgMemberStatus
from pydantic import BaseModel
from typing import List, Optional

router = APIRouter(prefix="/projects", tags=["search"])


class SearchResultItem(BaseModel):
    section_id: int
    section_heading: str
    content_excerpt: str
    document_id: int
    document_title: str
    project_id: int
    project_name: str


class SearchResults(BaseModel):
    results: List[SearchResultItem]
    total: int


@router.get("/search", response_model=SearchResults)
async def search_sections(
    request: Request,
    q: Optional[str] = Query(None),
    tag: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Resolve org from header
    header_val = request.headers.get("X-Organization-ID")
    org_id = None
    if header_val:
        try:
            org_id = int(header_val)
        except ValueError:
            pass

    if not org_id:
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
        if not org:
            res2 = await db.execute(
                select(OrganizationMember).where(
                    OrganizationMember.user_id == current_user.id,
                    OrganizationMember.status == OrgMemberStatus.ACTIVE,
                ).limit(1)
            )
            member = res2.scalar_one_or_none()
            if not member:
                raise HTTPException(status_code=400, detail="User has no organization")
            org_id = member.org_id
        else:
            org_id = org.id

    query = (
        select(Project, Document)
        .join(Document, Document.project_id == Project.id)
        .where(Project.org_id == org_id)
    )

    if q:
        tsquery = func.plainto_tsquery("english", q)
        query = query.where(
            func.to_tsvector("english", Document.title).op("@@")(tsquery)
        )

    if tag:
        query = query.where(Project.tags.any(tag))

    query = query.limit(50)
    result = await db.execute(query)
    rows = result.all()

    results = []
    for proj, doc in rows:
        results.append(SearchResultItem(
            section_id=0,
            section_heading="",
            content_excerpt="",
            document_id=doc.id,
            document_title=doc.title,
            project_id=proj.id,
            project_name=proj.name,
        ))

    return SearchResults(results=results, total=len(results))
