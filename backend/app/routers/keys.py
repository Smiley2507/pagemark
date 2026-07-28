"""
API Keys router:
  GET    /users/api-keys         — list keys (metadata only, no raw key)
  POST   /users/api-keys         — create key; returns raw key ONCE
  DELETE /users/api-keys/{key_id} — revoke key
"""
import secrets
import hashlib
from datetime import datetime
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.models.key import UserAPIKey
from app.models.audit import AuditLog
from app.schemas.key import APIKeyCreate, APIKeyResponse

router = APIRouter(prefix="/users", tags=["api-keys"])


def _hash_key(raw: str) -> str:
    return hashlib.sha256(raw.encode()).hexdigest()


@router.get("/api-keys", response_model=List[APIKeyResponse])
async def list_api_keys(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    res = await db.execute(
        select(UserAPIKey)
        .where(UserAPIKey.user_id == current_user.id)
        .order_by(UserAPIKey.created_at.desc())
    )
    keys = res.scalars().all()
    # Never expose key_hash — return metadata only
    return [
        APIKeyResponse(
            id=k.id,
            name=k.name,
            created_at=k.created_at,
            expires_at=k.expires_at,
        )
        for k in keys
    ]


@router.post("/api-keys", status_code=status.HTTP_201_CREATED, response_model=APIKeyResponse)
async def create_api_key(
    body: APIKeyCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    raw_key = "pm_" + secrets.token_urlsafe(40)
    key_hash = _hash_key(raw_key)

    api_key = UserAPIKey(
        user_id=current_user.id,
        name=body.name,
        key_hash=key_hash,
        expires_at=body.expires_at,
    )
    db.add(api_key)
    await db.commit()
    await db.refresh(api_key)

    db.add(AuditLog(
        user_id=current_user.id,
        org_id=None,
        action="create_api_key",
        resource=f"key:{api_key.id}:name:{body.name}",
    ))
    await db.commit()

    # Return raw key exactly once
    return APIKeyResponse(
        id=api_key.id,
        name=api_key.name,
        created_at=api_key.created_at,
        expires_at=api_key.expires_at,
        raw_key=raw_key,
    )


@router.delete("/api-keys/{key_id}", status_code=status.HTTP_204_NO_CONTENT)
async def revoke_api_key(
    key_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    res = await db.execute(
        select(UserAPIKey).where(
            UserAPIKey.id == key_id,
            UserAPIKey.user_id == current_user.id,
        )
    )
    key = res.scalar_one_or_none()
    if not key:
        raise HTTPException(status_code=404, detail="API key not found")
    await db.delete(key)
    db.add(AuditLog(
        user_id=current_user.id,
        org_id=None,
        action="revoke_api_key",
        resource=f"key:{key_id}:name:{key.name}",
    ))
    await db.commit()
    return None
