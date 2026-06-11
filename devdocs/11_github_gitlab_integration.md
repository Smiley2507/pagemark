# GitHub / GitLab Integration

## Overview

Pagemark integrates with GitHub (and partially with GitLab) to enable users to connect their source code repositories. The integration supports:

1. **OAuth authentication** to authorize Pagemark to access user repositories
2. **Repository listing** and browsing for project creation
3. **Repository cloning** for code analysis
4. **Automated re-syncing** when source code changes

## OAuth Flow

### GitHub OAuth

#### Configuration

OAuth credentials are configured via environment variables in `backend/app/config.py`:

| Variable | Description |
|----------|-------------|
| `GITHUB_CLIENT_ID` | GitHub OAuth App client ID |
| `GITHUB_CLIENT_SECRET` | GitHub OAuth App client secret |
| `GITHUB_REDIRECT_URI` | Callback URL (e.g., `https://pagemark.example.com/auth/github/callback`) |

#### Authorization (`GET /auth/github/authorize`)

Protected endpoint (requires authenticated user). Redirects the user to:

```
https://github.com/login/oauth/authorize?client_id={CLIENT_ID}&redirect_uri={REDIRECT_URI}&scope=repo,user,read:org&state={state}
```

- Uses the app's `GITHUB_CLIENT_ID`
- Requests scopes: `repo` (private repos), `user` (profile info), `read:org` (org membership)
- A random `state` parameter is generated for CSRF protection (stored in session or generated per-request)

#### Callback (`GET /auth/github/callback`)

Public endpoint called by GitHub after user authorization. Flow:

1. Receives `code` and `state` parameters
2. Exchanges `code` for an access token via `github_service.exchange_code_for_token(code)`:
   ```python
   # POST https://github.com/login/oauth/access_token
   # Body: {client_id, client_secret, code, redirect_uri}
   ```
3. Retrieves the authenticated user from the session (via `state` mapping or current session)
4. Encrypts the access token using `crypto_service.encrypt_token()` (Fernet symmetric encryption)
5. Stores encrypted token in `oauth_tokens` table with:
   - `provider = 'github'`
   - `access_token_encrypted` (Fernet-encrypted)
   - `token_scope = 'repo,user,read:org'`
6. Redirects user back to the frontend (e.g., `/git-connect`)

### GitLab OAuth

#### Configuration

| Variable | Description |
|----------|-------------|
| `GITLAB_CLIENT_ID` | GitLab OAuth App client ID |
| `GITLAB_CLIENT_SECRET` | GitLab OAuth App client secret |
| `GITLAB_REDIRECT_URI` | Callback URL |

#### Authorization (`GET /auth/gitlab/authorize`)

This endpoint exists in the auth router. It redirects to GitLab's OAuth authorize URL.

**Status**: The callback handler (`/auth/gitlab/callback`) was **not found** in the codebase. The GitLab integration appears to be **incomplete** — the authorization redirect works but the OAuth callback flow does not complete.

## Repository Listing

### `GET /projects/git/repos`

Lists repositories accessible to the authenticated user via their GitHub OAuth token.

**Parameters**: `provider` (github), `page` (default 1), `per_page` (default 30)

**Flow**:
1. Reads the user's encrypted GitHub OAuth token from `oauth_tokens`
2. Decrypts it via `crypto_service.decrypt_token()`
3. Calls `github_service.fetch_user_repos(access_token, page, per_page)`:
   ```python
   # GET https://api.github.com/user/repos?page={page}&per_page={per_page}&sort=updated
   # Headers: Authorization: Bearer {access_token}
   ```
4. Returns list of repos with: id, name, full_name, description, html_url, private, fork, default_branch, updated_at, owner info

**Response**:
```json
[
  {
    "id": 12345,
    "name": "my-repo",
    "full_name": "user/my-repo",
    "description": "A sample repository",
    "html_url": "https://github.com/user/my-repo",
    "private": false,
    "default_branch": "main",
    "updated_at": "2025-01-15T10:00:00Z",
    "owner": {"login": "user", "avatar_url": "..."}
  }
]
```

### `GET /projects/git/repos/{owner}/{repo}/branches`

Lists branches for a specific repository.

**Parameters**: `owner`, `repo`, `provider` (github)

**Flow**:
1. Fetches OAuth token for the user
2. Calls `github_service.fetch_repo_branches(owner, repo, access_token)`:
   ```python
   # GET https://api.github.com/repos/{owner}/{repo}/branches
   ```
3. Returns list of branches with name and commit SHA

## Connecting a Project to a Repository

### Via Git URL (`POST /projects/{project_id}/git/connect-url`)

For **public repositories**:

1. Accepts `repo_url` (Git URL) and optional `branch`
2. Validates URL via `git_service.validate_git_url()`
3. Checks accessibility via `git_service.check_repo_accessible(url)`
4. Creates a new Analysis snapshot
5. Updates project with source info: `source_type = GIT`, `source_provider`, `source_owner`, `source_repository`, `selected_branch`
6. Dispatches `clone_and_analyze_task` to Celery:
   - Clones the repository via GitPython (shallow clone, depth=1)
   - Applies exclusion patterns
   - Runs the 9-step analysis pipeline
   - Records HEAD commit SHA
   - Cleans up cloned repo

### Via OAuth (`POST /projects/{project_id}/git/connect-oauth`)

For **public or private repositories**:

1. Accepts `provider`, `owner`, `repo`, `branch`
2. Builds authenticated clone URL via `github_service.build_authenticated_clone_url()`:
   ```
   https://{token}@github.com/{owner}/{repo}.git
   ```
3. Same flow as Git URL from step 3 onward

### Project Source Fields

When a git project is connected, these fields on the `projects` table are populated:

| Field | Value |
|-------|-------|
| `source_type` | `"git"` |
| `source_provider` | `"github"` or `"gitlab"` |
| `source_owner` | Repository owner |
| `source_repository` | Repository name |
| `selected_branch` | User's chosen branch |
| `default_branch` | Repo's default branch |
| `source_visibility` | `"public"` or `"private"` |
| `last_synced_commit` | SHA from most recent analysis |

## Repository Re-Sync

### `POST /projects/{project_id}/git/sync`

Triggers a new analysis after source code changes:

1. Verifies the project is a Git source type
2. Retrieves stored OAuth token (if private) or uses public URL
3. Creates a new Analysis snapshot
4. Dispatches `clone_and_analyze_task` to Celery
5. On completion, the new analysis becomes `is_current = True`
6. Freshness service compares old vs new analysis to detect stale sections

## GitHub Service (`services/github_service.py`)

| Function | Parameters | HTTP Call | Returns |
|----------|-----------|-----------|---------|
| `get_authorize_url()` | — | — | GitHub OAuth authorize URL string |
| `exchange_code_for_token(code)` | `code: str` | POST to `https://github.com/login/oauth/access_token` | `{"access_token": "...", "token_type": "...", "scope": "..."}` |
| `fetch_user_profile(access_token)` | `access_token: str` | GET `https://api.github.com/user` | User profile dict (login, avatar_url, name, email, etc.) |
| `fetch_user_repos(access_token, page, per_page)` | `access_token, page, per_page` | GET `https://api.github.com/user/repos` | List of repo dicts |
| `fetch_repo_branches(owner, repo, access_token)` | `owner, repo, access_token` | GET `https://api.github.com/repos/{owner}/{repo}/branches` | List of branch dicts |
| `fetch_repo_metadata(owner, repo, access_token)` | `owner, repo, access_token` | GET `https://api.github.com/repos/{owner}/{repo}` | Repo metadata dict |
| `build_authenticated_clone_url(access_token, owner, repo)` | `access_token, owner, repo` | — | `https://{token}@github.com/{owner}/{repo}.git` |

## Git Service (`services/git_service.py`)

| Function | Parameters | Description |
|----------|-----------|-------------|
| `validate_git_url(url)` | `url: str` | Validates URL format (https://, ssh://, git://). Rejects invalid patterns. |
| `clone_repo(url, target_path, branch, depth, ignore_patterns)` | Various | Uses GitPython `Repo.clone_from()` with shallow clone (`depth=1`). After clone, removes files matching ignore_patterns. Returns cloned path. |
| `get_head_commit(repo_path)` | `repo_path: str` | Returns SHA of HEAD commit via `repo.head.commit.hexsha` |
| `cleanup_repo(path)` | `path: str` | Recursively removes the cloned directory via `shutil.rmtree()` |
| `check_repo_accessible(url, token)` | `url, token` | Attempts to reach the repository URL (lightweight check) |

## Token Storage and Encryption

### `oauth_tokens` Table

| Column | Description |
|--------|-------------|
| `user_id` | FK to users — the token owner |
| `provider` | `"github"` or `"gitlab"` |
| `access_token_encrypted` | Fernet-encrypted token |
| `token_scope` | Stored scope string |

### Encryption

- Uses `cryptography.fernet.Fernet` with `settings.ENCRYPTION_KEY`
- `encrypt_token(plain_text) -> str`: Encrypts and base64-encodes
- `decrypt_token(encrypted_text) -> str`: Decodes and decrypts
- Encryption key must be 32 base64-encoded bytes (Fernet requirement)

## Frontend Integration

### `GitConnectPage.tsx` (81 lines)

Simplified Git connection page:
- GitHub OAuth connect button (redirects to `/auth/github/authorize`)
- Disconnect button (calls `DELETE /auth/github/disconnect`)
- Status indicator (connected/disconnected via `GET /auth/github/status`)
- **Note**: This is a minimal implementation. The full repo browsing experience (listing repos, selecting branches) is handled within the **Document Setup Wizard** (`SourceStep.tsx`, 388 lines).

### `SourceStep.tsx` (388 lines)

Part of the guided document creation flow:
- **GitHub OAuth section**: "Connect GitHub" button, when connected shows avatar + username + disconnect
- **Repository browser**: Dropdown/search listing repos from `GET /projects/git/repos`
- **Branch selector**: Populated from `GET /projects/git/repos/{owner}/{repo}/branches` when a repo is selected
- **Git URL input**: Direct URL input for public repos
- **ZIP upload**: Alternative to git
- **Skip option**: Create project without source

### Frontend API (`api/analysis.ts`)

| Function | Endpoint | Description |
|----------|----------|-------------|
| `gitConnectUrl(projectId, data)` | `POST /projects/{id}/git/connect-url` | Connect public git URL |
| `gitConnectOAuth(projectId, data)` | `POST /projects/{id}/git/connect-oauth` | Connect via OAuth |
| `gitSync(projectId)` | `POST /projects/{id}/git/sync` | Re-sync repository |
| `listRepos(provider, page, perPage)` | `GET /projects/git/repos` | List GitHub repos |
| `listBranches(owner, repo, provider)` | `GET /projects/git/repos/{owner}/{repo}/branches` | List branches |

### Frontend API (`api/gitAuth.ts`)

| Function | Endpoint | Description |
|----------|----------|-------------|
| `getGitHubStatus()` | `GET /auth/github/status` | Check connection status |
| `disconnectGitHub()` | `DELETE /auth/github/disconnect` | Disconnect GitHub |

## Error Handling

| Scenario | Handling |
|----------|----------|
| Invalid Git URL | `validate_git_url()` returns false, endpoint returns 400 |
| Repository not accessible | `check_repo_accessible()` fails, endpoint returns 400 with message |
| OAuth token expired | GitHub API returns 401, stored in `oauth_tokens` — user must reconnect |
| Clone failure | `clone_and_analyze_task` retries 3 times with 10s countdown, then fails |
| No OAuth token found | `GET /projects/git/repos` returns empty list or error |
| ZIP files > 8000 or > 150MB | Raises `ValueError`, captured by task error handling |

## Limitations and Notes

1. **GitLab is incomplete**: The authorization endpoint exists but the callback handler does not. GitLab integration is non-functional.
2. **No webhook support**: There are no GitHub/GitLab webhooks for automatic re-syncing when source code changes. The user must manually trigger "Sync" or re-upload.
3. **Shallow clones only**: GitPython clones with `depth=1`, which means no git history is available for differential analysis.
4. **Token scope may be insufficient**: The `repo` scope grants full access to private repos. The `read:org` scope is requested but may not be actively used.
5. **No token refresh**: GitHub OAuth tokens do not expire by default (unless revoked), so no refresh mechanism is needed. However, if GitHub enforces token expiration in the future, this would break.
6. **No fine-grained PAT support**: The system works with OAuth tokens and does not support GitHub Fine-Grained Personal Access Tokens.
7. **Clone URL exposes token**: The authenticated clone URL embeds the token in the URL (`https://token@github.com/...`), which could be logged by GitPython or the OS.
