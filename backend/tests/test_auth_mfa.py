from datetime import timedelta

import pytest
from fastapi import Response

from app.models.time import utcnow
from app.models.user import User, UserOtpCode
from app.routers.auth import verify_mfa
from app.schemas.auth import VerifyMfaRequest
from app.services import auth_service


@pytest.mark.anyio
async def test_verify_mfa_uses_latest_active_login_code(db):
    user = User(
        email="mfa-user@example.com",
        name="MFA User",
        password_hash=auth_service.hash_password("correct-password"),
        is_verified=True,
    )
    db.add(user)
    await db.flush()

    now = utcnow()
    db.add_all([
        UserOtpCode(
            user_id=user.id,
            code_hash=auth_service.hash_otp("111111"),
            expires_at=now + timedelta(minutes=5),
            purpose="login",
            created_at=now,
        ),
        UserOtpCode(
            user_id=user.id,
            code_hash=auth_service.hash_otp("222222"),
            expires_at=now + timedelta(minutes=5),
            purpose="login",
            created_at=now + timedelta(seconds=1),
        ),
    ])
    await db.commit()

    result = await verify_mfa(
        VerifyMfaRequest(email=user.email, code="222222"),
        Response(),
        db,
    )

    assert result.email == user.email
