from typing import Callable, Optional
from fastapi import Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from app.database import get_db
from app.models.user import User
from app.models.organization import OrganizationMember, OrgMemberStatus
from app.models.project import Project
from app.models.document import Document, Section
from app.models.document_share import DocumentShare
from app.services import auth_service, admin_auth_service
from app.authz import (
    PROJECT_READ,
    CONTENT_COMMENT,
    CONTENT_WRITE,
    SHARE_PERMISSION_SATISFIES,
    member_can,
    require_capability,
)


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

    if user.is_suspended:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account suspended")

    return user


_PERMISSION_ORDER = {"view": 0, "comment": 1, "edit": 2}
_CAPABILITY_TO_SHARE_LEVEL = {v: k for k, v in SHARE_PERMISSION_SATISFIES.items()}


async def _get_active_member(db: AsyncSession, org_id: int, user_id: int) -> Optional[OrganizationMember]:
    res = await db.execute(
        select(OrganizationMember).where(
            OrganizationMember.org_id == org_id,
            OrganizationMember.user_id == user_id,
            OrganizationMember.status == OrgMemberStatus.ACTIVE,
        )
    )
    return res.scalar_one_or_none()


async def _document_share_satisfies(
    db: AsyncSession, document_id: int, user_id: int, capability: str
) -> bool:
    """DocumentShare's view<comment<edit ladder substitutes for read/comment/write only."""
    required_level = _CAPABILITY_TO_SHARE_LEVEL.get(capability)
    if required_level is None:
        return False
    share_res = await db.execute(
        select(DocumentShare).where(
            DocumentShare.document_id == document_id,
            DocumentShare.user_id == user_id,
            DocumentShare.revoked_at.is_(None),
        )
    )
    share = share_res.scalar_one_or_none()
    if not share:
        return False
    return _PERMISSION_ORDER.get(share.permission.value, -1) >= _PERMISSION_ORDER[required_level]


def require_project(capability: str = PROJECT_READ) -> Callable:
    """Dependency factory: resolve Project, verify active org membership, require capability."""
    async def _check(
        project_id: int,
        current_user: User = Depends(get_current_user),
        db: AsyncSession = Depends(get_db),
    ) -> Project:
        res = await db.execute(select(Project).where(Project.id == project_id))
        project = res.scalar_one_or_none()
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")

        member = await _get_active_member(db, project.org_id, current_user.id)
        if not member:
            raise HTTPException(status_code=404, detail="Project not found")

        require_capability(member, capability, project=project, user_id=current_user.id)
        return project

    return _check


def require_section(capability: str = PROJECT_READ) -> Callable:
    """Dependency factory: resolve Section -> Document -> Project, verify membership,
    require capability, falling back to a DocumentShare on the parent document."""
    async def _check(
        section_id: int,
        current_user: User = Depends(get_current_user),
        db: AsyncSession = Depends(get_db),
    ) -> Section:
        sec_res = await db.execute(
            select(Section).where(Section.id == section_id).options(selectinload(Section.document))
        )
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

        member = await _get_active_member(db, project.org_id, current_user.id)
        if not member:
            raise HTTPException(status_code=404, detail="Section not found")

        if not member_can(member, capability, project=project, user_id=current_user.id):
            if not await _document_share_satisfies(db, document.id, current_user.id, capability):
                require_capability(member, capability, project=project, user_id=current_user.id)

        return section

    return _check


def require_document(capability: str = PROJECT_READ) -> Callable:
    """Dependency factory: resolve Project + Document, verify membership, require
    capability, falling back to a DocumentShare on this document."""
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

        member = await _get_active_member(db, project.org_id, current_user.id)
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

        if not member_can(member, capability, project=project, user_id=current_user.id):
            if not await _document_share_satisfies(db, document.id, current_user.id, capability):
                require_capability(member, capability, project=project, user_id=current_user.id)

        return document

    return _check


# Backwards-compatible wrappers: every endpoint using these four names keeps working.
verify_project_ownership = require_project(PROJECT_READ)
verify_section_ownership = require_section(PROJECT_READ)
verify_document_access = require_document(PROJECT_READ)


def require_document_permission(required_permission: str) -> Callable:
    """Preserves the old view/comment/edit vocabulary on top of require_document."""
    capability = {"view": PROJECT_READ, "comment": CONTENT_COMMENT, "edit": CONTENT_WRITE}[required_permission]
    return require_document(capability)


async def require_superuser(
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> User:
    """
    Dependency that requires a valid admin Bearer token in the Authorization header
    AND that the user is a superuser (not suspended).
    Returns the User if all checks pass.
    """
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Admin authentication required")

    token = auth_header.removeprefix("Bearer ")
    payload = admin_auth_service.decode_admin_token(token)
    if not payload:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired admin token")

    user_id = payload.get("sub")
    result = await db.execute(select(User).where(User.id == int(user_id)))
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")

    if not user.is_superuser:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not a superuser")

    if user.is_suspended:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account suspended")

    return user
