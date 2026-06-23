"""Admin dashboard router — superuser management of users, orgs, system settings, and activity."""

import secrets
from datetime import datetime, timedelta
from app.models.time import utcnow
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func, case
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models.user import User, UserSettings
from app.models.organization import Organization, OrganizationMember, OrgMemberRole
from app.models.project import Project
from app.models.document import Document, Section
from app.models.admin import AdminOtpCode, SuperuserRequest, SuperuserRequestStatus, SystemSettings
from app.models.activity import ActivityEvent
from app.schemas.admin import (
    AdminLoginRequest, AdminLoginResponse,
    AdminVerifyOtpRequest, AdminVerifyOtpResponse,
    AdminMeResponse,
    SuperuserRequestCreate, SuperuserRequestOut, SuperuserRequestAction,
    SystemStats, GrowthDataResponse, GrowthDataPoint,
    AdminUserOut, AdminUserUpdate, AdminUserListResponse,
    AdminOrganizationOut, AdminOrganizationUpdate, AdminOrganizationListResponse,
    SystemSettingsOut, SystemSettingsUpdate,
    AdminActivityEvent, AdminActivityResponse,
)
from app.services import auth_service, admin_auth_service
from app.dependencies import require_superuser
from app.config import settings

router = APIRouter(prefix="/admin", tags=["admin"])


# ── Email helper (reuse pattern from auth.py) ────────────────────

from fastapi_mail import FastMail, MessageSchema, ConnectionConfig
from pydantic import SecretStr

_mail_conf: ConnectionConfig | None = None

def _get_mail_conf() -> ConnectionConfig:
    global _mail_conf
    if _mail_conf is None:
        ConnectionConfig.model_rebuild(_types_namespace={"SecretStr": SecretStr})
        _mail_conf = ConnectionConfig(
            MAIL_USERNAME=settings.MAIL_USERNAME,
            MAIL_PASSWORD=settings.MAIL_PASSWORD,
            MAIL_FROM=settings.MAIL_FROM,
            MAIL_PORT=settings.MAIL_PORT,
            MAIL_SERVER=settings.MAIL_SERVER,
            MAIL_FROM_NAME="Pagemark Admin",
            MAIL_STARTTLS=True,
            MAIL_SSL_TLS=False,
        )
    return _mail_conf


async def _send_email(subject: str, recipient: str, body: str):
    message = MessageSchema(subject=subject, recipients=[recipient], body=body, subtype="html")
    await FastMail(_get_mail_conf()).send_message(message)


# ── Helpers ──────────────────────────────────────────────────────

async def _get_or_create_settings(db: AsyncSession) -> SystemSettings:
    result = await db.execute(select(SystemSettings).limit(1))
    settings_row = result.scalar_one_or_none()
    if not settings_row:
        settings_row = SystemSettings(id=1)
        db.add(settings_row)
        await db.commit()
        await db.refresh(settings_row)
    return settings_row


async def _get_user_count(db: AsyncSession) -> int:
    result = await db.execute(select(func.count(User.id)))
    return result.scalar() or 0


async def _get_org_count(db: AsyncSession) -> int:
    result = await db.execute(select(func.count(Organization.id)))
    return result.scalar() or 0


async def _get_project_count(db: AsyncSession) -> int:
    result = await db.execute(select(func.count(Project.id)))
    return result.scalar() or 0


async def _get_document_count(db: AsyncSession) -> int:
    result = await db.execute(select(func.count(Document.id)))
    return result.scalar() or 0


# ── Auth endpoints ───────────────────────────────────────────────

@router.post("/auth/login", response_model=AdminLoginResponse)
async def admin_login(
    body: AdminLoginRequest,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(User).where(User.email == body.email))
    user = result.scalar_one_or_none()
    if not user or not auth_service.verify_password(body.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    if not user.is_superuser:
        raise HTTPException(status_code=403, detail="Not authorized as admin")
    if user.is_suspended:
        raise HTTPException(status_code=403, detail="Account suspended")

    settings_row = await _get_or_create_settings(db)
    otp_expiry = settings_row.otp_expiry_minutes

    code = admin_auth_service.generate_otp()
    code_hash = admin_auth_service.hash_otp(code)
    expires_at = utcnow() + timedelta(minutes=otp_expiry)

    otp_record = AdminOtpCode(
        user_id=user.id,
        code_hash=code_hash,
        expires_at=expires_at,
    )
    db.add(otp_record)
    await db.commit()

    try:
        await _send_email(
            "Your Pagemark admin verification code",
            user.email,
            f"""
            <h2>Admin Login Verification</h2>
            <p>Your verification code is:</p>
            <p style="font-size:24px;font-weight:bold;letter-spacing:4px;text-align:center;padding:16px;background:#f4f4f5;border-radius:8px;">
                {code}
            </p>
            <p>This code expires in {otp_expiry} minutes.</p>
            <p>If you did not request this, please ignore this email.</p>
            """,
        )
    except Exception:
        pass

    return AdminLoginResponse(requires_otp=True, message=f"OTP sent to {user.email}")


@router.post("/auth/verify-otp", response_model=AdminVerifyOtpResponse)
async def admin_verify_otp(
    body: AdminVerifyOtpRequest,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(User).where(User.email == body.email))
    user = result.scalar_one_or_none()
    if not user or not user.is_superuser or user.is_suspended:
        raise HTTPException(status_code=401, detail="Invalid request")

    settings_row = await _get_or_create_settings(db)
    timeout = settings_row.admin_session_timeout_minutes

    otp_result = await db.execute(
        select(AdminOtpCode)
        .where(
            AdminOtpCode.user_id == user.id,
            AdminOtpCode.used == False,
            AdminOtpCode.expires_at > utcnow(),
        )
        .order_by(AdminOtpCode.created_at.desc())
        .limit(1)
    )
    otp_record = otp_result.scalar_one_or_none()
    if not otp_record:
        raise HTTPException(status_code=401, detail="No valid OTP found. Request a new one.")

    if not admin_auth_service.verify_otp(body.code, otp_record.code_hash):
        raise HTTPException(status_code=401, detail="Invalid OTP code")

    otp_record.used = True
    await db.commit()

    token = admin_auth_service.create_admin_token(user.id, expires_in_minutes=timeout)
    return AdminVerifyOtpResponse(access_token=token, expires_in_minutes=timeout)


@router.get("/auth/me", response_model=AdminMeResponse)
async def admin_me(
    current_user: User = Depends(require_superuser),
):
    return AdminMeResponse(
        id=current_user.id,
        email=current_user.email,
        name=current_user.name,
        is_superuser=current_user.is_superuser,
    )


@router.post("/auth/request-signup", status_code=201)
async def request_superuser(
    body: SuperuserRequestCreate,
    db: AsyncSession = Depends(get_db),
):
    existing = await db.execute(
        select(SuperuserRequest).where(
            SuperuserRequest.email == body.email,
            SuperuserRequest.status == SuperuserRequestStatus.PENDING,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="A pending request already exists for this email")

    user_exists = await db.execute(select(User).where(User.email == body.email))
    if user_exists.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="A user with this email already exists")

    request = SuperuserRequest(
        email=body.email,
        name=body.name,
        justification=body.justification,
    )
    db.add(request)
    await db.commit()
    return {"message": "Request submitted. An existing admin will review it."}


@router.get("/auth/pending-requests", response_model=list[SuperuserRequestOut])
async def get_pending_requests(
    current_user: User = Depends(require_superuser),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(SuperuserRequest)
        .where(SuperuserRequest.status == SuperuserRequestStatus.PENDING)
        .order_by(SuperuserRequest.created_at.desc())
    )
    return result.scalars().all()


@router.post("/auth/approve-request/{request_id}")
async def approve_superuser_request(
    request_id: int,
    body: SuperuserRequestAction,
    current_user: User = Depends(require_superuser),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(SuperuserRequest).where(SuperuserRequest.id == request_id))
    req = result.scalar_one_or_none()
    if not req or req.status != SuperuserRequestStatus.PENDING:
        raise HTTPException(status_code=404, detail="Pending request not found")

    if body.action == "approve":
        existing_user = await db.execute(select(User).where(User.email == req.email))
        user = existing_user.scalar_one_or_none()
        if not user:
            password = secrets.token_urlsafe(16)
            user = User(
                email=req.email,
                name=req.name or req.email.split("@")[0],
                password_hash=auth_service.hash_password(password),
                is_superuser=True,
                is_verified=True,
            )
            db.add(user)
            await db.flush()
            try:
                await _send_email(
                    "Your admin account has been approved",
                    req.email,
                    f"""
                    <h2>Admin Account Approved</h2>
                    <p>Your superuser request has been approved.</p>
                    <p>Your temporary password: <strong>{password}</strong></p>
                    <p>Please log in at the admin panel and change your password.</p>
                    """,
                )
            except Exception:
                pass
        else:
            user.is_superuser = True
            user.is_suspended = False

        req.status = SuperuserRequestStatus.APPROVED
        req.reviewer_id = current_user.id
        req.reviewed_at = utcnow()
        await db.commit()
        return {"message": f"Superuser request approved for {req.email}"}

    elif body.action == "reject":
        req.status = SuperuserRequestStatus.REJECTED
        req.reviewer_id = current_user.id
        req.reviewed_at = utcnow()
        await db.commit()

        try:
            await _send_email(
                "Your admin request was not approved",
                req.email,
                f"<p>Your request for superuser access to Pagemark has been declined.</p>",
            )
        except Exception:
            pass

        return {"message": f"Superuser request rejected for {req.email}"}

    raise HTTPException(status_code=400, detail="Invalid action")


@router.post("/auth/logout")
async def admin_logout():
    return {"message": "Logged out. Discard your admin token."}


# ── Stats ────────────────────────────────────────────────────────

@router.get("/stats", response_model=SystemStats)
async def get_system_stats(
    current_user: User = Depends(require_superuser),
    db: AsyncSession = Depends(get_db),
):
    total_users = await _get_user_count(db)
    total_organizations = await _get_org_count(db)
    total_projects = await _get_project_count(db)
    total_documents = await _get_document_count(db)

    cutoff_24h = utcnow() - timedelta(hours=24)
    cutoff_7d = utcnow() - timedelta(days=7)
    cutoff_30d = utcnow() - timedelta(days=30)

    active_24h_result = await db.execute(
        select(func.count(ActivityEvent.id)).where(ActivityEvent.created_at > cutoff_24h)
    )
    active_7d_result = await db.execute(
        select(func.count(ActivityEvent.id)).where(ActivityEvent.created_at > cutoff_7d)
    )
    active_30d_result = await db.execute(
        select(func.count(ActivityEvent.id)).where(ActivityEvent.created_at > cutoff_30d)
    )

    gen_result = await db.execute(
        select(func.count(Section.id)).where(Section.content_md.isnot(None))
    )

    pending_result = await db.execute(
        select(func.count(SuperuserRequest.id)).where(
            SuperuserRequest.status == SuperuserRequestStatus.PENDING
        )
    )

    return SystemStats(
        total_users=total_users,
        total_organizations=total_organizations,
        total_projects=total_projects,
        total_documents=total_documents,
        active_users_last_24h=active_24h_result.scalar() or 0,
        active_users_last_7d=active_7d_result.scalar() or 0,
        active_users_last_30d=active_30d_result.scalar() or 0,
        documents_generated=gen_result.scalar() or 0,
        pending_superuser_requests=pending_result.scalar() or 0,
    )


@router.get("/stats/growth", response_model=GrowthDataResponse)
async def get_growth_data(
    days: int = Query(30, ge=1, le=365),
    current_user: User = Depends(require_superuser),
    db: AsyncSession = Depends(get_db),
):
    cutoff = utcnow() - timedelta(days=days)

    user_trunc = func.date_trunc("day", User.created_at)
    users_result = await db.execute(
        select(user_trunc.label("date"), func.count(User.id).label("count"))
        .where(User.created_at > cutoff)
        .group_by(user_trunc)
        .order_by(user_trunc)
    )
    users_by_day = {str(row.date): row.count for row in users_result}

    org_trunc = func.date_trunc("day", Organization.created_at)
    orgs_result = await db.execute(
        select(org_trunc.label("date"), func.count(Organization.id).label("count"))
        .where(Organization.created_at > cutoff)
        .group_by(org_trunc)
        .order_by(org_trunc)
    )
    orgs_by_day = {str(row.date): row.count for row in orgs_result}

    proj_trunc = func.date_trunc("day", Project.created_at)
    projects_result = await db.execute(
        select(proj_trunc.label("date"), func.count(Project.id).label("count"))
        .where(Project.created_at > cutoff)
        .group_by(proj_trunc)
        .order_by(proj_trunc)
    )
    projects_by_day = {str(row.date): row.count for row in projects_result}

    doc_trunc = func.date_trunc("day", Document.created_at)
    docs_result = await db.execute(
        select(doc_trunc.label("date"), func.count(Document.id).label("count"))
        .where(Document.created_at > cutoff)
        .group_by(doc_trunc)
        .order_by(doc_trunc)
    )
    docs_by_day = {str(row.date): row.count for row in docs_result}

    all_dates = sorted(set(
        list(users_by_day.keys())
        + list(orgs_by_day.keys())
        + list(projects_by_day.keys())
        + list(docs_by_day.keys())
    ))

    data = [
        GrowthDataPoint(
            date=d,
            users=users_by_day.get(d, 0),
            organizations=orgs_by_day.get(d, 0),
            projects=projects_by_day.get(d, 0),
            documents=docs_by_day.get(d, 0),
        )
        for d in all_dates
    ]

    return GrowthDataResponse(data=data)


# ── User management ──────────────────────────────────────────────

@router.get("/users", response_model=AdminUserListResponse)
async def list_users(
    search: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    current_user: User = Depends(require_superuser),
    db: AsyncSession = Depends(get_db),
):
    query = select(User)

    if search:
        query = query.where(
            User.email.ilike(f"%{search}%") | User.name.ilike(f"%{search}%")
        )

    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    query = query.order_by(User.created_at.desc()).offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(query)
    users = result.scalars().all()

    user_list = []
    for u in users:
        org_count_result = await db.execute(
            select(func.count(OrganizationMember.id))
            .where(OrganizationMember.user_id == u.id)
        )
        org_count = org_count_result.scalar() or 0

        user_list.append(AdminUserOut(
            id=u.id,
            email=u.email,
            name=u.name,
            is_verified=u.is_verified,
            is_superuser=u.is_superuser,
            is_suspended=u.is_suspended,
            login_count=u.login_count,
            created_at=u.created_at,
            updated_at=u.updated_at,
            organization_count=org_count,
        ))

    return AdminUserListResponse(users=user_list, total=total, page=page, page_size=page_size)


@router.get("/users/{user_id}", response_model=AdminUserOut)
async def get_user_detail(
    user_id: int,
    current_user: User = Depends(require_superuser),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    org_count_result = await db.execute(
        select(func.count(OrganizationMember.id))
        .where(OrganizationMember.user_id == user.id)
    )

    return AdminUserOut(
        id=user.id,
        email=user.email,
        name=user.name,
        is_verified=user.is_verified,
        is_superuser=user.is_superuser,
        is_suspended=user.is_suspended,
        login_count=user.login_count,
        created_at=user.created_at,
        updated_at=user.updated_at,
        organization_count=org_count_result.scalar() or 0,
    )


@router.patch("/users/{user_id}", response_model=AdminUserOut)
async def update_user(
    user_id: int,
    body: AdminUserUpdate,
    current_user: User = Depends(require_superuser),
    db: AsyncSession = Depends(get_db),
):
    if user_id == current_user.id and body.is_suspended is True:
        raise HTTPException(status_code=400, detail="Cannot suspend yourself")

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if body.is_suspended is not None:
        user.is_suspended = body.is_suspended
    if body.is_superuser is not None:
        user.is_superuser = body.is_superuser
    if body.name is not None:
        user.name = body.name

    await db.commit()
    await db.refresh(user)

    org_count_result = await db.execute(
        select(func.count(OrganizationMember.id))
        .where(OrganizationMember.user_id == user.id)
    )

    return AdminUserOut(
        id=user.id,
        email=user.email,
        name=user.name,
        is_verified=user.is_verified,
        is_superuser=user.is_superuser,
        is_suspended=user.is_suspended,
        login_count=user.login_count,
        created_at=user.created_at,
        updated_at=user.updated_at,
        organization_count=org_count_result.scalar() or 0,
    )


# ── Organization management ──────────────────────────────────────

@router.get("/organizations", response_model=AdminOrganizationListResponse)
async def list_organizations(
    search: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    current_user: User = Depends(require_superuser),
    db: AsyncSession = Depends(get_db),
):
    query = select(Organization)

    if search:
        query = query.where(
            Organization.name.ilike(f"%{search}%") | Organization.slug.ilike(f"%{search}%")
        )

    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    query = query.order_by(Organization.created_at.desc()).offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(query)
    orgs = result.scalars().all()

    org_list = []
    for org in orgs:
        member_count_result = await db.execute(
            select(func.count(OrganizationMember.id))
            .where(OrganizationMember.org_id == org.id)
        )
        project_count_result = await db.execute(
            select(func.count(Project.id))
            .where(Project.org_id == org.id)
        )

        org_list.append(AdminOrganizationOut(
            id=org.id,
            name=org.name,
            slug=org.slug,
            personal=org.personal,
            quality_threshold=org.quality_threshold,
            created_by=org.created_by,
            created_at=org.created_at,
            member_count=member_count_result.scalar() or 0,
            project_count=project_count_result.scalar() or 0,
        ))

    return AdminOrganizationListResponse(
        organizations=org_list, total=total, page=page, page_size=page_size
    )


@router.get("/organizations/{org_id}", response_model=AdminOrganizationOut)
async def get_organization_detail(
    org_id: int,
    current_user: User = Depends(require_superuser),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Organization).where(Organization.id == org_id))
    org = result.scalar_one_or_none()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")

    member_count_result = await db.execute(
        select(func.count(OrganizationMember.id))
        .where(OrganizationMember.org_id == org.id)
    )
    project_count_result = await db.execute(
        select(func.count(Project.id))
        .where(Project.org_id == org.id)
    )

    return AdminOrganizationOut(
        id=org.id,
        name=org.name,
        slug=org.slug,
        personal=org.personal,
        quality_threshold=org.quality_threshold,
        created_by=org.created_by,
        created_at=org.created_at,
        member_count=member_count_result.scalar() or 0,
        project_count=project_count_result.scalar() or 0,
    )


@router.patch("/organizations/{org_id}", response_model=AdminOrganizationOut)
async def update_organization(
    org_id: int,
    body: AdminOrganizationUpdate,
    current_user: User = Depends(require_superuser),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Organization).where(Organization.id == org_id))
    org = result.scalar_one_or_none()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")

    if body.name is not None:
        org.name = body.name
    if body.quality_threshold is not None:
        if not 0 <= body.quality_threshold <= 100:
            raise HTTPException(status_code=400, detail="Quality threshold must be 0-100")
        org.quality_threshold = body.quality_threshold
    if body.is_suspended is not None:
        members_result = await db.execute(
            select(OrganizationMember).where(
                OrganizationMember.org_id == org.id,
                OrganizationMember.status == "active",
            )
        )
        members = members_result.scalars().all()
        new_status = "suspended" if body.is_suspended else "active"
        for member in members:
            member.status = new_status

    await db.commit()
    await db.refresh(org)

    member_count_result = await db.execute(
        select(func.count(OrganizationMember.id))
        .where(OrganizationMember.org_id == org.id)
    )
    project_count_result = await db.execute(
        select(func.count(Project.id))
        .where(Project.org_id == org.id)
    )

    return AdminOrganizationOut(
        id=org.id,
        name=org.name,
        slug=org.slug,
        personal=org.personal,
        quality_threshold=org.quality_threshold,
        created_by=org.created_by,
        created_at=org.created_at,
        member_count=member_count_result.scalar() or 0,
        project_count=project_count_result.scalar() or 0,
    )


# ── System settings ──────────────────────────────────────────────

@router.get("/settings", response_model=SystemSettingsOut)
async def get_system_settings(
    current_user: User = Depends(require_superuser),
    db: AsyncSession = Depends(get_db),
):
    settings_row = await _get_or_create_settings(db)
    return SystemSettingsOut(
        allow_public_signup=settings_row.allow_public_signup,
        default_org_quality_threshold=settings_row.default_org_quality_threshold,
        maintenance_mode=settings_row.maintenance_mode,
        max_orgs_per_user=settings_row.max_orgs_per_user,
        admin_session_timeout_minutes=settings_row.admin_session_timeout_minutes,
        otp_expiry_minutes=settings_row.otp_expiry_minutes,
    )


@router.patch("/settings", response_model=SystemSettingsOut)
async def update_system_settings(
    body: SystemSettingsUpdate,
    current_user: User = Depends(require_superuser),
    db: AsyncSession = Depends(get_db),
):
    settings_row = await _get_or_create_settings(db)

    if body.allow_public_signup is not None:
        settings_row.allow_public_signup = body.allow_public_signup
    if body.default_org_quality_threshold is not None:
        if not 0 <= body.default_org_quality_threshold <= 100:
            raise HTTPException(status_code=400, detail="Quality threshold must be 0-100")
        settings_row.default_org_quality_threshold = body.default_org_quality_threshold
    if body.maintenance_mode is not None:
        settings_row.maintenance_mode = body.maintenance_mode
    if body.max_orgs_per_user is not None:
        settings_row.max_orgs_per_user = body.max_orgs_per_user
    if body.admin_session_timeout_minutes is not None:
        settings_row.admin_session_timeout_minutes = body.admin_session_timeout_minutes
    if body.otp_expiry_minutes is not None:
        settings_row.otp_expiry_minutes = body.otp_expiry_minutes

    await db.commit()
    await db.refresh(settings_row)

    return SystemSettingsOut(
        allow_public_signup=settings_row.allow_public_signup,
        default_org_quality_threshold=settings_row.default_org_quality_threshold,
        maintenance_mode=settings_row.maintenance_mode,
        max_orgs_per_user=settings_row.max_orgs_per_user,
        admin_session_timeout_minutes=settings_row.admin_session_timeout_minutes,
        otp_expiry_minutes=settings_row.otp_expiry_minutes,
    )


# ── Global activity ──────────────────────────────────────────────

@router.get("/activity", response_model=AdminActivityResponse)
async def get_global_activity(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    event_type: Optional[str] = Query(None),
    org_id: Optional[int] = Query(None),
    days: int = Query(30, ge=1, le=365),
    current_user: User = Depends(require_superuser),
    db: AsyncSession = Depends(get_db),
):
    cutoff = utcnow() - timedelta(days=days)

    query = (
        select(
            ActivityEvent,
            Project.name.label("project_name"),
            Project.org_id.label("event_org_id"),
            Organization.name.label("organization_name"),
        )
        .outerjoin(Project, ActivityEvent.project_id == Project.id)
        .outerjoin(Organization, Project.org_id == Organization.id)
        .where(ActivityEvent.created_at > cutoff)
    )

    if event_type:
        query = query.where(ActivityEvent.event_type == event_type)
    if org_id:
        query = query.where(Project.org_id == org_id)

    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    query = query.order_by(ActivityEvent.created_at.desc()).offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(query)
    rows = result.all()

    activity_events = []
    activity_service_result = None
    try:
        from app.services.activity_service import EVENT_MESSAGES
        activity_service_result = EVENT_MESSAGES
    except ImportError:
        pass

    ACTIVITY_MESSAGES = activity_service_result or {}

    for row in rows:
        event = row[0]
        project_name = row[1]
        event_org_id = row[2]
        org_name = row[3]

        activity_events.append(AdminActivityEvent(
            id=event.id,
            event_type=event.event_type,
            message=ACTIVITY_MESSAGES.get(event.event_type, event.event_type),
            project_id=event.project_id,
            project_name=project_name,
            organization_id=event_org_id,
            organization_name=org_name,
            created_at=event.created_at,
        ))

    return AdminActivityResponse(
        events=activity_events,
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get("/activity/event-types")
async def get_activity_event_types(
    current_user: User = Depends(require_superuser),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(ActivityEvent.event_type, func.count(ActivityEvent.id).label("count"))
        .group_by(ActivityEvent.event_type)
        .order_by(func.count(ActivityEvent.id).desc())
    )
    return [{"event_type": row[0], "count": row[1]} for row in result]
