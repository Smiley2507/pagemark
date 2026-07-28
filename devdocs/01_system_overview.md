# System Overview

## What Is Pagemark

Pagemark is an AI-assisted documentation platform that turns source code into structured, maintainable technical documentation. It is designed for **software developers** (called "Project maintainers") who need to create and keep documentation in sync with a changing codebase. The system ingests source code, analyzes it to extract structural facts (file trees, languages, endpoints, complexity, dependencies), then uses a BYOK (Bring Your Own Key) AI provider to generate documentation outlines and prose. A human-in-the-loop review workflow ensures generated content is accurate before it is marked as reviewed. When source code changes, Pagemark flags potentially stale sections and proposes updates.

## Who It Is For

- **Software engineers** maintaining documentation for their own projects
- **Documentation teams** collaborating on large documentation sets
- **Engineering managers** who want automated documentation pipelines
- **Open-source maintainers** needing to generate API references, architecture docs, contribution guides, etc.

## Architecture Overview

The system is split into three main tiers:

```
┌─────────────────────────────────────────────┐
│              Frontend (React SPA)            │
│  Vite + TypeScript + Tiptap + TanStack Query │
│           Port 5173 (dev) / 80 (prod)        │
└──────────────┬──────────────────────────────┘
               │ HTTP/HTTPS (JSON + SSE)
               │
┌──────────────▼──────────────────────────────┐
│           Backend (FastAPI Python)           │
│  SQLAlchemy Async + Pydantic + Celery Workers│
│               Port 8000                     │
└──────┬──────────────────┬───────────────────┘
       │                  │
       ▼                  ▼
┌──────────────┐  ┌──────────────┐
│  PostgreSQL   │  │    Redis     │
│  (Primary DB) │  │ (Celery      │
│               │  │  Broker +    │
│               │  │  Result)     │
└──────────────┘  └──────────────┘
       │
       ▼
┌─────────────────────────────────────────────┐
│         External Services                   │
│  Anthropic Claude + Google Gemini           │
│  + OpenCode Go (BYOK AI Providers)          │
│  GitHub OAuth + GitLab OAuth                │
│  Liveblocks (real-time collaboration)       │
│  LanguageTool (grammar)                     │
│  SMTP (email)                               │
└─────────────────────────────────────────────┘
```

### Frontend (React 19 + TypeScript + Vite 8)

The frontend is a single-page application built with React 19, TypeScript 6, and Vite 8 as the bundler. Key libraries:

- **React Router v7** — Client-side routing with nested route layouts
- **TanStack React Query v5** — Server state management, caching, and background refetching
- **Zustand v5** — Client-side state (auth, editor UI, AI chat, organization, theme, view preferences)
- **Axios** — HTTP client with 401 interceptor and token refresh queue
- **TailwindCSS v3 + class-variance-authority** — Styling
- **Tiptap v3** — Rich text / Markdown editor with extensions (tables, images, code blocks, link, color)
- **Liveblocks + Yjs** — Section-scoped real-time collaborative editing, presence, and comment threads
- **@xyflow/react** — React Flow for diagram rendering
- **Recharts** — Charting (quality scores, activity heatmap)
- **react-diff-viewer-continued** — Visual diff rendering
- **mermaid** — Diagram rendering in Markdown
- **Motiion** (Framer Motion) — Animations
- **Radix UI** — Accessible primitives (Dialog, DropdownMenu, Tabs, Toast, Tooltip)
- **Remixicon + Lucide React** — Icons
- **sonner** — Toast notifications
- **date-fns** — Date formatting and manipulation
- **@dnd-kit** — Drag-and-drop section reordering
- **react-resizable-panels** — Resizable three-panel editor layout
- **Vitest** — Unit testing

Pages are organized into: auth, dashboard/home, project workspace, document editor, document setup wizard, settings, templates, export, organization management, NLP dashboard, analysis results, git connection.

### Backend (Python FastAPI)

The backend is an async Python application using FastAPI. Key components:

- **FastAPI** — Async web framework with automatic OpenAPI docs at `/docs`
- **SQLAlchemy 2.x (async)** — ORM with asyncpg PostgreSQL driver
- **Alembic** — Database schema migrations (26 migration files)
- **Pydantic v2** — Settings validation (via pydantic-settings) and request/response schema validation
- **Celery** — Distributed task queue for analysis and generation workloads
- **Redis** — Celery message broker and result backend
- **python-jose** — JWT token creation and verification
- **passlib + bcrypt** — Password hashing
- **tree-sitter** — Code parsing (Python, JavaScript/TypeScript, Java)
- **Anthropic SDK** — Claude API integration
- **Google Generative AI SDK** — Gemini API integration
- **WeasyPrint** — PDF generation from HTML/CSS
- **GitPython** — Git repository cloning and inspection
- **httpx** — Async HTTP client for external API calls
- **cryptography (Fernet)** — Symmetric encryption for stored OAuth and AI API tokens
- **PyMuPDF** — PDF text extraction for resources
- **python-docx** — DOCX text extraction for resources
- **LanguageTool** — Grammar checking

#### Backend Module Layout

```
backend/
├── app/
│   ├── main.py                    # FastAPI app, CORS, lifespan, router includes
│   ├── config.py                  # Pydantic settings (env vars)
│   ├── database.py                # Async + sync SQLAlchemy engines
│   ├── dependencies.py            # Dependency injection (auth, ownership, permissions)
│   ├── ai_providers.py            # BYOK provider catalog
│   ├── models/                    # SQLAlchemy ORM models (35 tables)
│   ├── schemas/                   # Pydantic request/response schemas
│   ├── routers/                   # API route handlers (22 router files)
│   ├── services/                  # Business logic services (18 service files)
│   ├── prompts/                   # AI prompt templates (4 files)
│   ├── workers/                   # Celery task workers (4 files)
│   └── exceptions.py              # Custom exceptions (NeedsClarificationException)
├── alembic/                       # Migration configuration + 26 migration files
├── alembic.ini
├── requirements.txt
└── Dockerfile
```

### Database (PostgreSQL 16)

PostgreSQL is the primary data store, accessed via async SQLAlchemy. The schema consists of 35 tables covering: users and authentication, organizations and membership, projects, documents and sections, templates, analysis snapshots, outline proposals, template recommendations, generation runs and tasks, AI credentials, OAuth tokens, chat threads and messages, resources, quality reports, evidence references, section versions, activity events, audit logs, collaboration notes, document sharing, NLP reports, clarification requests, and workspace preferences.

### External API Integrations

1. **AI Providers (BYOK)** — Users configure their own API keys for Anthropic (Claude), Google (Gemini), or OpenCode Go (which supports DeepSeek, Kimi, GLM, MiMo). The system never provides its own AI capacity. All AI operations (section generation, refinement, chat, outline generation, phrasing suggestions, structure suggestions) go through the user's configured provider.

2. **GitHub / GitLab OAuth** — Users connect repositories via OAuth 2.0. Tokens are encrypted with Fernet and stored in the database. The GitHub API is used for repo/branch listing and authenticated clone URLs.

3. **LanguageTool** — Grammar checking via LanguageTool API (self-hosted or public).

4. **Liveblocks** — Real-time section editing and collaborative thread UI. The backend authorizes Liveblocks rooms using the current Pagemark session and document permissions.

5. **SMTP Email** — Transactional emails (verification, password reset, notifications) via fastapi-mail.

### Communication Between Layers

1. **Frontend ↔ Backend**: HTTP REST over JSON. The Axios client sends requests with cookies containing JWT access/refresh tokens. The `X-Organization-ID` header scopes requests to the active organization. SSE (Server-Sent Events) is used for streaming AI chat responses.

2. **Backend ↔ Database**: Async SQLAlchemy sessions via asyncpg. Celery workers use synchronous psycopg2 connections.

3. **Backend ↔ Redis**: Celery uses Redis as both broker and result backend.

4. **Backend ↔ AI Providers**: Direct HTTPS calls using provider-specific SDKs (Anthropic SDK, Google Generative AI SDK) or raw HTTP for OpenCode Go.

5. **Backend ↔ GitHub/GitLab**: OAuth 2.0 for authorization, REST API for data fetching, GitPython for repository cloning.

6. **Backend ↔ Liveblocks**: The backend calls Liveblocks authorization APIs with `LIVEBLOCKS_SECRET_KEY` after resolving Pagemark document permissions.

7. **Backend ↔ Email**: SMTP via fastapi-mail library.

### Key Workflows

#### Document Creation Flow
1. User creates a Project with source code (ZIP upload, Git URL, GitHub OAuth, or scratch)
2. Backend triggers async Celery analysis (9 steps): connect → extract → detect languages → parse files → detect endpoints → compute complexity → save results → generate outline (AI) → NLP analysis
3. User reviews analysis results in the guided setup wizard
4. User picks a Template (built-in or custom) or creates a Custom Outline
5. System proposes an Outline (optionally AI-adapted via AdaptTemplate)
6. User approves the Outline, which materializes it into editable Sections
7. User chooses a Generation mode (complete document or section-on-demand)
8. AI generates section prose; user reviews and accepts each section
9. User exports the document (Markdown, HTML, or PDF)

#### Real-Time Collaboration Flow
1. User opens a document section in the editor
2. Frontend derives a Liveblocks room id from project, document, and section ids
3. LiveblocksProvider calls the backend collaboration auth endpoint
4. Backend validates the JWT session, project membership, document/share permission, and section ownership
5. Backend maps the effective permission to Liveblocks room capabilities
6. Users edit together through Liveblocks/Tiptap/Yjs
7. The frontend persists durable Markdown snapshots to `sections.content_md` through the collaboration snapshot endpoint
8. Snapshot writes clear reviewed state when content changes, matching normal edit behavior

#### Source Change Detection
1. User re-syncs the project source (Git sync or ZIP re-upload)
2. New Analysis snapshot is created
3. Freshness service compares old vs. new analysis to detect changes
4. Reviewed sections with relevant changes become "potentially stale"
5. User can view proposed updates as diffs and accept/reject them

### Deployment

The system is containerized with Docker Compose:
- `docker-compose.yml` defines PostgreSQL 16, Redis, and a Celery worker service
- The FastAPI backend and the Vite frontend are served separately
- The backend serves the frontend's built static files in production or proxies to the Vite dev server in development
