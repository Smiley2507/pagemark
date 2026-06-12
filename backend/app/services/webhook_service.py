import hashlib
import hmac
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.project import Project


def verify_github_signature(payload: bytes, signature: str, secret: str) -> bool:
    expected = hmac.new(
        secret.encode("utf-8"),
        payload,
        hashlib.sha256,
    ).hexdigest()
    return hmac.compare_digest(f"sha256={expected}", signature)


async def find_project_by_repo(db: AsyncSession, repo_full_name: str) -> Project | None:
    owner, repo = repo_full_name.split("/", 1)
    result = await db.execute(
        select(Project).where(
            Project.source_owner == owner,
            Project.source_repository == repo,
            Project.source_type == "git",
            Project.deleted_at.is_(None),
        )
    )
    return result.scalar_one_or_none()
