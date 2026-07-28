import hashlib
import hmac
import secrets
import time
from typing import Optional
from jose import JWTError, jwt

from app.config import settings


ADMIN_TOKEN_EXPIRE_MINUTES = 10
ADMIN_JWT_ALGORITHM = "HS256"


def _admin_jwt_secret() -> str:
    return settings.SECRET_KEY + ":admin"


def create_admin_token(user_id: int, expires_in_minutes: int = ADMIN_TOKEN_EXPIRE_MINUTES) -> str:
    expire = time.time() + expires_in_minutes * 60
    payload = {
        "sub": str(user_id),
        "type": "admin",
        "exp": expire,
    }
    return jwt.encode(payload, _admin_jwt_secret(), algorithm=ADMIN_JWT_ALGORITHM)


def decode_admin_token(token: str) -> Optional[dict]:
    try:
        payload = jwt.decode(token, _admin_jwt_secret(), algorithms=[ADMIN_JWT_ALGORITHM])
        if payload.get("type") != "admin":
            return None
        return payload
    except JWTError:
        return None


def generate_otp(length: int = 6) -> str:
    return str(secrets.randbelow(10**length)).zfill(length)


def hash_otp(code: str) -> str:
    return hashlib.sha256(code.encode()).hexdigest()


def verify_otp(code: str, code_hash: str) -> bool:
    return hmac.compare_digest(hash_otp(code), code_hash)
