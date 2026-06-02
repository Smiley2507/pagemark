# PAGEMARK.md — Backend Context File for AI Agents
## Read this file before generating any code for this project.

---

## What Pagemark Is

Pagemark is an AI-assisted collaborative software documentation generation
system. Developers upload source code, an AI analyses it and generates
structured technical documentation, and the developer refines it section
by section through a conversational AI interface.

This is a final year project at Adventist University of Central Africa (AUCA),
Faculty of Information Technology, Software Engineering. Student ID: 25599.

---

## Tech Stack

| Layer | Technology |
|---|---|
| API framework | FastAPI (Python 3.11) |
| ORM | SQLAlchemy 2.0 (async) |
| Migrations | Alembic |
| Database | PostgreSQL |
| Auth | JWT stored in httpOnly cookies |
| Password hashing | bcrypt (passlib) |
| AI | Anthropic Claude API (claude-sonnet-4-5) |
| Background jobs | Celery + Redis |
| Code analysis | Tree-sitter (Python bindings) |
| Email | fastapi-mail |
| Export | WeasyPrint (PDF), python-docx (DOCX), markdown (HTML) |
| HTTP client | httpx (for OAuth and link checking) |
| Diff computation | difflib (Python stdlib) |
| Readability | textstat |
| Token encryption | cryptography (Fernet) |

---

## Project Folder Structure

```
backend/
├── app/
│   ├── main.py              ← FastAPI app, CORS, router registration
│   ├── config.py            ← pydantic-settings, reads from .env
│   ├── database.py          ← async SQLAlchemy engine, get_db dependency
│   ├── dependencies.py      ← get_current_user, require_org_role,
│   │                           verify_project_access, verify_section_access,
│   │                           log_action helper
│   ├── models/
│   │   ├── __init__.py
│   │   ├── user.py          ← User, EmailVerification, PasswordReset
│   │   ├── organization.py  ← Organization, OrganizationMember, OAuthToken
│   │   ├── project.py       ← Project, Template
│   │   ├── document.py      ← Document, Section
│   │   ├── version.py       ← SectionVersion
│   │   ├── analysis.py      ← Analysis
│   │   ├── quality.py       ← QualityReport, QualityIssue, BrokenLink
│   │   ├── chat.py          ← ChatThread, ChatMessage
│   │   ├── share.py         ← Share, Comment
│   │   └── audit.py         ← AuditLog
│   ├── schemas/
│   │   └── (one file per model domain, mirrors models/)
│   ├── routers/
│   │   ├── auth.py          ← register, login, logout, refresh, verify-email,
│   │   │                       forgot-password, reset-password,
│   │   │                       github/authorize, github/callback,
│   │   │                       gitlab/authorize, gitlab/callback
│   │   ├── users.py         ← profile, settings, avatar, api-keys
│   │   ├── organizations.py ← CRUD, members, invite, join-request
│   │   ├── projects.py      ← CRUD, duplicate, star (scoped to org)
│   │   ├── templates.py     ← list, create, delete
│   │   ├── documents.py     ← get document tree
│   │   ├── sections.py      ← CRUD, reorder, autosave, status,
│   │   │                       prefill, retry-prefill
│   │   ├── versions.py      ← list, diff, restore
│   │   ├── analysis.py      ← upload, git-connect-url, git-connect-oauth,
│   │   │                       git-sync, status, apply-outline,
│   │   │                       dismiss-outline, prefill-estimate,
│   │   │                       full-prefill, full-prefill-progress
│   │   ├── ai.py            ← generate-outline, generate-section,
│   │   │                       refine, accept, reject,
│   │   │                       chat-threads, messages, stream
│   │   ├── quality.py       ← run, report, issues
│   │   ├── export.py        ← export (markdown/pdf/html/docx)
│   │   ├── sharing.py       ← create share, list, revoke, shared/{token},
│   │   │                       comments
│   │   └── knowledge.py     ← articles CRUD (admin write, all read)
│   ├── services/
│   │   ├── auth_service.py       ← hash_password, verify, create_token
│   │   ├── ai_service.py         ← generate_section, refine_section,
│   │   │                            stream_chat, generate_outline
│   │   ├── analysis_service.py   ← generate_outline_with_ai,
│   │   │                            apply_outline_to_document
│   │   ├── prefill_service.py    ← generate_section_content,
│   │   │                            estimate_prefill_tokens
│   │   ├── quality_service.py    ← score_completeness, score_readability,
│   │   │                            score_consistency, check_links
│   │   └── export_service.py     ← export_markdown, export_html, export_pdf,
│   │                                export_docx
│   ├── workers/
│   │   ├── celery_app.py         ← Celery instance, Redis broker
│   │   ├── analysis_worker.py    ← analyze_project_task,
│   │   │                            clone_and_analyze_task
│   │   ├── quality_worker.py     ← score_quality_task
│   │   ├── export_worker.py      ← export_task
│   │   └── prefill_worker.py     ← full_prefill_task
│   └── prompts/
│       ├── system_prompt.py      ← DOCUMENTATION_SPECIALIST_PROMPT
│       ├── outline.py            ← OUTLINE_SYSTEM_PROMPT, build_outline_prompt,
│       │                            parse_and_validate_outline_json
│       ├── section.py            ← build_section_prompt (per section type)
│       ├── refine.py             ← build_refine_prompt
│       └── chat.py               ← build_chat_prompt
├── alembic/
│   ├── versions/
│   └── env.py
├── tests/
├── uploads/                  ← uploaded ZIP files (gitignored)
├── repos/                    ← cloned git repos temp storage (gitignored)
├── .env
├── .env.example
├── alembic.ini
├── requirements.txt
└── PAGEMARK.md               ← this file
```

---

## Database Schema

### users
```
id, email (unique), password_hash, name, avatar_url,
email_verified (bool, default false),
created_at, updated_at
```

### email_verifications
```
id, user_id → users, token (unique), expires_at, used (bool), created_at
```

### password_resets
```
id, user_id → users, token (unique), expires_at, used (bool), created_at
```

### organizations
```
id, name, slug (unique), avatar_url,
created_by → users,
personal (bool, default false),   ← true for auto-created personal orgs
created_at, updated_at
```

### organization_members
```
id,
org_id → organizations,
user_id → users,
role (enum: admin, project_manager, developer, technical_writer, viewer),
status (enum: active, invited, suspended),
invited_by → users (nullable),
joined_at (nullable),
created_at
UNIQUE (org_id, user_id)
```

### oauth_tokens
```
id, user_id → users, provider (github/gitlab),
access_token (encrypted with Fernet),
token_scope, created_at, updated_at
UNIQUE (user_id, provider)
```

### user_api_keys
```
id, user_id → users, name, key_hash (hashed), key_prefix (first 8 chars),
last_used_at, created_at
```

### user_settings
```
user_id PK → users, notifications_json, language (default en),
theme (default system)
```

### projects
```
id,
org_id → organizations,      ← OWNED BY ORG, NOT BY USER
created_by → users,
name, description,
status (enum: pending, draft, finalized),
completion_pct (float, default 0),
source_type (enum: zip, git, scratch),
git_repo_url (nullable), git_branch (nullable),
git_provider (nullable: github, gitlab),
template_id → templates (nullable),
starred (bool, default false),
deleted_at (nullable),        ← soft delete only
created_at, updated_at
```

### templates
```
id, name, description, category,
sections_json (JSON recursive tree),
org_id → organizations (nullable, null = built-in),
created_by → users (nullable),
is_builtin (bool),
created_at
```

### documents
```
id, project_id → projects, title (default Documentation)
```

### sections
```
id, document_id → documents,
parent_id → sections (nullable),  ← null = H1, int = H2
order_index (int),
heading (string),
content_md (text, default ''),
status (enum: pending, draft, finalized, error),
created_at, updated_at
UNIQUE (document_id, heading)     ← headings unique within document
```

### section_versions
```
id, section_id → sections,
content_md (text),
author_type (enum: user, ai),
summary (string, nullable),
added (int), removed (int), modified (int),
created_at
```

### analyses
```
id, project_id → projects (unique),
status (enum: pending, running, complete, failed),
current_step (int, default 0),
total_steps (int, default 6),
current_step_label (string),
file_tree_json (JSON),
languages_json (JSON),
endpoints_json (JSON),
complexity_score (float),
deps_json (JSON),
outline_json (JSON, nullable),        ← AI proposed outline, not yet applied
has_pending_proposal (bool, default false),
error_message (string, nullable),
completed_at (nullable),
created_at
```

### quality_reports
```
id, project_id → projects (unique),
overall_score, completeness, consistency, readability, accuracy (all float),
generated_at
```

### quality_issues
```
id, report_id → quality_reports,
severity (enum: error, warning, info),
section_ref, message, suggestion
```

### broken_links
```
id, report_id → quality_reports,
url, status_code (int), section_ref
```

### chat_threads
```
id, project_id → projects,
title (string, auto-derived from first message),
created_at, updated_at
```

### chat_messages
```
id, thread_id → chat_threads,
role (enum: user, ai),
content (text),
created_at
```

### shares
```
id, project_id → projects,
token (unique, random 32 chars),
permission (enum: view, comment, edit),
created_by → users,
expires_at (nullable),
created_at
```

### comments
```
id, project_id → projects,
section_id → sections,
author_id → users,
body (text),
resolved (bool, default false),
created_at
```

### kb_articles
```
id, kind (enum: template, glossary, best_practice, style_rule),
title, body (text), tags (ARRAY),
created_by → users,
org_id → organizations (nullable, null = platform-wide),
created_at
```

### audit_logs
```
id, user_id → users (nullable),
org_id → organizations (nullable),
project_id → projects (nullable),
action (string), metadata_json (JSON),
created_at
```

---

## Conventions — Follow These in Every File

### Architecture
- Business logic lives in `services/` — never in `routers/`
- All AI calls go through `ai_service.py` — never direct in routers
- All prompts live in `prompts/` — never hardcoded in services or routers
- Background jobs always run via Celery — never inline in API routes
- One model file per domain — never put multiple unrelated models in one file

### Naming
- Router files: snake_case matching the resource (`organizations.py`)
- Service functions: verb_noun (`generate_section_content`, `apply_outline`)
- Celery tasks: noun_verb_task (`analyze_project_task`, `score_quality_task`)
- Pydantic schemas: ResourceCreate, ResourceUpdate, ResourceResponse

### Auth and Permissions
- JWT in httpOnly cookies — NEVER in response body or localStorage
- Every protected route calls `get_current_user` first
- Every org-scoped route calls `require_org_role` second
- Section access verified via `verify_section_access` (joins through doc→project→org)
- Return 404 (never 403) when user cannot access a resource
  (never confirm that a resource exists to unauthorized users)
- Roles stored in `organization_members` — NEVER on the `users` table

### Data Safety
- Soft delete only — set `deleted_at = now()`, never DELETE from projects
- Autosave does NOT create a version snapshot
- Version snapshot created ONLY on: AI accept, manual save, status change
- AI refine endpoint returns diff — does NOT auto-save
- User must call accept endpoint explicitly to save refined content
- Celery tasks always re-verify ownership using the passed user_id

### Ownership Verification Pattern
```python
# Every Celery task uses this pattern:
project = db.query(Project).join(Organization).join(OrganizationMember).filter(
    Project.id == project_id,
    OrganizationMember.user_id == user_id,
    OrganizationMember.status == "active"
).first()
if not project:
    raise ValueError(f"Project {project_id} not found for user {user_id}")
```

### Section Hierarchy Rules
- Maximum two levels: H1 (parent_id=None) and H2 (parent_id=H1.id)
- Cannot add a child to an H2 section
- Cannot reparent an H1 that has children to become an H2
- Heading must be unique within a document (enforced by DB constraint)
- Cascade delete: deleting an H1 also deletes all its H2 children

### Outline Proposal Rules (Non-Destructive)
- AI outline saved to `analysis.outline_json` — never applied automatically
- `has_pending_proposal` flips to true when proposal is ready
- Apply action: adds new sections, reorders existing, NEVER deletes sections
- Existing section content is NEVER overwritten by apply

---

## Organization System

### How It Works
Every user gets a personal organization (personal=true) automatically on
registration. Projects belong to organizations, not users. Users belong
to organizations via organization_members with a specific role.

### Registration Flow
1. User fills: name, email, password, organization name (optional), role
2. Email verification sent (required before login)
3. If org name provided and org exists: offer to request to join or create new
4. If org name provided and org is new: create org, make user admin
5. If no org name: create personal org named "{name}'s Workspace"
6. On first login after verification: show 3-step onboarding wizard

### Role Permission Matrix
```
Action                         admin  pm    dev   tw    viewer
───────────────────────────────────────────────────────────────
Invite / remove members          ✓
Change member roles              ✓
Delete organization              ✓
Create / delete projects         ✓     ✓
View all projects                ✓     ✓     ✓     ✓     ✓
Upload code / run analysis       ✓     ✓     ✓
Edit documentation               ✓     ✓     ✓     ✓
AI generate / prefill            ✓     ✓     ✓     ✓
Submit for review                ✓     ✓     ✓     ✓
Review and approve docs          ✓     ✓           ✓
Export documentation             ✓     ✓     ✓     ✓     ✓
View quality reports             ✓     ✓     ✓     ✓     ✓
Configure quality thresholds     ✓     ✓
Manage templates                 ✓
View audit logs                  ✓     ✓
Manage org settings              ✓
```

### require_org_role Dependency
```python
async def require_org_role(
    required_roles: list[str],
    org_id: int,
    current_user: User,
    db: AsyncSession
) -> OrganizationMember:
    membership = await db.execute(
        select(OrganizationMember).where(
            OrganizationMember.org_id == org_id,
            OrganizationMember.user_id == current_user.id,
            OrganizationMember.status == "active"
        )
    )
    member = membership.scalar_one_or_none()
    if not member:
        raise HTTPException(404, "Not found")
    if member.role not in required_roles:
        raise HTTPException(403, "Insufficient permissions")
    return member
```

---

## AI System

### The Prompt Hierarchy (every AI call uses all four layers)
```
Layer 1: DOCUMENTATION_SPECIALIST_PROMPT  (in every call as system prompt)
Layer 2: Task-specific prompt             (section.py, refine.py, etc.)
Layer 3: Project context                  (from project.context_md field)
Layer 4: Situational data                 (code analysis, current content)
```

### DOCUMENTATION_SPECIALIST_PROMPT rules (in system_prompt.py)
The system prompt must instruct Claude to:
- Never produce generic documentation applicable to any project
- Never use filler phrases ("This section covers...", "In this guide...")
- Never invent technical details not in the code analysis
- Never write placeholder text like "[your project name]"
- Always use project-specific terminology from the context file
- Always target the specified audience and tone
- Return only the section content in markdown — no preamble

### AI Endpoints Behaviour
- `POST /ai/generate-section`: generates, saves, creates version (author=ai)
- `POST /ai/refine`: returns diff only — does NOT save
- `POST /ai/accept`: saves refined content, creates version (author=ai)
- `POST /ai/reject`: no-op (frontend discards diff)
- `POST /ai/chat/stream`: SSE streaming, saves both user and AI messages

### Streaming Response Format
```
data: {text chunk}\n\n    ← each token as it arrives
data: [DONE]\n\n           ← signals stream end
```

---

## Background Job Patterns

### Celery Task State Updates
All long-running tasks update state for frontend polling:
```python
self.update_state(
    state="PROGRESS",
    meta={
        "current": step_number,
        "total": total_steps,
        "label": "Extracting files..."
    }
)
```

### Analysis Pipeline Steps (6 steps)
1. Extracting files
2. Reading file structure (file tree, LOC)
3. Detecting languages (aggregate stats)
4. Analysing code structure (Tree-sitter AST)
5. Detecting API endpoints
6. Computing complexity + saving results

### Full Prefill Task Behaviour
- Processes PENDING sections sequentially
- Failure on one section does NOT abort the rest
- Failed sections get status="error"
- Returns: { total, completed, failed, failed_sections: [{id, heading, error}] }

---

## Git Integration

### Public URL Path (no OAuth)
- `POST /projects/{id}/git/connect-url` — accepts repo URL + branch
- Clones with `gitpython` using `depth=1` (shallow clone)
- Validates repo is public before cloning (httpx HEAD request)
- Returns 400 if private: "Repository is private. Use GitHub OAuth."

### OAuth Path (private repos)
- GitHub: `GET /auth/github/authorize` → callback → store encrypted token
- GitLab: `GET /auth/gitlab/authorize` → callback → store encrypted token
- `GET /projects/git/repos` — lists user's repos via provider API
- `GET /projects/git/repos/{owner}/{repo}/branches` — branch list
- `POST /projects/{id}/git/connect-oauth` — connect and trigger analysis
- `POST /projects/{id}/git/sync` — re-run analysis on same repo

### Token Security
- OAuth tokens encrypted with Fernet before storing in oauth_tokens table
- Encryption key in .env as ENCRYPTION_KEY
- Never log or return decrypted tokens

---

## Export Formats

| Format | Library | Content-Type | Filename |
|---|---|---|---|
| Markdown | string concatenation | text/markdown | {project}.md |
| HTML | markdown + html template | text/html | {project}.html |
| PDF | weasyprint | application/pdf | {project}.pdf |
| DOCX | python-docx | application/vnd.openxmlformats... | {project}.docx |

All exports are generated on demand — never stored permanently.
Return as FileResponse or StreamingResponse.

---

## Environment Variables

```
# Database
DATABASE_URL=postgresql+asyncpg://user:pass@localhost/pagemark

# Redis
REDIS_URL=redis://localhost:6379/0

# Auth
SECRET_KEY=                    # random 64 char string
ACCESS_TOKEN_EXPIRE_MINUTES=30
REFRESH_TOKEN_EXPIRE_DAYS=7
ENCRYPTION_KEY=                # Fernet key for OAuth token encryption

# AI
ANTHROPIC_API_KEY=

# Email
MAIL_USERNAME=
MAIL_PASSWORD=
MAIL_FROM=noreply@pagemark.io
MAIL_PORT=587
MAIL_SERVER=smtp.gmail.com

# OAuth
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
GITHUB_REDIRECT_URI=http://localhost:8000/auth/github/callback
GITLAB_CLIENT_ID=
GITLAB_CLIENT_SECRET=
GITLAB_REDIRECT_URI=http://localhost:8000/auth/gitlab/callback

# Frontend
FRONTEND_URL=http://localhost:5173
```

---

## What NOT to Do

- Never store JWT tokens in response body or localStorage
- Never store roles on the users table
- Never hard-delete projects — use deleted_at
- Never run analysis, quality scoring, or export inline — always Celery
- Never hardcode prompts in routers or services — use prompts/ files
- Never auto-save AI refinements — user must accept explicitly
- Never apply AI outlines automatically — user must click Apply
- Never delete sections when applying an outline — only add and reorder
- Never trust sequential integer IDs alone for authorization
- Never return 403 for ownership failures — return 404
- Never store OAuth tokens unencrypted
- Never commit .env to git
- Never put business logic in routers — use services/
- Never allow H3 structural sections — two levels maximum (H1 and H2)
- Never add a child section to an H2 — enforce in router validation