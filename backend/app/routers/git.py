from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import List

from app.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.models.oauth_token import OAuthToken
from app.schemas.analysis import GitRepoResponse, GitBranchResponse
from app.services import github_service, gitlab_service, crypto_service

router = APIRouter(prefix="/projects/git", tags=["git"])


@router.get("/repos", response_model=List[GitRepoResponse])
async def list_git_repos(
    provider: str = Query("github", description="The git provider (github or gitlab)"),
    page: int = Query(1, ge=1),
    per_page: int = Query(50, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Fetch user's token for the specified provider
    result = await db.execute(
        select(OAuthToken).where(
            OAuthToken.user_id == current_user.id,
            OAuthToken.provider == provider
        ).order_by(OAuthToken.updated_at.desc())
    )
    token_obj = result.scalars().first()

    if not token_obj:
        raise HTTPException(status_code=400, detail=f"No {provider} OAuth connection found.")

    decrypted_token = crypto_service.decrypt_token(token_obj.access_token_encrypted)

    if provider == "github":
        repos = await github_service.fetch_user_repos(decrypted_token, page, per_page)
    elif provider == "gitlab":
        repos = await gitlab_service.fetch_user_repos(decrypted_token, page, per_page)
    else:
        raise HTTPException(status_code=400, detail="Unsupported provider")

    return repos


@router.get("/repos/{owner}/{repo}/branches", response_model=List[GitBranchResponse])
async def list_repo_branches(
    owner: str,
    repo: str,
    provider: str = Query("github", description="The git provider (github or gitlab)"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(OAuthToken).where(
            OAuthToken.user_id == current_user.id,
            OAuthToken.provider == provider
        ).order_by(OAuthToken.updated_at.desc())
    )
    token_obj = result.scalars().first()

    if not token_obj:
        raise HTTPException(status_code=400, detail=f"No {provider} OAuth connection found.")

    decrypted_token = crypto_service.decrypt_token(token_obj.access_token_encrypted)

    if provider == "github":
        branches = await github_service.fetch_repo_branches(decrypted_token, owner, repo)
    elif provider == "gitlab":
        # GitLab expects URL-encoded project path, which is owner%2Frepo
        project_id = f"{owner}%2F{repo}"
        branches = await gitlab_service.fetch_repo_branches(decrypted_token, project_id)
    else:
        raise HTTPException(status_code=400, detail="Unsupported provider")

    return branches
