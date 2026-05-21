import secrets
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, Response, Request, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from fastapi_mail import FastMail, MessageSchema, ConnectionConfig

from app.database import get_db
from app.config import settings
from app.models.user import User, UserRole, UserSettings, RoleEnum
from app.schemas.auth import RegisterRequest, LoginRequest, TokenResponse, MeResponse, ForgotPasswordRequest, ResetPasswordRequest
from app.services import auth_service
from app.dependencies import get_current_user

router = APIRouter(prefix="/auth", tags=["authentication"])

# Mail configuration
mail_conf = ConnectionConfig(
    MAIL_USERNAME=settings.MAIL_USERNAME,
    MAIL_PASSWORD=settings.MAIL_PASSWORD,
    MAIL_FROM=settings.MAIL_FROM,
    MAIL_PORT=settings.MAIL_PORT,
    MAIL_SERVER=settings.MAIL_SERVER,
    MAIL_FROM_NAME="Pagemark AI",
    MAIL_STARTTLS=True,
    MAIL_SSL_TLS=False,
)

async def send_reset_email(email: str, token: str):
    reset_link = f"{settings.FRONTEND_URL}/reset-password?token={token}"
    message = MessageSchema(
        subject="Password Reset Request",
        recipients=[email],
        body=f"Click the link to reset your password: {reset_link}",
        subtype="html"
    )
    fm = FastMail(mail_conf)
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
