"""
Organizations router:
  GET    /organizations                         — list user's orgs
  POST   /organizations                         — create new org
  GET    /organizations/{org_id}                 — get org details
  PATCH  /organizations/{org_id}                 — update org (name, avatar, quality_threshold)
  GET    /organizations/{org_id}/members        — list members
  POST   /organizations/{org_id}/invites        — send invite
  POST   /organizations/invites/{token}/accept  — accept invite
  GET    /organizations/{org_id}/audit-logs     — paginated audit logs (admin/pm)
  PUT    /organizations/{org_id}/members/{uid}  — update member role (admin)
  DELETE /organizations/{org_id}/members/{uid}  — revoke membership (admin)
"""
import secrets
from datetime import datetime, timedelta
import re
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from pydantic import SecretStr
from fastapi_mail import FastMail, MessageSchema, ConnectionConfig

from app.database import get_db
from app.config import settings
from app.dependencies import get_current_user
from app.models.user import User, UserSettings
from app.models.organization import Organization, OrganizationMember, OrgMemberRole, OrgMemberStatus
from app.models.audit import AuditLog
from app.schemas.organization import (
    OrganizationCreate, OrganizationResponse,
    MemberResponse, InviteMemberRequest, UpdateMemberRoleRequest,
    AuditLogResponse,
)

router = APIRouter(prefix="/organizations", tags=["organizations"])


# ── Helpers ───────────────────────────────────────────────────────────────────

def _make_slug(name: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")
    return slug + "-" + secrets.token_hex(4)


async def _get_membership(
    db: AsyncSession,
    org_id: int,
    user_id: int,
    required_roles: Optional[List[OrgMemberRole]] = None,
) -> OrganizationMember:
    """Return the OrganizationMember or raise 404 (to avoid IDOR leaks)."""
    res = await db.execute(
        select(OrganizationMember).where(
            OrganizationMember.org_id == org_id,
            OrganizationMember.user_id == user_id,
            OrganizationMember.status == OrgMemberStatus.ACTIVE,
        )
    )
    member = res.scalar_one_or_none()
    if not member:
        raise HTTPException(status_code=404, detail="Organization not found")
    if required_roles and member.role not in required_roles:
        raise HTTPException(status_code=404, detail="Organization not found")
    return member


async def _log(db: AsyncSession, user_id: int, org_id: int, action: str, resource: str = ""):
    db.add(AuditLog(user_id=user_id, org_id=org_id, action=action, resource=resource))


async def _send_invite_email(email: str, org_name: str, token: str):
    try:
        from pydantic import SecretStr as _SecretStr
        ConnectionConfig.model_rebuild(_types_namespace={"SecretStr": _SecretStr})
        conf = ConnectionConfig(
            MAIL_USERNAME=settings.MAIL_USERNAME,
            MAIL_PASSWORD=settings.MAIL_PASSWORD,
            MAIL_FROM=settings.MAIL_FROM,
            MAIL_PORT=settings.MAIL_PORT,
            MAIL_SERVER=settings.MAIL_SERVER,
            MAIL_FROM_NAME="Pagemark AI",
            MAIL_STARTTLS=True,
            MAIL_SSL_TLS=False,
        )
        link = f"{settings.FRONTEND_URL}/org/invite/{token}"
        body = (
            f"<h2>You've been invited to join <b>{org_name}</b> on Pagemark</h2>"
            f"<p><a href='{link}' style='background:#6366f1;color:#fff;padding:10px 20px;"
            f"border-radius:6px;text-decoration:none;'>Accept Invitation</a></p>"
            f"<p>This invite expires in 7 days.</p>"
        )
        msg = MessageSchema(
            subject=f"Invitation to join {org_name} on Pagemark",
            recipients=[email],
            body=body,
            subtype="html",
        )
        await FastMail(conf).send_message(msg)
    except Exception:
        pass


# ── Routes ────────────────────────────────────────────────────────────────────

@router.get("", response_model=List[OrganizationResponse])
async def list_organizations(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    res = await db.execute(
        select(Organization)
        .join(OrganizationMember, OrganizationMember.org_id == Organization.id)
        .where(
            OrganizationMember.user_id == current_user.id,
            OrganizationMember.status == OrgMemberStatus.ACTIVE,
        )
    )
    return res.scalars().all()


@router.post("", status_code=status.HTTP_201_CREATED, response_model=OrganizationResponse)
async def create_organization(
    body: OrganizationCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    org = Organization(
        name=body.name,
        slug=_make_slug(body.name),
        avatar_url=body.avatar_url,
        created_by=current_user.id,
        personal=False,
    )
    db.add(org)
    await db.flush()

    db.add(OrganizationMember(
        org_id=org.id,
        user_id=current_user.id,
        role=OrgMemberRole.ADMIN,
        status=OrgMemberStatus.ACTIVE,
    ))
    await _log(db, current_user.id, org.id, "create_organization", f"org:{org.id}")
    await db.commit()
    await db.refresh(org)
    return org


from pydantic import BaseModel


class OrganizationUpdateRequest(BaseModel):
    name: Optional[str] = None
    avatar_url: Optional[str] = None
    quality_threshold: Optional[int] = None
    ai_provider: Optional[str] = None
    ai_key: Optional[str] = None


@router.get("/{org_id}", response_model=OrganizationResponse)
async def get_organization(
    org_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _get_membership(db, org_id, current_user.id)
    res = await db.execute(select(Organization).where(Organization.id == org_id))
    org = res.scalar_one_or_none()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    return org


@router.patch("/{org_id}", response_model=OrganizationResponse)
async def update_organization(
    org_id: int,
    body: OrganizationUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _get_membership(db, org_id, current_user.id, [OrgMemberRole.ADMIN])

    res = await db.execute(select(Organization).where(Organization.id == org_id))
    org = res.scalar_one_or_none()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")

    if body.name is not None:
        org.name = body.name
    if body.avatar_url is not None:
        org.avatar_url = body.avatar_url
    if body.quality_threshold is not None:
        if body.quality_threshold < 0 or body.quality_threshold > 100:
            raise HTTPException(status_code=400, detail="Quality threshold must be between 0 and 100")
        org.quality_threshold = body.quality_threshold

    if body.ai_provider is not None:
        org.ai_provider = body.ai_provider if body.ai_provider else None
    if body.ai_key is not None:
        from app.services import crypto_service
        org.ai_key_encrypted = crypto_service.encrypt_token(body.ai_key) if body.ai_key else None

    await _log(db, current_user.id, org_id, "update_organization", f"org:{org_id}")
    await db.commit()
    await db.refresh(org)
    return org


@router.get("/{org_id}/members", response_model=List[MemberResponse])
async def list_members(
    org_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _get_membership(db, org_id, current_user.id)

    res = await db.execute(
        select(OrganizationMember, User)
        .join(User, User.id == OrganizationMember.user_id)
        .where(OrganizationMember.org_id == org_id)
    )
    rows = res.all()
    result = []
    for member, user in rows:
        result.append(MemberResponse(
            id=member.id,
            user_id=member.user_id,
            org_id=member.org_id,
            role=member.role,
            status=member.status,
            joined_at=member.joined_at,
            user_name=user.name,
            user_email=user.email,
            user_avatar=user.avatar_url,
        ))
    return result


@router.post("/{org_id}/invites", status_code=status.HTTP_201_CREATED)
async def send_invite(
    org_id: int,
    body: InviteMemberRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _get_membership(db, org_id, current_user.id, [OrgMemberRole.ADMIN])

    org_res = await db.execute(select(Organization).where(Organization.id == org_id))
    org = org_res.scalar_one_or_none()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")

    user_res = await db.execute(select(User).where(User.email == body.email))
    invitee = user_res.scalar_one_or_none()
    if not invitee:
        raise HTTPException(status_code=404, detail="User not found. They must register first.")

    existing_res = await db.execute(
        select(OrganizationMember).where(
            OrganizationMember.org_id == org_id,
            OrganizationMember.user_id == invitee.id,
        )
    )
    if existing_res.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="User is already a member or has a pending invite")

    invite_token = secrets.token_urlsafe(32)
    member = OrganizationMember(
        org_id=org_id,
        user_id=invitee.id,
        role=body.role,
        invited_by=current_user.id,
        status=OrgMemberStatus.INVITED,
        invite_token=invite_token,
        invite_token_expires=datetime.utcnow() + timedelta(days=7),
    )
    db.add(member)
    await _log(db, current_user.id, org_id, "invite_member", f"user:{body.email}")
    await db.commit()

    await _send_invite_email(body.email, org.name, invite_token)
    return {"message": "Invitation sent"}


@router.post("/invites/{token}/accept")
async def accept_invite(
    token: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    res = await db.execute(
        select(OrganizationMember).where(OrganizationMember.invite_token == token)
    )
    member = res.scalar_one_or_none()
    if not member:
        raise HTTPException(status_code=404, detail="Invite not found or already accepted")
    if member.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="This invite is for a different user")
    if member.invite_token_expires and member.invite_token_expires < datetime.utcnow():
        raise HTTPException(status_code=400, detail="Invite has expired")

    member.status = OrgMemberStatus.ACTIVE
    member.joined_at = datetime.utcnow()
    member.invite_token = None
    member.invite_token_expires = None
    await _log(db, current_user.id, member.org_id, "accept_invite", f"org:{member.org_id}")
    await db.commit()
    return {"message": "Joined organization successfully"}


@router.get("/{org_id}/audit-logs", response_model=List[AuditLogResponse])
async def get_audit_logs(
    org_id: int,
    page: int = Query(1, ge=1),
    per_page: int = Query(50, le=200),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _get_membership(db, org_id, current_user.id, [OrgMemberRole.ADMIN, OrgMemberRole.PROJECT_MANAGER])

    offset = (page - 1) * per_page
    res = await db.execute(
        select(AuditLog, User)
        .join(User, User.id == AuditLog.user_id)
        .where(AuditLog.org_id == org_id)
        .order_by(AuditLog.created_at.desc())
        .limit(per_page)
        .offset(offset)
    )
    return [
        AuditLogResponse(
            id=log.id, user_id=log.user_id, org_id=log.org_id,
            action=log.action, resource=log.resource, created_at=log.created_at,
            user_name=user.name, user_email=user.email,
        )
        for log, user in res.all()
    ]


@router.put("/{org_id}/members/{user_id}", response_model=MemberResponse)
async def update_member_role(
    org_id: int,
    user_id: int,
    body: UpdateMemberRoleRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _get_membership(db, org_id, current_user.id, [OrgMemberRole.ADMIN])

    res = await db.execute(
        select(OrganizationMember).where(
            OrganizationMember.org_id == org_id,
            OrganizationMember.user_id == user_id,
        )
    )
    member = res.scalar_one_or_none()
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")

    member.role = body.role
    await _log(db, current_user.id, org_id, "update_member_role", f"user:{user_id}:role:{body.role.value}")
    await db.commit()
    await db.refresh(member)

    user_res = await db.execute(select(User).where(User.id == user_id))
    user = user_res.scalar_one()
    return MemberResponse(
        id=member.id, user_id=member.user_id, org_id=member.org_id,
        role=member.role, status=member.status, joined_at=member.joined_at,
        user_name=user.name, user_email=user.email, user_avatar=user.avatar_url,
    )


@router.delete("/{org_id}/members/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def revoke_membership(
    org_id: int,
    user_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _get_membership(db, org_id, current_user.id, [OrgMemberRole.ADMIN])

    res = await db.execute(
        select(OrganizationMember).where(
            OrganizationMember.org_id == org_id,
            OrganizationMember.user_id == user_id,
        )
    )
    member = res.scalar_one_or_none()
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")

    await db.delete(member)
    await _log(db, current_user.id, org_id, "revoke_membership", f"user:{user_id}")
    await db.commit()
    return None
