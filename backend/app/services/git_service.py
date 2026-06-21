import json
import os
import shutil
import tarfile
import httpx
from typing import Tuple
from urllib.parse import urlparse

META_FILENAME = ".pagemark_git_meta"


def _parse_url(url: str) -> Tuple[str, str, str, str | None]:
    """
    Parse a Git URL and return (provider, owner, repo, token).
    
    Supports URLs with embedded credentials:
      https://token@github.com/owner/repo.git
    """
    if not url:
        raise ValueError("URL cannot be empty")

    url = url.strip()
    if url.endswith(".git"):
        url = url[:-4]

    parsed = urlparse(url)
    if parsed.scheme not in ("http", "https"):
        raise ValueError("Only http/https URLs are supported")

    # Extract token from netloc (e.g. "token@github.com")
    token = None
    raw_netloc = parsed.netloc
    if '@' in raw_netloc:
        userinfo, _, raw_netloc = raw_netloc.partition('@')
        token = userinfo

    domain = raw_netloc.lower()
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

    return provider, owner, repo, token


def validate_git_url(url: str) -> Tuple[str, str, str]:
    """Returns (provider, owner, repo). Raises ValueError if invalid."""
    provider, owner, repo, _ = _parse_url(url)
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


def _download_archive(url: str, branch: str) -> bytes:
    """Download repository archive using provider API (avoids CDN TLS issues)."""
    provider, owner, repo, token = _parse_url(url)
    headers = {}
    if token:
        headers["Authorization"] = f"Bearer {token}"

    with httpx.Client(timeout=120.0, follow_redirects=True) as client:
        if provider == "github":
            archive_url = f"https://api.github.com/repos/{owner}/{repo}/tarball/{branch}"
            resp = client.get(archive_url, headers=headers)
        elif provider == "bitbucket":
            archive_url = f"https://bitbucket.org/{owner}/{repo}/get/{branch}.tar.gz"
            resp = client.get(archive_url, headers=headers)
        else:
            raise ValueError(f"Unsupported provider: {provider}")
        resp.raise_for_status()
        return resp.content


def _fetch_commit_sha(url: str, branch: str) -> str | None:
    """Fetch the latest commit SHA for a branch via provider API."""
    try:
        provider, owner, repo, token = _parse_url(url)
        headers = {}
        if token:
            headers["Authorization"] = f"Bearer {token}"

        if provider == "github":
            api_url = f"https://api.github.com/repos/{owner}/{repo}/git/refs/heads/{branch}"
            with httpx.Client(timeout=15.0, follow_redirects=True) as client:
                resp = client.get(api_url, headers=headers)
                if resp.status_code == 200:
                    return resp.json().get("object", {}).get("sha")
    except Exception:
        pass
    return None


def _extract_tarball(tarball_path: str, target_path: str):
    """Extract a tarball, stripping the top-level directory that GitHub/Bitbucket include."""
    with tarfile.open(tarball_path, "r:gz") as tar:
        members = tar.getmembers()

        # Determine the common top-level directory (e.g. "owner-repo-sha/")
        top_level = None
        for m in members:
            if '/' in m.name:
                candidate = m.name.split('/')[0]
                if top_level is None:
                    top_level = candidate
                elif candidate != top_level:
                    top_level = None
                    break

        if top_level:
            # Strip the top-level directory prefix
            for m in members:
                if m.name == top_level:
                    continue
                if m.name.startswith(top_level + '/'):
                    m.name = m.name[len(top_level) + 1:]
                    tar.extract(m, target_path)
        else:
            tar.extractall(target_path)


def clone_repo(url: str, target_path: str, branch: str = "main", depth: int = 1, ignore_patterns: list[str] | None = None) -> str:
    """
    Download repository source code via tarball instead of git clone.
    Avoids TLS issues with Debian's GnuTLS-linked git binary.
    """
    if os.path.exists(target_path):
        shutil.rmtree(target_path)
    os.makedirs(target_path, exist_ok=True)

    tarball_path = os.path.join(os.path.dirname(target_path), "__pagemark_repo.tar.gz")
    try:
        content = _download_archive(url, branch)
        with open(tarball_path, "wb") as f:
            f.write(content)

        _extract_tarball(tarball_path, target_path)
    finally:
        if os.path.exists(tarball_path):
            os.remove(tarball_path)

    # Save commit SHA if we can fetch it
    commit_sha = _fetch_commit_sha(url, branch)
    if commit_sha:
        meta = {"commit_sha": commit_sha}
        with open(os.path.join(target_path, META_FILENAME), "w") as f:
            json.dump(meta, f)

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
    """Return the commit SHA saved during clone_repo."""
    meta_path = os.path.join(path, META_FILENAME)
    if os.path.exists(meta_path):
        try:
            with open(meta_path) as f:
                meta = json.load(f)
            return meta.get("commit_sha")
        except Exception:
            pass
    return None


def cleanup_repo(path: str):
    """Deletes a local repository clone."""
    if os.path.exists(path):
        shutil.rmtree(path, ignore_errors=True)
