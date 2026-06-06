"""BYOK AI credential storage and retrieval."""

from dataclasses import dataclass
from datetime import datetime

from fastapi import HTTPException
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai_providers import VALID_PROVIDERS, is_valid_model
from app.models.ai_credential import UserAiCredential
from app.services import crypto_service
from app.services.ai_service import list_models, validate_credential, AiServiceError


@dataclass
class ActiveCredential:
    id: int
    provider: str
    model_id: str
    api_key: str


def _key_hint(api_key: str) -> str:
    k = api_key.strip()
    return k[-4:] if len(k) >= 4 else "****"


async def list_credentials(db: AsyncSession, user_id: int) -> list[UserAiCredential]:
    result = await db.execute(
        select(UserAiCredential)
        .where(UserAiCredential.user_id == user_id)
        .order_by(UserAiCredential.provider)
    )
    return list(result.scalars().all())


async def upsert_credential(
    db: AsyncSession,
    user_id: int,
    provider: str,
    api_key: str,
    model_id: str,
) -> UserAiCredential:
    if provider not in VALID_PROVIDERS:
        raise HTTPException(status_code=400, detail=f"Unsupported provider: {provider}")
    if not is_valid_model(provider, model_id):
        raise HTTPException(status_code=400, detail=f"Unsupported model: {model_id}")

    try:
        validate_credential(provider, api_key, model_id)
    except AiServiceError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e

    encrypted = crypto_service.encrypt_token(api_key.strip())
    hint = _key_hint(api_key)
    now = datetime.utcnow()

    result = await db.execute(
        select(UserAiCredential).where(
            UserAiCredential.user_id == user_id,
            UserAiCredential.provider == provider,
        )
    )
    row = result.scalar_one_or_none()

    count_result = await db.execute(
        select(UserAiCredential).where(UserAiCredential.user_id == user_id)
    )
    existing_count = len(list(count_result.scalars().all()))

    if row:
        row.api_key_encrypted = encrypted
        row.model_id = model_id
        row.key_hint = hint
        row.validated_at = now
        row.updated_at = now
    else:
        row = UserAiCredential(
            user_id=user_id,
            provider=provider,
            api_key_encrypted=encrypted,
            model_id=model_id,
            key_hint=hint,
            is_active=existing_count == 0,
            validated_at=now,
        )
        db.add(row)

    await db.commit()
    await db.refresh(row)
    return row


async def set_active(db: AsyncSession, user_id: int, credential_id: int) -> UserAiCredential:
    result = await db.execute(
        select(UserAiCredential).where(
            UserAiCredential.id == credential_id,
            UserAiCredential.user_id == user_id,
        )
    )
    row = result.scalar_one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="Credential not found")

    await db.execute(
        update(UserAiCredential)
        .where(UserAiCredential.user_id == user_id)
        .values(is_active=False)
    )
    row.is_active = True
    await db.commit()
    await db.refresh(row)
    return row


async def delete_credential(db: AsyncSession, user_id: int, credential_id: int) -> None:
    result = await db.execute(
        select(UserAiCredential).where(
            UserAiCredential.id == credential_id,
            UserAiCredential.user_id == user_id,
        )
    )
    row = result.scalar_one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="Credential not found")

    was_active = row.is_active
    await db.delete(row)
    await db.commit()

    if was_active:
        remaining = await db.execute(
            select(UserAiCredential)
            .where(UserAiCredential.user_id == user_id)
            .order_by(UserAiCredential.updated_at.desc())
            .limit(1)
        )
        next_row = remaining.scalar_one_or_none()
        if next_row:
            next_row.is_active = True
            await db.commit()


async def get_active_credential(db: AsyncSession, user_id: int) -> ActiveCredential | None:
    result = await db.execute(
        select(UserAiCredential).where(
            UserAiCredential.user_id == user_id,
            UserAiCredential.is_active == True,  # noqa: E712
        )
    )
    row = result.scalar_one_or_none()
    if not row:
        return None

    api_key = crypto_service.decrypt_token(row.api_key_encrypted)
    return ActiveCredential(
        id=row.id,
        provider=row.provider,
        model_id=row.model_id,
        api_key=api_key,
    )


async def list_provider_models(
    db: AsyncSession,
    user_id: int,
    provider: str,
) -> tuple[list[dict[str, str]], str]:
    if provider not in VALID_PROVIDERS:
        raise HTTPException(status_code=400, detail=f"Unsupported provider: {provider}")

    result = await db.execute(
        select(UserAiCredential).where(
            UserAiCredential.user_id == user_id,
            UserAiCredential.provider == provider,
        )
    )
    row = result.scalar_one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="Credential not found")

    api_key = crypto_service.decrypt_token(row.api_key_encrypted)
    try:
        return list_models(provider, api_key)
    except AiServiceError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
