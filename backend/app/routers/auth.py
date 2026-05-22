import secrets
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, Response, Request, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from pydantic import SecretStr
from fastapi_mail import FastMail, MessageSchema, ConnectionConfig

from app.database import get_db
from app.config import settings
from app.models.user import User, UserRole, UserSettings, RoleEnum
from app.schemas.auth import RegisterRequest, LoginRequest, TokenResponse, MeResponse, ForgotPasswordRequest, ResetPasswordRequest
from app.services import auth_service
from app.dependencies import get_current_user


from fastapi.responses import RedirectResponse
from app.models.oauth_token import OAuthToken
from app.services import github_service, gitlab_service, crypto_service
from app.schemas.analysis import GitHubStatusResponse
from app.ai_providers import PROVIDERS
from app.schemas.ai_credential import (
    AiProviderCatalogResponse,
    AiProviderCatalogItem,
    AiModelOption,
    AiCredentialListResponse,
    AiCredentialResponse,
    AiCredentialUpsertRequest,
)
from app.services import ai_credential_service

router = APIRouter(prefix="/auth", tags=["authentication"])

_mail_conf: ConnectionConfig | None = None


def _get_mail_conf() -> ConnectionConfig:
    """Lazy-init mail config (Pydantic v2 + Python 3.14 need SecretStr in rebuild namespace)."""
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


async def send_reset_email(email: str, token: str):
    reset_link = f"{settings.FRONTEND_URL}/reset-password?token={token}"
    message = MessageSchema(
        subject="Password Reset Request",
        recipients=[email],
        body=f"Click the link to reset your password: {reset_link}",
        subtype="html"
    )
    fm = FastMail(_get_mail_conf())
    await fm.send_message(message)

@router.post("/register", status_code=status.HTTP_201_CREATED, response_model=MeResponse)
async def register(request: RegisterRequest, db: AsyncSession = Depends(get_db)):
    # Check if email exists
    result = await db.execute(select(User).where(User.email == request.email))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Email already registered")

    # Create User
    hashed_pw = auth_service.hash_password(request.password)
    user = User(email=request.email, password_hash=hashed_pw, name=request.name)
    db.add(user)
    await db.flush() # Get user.id

    # Create UserRole
    role = UserRole(user_id=user.id, role=RoleEnum.USER)
    db.add(role)

    # Create UserSettings
    user_settings = UserSettings(user_id=user.id)
    db.add(user_settings)

    await db.commit()
    await db.refresh(user)
    return user

@router.post("/login", response_model=MeResponse)
async def login(request: LoginRequest, response: Response, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == request.email))
    user = result.scalar_one_or_none()

    if not user or not auth_service.verify_password(request.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    access_token = auth_service.create_access_token(user.id)
    refresh_token = auth_service.create_refresh_token(user.id)

    response.set_cookie(
        key="access_token",
        value=access_token,
        httponly=True,
        secure=False, # Set True in production
        samesite="lax"
    )
    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        secure=False, # Set True in production
        samesite="lax"
    )

    return user

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

    user_id = payload.get("sub")
    access_token = auth_service.create_access_token(int(user_id))

    response.set_cookie(
        key="access_token",
        value=access_token,
        httponly=True,
        secure=False,
        samesite="lax"
    )
    return {"message": "token refreshed"}

@router.get("/me", response_model=MeResponse)
async def me(current_user: User = Depends(get_current_user)):
    return current_user

@router.post("/forgot-password")
async def forgot_password(body: ForgotPasswordRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == body.email))
    user = result.scalar_one_or_none()

    if user:
        token = secrets.token_urlsafe(32)
        expires = datetime.utcnow() + timedelta(hours=1)

        # Update UserSettings
        settings_res = await db.execute(select(UserSettings).where(UserSettings.user_id == user.id))
        user_settings = settings_res.scalar_one_or_none()
        if user_settings:
            user_settings.reset_token = token
            user_settings.reset_token_expires = expires
            await db.commit()
            await send_reset_email(user.email, token)

    return {"message": "If this email is registered, a reset link has been sent"}

@router.post("/reset-password")
async def reset_password(body: ResetPasswordRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(UserSettings).where(UserSettings.reset_token == body.token))
    user_settings = result.scalar_one_or_none()

    if not user_settings or user_settings.reset_token_expires < datetime.utcnow():
        raise HTTPException(status_code=400, detail="Invalid or expired token")

    # Get User
    user_res = await db.execute(select(User).where(User.id == user_settings.user_id))
    user = user_res.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user.password_hash = auth_service.hash_password(body.new_password)
    user_settings.reset_token = None
    user_settings.reset_token_expires = None

    await db.commit()
    return {"message": "Password has been reset"}


# ── GitHub OAuth ───────────────────────────────────────────────

@router.get("/github/authorize")
async def github_authorize(current_user: User = Depends(get_current_user)):
    # Use user ID or token as state to prevent CSRF and correlate callback
    state = auth_service.create_access_token(current_user.id)
    url = github_service.get_authorize_url(state)
    return RedirectResponse(url)


@router.get("/github/callback")
async def github_callback(code: str, state: str, db: AsyncSession = Depends(get_db)):
    # Validate state (which is a JWT token containing user_id)
    payload = auth_service.decode_token(state)
    if not payload or payload.get("type") != "access":
        raise HTTPException(status_code=400, detail="Invalid state token")
    
    user_id = int(payload.get("sub"))
    
    # Exchange code for token
    access_token = await github_service.exchange_code_for_token(code)
    
    # Encrypt token
    encrypted_token = crypto_service.encrypt_token(access_token)
    
    # Store token in DB
    result = await db.execute(select(OAuthToken).where(OAuthToken.user_id == user_id, OAuthToken.provider == "github"))
    existing_token = result.scalar_one_or_none()
    
    if existing_token:
        existing_token.access_token_encrypted = encrypted_token
    else:
        new_token = OAuthToken(user_id=user_id, provider="github", access_token_encrypted=encrypted_token)
        db.add(new_token)
        
    await db.commit()
    
    # Redirect to frontend
    return RedirectResponse(f"{settings.FRONTEND_URL}/git-connect?connected=true&provider=github")


@router.get("/github/status", response_model=GitHubStatusResponse)
async def github_status(current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(OAuthToken).where(OAuthToken.user_id == current_user.id, OAuthToken.provider == "github"))
    token_obj = result.scalar_one_or_none()
    
    if not token_obj:
        return {"connected": False}
        
    try:
        decrypted_token = crypto_service.decrypt_token(token_obj.access_token_encrypted)
        profile = await github_service.fetch_user_profile(decrypted_token)
        return {
            "connected": True,
            "username": profile.get("login"),
            "avatar": profile.get("avatar_url")
        }
    except Exception:
        return {"connected": False}


@router.delete("/github/disconnect", status_code=status.HTTP_204_NO_CONTENT)
async def github_disconnect(current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(OAuthToken).where(OAuthToken.user_id == current_user.id, OAuthToken.provider == "github"))
    token_obj = result.scalar_one_or_none()
    if token_obj:
        await db.delete(token_obj)
        await db.commit()
    return None


# ── GitLab OAuth ───────────────────────────────────────────────

@router.get("/gitlab/authorize")
async def gitlab_authorize(current_user: User = Depends(get_current_user)):
    state = auth_service.create_access_token(current_user.id)
    url = gitlab_service.get_authorize_url(state)
    return RedirectResponse(url)


@router.get("/gitlab/callback")
async def gitlab_callback(code: str, state: str, db: AsyncSession = Depends(get_db)):
    payload = auth_service.decode_token(state)
    if not payload or payload.get("type") != "access":
        raise HTTPException(status_code=400, detail="Invalid state token")
    
    user_id = int(payload.get("sub"))
    access_token = await gitlab_service.exchange_code_for_token(code)
    encrypted_token = crypto_service.encrypt_token(access_token)
    
    result = await db.execute(select(OAuthToken).where(OAuthToken.user_id == user_id, OAuthToken.provider == "gitlab"))
    existing_token = result.scalar_one_or_none()
    
    if existing_token:
        existing_token.access_token_encrypted = encrypted_token
    else:
        new_token = OAuthToken(user_id=user_id, provider="gitlab", access_token_encrypted=encrypted_token)
        db.add(new_token)
        
    await db.commit()
    
    return RedirectResponse(f"{settings.FRONTEND_URL}/git-connect?connected=true&provider=gitlab")


@router.get("/gitlab/status", response_model=GitHubStatusResponse)
async def gitlab_status(current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(OAuthToken).where(OAuthToken.user_id == current_user.id, OAuthToken.provider == "gitlab"))
    token_obj = result.scalar_one_or_none()
    
    if not token_obj:
        return {"connected": False}
        
    try:
        decrypted_token = crypto_service.decrypt_token(token_obj.access_token_encrypted)
        profile = await gitlab_service.fetch_user_profile(decrypted_token)
        return {
            "connected": True,
            "username": profile.get("username"),
            "avatar": profile.get("avatar_url")
        }
    except Exception:
        return {"connected": False}


@router.delete("/gitlab/disconnect", status_code=status.HTTP_204_NO_CONTENT)
async def gitlab_disconnect(current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(OAuthToken).where(OAuthToken.user_id == current_user.id, OAuthToken.provider == "gitlab"))
    token_obj = result.scalar_one_or_none()
    if token_obj:
        await db.delete(token_obj)
        await db.commit()
    return None


# ── BYOK AI credentials ───────────────────────────────────────────

@router.get("/me/ai-providers/catalog", response_model=AiProviderCatalogResponse)
async def ai_providers_catalog(current_user: User = Depends(get_current_user)):
    providers = [
        AiProviderCatalogItem(
            id=pid,
            label=info["label"],
            models=[AiModelOption(**m) for m in info["models"]],
        )
        for pid, info in PROVIDERS.items()
    ]
    return AiProviderCatalogResponse(providers=providers)


@router.get("/me/ai-credentials", response_model=AiCredentialListResponse)
async def list_ai_credentials(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    rows = await ai_credential_service.list_credentials(db, current_user.id)
    creds = [AiCredentialResponse.model_validate(r) for r in rows]
    return AiCredentialListResponse(
        credentials=creds,
        has_active=any(c.is_active for c in creds),
    )


@router.put("/me/ai-credentials/{provider}", response_model=AiCredentialResponse)
async def upsert_ai_credential(
    provider: str,
    body: AiCredentialUpsertRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    row = await ai_credential_service.upsert_credential(
        db, current_user.id, provider, body.api_key, body.model_id
    )
    return AiCredentialResponse.model_validate(row)


@router.post("/me/ai-credentials/{credential_id}/activate", response_model=AiCredentialResponse)
async def activate_ai_credential(
    credential_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    row = await ai_credential_service.set_active(db, current_user.id, credential_id)
    return AiCredentialResponse.model_validate(row)


@router.delete("/me/ai-credentials/{credential_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_ai_credential(
    credential_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await ai_credential_service.delete_credential(db, current_user.id, credential_id)
    return None
