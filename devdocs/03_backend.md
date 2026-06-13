# Backend Documentation

## Overview

The Pagemark backend is a Python FastAPI application located at `backend/`. It provides a RESTful API for the frontend SPA, orchestrates code analysis via Celery workers, integrates with AI providers for documentation generation, and supports OAuth connections to GitHub/GitLab.

## Application Entry Point

### `backend/app/main.py`

Creates the FastAPI application and configures:

- **Lifespan**: On startup, calls `seed_builtin_templates()` which upserts 8 built-in templates (API Reference, SDK Guide, User Manual, Architecture Doc, Migration Guide, CLI Reference, Contribution Guide, Configuration Guide) by name.
- **CORS**: Allows `settings.FRONTEND_URL`, localhost:5173/5174, plus regex matching `localhost`/`127.0.0.1:517\d`.
- **Static mount**: `/static` → `settings.UPLOAD_DIR`.
- **Health**: `GET /health` returns `{"status": "ok", "version": "1.0.0"}`.

All 22 routers are included via `app.include_router()`.

## Configuration

### `backend/app/config.py`

All environment variables are loaded via pydantic-settings `BaseSettings`:

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `DATABASE_URL` | `str` | — | Async PostgreSQL URL |
| `REDIS_URL` | `str` | — | Redis connection for Celery |
| `SECRET_KEY` | `str` | — | JWT signing key |
| `ANTHROPIC_API_KEY` | `Optional[str]` | None | Legacy fallback (deprecated — BYOK is the standard path) |
| `LIVEBLOCKS_SECRET_KEY` | `str` | `""` | Liveblocks secret used to authorize real-time collaboration sessions |
| `LIVEBLOCKS_API_BASE_URL` | `str` | `https://api.liveblocks.io` | Liveblocks REST API base URL |
| `FRONTEND_URL` | `str` | — | Frontend origin for CORS |
| `UPLOAD_DIR` | `str` | `/tmp/opencode/uploads` | Directory for uploaded files |
| `MAIL_USERNAME` | `str` | — | SMTP username |
| `MAIL_PASSWORD` | `str` | — | SMTP password |
| `MAIL_FROM` | `str` | — | Sender email address |
| `MAIL_PORT` | `int` | — | SMTP port |
| `MAIL_SERVER` | `str` | — | SMTP server host |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `int` | 30 | JWT access token TTL |
| `REFRESH_TOKEN_EXPIRE_DAYS` | `int` | 7 | JWT refresh token TTL |
| `GITHUB_CLIENT_ID` | `str` | — | GitHub OAuth app client ID |
| `GITHUB_CLIENT_SECRET` | `str` | — | GitHub OAuth app secret |
| `GITHUB_REDIRECT_URI` | `str` | — | GitHub OAuth callback URL |
| `GITLAB_CLIENT_ID` | `str` | — | GitLab OAuth app client ID |
| `GITLAB_CLIENT_SECRET` | `str` | — | GitLab OAuth app secret |
| `GITLAB_REDIRECT_URI` | `str` | — | GitLab OAuth callback URL |
| `ENCRYPTION_KEY` | `str` | — | Fernet symmetric encryption key for OAuth/AI tokens |

## Database Layer

### `backend/app/database.py`

- **Async engine**: `create_async_engine(settings.DATABASE_URL)` with `echo=True`
- **Async session**: `async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)`
- **Sync engine**: Converts `asyncpg://` → `psycopg2://` by replacing the dialect — used by Celery workers
- **`get_db`**: Async generator yielding `AsyncSession` for dependency injection

## Dependencies

### `backend/app/dependencies.py`

| Dependency | Signature | Description |
|------------|-----------|-------------|
| `get_current_user` | `(request: Request, db: AsyncSession) -> User` | Reads `access_token` cookie → decodes JWT → fetches user from DB. Raises 401 if invalid. |
| `require_org_role(roles: list[OrgMemberRole])` | Factory returning `(project_id: int, current_user: User, db: AsyncSession) -> OrganizationMember` | Checks user is a member of the project's org with one of the required roles. |
| `verify_project_ownership` | `(project_id: int, current_user: User, db: AsyncSession) -> Project` | Verifies user is an active member of the project's organization. |
| `verify_section_ownership` | `(section_id: int, current_user: User, db: AsyncSession) -> Section` | Traverses Section→Document→Project→OrganizationMember to verify access. |
| `verify_document_access` | `(project_id: int, document_id: int, current_user: User, db: AsyncSession) -> Document` | Checks org membership first, then admin/creator bypass, then DocumentShare for external users. |
| `require_document_permission(perm: str)` | Factory returning document access check | Like `verify_document_access` but also checks share permission level (`view` < `comment` < `edit`). |

## Exceptions

### `backend/app/exceptions.py`

- **`NeedsClarificationException`**: Raised when AI generation needs user input to proceed. Contains `clarification_request` data and the affected `section_id`. When caught, the system creates a `ClarificationRequest` and pauses section generation.

## AI Provider Catalog

### `backend/app/ai_providers.py`

Defines the BYOK provider catalog as a `PROVIDERS` dict:

```python
PROVIDERS = {
    "anthropic": {
        "name": "Anthropic",
        "models": ["claude-sonnet-4-20250514", "claude-haiku-3-5-sonnet-20241022"],
        "default_model": "claude-sonnet-4-20250514",
    },
    "google": {
        "name": "Google AI Studio",
        "models": ["gemini-2.5-flash-001", "gemini-2.5-pro-001"],
        "default_model": "gemini-2.5-flash-001",
    },
    "opencode_go": {
        "name": "OpenCode Go",
        "models": ["deepseek-chat", "deepseek-reasoner", "kimi-latest", "glm-4-plus", "miMo"],
        "default_model": "deepseek-chat",
    },
}
```

Also provides `is_valid_model(provider, model_id)` to validate model identifiers.

## Router Reference

### `auth.py` — Prefix: `/auth`, Tags: `authentication`

| Method | Route | Auth | Request | Response | Description |
|--------|-------|------|---------|----------|-------------|
| POST | `/auth/register` | None | `RegisterRequest` (email, password, name, org_name) | `MeResponse` (201) | Creates user + personal org. Sends verification email. |
| GET | `/auth/verify-email` | None | `token: str` query | `{"message"}` | Verifies email address via token from UserSettings. |
| POST | `/auth/login` | None | `LoginRequest` (email, password) | `MeResponse` | Validates credentials, sets `access_token` (30min) and `refresh_token` (7d) cookies. Checks `is_verified`. |
| POST | `/auth/logout` | None | — | `{"message"}` | Clears both cookies. |
| POST | `/auth/refresh` | None | `refresh_token` cookie | `{"message"}` | Validates refresh token, issues new access token. |
| GET | `/auth/me` | `get_current_user` | — | `MeResponse` | Returns current user profile. |
| PATCH | `/auth/me` | `get_current_user` | `UpdateMeRequest` | `MeResponse` | Update name, avatar, or password. |
| POST | `/auth/forgot-password` | None | `ForgotPasswordRequest` (email) | `{"message"}` | Sends password reset email with token. |
| POST | `/auth/reset-password` | None | `ResetPasswordRequest` (token, new_password) | `{"message"}` | Resets password using valid token. |
| GET | `/auth/github/authorize` | `get_current_user` | — | `RedirectResponse` | Redirects to GitHub OAuth authorize URL. |
| GET | `/auth/github/callback` | None | `code`, `state` | `RedirectResponse` | Exchanges code for token, encrypts and stores it. |
| GET | `/auth/github/status` | `get_current_user` | — | `{"connected","provider","username"}` | Checks if GitHub is connected. |
| DELETE | `/auth/github/disconnect` | `get_current_user` | — | 204 | Deletes OAuth token. |
| GET | `/auth/gitlab/authorize` | `get_current_user` | — | `RedirectResponse` | GitLab OAuth authorize (incomplete — no callback handler found). |
| GET | `/auth/me/notification-preferences` | `get_current_user` | — | preferences | Gets notification preferences from UserSettings JSON. |
| PUT | `/auth/me/notification-preferences` | `get_current_user` | body | preferences | Updates notification preferences. |
| GET | `/auth/me/ai-providers/catalog` | `get_current_user` | — | `AiProviderCatalogResponse` | Lists all available AI providers with models. |
| GET | `/auth/me/ai-credentials` | `get_current_user` | — | `AiCredentialListResponse` | Lists user's stored AI credentials. |
| GET | `/auth/me/ai-credentials/{provider}/models` | `get_current_user` | provider path | model list | Lists models for a specific provider (via API call). |
| POST | `/auth/me/ai-credentials/{provider}/test` | `get_current_user` | `AiCredentialTestRequest` | test result | Tests credential connectivity to provider. |
| PUT | `/auth/me/ai-credentials/{provider}` | `get_current_user` | `AiCredentialUpsertRequest` | credential | Upserts credential (encrypts key, stores, sets active). |
| POST | `/auth/me/ai-credentials/{credential_id}/activate` | `get_current_user` | credential_id | credential | Sets credential as active, deactivates others. |
| DELETE | `/auth/me/ai-credentials/{credential_id}` | `get_current_user` | credential_id | 204 | Deletes AI credential. |

**Cookie settings**: `access_token` — httponly, samesite=lax, path=/, max_age=1800 (30min). `refresh_token` — httponly, samesite=lax, path=/auth/refresh, max_age=604800 (7d).

### `projects.py` — Prefix: `/projects`, Tags: `projects`

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| GET | `/projects/activity/recent` | `get_current_user` | Recent activity across org filtered by notification preferences |
| GET | `/projects/tags` | `get_current_user` | All tags used across organization projects |
| GET | `/projects` | `get_current_user` | List projects with optional search, status, starred filters |
| POST | `/projects` | `get_current_user` | Create project with source exclusions |
| GET | `/projects/{project_id}` | `get_current_user` | Get single project with details |
| PATCH | `/projects/{project_id}` | `get_current_user` | Update project (name, description, status, tags, starred, export_settings, context_md) |
| GET | `/projects/{project_id}/source/exclusions` | `get_current_user` | List source exclusion patterns |
| PUT | `/projects/{project_id}/source/exclusions` | `get_current_user` | Replace all source exclusions |
| DELETE | `/projects/{project_id}` | `get_current_user` | Soft-delete project (sets deleted_at) |
| PATCH | `/projects/{project_id}/context` | `get_current_user` | Update project context markdown |
| POST | `/projects/{project_id}/duplicate` | `get_current_user` | Deep-duplicate project with documents and sections |
| POST | `/projects/{project_id}/upload` | `get_current_user` | Upload ZIP file and trigger Celery analysis |
| POST | `/projects/{project_id}/git/connect-url` | `get_current_user` | Connect public Git URL and trigger analysis |
| POST | `/projects/{project_id}/git/connect-oauth` | `get_current_user` | Connect via GitHub OAuth and trigger analysis |
| POST | `/projects/{project_id}/git/sync` | `get_current_user` | Re-sync Git repository (new analysis) |
| GET | `/projects/{project_id}/analysis/status` | `get_current_user` | Latest analysis status with step-by-step progress |
| GET | `/projects/{project_id}/analysis/snapshots` | `get_current_user` | All analysis snapshots for project |
| GET | `/projects/{project_id}/analysis/results` | `get_current_user` | Full analysis results (file tree, languages, endpoints, complexity) |
| GET | `/projects/{project_id}/analysis/outline-diff` | `get_current_user` | Diff between current document outline and proposed AI outline |
| POST | `/projects/{project_id}/analysis/apply-outline` | `get_current_user` | Apply the proposed AI outline to the document |
| GET | `/projects/{project_id}/activity` | `get_current_user` | Paginated activity timeline with optional filters |
| GET | `/projects/{project_id}/activity/heatmap` | `get_current_user` | GitHub-style activity heatmap data |
| GET | `/projects/{project_id}/activity/event-types` | `get_current_user` | All event type values used in activity |

### `documents.py` — Prefix: `/{project_id}/documents`, Tags: `documents`

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| GET | `/projects/{project_id}/documents` | `verify_project_ownership` | List documents for project |
| POST | `/projects/{project_id}/documents` | `verify_project_ownership` | Create document (optional template_id, setup_stage) |
| GET | `/projects/{project_id}/documents/{document_id}` | `verify_document_access` | Get document with sections, template, shares |
| PATCH | `/projects/{project_id}/documents/{document_id}` | `require_document_permission("edit")` | Update document fields |
| DELETE | `/projects/{project_id}/documents/{document_id}` | `require_document_permission("edit")` | Hard-delete document (nullifies activity event links) |
| GET | `/projects/{project_id}/documents/{document_id}/setup` | `verify_document_access` | Full setup state: recommendations, proposals, clarifications, sections, analysis |
| GET | `/projects/{project_id}/documents/{document_id}/template-recommendations` | `verify_project_ownership` | List template recommendations |
| POST | `/projects/{project_id}/documents/{document_id}/template-recommendations` | `verify_project_ownership` | Create recommendations (rule-based or AI-personalized) |
| GET | `/projects/{project_id}/documents/{document_id}/outline-proposals` | `verify_project_ownership` | List outline proposals |
| POST | `/projects/{project_id}/documents/{document_id}/outline-proposals` | `verify_project_ownership` | Create outline proposal |
| PATCH | `/projects/{project_id}/documents/{document_id}/outline-proposals/{proposal_id}` | `verify_project_ownership` | Update draft outline proposal |
| POST | `/projects/{project_id}/documents/{document_id}/outline-proposals/{proposal_id}/approve` | `verify_project_ownership` | Approve proposal → materializes sections |
| POST | `/projects/{project_id}/documents/{document_id}/outline-proposals/{proposal_id}/clarification-requests` | `verify_project_ownership` | Create clarification request for proposal |
| POST | `/projects/{project_id}/documents/{document_id}/clarification-requests/{request_id}/skip` | `verify_project_ownership` | Skip a clarification request |
| POST | `/projects/{project_id}/documents/{document_id}/generation-estimate` | `verify_project_ownership` | Estimate token usage and cost for generation |
| GET | `/projects/{project_id}/documents/{document_id}/generation-runs` | `verify_project_ownership` | List all generation runs |
| POST | `/projects/{project_id}/documents/{document_id}/generation-runs` | `verify_project_ownership` | Create and optionally execute generation run |
| GET | `/projects/{project_id}/documents/{document_id}/generation-runs/{run_id}` | `verify_project_ownership` | Get generation run with section tasks |
| POST | `/projects/{project_id}/documents/{document_id}/generation-runs/{run_id}/confirm-failover` | `verify_project_ownership` | Confirm provider failover for a running generation |
| GET | `/projects/{project_id}/documents/{document_id}/sections` | `verify_project_ownership` | Section tree for document |
| POST | `/projects/{project_id}/documents/{document_id}/sections` | `require_document_permission("edit")` | Create custom section |
| PATCH | `/projects/{project_id}/documents/{document_id}/sections/{section_id}` | `verify_project_ownership` | Update section content/status |
| PATCH | `/projects/{project_id}/documents/{document_id}/sections/{section_id}/autosave` | `verify_project_ownership` | Autosave section (3-second debounce on frontend) |
| POST | `/projects/{project_id}/documents/{document_id}/sections/{section_id}/collaboration/auth` | `verify_project_ownership` + document permission resolution | Authorize current user for the section's Liveblocks room |
| PATCH | `/projects/{project_id}/documents/{document_id}/sections/{section_id}/collaboration/snapshot` | `verify_project_ownership` + `EDIT` permission | Persist a Liveblocks collaborative editor snapshot to `sections.content_md` |
| PUT | `/projects/{project_id}/documents/{document_id}/sections/{section_id}/title` | `verify_project_ownership` | Update section title |
| PUT | `/projects/{project_id}/documents/{document_id}/sections/reorder` | `verify_project_ownership` | Reorder sections by ID array |
| DELETE | `/projects/{project_id}/documents/{document_id}/sections/{section_id}` | `verify_project_ownership` | Soft-delete section |
| GET | `/projects/{project_id}/documents/{document_id}/freshness` | `verify_project_ownership` | Get freshness status for all sections |
| POST | `/projects/{project_id}/documents/{document_id}/sections/{section_id}/freshness/accept` | `verify_project_ownership` | Accept freshness update proposal |
| POST | `/projects/{project_id}/documents/{document_id}/sections/{section_id}/freshness/reject` | `verify_project_ownership` | Reject freshness update proposal |

### `sections.py` — Prefix: `/sections`, Tags: `sections`

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| GET | `/sections/{section_id}` | `get_current_user` | Get section with evidence references |
| PATCH | `/sections/{section_id}/autosave` | `get_current_user` | Autosave section content (tracks modified/unchanged) |
| PATCH | `/sections/{section_id}` | `get_current_user` | Update section + create version snapshot |
| PATCH | `/sections/{section_id}/status` | `get_current_user` | Update status + create version snapshot |
| POST | `/sections/{section_id}/accept-review` | `get_current_user` | Accept section review (marks content as reviewed) |
| PUT | `/sections/reorder` | `get_current_user` | Reorder sections by ID array |
| PUT | `/sections/{section_id}/title` | `get_current_user` | Update section title |
| DELETE | `/sections/{section_id}` | `get_current_user` | Soft-delete section |

### `ai.py` — Tags: `ai`

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| POST | `/documents/{document_id}/ai/suggest-structure` | `get_current_user` | AI suggests structural changes (reorder/rename/add/remove/merge) |
| POST | `/projects/{project_id}/ai/generate-outline` | `get_current_user` | Generate outline from analysis via active AI provider |
| POST | `/sections/{section_id}/ai/generate` | `get_current_user` | Generate section content via AI + version snapshot |
| POST | `/sections/{section_id}/ai/refine` | `get_current_user` | Refine section per user instruction, returns diff |
| POST | `/sections/{section_id}/ai/accept` | `get_current_user` | Accept refined content + version snapshot |
| POST | `/projects/{project_id}/chat/threads` | `get_current_user` | Create chat thread |
| GET | `/projects/{project_id}/chat/threads` | `get_current_user` | List chat threads |
| POST | `/chat/threads/{thread_id}/messages/stream` | `get_current_user` | Send message and stream AI response via SSE |
| GET | `/chat/threads/{thread_id}/messages` | `get_current_user` | Get all messages in thread |
| POST | `/sections/{section_id}/phrasing-suggestions` | `get_current_user` | Get 3 alternative phrasings for selected text |

### `export.py` — Prefix: `/projects`, Tags: `export`

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| GET | `/projects/{project_id}/documents/{document_id}/export` | `verify_project_ownership` | Export document as markdown/html/pdf with optional override settings. Returns file as download. |
| GET | `/projects/{project_id}/export` | `verify_project_ownership` | Legacy: export first document in project |
| GET | `/projects/{project_id}/documents/{document_id}/export-preview` | `verify_project_ownership` | Return HTML preview (no Content-Disposition header) |
| POST | `/projects/batch-export` | `get_current_user` | Batch export up to 50 projects as PDFs in zip file |

Export supports ~40 query parameters for customization: `format`, `paper_size`, `margin_top/bottom/left/right`, `font_family`, `font_size`, `heading_font`, `primary_color`, `secondary_color`, `background_color`, `text_color`, `heading_color`, `link_color`, `code_theme`, `line_height`, `max_width`, `show_header`, `header_text`, `show_footer`, `footer_text`, `show_page_numbers`, `page_number_format`, `logo_url`, `logo_position`, `logo_max_width`, `table_style`, `watermark_text`, `watermark_opacity`, `include_diagrams`, `cover_page`, `page_break_between_sections`, `toc_depth`, `toc`, and more.

### `templates.py` — Prefix: `/templates`, Tags: `templates`

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| GET | `/templates` | `get_current_user` | List all built-in + user's custom templates |
| POST | `/templates` | `get_current_user` | Create custom template |
| PATCH | `/templates/{template_id}` | `get_current_user` | Update own custom template (not built-in) |
| DELETE | `/templates/{template_id}` | `get_current_user` | Delete own custom template (not built-in) |

### `organizations.py` — Prefix: `/organizations`, Tags: `organizations`

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| GET | `/organizations` | `get_current_user` | List user's organizations |
| POST | `/organizations` | `get_current_user` | Create organization + add self as ADMIN |
| GET | `/organizations/{org_id}` | membership | Get organization details |
| PATCH | `/organizations/{org_id}` | ADMIN | Update org settings (name, avatar, quality_threshold, ai_provider/key) |
| GET | `/organizations/{org_id}/members` | membership | List/filter members |
| POST | `/organizations/{org_id}/invites` | ADMIN | Send invite email |
| POST | `/organizations/{org_id}/invites/{user_id}/resend` | ADMIN | Resend invite |
| POST | `/organizations/invites/{token}/accept` | `get_current_user` | Accept invite by token |
| GET | `/organizations/{org_id}/audit-logs` | ADMIN/PM | Paginated audit logs |
| PUT | `/organizations/{org_id}/members/{user_id}` | ADMIN | Update member role |
| DELETE | `/organizations/{org_id}/members/{user_id}` | ADMIN | Remove member |
| POST | `/organizations/{org_id}/join-links` | ADMIN | Create join link |
| GET | `/organizations/{org_id}/join-links` | ADMIN | List join links |
| POST | `/organizations/{org_id}/join-links/{link_id}/revoke` | ADMIN | Revoke join link |
| POST | `/organizations/join-links/{code}/accept` | `get_current_user` | Join org via link |

### `search.py` — Prefix: `/projects`, Tags: `search`

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| GET | `/projects/search` | `get_current_user` | Full-text search across projects, documents, sections. Filters: `q`, `tag`, `status`, `type` (all/project/document/section), `sort` (relevance/updated/created/name). Capped at 50 results. |

### `git.py` — Prefix: `/projects/git`, Tags: `git`

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| GET | `/projects/git/repos` | `get_current_user` | List GitHub repos via OAuth (paginated) |
| GET | `/projects/git/repos/{owner}/{repo}/branches` | `get_current_user` | List branches for a specific repo |

### `shares.py` — Tags: `shares`

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| GET | `/projects/{project_id}/documents/{document_id}/shares` | `verify_document_access` | List active (non-revoked) shares |
| POST | `/projects/{project_id}/documents/{document_id}/shares` | admin/creator | Create/update share (upsert by document_id + user_id) |
| DELETE | `/projects/{project_id}/documents/{document_id}/shares/{share_id}` | admin/creator | Revoke share (sets revoked_at) |

### `versions.py` — Tags: `versions`

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| GET | `/sections/{section_id}/versions` | `get_current_user` | List all versions for a section |
| GET | `/versions/{version_id}/diff` | `get_current_user` | Diff between version and its immediate predecessor |
| POST | `/versions/{version_id}/restore` | `get_current_user` | Restore section to this version's content + create new version | 349 |

### `quality.py` — Tags: `quality`

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| POST | `/projects/{project_id}/documents/{document_id}/quality/run` | `verify_project_ownership` | Dispatch Celery quality analysis task (returns 202) |
| GET | `/projects/{project_id}/documents/{document_id}/quality` | `verify_project_ownership` | Get quality report with issues and broken links |
| GET | `/projects/{project_id}/documents/{document_id}/quality/issues` | `verify_project_ownership` | Get quality issues, optionally filtered by severity |

### `notes.py` — Tags: `notes`

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| GET | `/projects/{project_id}/documents/{document_id}/notes` | `verify_project_ownership` | List notes, optionally filtered by section_id |
| POST | `/projects/{project_id}/documents/{document_id}/notes` | `verify_project_ownership` | Create collaboration note |

### Liveblocks collaboration support in `documents.py`

Real-time collaboration is implemented in the documents router rather than a separate router because rooms are section-scoped and must validate project, document, and section identity together.

- Room id format: `project:{project_id}:document:{document_id}:section:{section_id}`
- Auth endpoint: validates the current JWT cookie session, checks document access/share permission, maps Pagemark permissions to Liveblocks room permissions, then calls `POST {LIVEBLOCKS_API_BASE_URL}/v2/authorize-user`.
- Snapshot endpoint: accepts Markdown from the collaborative editor, requires effective `EDIT` permission, blocks edits to `APPROVED` documents, persists `sections.content_md`, and clears reviewed state just like normal content edits.
- If `LIVEBLOCKS_SECRET_KEY` is empty, collaboration auth returns 503 so deployments fail closed instead of issuing unauthenticated rooms.

### `grammar.py` — Tags: `grammar`

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| POST | `/projects/{project_id}/grammar/check` | `get_current_user` | Check text grammar via LanguageTool |

### `terminology.py` — Tags: `terminology`

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| GET | `/terminology/projects/{project_id}/check` | `get_current_user` | Find terminology conflicts in document sections |
| POST | `/terminology/projects/{project_id}/resolve` | `get_current_user` | Replace a term across all sections |

### `keys.py` — Tags: `api-keys`

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| GET | `/users/api-keys` | `get_current_user` | List API keys (metadata only, not the raw key) |
| POST | `/users/api-keys` | `get_current_user` | Create API key (returns raw key once) |
| DELETE | `/users/api-keys/{key_id}` | `get_current_user` | Revoke API key |

### `uploads.py` — Tags: `uploads`

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| POST | `/upload/logo` | `get_current_user` | Upload logo image (png/jpeg/webp/svg, max 5MB) |

### `resources.py` — Tags: `resources`

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| POST | `/projects/{project_id}/resources/upload` | `verify_project_ownership` | Upload resource file (PDF/image/doc/text, max 20MB), extract text |
| GET | `/projects/{project_id}/resources` | `verify_project_ownership` | List resources, optionally filtered by type |
| GET | `/projects/{project_id}/resources/{resource_id}` | `verify_project_ownership` | Get resource metadata |
| GET | `/projects/{project_id}/resources/{resource_id}/data` | `verify_project_ownership` | Download raw file data |
| DELETE | `/projects/{project_id}/resources/{resource_id}` | `verify_project_ownership` | Delete resource |

### `clarification.py` — Tags: `clarifications`

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| GET | `/clarifications/{section_id}` | `get_current_user` | Get latest pending clarification for a section |
| POST | `/clarifications/{section_id}/clarify` | `get_current_user` | Answer a clarification request → resumes generation |

### `nlp.py` — Tags: `nlp`

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| GET | `/projects/{project_id}/nlp-report` | `get_current_user` | Get latest NLP report for project |

### `context_search.py` — Tags: `context search`

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| GET | `/context-search/{project_id}` | `get_current_user` | Search project resources, sections, documents, files, symbols. Results grouped by type with relevance scores. |

## Service Layer Reference

### `services/auth_service.py`

Functions:
- `hash_password(password: str) -> str` — bcrypt hash
- `verify_password(plain: str, hashed: str) -> bool` — bcrypt verify
- `create_access_token(data: dict) -> str` — JWT encode with `sub`, `exp` (30min), `type: "access"`
- `create_refresh_token(data: dict) -> str` — JWT encode with `sub`, `exp` (7d), `type: "refresh"`
- `decode_token(token: str) -> dict` — JWT decode with key verification

### `services/crypto_service.py`

- `encrypt_token(plain_text: str) -> str` — Fernet encrypt
- `decrypt_token(encrypted_text: str) -> str` — Fernet decrypt

### `services/ai_service.py`

Unified AI provider interface with three implementations:

- `complete_text(system_prompt, user_prompt, provider, api_key, model_id) -> str` — Routes to the appropriate provider implementation based on provider string
- `validate_credential(provider, api_key, model_id) -> bool` — Tests provider connectivity
- `list_models(provider, api_key) -> list[str]` — Lists available models for a provider (only Google supports dynamic listing; others return catalog)

Provider-specific implementations (private functions):
- `_complete_anthropic(system, user, api_key, model)` — Uses Anthropic SDK with `max_tokens=16384`, no streaming
- `_complete_google(system, user, api_key, model)` — Uses Google Generative AI SDK with `max_output_tokens=8192`
- `_complete_opencode_go(system, user, api_key, model)` — HTTP POST to configurable endpoint with JSON body

### `services/ai_doc_service.py`

Singleton `AIService` class (instance: `ai_service`) providing high-level AI operations:

- **`generate_section(section, document, project, provider, api_key, model, resource, evidence)`**:

  1. Fetches active analysis snapshot for the project
  2. Builds section prompt via `build_section_prompt()` with project context, codebase analysis, template instructions, and section guidance
  3. Calls `ai_service.complete_text()`
  4. Parses response JSON — expects `{ "content": "..." }` or `{ "action": "ask_user", "question": "...", ... }`
  5. If `action: "ask_user"`, raises `NeedsClarificationException` to create a clarification request
  6. On success, creates evidence references from response data, updates section content and lifecycle, creates version snapshot

- **`refine_section(section, user_instruction, provider, api_key, model)`**:

  1. Builds refine prompt via `build_refine_prompt()` with current content + instruction
  2. Calls AI and gets improved markdown
  3. Computes diff stats using `difflib.SequenceMatcher` (added/removed/modified lines)
  4. Returns `{"content", "diff", "diff_lines"}` with line-level diff

- **`stream_chat(thread, messages, provider, api_key, model, resource)`**:

  1. Builds chat prompt via `build_chat_prompt()`
  2. For Anthropic: Uses native streaming via SDK (`stream=True`), yields SSE events with `text` delta and `citation` types
  3. For other providers: Falls back to `complete_text()` then yields the full response as one chunk
  4. Saves the complete AI message to the database after streaming finishes
  5. Yields SSE-formatted strings with `data: ` prefix

- **`phrasing_suggestions(text, provider, api_key, model)`**: Gets 3 alternative phrasings for selected text via AI

- **`suggest_structure(sections_json, document, provider, api_key, model)`**: Gets structural suggestions (reorder, rename, add, remove, merge) for the document outline via AI

### `services/context_assembly.py`

`ContextAssemblyService` singleton for token-budget-aware context construction:

- **`assemble(resources, max_tokens=8000)`**: Builds structured context blocks from `Resource` objects, truncating to fit within token budget. Returns `<context>` blocks with type annotations (section, document, file_metadata, file_content, symbol, analysis_fragment, etc.)
- **`get_vision_content_blocks(resources)`**: Extracts image resources for Anthropic vision API support

### `services/ai_credential_service.py`

Manages user AI credentials:

- `upsert_credential(db, user_id, provider, api_key, model_id) -> UserAiCredential` — Encrypts key, creates/updates credential, sets as active
- `set_active_credential(db, credential_id, user_id) -> UserAiCredential` — Sets one credential active, deactivates others
- `delete_credential(db, credential_id, user_id)` — Deletes credential
- `get_active_credential(db, user_id) -> ActiveCredential | None` — Gets active credential with decrypted key
- `list_provider_models(provider, api_key) -> list[str]` — Lists models for a provider

### `services/generation_service.py`

Orchestrates document generation runs:

- **`create_generation_run(db, document_id, mode, provider, model, estimate_only=False) -> GenerationRun`**: Creates run record, estimates tokens/cost using model pricing tables
- **`execute_generation_run(run_id, db)`**: Executes a generation run:
  - For `SECTION_ON_DEMAND`: Creates a single section task
  - For `COMPLETE_DOCUMENT`: Creates section tasks for all empty sections, handles dependencies (foundational sections first), uses semaphore for provider-aware parallelism (Anthropic=2, Google=5, default=3)
  - Calls `_execute_task()` for each task which invokes `ai_service.generate_section()`
  - If `NeedsClarificationException` is caught: Pauses the task, creates `ClarificationRequest`
  - If provider error occurs: Pauses the run and requires user confirmation before failover
- **`confirm_failover(run_id, db)`**: Confirms provider failover; remaining tasks use a fallback provider
- **`accept_section_review(section_id, user_id, db)`**: Accepts a section's generated content as reviewed

### `services/template_recommendation_service.py`

- **`create_rule_based_recommendations(db, document_id)`**: Scores templates against analysis facts (language, framework, project type). Uses predefined compatibility rules — e.g., API Reference matches repos with endpoints, SDK Guide matches Python/JS repos with package managers
- **`create_ai_personalized_recommendation(db, document_id)`**: Uses AI to analyze project context and suggest the most appropriate template
- **`create_custom_outline_seeded_recommendation(db, document_id, sections)`**: Creates a recommendation based on user-provided custom outline
- **`create_outline_proposal(db, document_id, basis, analysis_id, template_id=None, custom_sections=None)`**: Generates outline proposal from template or custom input, optionally AI-adapted
- **`approve_outline_proposal(db, proposal_id, user_id)`**: Approves proposal → creates Section entities from outline, marks proposal as APPROVED (immutable after this)
- **`create_clarification_request(db, ...)`**: Creates clarification requests for low-confidence areas
- **`skip_clarification_request(db, request_id)`**: Skips a clarification request

### `services/analysis_service.py`

(See the dedicated Code Analysis document for full details — this is the 1285-line core analysis pipeline.)

### `services/export_service.py`

(See the dedicated Export document for full details.)

### `services/git_service.py`

- `validate_git_url(url: str) -> bool` — Validates git URL format (https, ssh, git://)
- `clone_repo(url, target_path, branch="main", depth=1, ignore_patterns=None) -> str` — Shallow clone using GitPython, applies post-clone exclusion cleanup
- `get_head_commit(repo_path) -> str` — Returns HEAD commit SHA
- `cleanup_repo(repo_path)` — Recursively removes cloned repo
- `check_repo_accessible(url, token=None) -> bool` — Checks repository accessibility

### `services/github_service.py`

- `get_authorize_url() -> str` — Builds GitHub OAuth authorize URL with scopes (repo, user, read:org)
- `exchange_code_for_token(code) -> dict` — Exchanges authorization code for access token
- `fetch_user_profile(access_token) -> dict` — Gets authenticated user's GitHub profile
- `fetch_user_repos(access_token, page=1, per_page=30) -> list` — Lists user's repositories
- `fetch_repo_branches(owner, repo, access_token) -> list` — Lists branches for a repo
- `fetch_repo_metadata(owner, repo, access_token) -> dict` — Gets repo metadata (default branch, visibility, description)
- `build_authenticated_clone_url(access_token, owner, repo) -> str` — Builds HTTPS clone URL with token embedded

### `services/freshness_service.py`

- `detect_stale_sections(db, project_id, old_analysis_id, new_analysis_id)` — Compares old vs new analysis for changes in: source_commit, file_tree, endpoints, languages. Returns list of stale section IDs with change summaries
- `generate_update_proposal(db, section_id, new_analysis)` — Generates AI proposal for updating a stale section
- `apply_freshness_update(db, section_id)` — Applies accepted freshness update
- `refresh_document_freshness(db, document_id)` — Refreshes freshness state for all sections in a document
- `get_document_freshness_status(db, document_id)` — Returns freshness summary for a document

### `services/activity_service.py`

- `record_event(db, project_id, event_type, weight=1.0, **links)` — Records an activity event with optional linked entities
- `get_timeline(db, project_id, limit=50, offset=0, event_type=None, days=None)` — Paginated timeline of events
- `get_recent_for_org(db, user_id, limit=20, days=30)` — Recent events across org projects (filtered by notification preferences)
- `get_heatmap_data(db, project_id, days=365)` — Daily event counts weighted by event type for GitHub-style heatmap

### `services/version_service.py`

- `compute_diff(version)` — Computes diff between version and its immediate predecessor using Python's `difflib.unified_diff`
- `restore_version(db, version_id, user_id)` — Restores section content from a version, creates new version snapshot

### `services/section_service.py`

- `section_to_response(section)` — Converts section ORM to response dict with children and evidence
- `build_section_tree(sections)` — Builds hierarchical tree from flat section list using parent_id
- `compute_completion_pct(document)` — Calculates completion percentage from section content_lifecycle states
- `get_project_for_user(db, project_id, user_id)` — Verifies user has access to project
- `get_document_for_project(db, document_id, project_id)` — Verifies document belongs to project
- `get_section_for_user(db, section_id, user_id)` — Full access check chain for section
- `clear_review_state_for_content_edit(section)` — When user edits reviewed content, clears review state (resets to generated_draft)
- `recompute_project_completion(db, project_id)` — Updates project status based on document completion

### `services/grammar_service.py`

- `check_grammar(text, language="en-US") -> dict` — Sends text to LanguageTool API, returns issues with replacements, offset, message, rule

### `services/nlp_service.py`

- `compute_readability(text) -> float` — Flesch Reading Ease score (for English text)
- `extract_entities(text) -> list` — Named entity extraction (heuristic: capitalized phrases, common entity patterns)
- `analyze_style(text) -> dict` — Style metrics (avg sentence length, passive voice count, adverb count, lexical diversity)
- `generate_suggestions(style_analysis) -> list` — Generates improvement suggestions based on style analysis

### `services/terminology_service.py`

- `check_terminology(db, project_id) -> list` — Scans document sections for conflicting terminology usage
- `resolve_terminology(db, project_id, old_term, new_term)` — Replaces a term across all sections in a project, creating version snapshots

### `services/notifications_service.py`

- `send_notification(recipient_email, subject, body)` — Sends email via fastapi-mail
- `send_verification_email(user, token)` — Sends email verification link
- `send_password_reset_email(user, token)` — Sends password reset link
- `send_invite_email(inviter_name, org_name, invite_token, recipient_email)` — Sends org invitation email

## Celery Workers

### `workers/celery_app.py`

Configures Celery with Redis broker and result backend. Auto-discovers tasks from configured modules.

### `workers/analysis_worker.py`

- **`analyze_project_task(project_id, analysis_id, source_path, source_type='zip', ignore_patterns=None)`**: Extracts ZIP archive, runs static analysis pipeline (steps 3-7), saves results. Retries up to 3 times on failure.
- **`clone_and_analyze_task(project_id, analysis_id, repo_url, branch='main')`**: Clones git repo, runs analysis pipeline, cleans up cloned repo. Retries up to 3 times.
- **`_run_nlp_analysis(project_id, analysis_id)`**: Computes readability, entities, style analysis, and suggestions from document content.

### `workers/quality_worker.py`

- **`generate_quality_report(document_id)`**: Analyzes document quality — checks completeness (empty sections), consistency (heading structure), readability scores, broken links, terminology conflicts. Creates/updates `QualityReport` with sub-scores and issues.

### `workers/notification_worker.py`

- **`send_email_task(recipient, subject, body)`**: Sends email asynchronously via Celery.

## Middleware

- **CORS middleware** — Configured in `main.py` with specific allowed origins
- **Authentication middleware** — No global middleware; individual endpoints use `Depends(get_current_user)`
- **No other custom middleware** — The app uses FastAPI's built-in exception handlers

## Error Handling

- **HTTP exceptions** — Standard FastAPI `HTTPException` raises (401 for auth, 403 for permission, 404 for not found, 422 for validation)
- **NeedsClarificationException** — Caught in generation flow to create clarification requests rather than failing entirely
- **Celery retries** — Analysis and clone tasks have `max_retries=3` with 10-second countdown
- **Celery failures** — Analysis failures are recorded in the `analyses` table with `error_message` and `status=FAILED`

## Authentication & Authorization

- **Session management**: JWT tokens stored in httponly cookies
- **Role-based access**: Organization roles enforced via `require_org_role()` dependency
- **Resource ownership**: Verified through chain of foreign keys (Section→Document→Project→Organization→Member)
- **Document sharing**: External users can access documents via `DocumentShare` with VIEW/COMMENT/EDIT permissions
