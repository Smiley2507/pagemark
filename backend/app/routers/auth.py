"""
Updated auth router — adds org creation on register,
email verification flow, and login verification gate.
All existing OAuth + BYOK endpoints are preserved unchanged.
"""
import json
import secrets
from datetime import datetime, timedelta
import re
from fastapi import APIRouter, Depends, HTTPException, Response, Request, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from pydantic import SecretStr
from fastapi_mail import FastMail, MessageSchema, ConnectionConfig

from app.database import get_db
from app.config import settings
from app.models.user import User, UserRole, UserSettings, RoleEnum
from app.models.organization import Organization, OrganizationMember, OrgMemberRole, OrgMemberStatus
from app.models.audit import AuditLog
from app.schemas.auth import RegisterRequest, LoginRequest, MeResponse, UpdateMeRequest, ForgotPasswordRequest, ResetPasswordRequest
from app.services import auth_service
from app.dependencies import get_current_user
from fastapi.responses import RedirectResponse
from app.models.oauth_token import OAuthToken
from app.services import github_service, crypto_service
from app.schemas.analysis import GitHubStatusResponse
from app.ai_providers import PROVIDERS
from app.schemas.ai_credential import (
    AiProviderCatalogResponse, AiProviderCatalogItem, AiModelOption,
    AiProviderModelsResponse, AiCredentialListResponse, AiCredentialResponse, AiCredentialUpsertRequest,
    AiCredentialTestRequest, AiCredentialTestResponse,
)
from app.schemas.notification import (
    NotificationPreferences, NotificationPreferencesResponse, UpdateNotificationPreferencesRequest,
)
from app.services import ai_credential_service
from app.services.rate_limiter import rate_limit

router = APIRouter(prefix="/auth", tags=["authentication"])

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
            MAIL_FROM_NAME="Pagemark AI",
            MAIL_STARTTLS=True,
            MAIL_SSL_TLS=False,
        )
    return _mail_conf


async def _send_email(subject: str, recipient: str, body: str):
    message = MessageSchema(subject=subject, recipients=[recipient], body=body, subtype="html")
    await FastMail(_get_mail_conf()).send_message(message)


async def send_reset_email(email: str, token: str):
    link = f"{settings.FRONTEND_URL}/reset-password?token={token}"
    await _send_email("Password Reset Request", email, f"<p>Reset link: <a href='{link}'>{link}</a></p>")


async def send_verification_email(email: str, token: str):
    link = f"{settings.FRONTEND_URL}/verify-email?token={token}"
    body = (
        f"<h2>Welcome to Pagemark!</h2>"
        f"<p>Verify your email: <a href='{link}' style='background:#6366f1;color:#fff;"
        f"padding:10px 20px;border-radius:6px;text-decoration:none;'>Verify Email</a></p>"
        f"<p>This link expires in 24 hours.</p>"
    )
    await _send_email("Verify your Pagemark email", email, body)


def _make_slug(name: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")
    return slug + "-" + secrets.token_hex(4)


# ── Registration ──────────────────────────────────────────────────────────────

@router.post("/register", status_code=status.HTTP_201_CREATED, response_model=MeResponse)
async def register(request: RegisterRequest, db: AsyncSession = Depends(get_db), _: None = rate_limit(3, 60)):
    result = await db.execute(select(User).where(User.email == request.email))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Email already registered")

    user = User(
        email=request.email,
        password_hash=auth_service.hash_password(request.password),
        name=request.name,
        is_verified=False,
    )
    db.add(user)
    await db.flush()

    db.add(UserRole(user_id=user.id, role=RoleEnum.USER))

    verification_token = secrets.token_urlsafe(32)
    db.add(UserSettings(
        user_id=user.id,
        notifications_json=json.dumps(_get_default_notification_preferences()),
        verification_token=verification_token,
        verification_token_expires=datetime.utcnow() + timedelta(hours=24),
    ))

    org_name = request.organization_name or f"{request.name}'s Workspace"
    is_personal = not bool(request.organization_name)
    org = Organization(name=org_name, slug=_make_slug(org_name), created_by=user.id, personal=is_personal)
    db.add(org)
    await db.flush()

    db.add(OrganizationMember(
        org_id=org.id, user_id=user.id,
        role=OrgMemberRole.ADMIN, status=OrgMemberStatus.ACTIVE,
    ))

    await db.commit()
    await db.refresh(user)

    try:
        await send_verification_email(user.email, verification_token)
    except Exception:
        pass

    return MeResponse(
        id=user.id,
        email=user.email,
        name=user.name,
        avatar_url=user.avatar_url,
        is_verified=user.is_verified,
        is_first_login=True,
        created_at=user.created_at,
    )


@router.get("/verify-email")
async def verify_email(token: str, db: AsyncSession = Depends(get_db)):
    res = await db.execute(select(UserSettings).where(UserSettings.verification_token == token))
    us = res.scalar_one_or_none()
    if not us or not us.verification_token_expires or us.verification_token_expires < datetime.utcnow():
        raise HTTPException(status_code=400, detail="Invalid or expired verification token")

    user_res = await db.execute(select(User).where(User.id == us.user_id))
    user = user_res.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user.is_verified = True
    us.verification_token = None
    us.verification_token_expires = None
    await db.commit()
    return {"message": "Email verified successfully"}


# ── Login ─────────────────────────────────────────────────────────────────────

@router.post("/login", response_model=MeResponse)
async def login(request: LoginRequest, response: Response, db: AsyncSession = Depends(get_db), _: None = rate_limit(10, 60)):
    result = await db.execute(select(User).where(User.email == request.email))
    user = result.scalar_one_or_none()

    if not user or not auth_service.verify_password(request.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    if not user.is_verified:
        raise HTTPException(status_code=401, detail="Email not verified")

    is_first_login = user.login_count == 0
    user.login_count += 1
    await db.commit()

    for key, value in [
        ("access_token", auth_service.create_access_token(user.id)),
        ("refresh_token", auth_service.create_refresh_token(user.id)),
    ]:
        response.set_cookie(key=key, value=value, httponly=True, secure=True, samesite="none")

    return MeResponse(
        id=user.id,
        email=user.email,
        name=user.name,
        avatar_url=user.avatar_url,
        is_verified=user.is_verified,
        is_first_login=is_first_login,
        created_at=user.created_at,
    )


@router.post("/logout")
async def logout(response: Response):
    response.delete_cookie("access_token")
    response.delete_cookie("refresh_token")
    return {"message": "logged out"}


@router.post("/refresh")
async def refresh(request: Request, response: Response, db: AsyncSession = Depends(get_db)):
    refresh_token = request.cookies.get("refresh_token")
    if not refresh_token:
        raise HTTPException(status_code=401, detail="Refresh token missing")
    payload = auth_service.decode_token(refresh_token)
    if not payload or payload.get("type") != "refresh":
        raise HTTPException(status_code=401, detail="Invalid refresh token")
    response.set_cookie(
        key="access_token",
        value=auth_service.create_access_token(int(payload.get("sub"))),
        httponly=True, secure=True, samesite="none",
    )
    return {"message": "token refreshed"}


@router.get("/me", response_model=MeResponse)
async def me(current_user: User = Depends(get_current_user)):
    return current_user


@router.patch("/me", response_model=MeResponse)
async def update_me(body: UpdateMeRequest, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    if body.name is not None:
        current_user.name = body.name
    if body.avatar_url is not None:
        current_user.avatar_url = body.avatar_url
    if body.password is not None:
        current_user.password_hash = auth_service.hash_password(body.password)
    await db.commit()
    await db.refresh(current_user)
    return current_user


@router.post("/forgot-password")
async def forgot_password(body: ForgotPasswordRequest, db: AsyncSession = Depends(get_db), _: None = rate_limit(3, 60)):
    result = await db.execute(select(User).where(User.email == body.email))
    user = result.scalar_one_or_none()
    if user:
        token = secrets.token_urlsafe(32)
        settings_res = await db.execute(select(UserSettings).where(UserSettings.user_id == user.id))
        us = settings_res.scalar_one_or_none()
        if us:
            us.reset_token = token
            us.reset_token_expires = datetime.utcnow() + timedelta(hours=1)
            await db.commit()
            await send_reset_email(user.email, token)
    return {"message": "If this email is registered, a reset link has been sent"}


@router.post("/reset-password")
async def reset_password(body: ResetPasswordRequest, db: AsyncSession = Depends(get_db), _: None = rate_limit(5, 60)):
    result = await db.execute(select(UserSettings).where(UserSettings.reset_token == body.token))
    us = result.scalar_one_or_none()
    if not us or us.reset_token_expires < datetime.utcnow():
        raise HTTPException(status_code=400, detail="Invalid or expired token")
    user_res = await db.execute(select(User).where(User.id == us.user_id))
    user = user_res.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.password_hash = auth_service.hash_password(body.new_password)
    us.reset_token = None
    us.reset_token_expires = None
    await db.commit()
    return {"message": "Password has been reset"}


# ── GitHub OAuth ───────────────────────────────────────────────

def _missing_github_oauth_configuration() -> list[str]:
    required = {
        "GITHUB_CLIENT_ID": settings.GITHUB_CLIENT_ID,
        "GITHUB_CLIENT_SECRET": settings.GITHUB_CLIENT_SECRET,
        "GITHUB_REDIRECT_URI": settings.GITHUB_REDIRECT_URI,
        "ENCRYPTION_KEY": settings.ENCRYPTION_KEY,
    }
    return [key for key, value in required.items() if not str(value or "").strip()]


@router.get("/github/authorize")
async def github_authorize(current_user: User = Depends(get_current_user)):
    missing = _missing_github_oauth_configuration()
    if missing:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=(
                "GitHub OAuth is not configured. Set "
                f"{', '.join(missing)} before connecting GitHub accounts."
            ),
        )
    return RedirectResponse(github_service.get_authorize_url(auth_service.create_access_token(current_user.id)))


@router.get("/github/callback")
async def github_callback(code: str, state: str, db: AsyncSession = Depends(get_db), _: None = rate_limit(10, 60)):
    payload = auth_service.decode_token(state)
    if not payload or payload.get("type") != "access":
        raise HTTPException(status_code=400, detail="Invalid state token")
    user_id = int(payload.get("sub"))
    encrypted = crypto_service.encrypt_token(await github_service.exchange_code_for_token(code))
    res = await db.execute(select(OAuthToken).where(OAuthToken.user_id == user_id, OAuthToken.provider == "github"))
    tok = res.scalar_one_or_none()
    if tok:
        tok.access_token_encrypted = encrypted
    else:
        db.add(OAuthToken(user_id=user_id, provider="github", access_token_encrypted=encrypted))
    await db.commit()
    return RedirectResponse(f"{settings.FRONTEND_URL}/git-connect?connected=true&provider=github")


@router.get("/github/status", response_model=GitHubStatusResponse)
async def github_status(current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    missing = _missing_github_oauth_configuration()
    if missing:
        return {"connected": False, "configured": False, "missing_configuration": missing}

    res = await db.execute(select(OAuthToken).where(OAuthToken.user_id == current_user.id, OAuthToken.provider == "github"))
    tok = res.scalar_one_or_none()
    if not tok:
        return {"connected": False, "configured": True}
    try:
        profile = await github_service.fetch_user_profile(crypto_service.decrypt_token(tok.access_token_encrypted))
        return {
            "connected": True,
            "configured": True,
            "username": profile.get("login"),
            "avatar": profile.get("avatar_url"),
        }
    except Exception:
        return {"connected": False, "configured": True}


@router.delete("/github/disconnect", status_code=status.HTTP_204_NO_CONTENT)
async def github_disconnect(current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    res = await db.execute(select(OAuthToken).where(OAuthToken.user_id == current_user.id, OAuthToken.provider == "github"))
    tok = res.scalar_one_or_none()
    if tok:
        await db.delete(tok)
        await db.commit()
    return None


NOTIFICATION_CATEGORY_MAP: dict[str, str] = {
    "source_webhook_received": "source_sync",
    "source_sync": "source_sync",
    "generation_run_started": "generation",
    "generation_run_completed": "generation",
    "generation_run_failed": "generation",
    "section_generated": "generation",
    "freshness_detected": "stale_sections",
    "freshness_accepted": "stale_sections",
    "freshness_rejected": "stale_sections",
    "document_shared": "document_sharing",
    "share_updated": "document_sharing",
    "share_revoked": "document_sharing",
}

# Event types excluded from the category filter — always shown
ALWAYS_VISIBLE_EVENTS = {
    "source_webhook_received",
    "analysis_started", "analysis_complete", "analysis_failed",
    "document_created", "outline_approved",
    "section_reviewed", "project_created",
}


def _get_default_notification_preferences() -> dict[str, bool]:
    return {
        "member_activity": True,
        "document_sharing": True,
        "document_notes": True,
        "generation": True,
        "quality": True,
        "stale_sections": True,
        "source_sync": True,
        "invites": True,
    }


def _apply_notification_filter(
    events: list[dict],
    preferences: dict[str, bool],
) -> list[dict]:
    """Filter activity events based on user notification preferences."""
    return [
        event for event in events
        if event.get("event_type") in ALWAYS_VISIBLE_EVENTS
        or NOTIFICATION_CATEGORY_MAP.get(event.get("event_type", ""), "")
           in [cat for cat, enabled in preferences.items() if enabled]
    ]


@router.get("/me/notification-preferences", response_model=NotificationPreferencesResponse)
async def get_notification_preferences(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(UserSettings).where(UserSettings.user_id == current_user.id))
    user_settings = result.scalar_one_or_none()
    preferences = _get_default_notification_preferences()
    if user_settings and user_settings.notifications_json:
        try:
            stored = json.loads(user_settings.notifications_json)
            preferences.update(stored)
        except (json.JSONDecodeError, TypeError):
            pass
    return NotificationPreferencesResponse(preferences=NotificationPreferences(**preferences))


@router.put("/me/notification-preferences", response_model=NotificationPreferencesResponse)
async def update_notification_preferences(
    body: UpdateNotificationPreferencesRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(UserSettings).where(UserSettings.user_id == current_user.id))
    user_settings = result.scalar_one_or_none()
    if not user_settings:
        user_settings = UserSettings(user_id=current_user.id)
        db.add(user_settings)
    user_settings.notifications_json = json.dumps(body.preferences.model_dump())
    await db.commit()
    return NotificationPreferencesResponse(preferences=body.preferences)


# ── BYOK AI credentials ───────────────────────────────────────────

@router.get("/me/ai-providers/catalog", response_model=AiProviderCatalogResponse)
async def ai_providers_catalog(current_user: User = Depends(get_current_user)):
    providers = [
        AiProviderCatalogItem(id=pid, label=info["label"], models=[AiModelOption(**m) for m in info["models"]])
        for pid, info in PROVIDERS.items()
    ]
    return AiProviderCatalogResponse(providers=providers)


@router.get("/me/ai-credentials", response_model=AiCredentialListResponse)
async def list_ai_credentials(current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    rows = await ai_credential_service.list_credentials(db, current_user.id)
    creds = [AiCredentialResponse.model_validate(r) for r in rows]
    return AiCredentialListResponse(credentials=creds, has_active=any(c.is_active for c in creds))


@router.get("/me/ai-credentials/{provider}/models", response_model=AiProviderModelsResponse)
async def list_ai_credential_models(
    provider: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    models, source = await ai_credential_service.list_provider_models(db, current_user.id, provider)
    return AiProviderModelsResponse(
        provider=provider,
        models=[AiModelOption(**model) for model in models],
        source=source,
    )


@router.post("/me/ai-credentials/{provider}/test", response_model=AiCredentialTestResponse)
async def test_ai_credential(
    provider: str, body: AiCredentialTestRequest,
    current_user: User = Depends(get_current_user),
):
    from app.services.ai_service import validate_credential, AiServiceError
    try:
        validate_credential(provider, body.api_key, body.model_id)
        return AiCredentialTestResponse(success=True, message="Connection successful")
    except AiServiceError as e:
        return AiCredentialTestResponse(success=False, message=str(e))


@router.put("/me/ai-credentials/{provider}", response_model=AiCredentialResponse)
async def upsert_ai_credential(
    provider: str, body: AiCredentialUpsertRequest,
    current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db),
):
    cred = await ai_credential_service.upsert_credential(db, current_user.id, provider, body.api_key, body.model_id)
    db.add(AuditLog(
        user_id=current_user.id,
        org_id=None,
        action="upsert_ai_credential",
        resource=f"provider:{provider}:credential:{cred.id}",
    ))
    await db.commit()
    return AiCredentialResponse.model_validate(cred)


@router.post("/me/ai-credentials/{credential_id}/activate", response_model=AiCredentialResponse)
async def activate_ai_credential(
    credential_id: int,
    current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db),
):
    cred = await ai_credential_service.set_active(db, current_user.id, credential_id)
    db.add(AuditLog(
        user_id=current_user.id,
        org_id=None,
        action="activate_ai_credential",
        resource=f"credential:{credential_id}:provider:{cred.provider}",
    ))
    await db.commit()
    return AiCredentialResponse.model_validate(cred)


@router.delete("/me/ai-credentials/{credential_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_ai_credential(
    credential_id: int,
    current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db),
):
    await ai_credential_service.delete_credential(db, current_user.id, credential_id)
    db.add(AuditLog(
        user_id=current_user.id,
        org_id=None,
        action="delete_ai_credential",
        resource=f"credential:{credential_id}",
    ))
    await db.commit()
    return None
