from typing import List, Callable
from fastapi import Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from app.database import get_db
from app.models.user import User
from app.models.organization import Organization, OrganizationMember, OrgMemberRole, OrgMemberStatus
from app.models.project import Project
from app.models.document import Document, Section
from app.services import auth_service


async def get_current_user(request: Request, db: AsyncSession = Depends(get_db)) -> User:
    token = request.cookies.get("access_token")
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")

    payload = auth_service.decode_token(token)
    if not payload or payload.get("type") != "access":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token")

    user_id = payload.get("sub")
    result = await db.execute(select(User).where(User.id == int(user_id)))
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")

    return user


def require_org_role(required_roles: List[str]) -> Callable:
    """
    Dependency factory that verifies the current user belongs to the org
    specified by the `org_id` path parameter and has one of the required roles.
    Raises 404 (not 403) to prevent IDOR leaks.
    """
    role_enums = [OrgMemberRole(r) for r in required_roles]

    async def _check(
        org_id: int,
        current_user: User = Depends(get_current_user),
        db: AsyncSession = Depends(get_db),
    ) -> OrganizationMember:
        res = await db.execute(
            select(OrganizationMember).where(
                OrganizationMember.org_id == org_id,
                OrganizationMember.user_id == current_user.id,
                OrganizationMember.status == OrgMemberStatus.ACTIVE,
            )
        )
        member = res.scalar_one_or_none()
        if not member or member.role not in role_enums:
            raise HTTPException(status_code=404, detail="Organization not found")
        return member

    return _check


async def verify_project_ownership(
    project_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Project:
    """
    Verifies that current_user belongs to the organization that owns this project.
    Raises 404 to prevent IDOR leaks.
    """
    res = await db.execute(select(Project).where(Project.id == project_id))
    project = res.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    member_res = await db.execute(
        select(OrganizationMember).where(
            OrganizationMember.org_id == project.org_id,
            OrganizationMember.user_id == current_user.id,
            OrganizationMember.status == OrgMemberStatus.ACTIVE,
        )
    )
    if not member_res.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Project not found")

    return project


async def verify_section_ownership(
    section_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Section:
    """
    Joins Section -> Document -> Project -> OrganizationMember to verify access.
    Raises 404 to prevent IDOR leaks.
    """
    sec_res = await db.execute(select(Section).where(Section.id == section_id))
    section = sec_res.scalar_one_or_none()
    if not section:
        raise HTTPException(status_code=404, detail="Section not found")

    doc_res = await db.execute(select(Document).where(Document.id == section.document_id))
    document = doc_res.scalar_one_or_none()
    if not document:
        raise HTTPException(status_code=404, detail="Section not found")

    proj_res = await db.execute(select(Project).where(Project.id == document.project_id))
    project = proj_res.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Section not found")

    member_res = await db.execute(
        select(OrganizationMember).where(
            OrganizationMember.org_id == project.org_id,
            OrganizationMember.user_id == current_user.id,
            OrganizationMember.status == OrgMemberStatus.ACTIVE,
        )
    )
    if not member_res.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Section not found")

    return section
