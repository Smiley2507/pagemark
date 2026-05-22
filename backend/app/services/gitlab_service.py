import httpx
from typing import Optional, Dict, Any, List
from fastapi import HTTPException
from app.config import settings

GITLAB_API_URL = "https://gitlab.com/api/v4"


def get_authorize_url(state: str) -> str:
    """Returns the GitLab OAuth authorization URL."""
    client_id = settings.GITLAB_CLIENT_ID
    redirect_uri = settings.GITLAB_REDIRECT_URI
    scope = "read_api read_repository"
    return f"https://gitlab.com/oauth/authorize?client_id={client_id}&redirect_uri={redirect_uri}&response_type=code&state={state}&scope={scope}"


async def exchange_code_for_token(code: str) -> str:
    """Exchanges an OAuth code for an access token."""
    url = "https://gitlab.com/oauth/token"
    payload = {
        "client_id": settings.GITLAB_CLIENT_ID,
        "client_secret": settings.GITLAB_CLIENT_SECRET,
        "code": code,
        "grant_type": "authorization_code",
        "redirect_uri": settings.GITLAB_REDIRECT_URI
    }

    async with httpx.AsyncClient() as client:
        response = await client.post(url, json=payload)
        if response.status_code != 200:
            raise HTTPException(status_code=400, detail="Failed to exchange GitLab token")

        data = response.json()
        if "error" in data:
            raise HTTPException(status_code=400, detail=data.get("error_description", "OAuth error"))

        return data.get("access_token")


async def fetch_user_profile(token: str) -> Dict[str, Any]:
    """Fetches the authenticated user's GitLab profile."""
    url = f"{GITLAB_API_URL}/user"
    headers = {"Authorization": f"Bearer {token}"}

    async with httpx.AsyncClient() as client:
        response = await client.get(url, headers=headers)
        if response.status_code != 200:
            raise HTTPException(status_code=401, detail="Invalid or expired GitLab token")
        return response.json()


async def fetch_user_repos(token: str, page: int = 1, per_page: int = 50) -> List[Dict[str, Any]]:
    """Fetches projects accessible to the user on GitLab."""
    url = f"{GITLAB_API_URL}/projects?membership=true&order_by=updated_at&sort=desc&page={page}&per_page={per_page}"
    headers = {"Authorization": f"Bearer {token}"}

    async with httpx.AsyncClient() as client:
        response = await client.get(url, headers=headers)
        if response.status_code != 200:
            raise HTTPException(status_code=401, detail="Failed to fetch GitLab projects")
            
        projects = response.json()
        
        # Map to standard response format
        return [
            {
                "id": proj["id"],
                "name": proj["name"],
                "full_name": proj["path_with_namespace"],
                "description": proj.get("description"),
                "private": proj["visibility"] == "private",
                "default_branch": proj.get("default_branch", "main"),
                "updated_at": proj.get("last_activity_at"),
                "language": None, # GitLab doesn't return primary language in list endpoint
                "stars_count": proj.get("star_count", 0),
                "html_url": proj["web_url"]
            }
            for proj in projects
        ]


async def fetch_repo_branches(token: str, project_id: str) -> List[Dict[str, Any]]:
    """Fetches branches for a specific GitLab project. Note: project_id can be URL encoded path."""
    url = f"{GITLAB_API_URL}/projects/{project_id}/repository/branches"
    headers = {"Authorization": f"Bearer {token}"}

    async with httpx.AsyncClient() as client:
        response = await client.get(url, headers=headers)
        if response.status_code == 404:
            raise HTTPException(status_code=404, detail="Repository not found")
        if response.status_code != 200:
            raise HTTPException(status_code=400, detail="Failed to fetch branches")
            
        branches = response.json()
        return [
            {
                "name": branch["name"],
                "is_default": branch.get("default", False)
            }
            for branch in branches
        ]


def build_authenticated_clone_url(token: str, path_with_namespace: str) -> str:
    """Builds a GitLab clone URL including the OAuth token for auth."""
    return f"https://oauth2:{token}@gitlab.com/{path_with_namespace}.git"
