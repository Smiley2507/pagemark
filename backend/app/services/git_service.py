import re
import shutil
import os
import httpx
from typing import Tuple
from urllib.parse import urlparse

try:
    import git
except ImportError:
    pass # Managed by requirements, let it fail at runtime if missing


def validate_git_url(url: str) -> Tuple[str, str, str]:
    """
    Validates the Git URL and returns (provider, owner, repo).
    Raises ValueError if invalid.
    """
    if not url:
        raise ValueError("URL cannot be empty")

    url = url.strip()
    if url.endswith(".git"):
        url = url[:-4]

    parsed = urlparse(url)
    if not parsed.scheme in ["http", "https"]:
        raise ValueError("Only http/https URLs are supported")

    domain = parsed.netloc.lower()
    path_parts = [p for p in parsed.path.split('/') if p]

    if len(path_parts) < 2:
        raise ValueError("URL must contain owner and repository name")

    owner = path_parts[0]
    repo = path_parts[1]

    if "github.com" in domain:
        provider = "github"
    elif "bitbucket.org" in domain:
        provider = "bitbucket"
    else:
        raise ValueError("Unsupported Git provider. Please use GitHub or Bitbucket.")

    return provider, owner, repo


def detect_provider(url: str) -> str:
    provider, _, _ = validate_git_url(url)
    return provider


async def check_repo_accessible(url: str) -> bool:
    """Checks if a repository is publicly accessible."""
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.head(url, follow_redirects=True)
            return response.status_code == 200
    except Exception:
        return False


def clone_repo(url: str, target_path: str, branch: str = "main", depth: int = 1, ignore_patterns: list[str] | None = None) -> str:
    """
    Clones a git repository to the target path.
    Optionally writes a .gitignore with the given patterns to skip large/generated dirs at analysis time.
    """
    # Ensure directory exists and is empty
    if os.path.exists(target_path):
        shutil.rmtree(target_path)
    os.makedirs(target_path, exist_ok=True)

    git.Repo.clone_from(url, target_path, branch=branch, depth=depth)
    if ignore_patterns:
        gitignore_path = os.path.join(target_path, ".gitignore")
        existing = ""
        if os.path.exists(gitignore_path):
            with open(gitignore_path) as f:
                existing = f.read().strip() + "\n"
        with open(gitignore_path, "w") as f:
            f.write(existing)
            f.write("\n".join(ignore_patterns))
            f.write("\n")
    return target_path


def get_head_commit(path: str) -> str | None:
    repo = git.Repo(path)
    try:
        return repo.head.commit.hexsha
    except Exception:
        return None


def cleanup_repo(path: str):
    """Deletes a local repository clone."""
    if os.path.exists(path):
        shutil.rmtree(path, ignore_errors=True)
