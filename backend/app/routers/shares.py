"""
Document sharing endpoints nested under project document routes.

  GET    /projects/{project_id}/documents/{document_id}/shares       — list shares
  POST   /projects/{project_id}/documents/{document_id}/shares       — add/update share
  DELETE /projects/{project_id}/documents/{document_id}/shares/{share_id} — revoke share
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.database import get_db
from app.dependencies import get_current_user, verify_document_access
from app.models.document import Document
from app.models.document_share import DocumentShare, DocumentSharePermission
from app.models.organization import OrganizationMember, OrgMemberRole, OrgMemberStatus
from app.models.project import Project
from app.models.user import User
from app.models.audit import AuditLog
from app.schemas.share import (
    ShareCreateRequest,
    ShareResponse,
    ShareListResponse,
    SharePermissionEnum,
)
from app.services import activity_service

router = APIRouter(prefix="/projects", tags=["shares"])


async def _can_manage_shares(
    db: AsyncSession,
    project_id: int,
    user_id: int,
) -> bool:
    """Check if user is org admin or project creator."""
    proj_res = await db.execute(select(Project).where(Project.id == project_id))
    project = proj_res.scalar_one_or_none()
    if not project:
        return False

    if project.created_by == user_id:
        return True

    member_res = await db.execute(
        select(OrganizationMember).where(
            OrganizationMember.org_id == project.org_id,
            OrganizationMember.user_id == user_id,
            OrganizationMember.status == OrgMemberStatus.ACTIVE,
        )
    )
    member = member_res.scalar_one_or_none()
    return member is not None and member.role == OrgMemberRole.ADMIN


async def _log_share_action(
    db: AsyncSession,
    user_id: int,
    document_id: int,
    action: str,
    resource: str = "",
):
    """Record share action in audit log."""
    proj_res = await db.execute(
        select(Project).join(Document, Document.project_id == Project.id).where(Document.id == document_id)
    )
    project = proj_res.scalar_one_or_none()
    org_id = project.org_id if project else None
    db.add(AuditLog(user_id=user_id, org_id=org_id, action=action, resource=resource))


def _share_to_response(share: DocumentShare, user: User | None = None) -> ShareResponse:
    return ShareResponse(
        id=share.id,
        document_id=share.document_id,
        user_id=share.user_id,
        permission=SharePermissionEnum(share.permission.value),
        created_by=share.created_by,
        created_at=share.created_at,
        revoked_at=share.revoked_at,
        user_name=user.name if user else None,
        user_email=user.email if user else None,
        user_avatar=user.avatar_url if user else None,
    )


@router.get(
    "/{project_id}/documents/{document_id}/shares",
    response_model=ShareListResponse,
)
async def list_shares(
    document_id: int,
    document: Document = Depends(verify_document_access),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(DocumentShare, User)
        .join(User, User.id == DocumentShare.user_id)
        .where(
            DocumentShare.document_id == document_id,
            DocumentShare.revoked_at.is_(None),
        )
        .order_by(DocumentShare.created_at.desc())
    )
    rows = result.all()
    shares = [_share_to_response(share, user) for share, user in rows]
    return ShareListResponse(shares=shares, total=len(shares))


@router.post(
    "/{project_id}/documents/{document_id}/shares",
    status_code=status.HTTP_201_CREATED,
    response_model=ShareResponse,
)
async def create_share(
    document_id: int,
    body: ShareCreateRequest,
    document: Document = Depends(verify_document_access),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    project_id = document.project_id
    if not await _can_manage_shares(db, project_id, current_user.id):
        raise HTTPException(status_code=403, detail="Only org admins and project creators can manage shares")

    if body.user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot share a document with yourself")

    user_res = await db.execute(select(User).where(User.id == body.user_id))
    target_user = user_res.scalar_one_or_none()
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")

    member_res = await db.execute(
        select(OrganizationMember).where(
            OrganizationMember.org_id == document.project.org_id,
            OrganizationMember.user_id == body.user_id,
            OrganizationMember.status == OrgMemberStatus.ACTIVE,
        )
    )
    if not member_res.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="User is not an active member of this organization")

    existing_res = await db.execute(
        select(DocumentShare).where(
            DocumentShare.document_id == document_id,
            DocumentShare.user_id == body.user_id,
            DocumentShare.revoked_at.is_(None),
        )
    )
    existing = existing_res.scalar_one_or_none()
    if existing:
        existing.permission = DocumentSharePermission(body.permission.value)
        existing.created_by = current_user.id
        await db.commit()
        await db.refresh(existing)
        share = existing
    else:
        share = DocumentShare(
            document_id=document_id,
            user_id=body.user_id,
            permission=DocumentSharePermission(body.permission.value),
            created_by=current_user.id,
        )
        db.add(share)
        await db.commit()
        await db.refresh(share)

    await _log_share_action(
        db, current_user.id, document_id,
        "document_shared" if not existing else "share_updated",
        f"document:{document_id}:user:{body.user_id}:{body.permission.value}",
    )

    await activity_service.record_event(
        db,
        project_id=project_id,
        document_id=document_id,
        event_type="document_shared",
        message=f"Shared document \"{document.title}\" with {target_user.name or target_user.email}",
        payload={"share_id": share.id, "user_id": body.user_id, "permission": body.permission.value},
    )
    await db.commit()

    return _share_to_response(share, target_user)


@router.delete(
    "/{project_id}/documents/{document_id}/shares/{share_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def revoke_share(
    document_id: int,
    share_id: int,
    document: Document = Depends(verify_document_access),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    project_id = document.project_id
    if not await _can_manage_shares(db, project_id, current_user.id):
        raise HTTPException(status_code=403, detail="Only org admins and project creators can manage shares")

    result = await db.execute(
        select(DocumentShare).where(
            DocumentShare.id == share_id,
            DocumentShare.document_id == document_id,
        )
    )
    share = result.scalar_one_or_none()
    if not share:
        raise HTTPException(status_code=404, detail="Share not found")
    if share.revoked_at:
        raise HTTPException(status_code=400, detail="Share is already revoked")

    share.revoked_at = __import__("datetime").datetime.utcnow()

    await _log_share_action(
        db, current_user.id, document_id,
        "share_revoked",
        f"document:{document_id}:user:{share.user_id}",
    )

    await activity_service.record_event(
        db,
        project_id=project_id,
        document_id=document_id,
        event_type="share_revoked",
        message=f"Revoked share for document \"{document.title}\"",
        payload={"share_id": share_id, "user_id": share.user_id},
    )
    await db.commit()

    return None
