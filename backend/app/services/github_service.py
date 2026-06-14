import httpx
from typing import Optional, Dict, Any, List
from fastapi import HTTPException
from urllib.parse import urlencode
from app.config import settings

GITHUB_API_URL = "https://api.github.com"


def get_authorize_url(state: str) -> str:
    """Returns the GitHub OAuth authorization URL."""
    query = urlencode({
        "client_id": settings.GITHUB_CLIENT_ID.strip(),
        "redirect_uri": settings.GITHUB_REDIRECT_URI.strip(),
        "scope": "repo read:user",
        "state": state,
    })
    return f"https://github.com/login/oauth/authorize?{query}"


async def exchange_code_for_token(code: str) -> str:
    """Exchanges an OAuth code for an access token."""
    url = "https://github.com/login/oauth/access_token"
    payload = {
        "client_id": settings.GITHUB_CLIENT_ID.strip(),
        "client_secret": settings.GITHUB_CLIENT_SECRET.strip(),
        "code": code,
        "redirect_uri": settings.GITHUB_REDIRECT_URI.strip()
    }
    headers = {"Accept": "application/json"}

    async with httpx.AsyncClient() as client:
        response = await client.post(url, json=payload, headers=headers)
        if response.status_code != 200:
            raise HTTPException(status_code=400, detail="Failed to exchange GitHub token")

        data = response.json()
        if "error" in data:
            raise HTTPException(status_code=400, detail=data.get("error_description", "OAuth error"))

        return data.get("access_token")


async def fetch_user_profile(token: str) -> Dict[str, Any]:
    """Fetches the authenticated user's GitHub profile."""
    url = f"{GITHUB_API_URL}/user"
    headers = {
        "Authorization": f"Bearer {token}",
        "Accept": "application/vnd.github.v3+json"
    }

    async with httpx.AsyncClient() as client:
        response = await client.get(url, headers=headers)
        if response.status_code != 200:
            raise HTTPException(status_code=401, detail="Invalid or expired GitHub token")
        return response.json()


async def fetch_user_repos(token: str, page: int = 1, per_page: int = 50) -> List[Dict[str, Any]]:
    """Fetches repositories accessible to the user."""
    url = f"{GITHUB_API_URL}/user/repos?sort=updated&per_page={per_page}&page={page}&type=all"
    headers = {
        "Authorization": f"Bearer {token}",
        "Accept": "application/vnd.github.v3+json"
    }

    async with httpx.AsyncClient() as client:
        response = await client.get(url, headers=headers)
        if response.status_code != 200:
            raise HTTPException(status_code=401, detail="Failed to fetch GitHub repositories")
        
        repos = response.json()
        
        # Map to standard response format
        return [
            {
                "id": repo["id"],
                "name": repo["name"],
                "full_name": repo["full_name"],
                "description": repo.get("description"),
                "private": repo["private"],
                "default_branch": repo.get("default_branch", "main"),
                "updated_at": repo.get("updated_at"),
                "language": repo.get("language"),
                "stars_count": repo.get("stargazers_count", 0),
                "html_url": repo["html_url"]
            }
            for repo in repos
        ]


async def fetch_repo_branches(token: str, owner: str, repo: str) -> List[Dict[str, Any]]:
    """Fetches branches for a specific repository."""
    url = f"{GITHUB_API_URL}/repos/{owner}/{repo}/branches"
    headers = {
        "Authorization": f"Bearer {token}",
        "Accept": "application/vnd.github.v3+json"
    }

    async with httpx.AsyncClient() as client:
        response = await client.get(url, headers=headers)
        if response.status_code == 404:
            raise HTTPException(status_code=404, detail="Repository not found")
        if response.status_code != 200:
            raise HTTPException(status_code=400, detail="Failed to fetch branches")
            
        branches = response.json()
        
        # We need to determine the default branch. This is normally found on the repo object.
        # For simplicity in this endpoint, we'll mark 'main' or 'master' as default.
        return [
            {
                "name": branch["name"],
                "is_default": branch["name"] in ["main", "master"]
            }
            for branch in branches
        ]


async def fetch_repo_metadata(token: str, owner: str, repo: str) -> Dict[str, Any]:
    """Fetch normalized metadata for one GitHub repository."""
    url = f"{GITHUB_API_URL}/repos/{owner}/{repo}"
    headers = {
        "Authorization": f"Bearer {token}",
        "Accept": "application/vnd.github.v3+json",
    }

    async with httpx.AsyncClient() as client:
        response = await client.get(url, headers=headers)
        if response.status_code == 404:
            raise HTTPException(status_code=404, detail="Repository not found")
        if response.status_code != 200:
            raise HTTPException(status_code=400, detail="Failed to fetch repository metadata")
        repo_data = response.json()
        return {
            "id": repo_data.get("id"),
            "name": repo_data.get("name"),
            "full_name": repo_data.get("full_name"),
            "private": bool(repo_data.get("private")),
            "default_branch": repo_data.get("default_branch"),
            "html_url": repo_data.get("html_url"),
            "language": repo_data.get("language"),
            "pushed_at": repo_data.get("pushed_at"),
            "updated_at": repo_data.get("updated_at"),
        }


def build_authenticated_clone_url(token: str, owner: str, repo: str) -> str:
    """Builds a GitHub clone URL including the OAuth token for auth."""
    return f"https://{token}@github.com/{owner}/{repo}.git"


async def register_webhook(
    token: str, owner: str, repo: str, webhook_url: str, secret: str
) -> dict[str, Any]:
    url = f"{GITHUB_API_URL}/repos/{owner}/{repo}/hooks"
    headers = {
        "Authorization": f"Bearer {token}",
        "Accept": "application/vnd.github.v3+json",
    }
    payload = {
        "name": "web",
        "active": True,
        "events": ["push"],
        "config": {
            "url": webhook_url,
            "content_type": "json",
            "secret": secret,
            "insecure_ssl": "0",
        },
    }
    async with httpx.AsyncClient() as client:
        response = await client.post(url, json=payload, headers=headers)
        if response.status_code == 422:
            detail = response.json().get("errors", [{}])[0].get("message", "Validation error")
            raise HTTPException(status_code=400, detail=f"GitHub webhook registration failed: {detail}")
        if response.status_code not in (201, 200):
            raise HTTPException(status_code=400, detail="Failed to register webhook on GitHub")
        return response.json()


async def delete_webhook(token: str, owner: str, repo: str, hook_id: int) -> None:
    url = f"{GITHUB_API_URL}/repos/{owner}/{repo}/hooks/{hook_id}"
    headers = {
        "Authorization": f"Bearer {token}",
        "Accept": "application/vnd.github.v3+json",
    }
    async with httpx.AsyncClient() as client:
        response = await client.delete(url, headers=headers)
        if response.status_code not in (204, 404):
            raise HTTPException(status_code=400, detail="Failed to delete webhook on GitHub")
