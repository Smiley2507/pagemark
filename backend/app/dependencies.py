from typing import List, Callable
from fastapi import Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from app.database import get_db
from app.models.user import User
from app.models.organization import Organization, OrganizationMember, OrgMemberRole, OrgMemberStatus
from app.models.project import Project
from app.models.document import Document, Section
from app.models.document_share import DocumentShare, DocumentSharePermission
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


_PERMISSION_ORDER = {"view": 0, "comment": 1, "edit": 2}


async def verify_document_access(
    project_id: int,
    document_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Document:
    """
    Verify the current user has at least view-level access to the document.
    Checks org membership, then org admin/project creator (full access),
    then DocumentShare (granular access). Raises 404 for IDOR protection.
    """
    proj_res = await db.execute(select(Project).where(Project.id == project_id))
    project = proj_res.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    member_res = await db.execute(
        select(OrganizationMember).where(
            OrganizationMember.org_id == project.org_id,
            OrganizationMember.user_id == current_user.id,
            OrganizationMember.status == OrgMemberStatus.ACTIVE,
        )
    )
    member = member_res.scalar_one_or_none()
    if not member:
        raise HTTPException(status_code=404, detail="Project not found")

    doc_res = await db.execute(
        select(Document)
        .where(Document.id == document_id, Document.project_id == project_id)
        .options(selectinload(Document.sections), selectinload(Document.template))
    )
    document = doc_res.scalar_one_or_none()
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")

    is_admin = member.role == OrgMemberRole.ADMIN
    is_project_creator = project.created_by == current_user.id
    if is_admin or is_project_creator:
        return document

    share_res = await db.execute(
        select(DocumentShare).where(
            DocumentShare.document_id == document_id,
            DocumentShare.user_id == current_user.id,
            DocumentShare.revoked_at.is_(None),
        )
    )
    share = share_res.scalar_one_or_none()
    if not share:
        raise HTTPException(status_code=404, detail="Document not found")

    return document


def require_document_permission(required_permission: str) -> Callable:
    """
    Dependency factory that requires the current user to have at least
    `required_permission` level on the document via DocumentShare.
    Org admins and project creators always pass.

    Permission hierarchy: view < comment < edit
    """
    async def _check(
        project_id: int,
        document_id: int,
        current_user: User = Depends(get_current_user),
        db: AsyncSession = Depends(get_db),
    ) -> Document:
        proj_res = await db.execute(select(Project).where(Project.id == project_id))
        project = proj_res.scalar_one_or_none()
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")

        member_res = await db.execute(
            select(OrganizationMember).where(
                OrganizationMember.org_id == project.org_id,
                OrganizationMember.user_id == current_user.id,
                OrganizationMember.status == OrgMemberStatus.ACTIVE,
            )
        )
        member = member_res.scalar_one_or_none()
        if not member:
            raise HTTPException(status_code=404, detail="Project not found")

        doc_res = await db.execute(
            select(Document)
            .where(Document.id == document_id, Document.project_id == project_id)
            .options(selectinload(Document.sections), selectinload(Document.template))
        )
        document = doc_res.scalar_one_or_none()
        if not document:
            raise HTTPException(status_code=404, detail="Document not found")

        is_admin = member.role == OrgMemberRole.ADMIN
        is_project_creator = project.created_by == current_user.id
        if is_admin or is_project_creator:
            return document

        share_res = await db.execute(
            select(DocumentShare).where(
                DocumentShare.document_id == document_id,
                DocumentShare.user_id == current_user.id,
                DocumentShare.revoked_at.is_(None),
            )
        )
        share = share_res.scalar_one_or_none()
        if not share:
            raise HTTPException(status_code=404, detail="Document not found")

        if _PERMISSION_ORDER.get(share.permission.value, -1) < _PERMISSION_ORDER.get(required_permission, 0):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Insufficient permission. Required: {required_permission}",
            )

        return document

    return _check
