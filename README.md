# Pagemark

Pagemark is an AI-assisted collaborative workspace for turning source code into structured technical documentation. Developers connect or upload source code, create purpose-specific Documents inside Projects, generate and refine Sections with BYOK AI providers, and collaborate in real time on Section content.

## Tech Stack

### Backend
- **API Framework**: FastAPI (Python 3.12+)
- **ORM & Database**: SQLAlchemy 2.0 (async) + PostgreSQL
- **Migrations**: Alembic
- **Background Jobs**: Celery + Redis
- **Code Analysis**: Tree-sitter
- **AI Integration**: BYOK provider credentials through the active provider abstraction
- **Realtime Collaboration**: Liveblocks access-token auth issued by FastAPI

### Frontend
- **Framework**: React + TypeScript + Vite
- **Styling**: Tailwind CSS + shadcn UI
- **State Management**: Zustand
- **API Client**: Axios
- **Editor**: TipTap/ProseMirror with Markdown persistence
- **Realtime Collaboration**: Liveblocks + Yjs

---

## Directory Structure

```text
pagemark/
├── backend/            # FastAPI backend application
│   ├── app/            # Source code (models, routers, schemas, services, etc.)
│   ├── alembic/        # DB migration scripts
│   └── requirements.txt
├── frontend/           # React frontend application
│   ├── src/            # React components, stores, and hooks
│   └── package.json
├── docker-compose.yml  # PostgreSQL, Redis & Celery worker
└── README.md           # Root project overview & setup guide
```

---

## Getting Started

### Prerequisites

Make sure you have the following installed:

- **Python 3.11+**
- **Node.js v18+** & npm
- **Docker** & Docker Compose (for PostgreSQL and Redis)

### 1. Start the Database Services

From the project root, spin up PostgreSQL and Redis via Docker:

```bash
docker compose up -d
```

This starts:
| Service    | Container        | Host Port | Credentials                        |
|------------|------------------|-----------|------------------------------------|
| PostgreSQL | `pagemark_db`    | `5433`    | user: `pagemark` / pw: `pagemark_dev` / db: `pagemark` |
| Redis      | `pagemark_redis` | `6379`    | No auth                            |
| Celery     | `pagemark_worker`| —         | Runs codebase analysis tasks       |

Ensure `backend/.env` exists (copy from `.env.example`). The worker uses it for `ENCRYPTION_KEY`, database, and Redis. **AI features use BYOK**: each user adds their own provider key in **Settings → AI Providers**.

For real-time collaboration, set `LIVEBLOCKS_SECRET_KEY` in `backend/.env`. Without it, the app still builds, but collaboration auth returns `503 Liveblocks is not configured`.

Wait for the containers to be healthy:

```bash
docker compose ps
```

Both should show `healthy` status before proceeding.

### 2. Set Up the Backend

```bash
# Navigate to backend
cd backend

# Create and activate a virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Copy environment file (only needed once)
cp .env.example .env
# Edit .env if you need to change any values (defaults work with docker-compose)

# Run database migrations
PYTHONPATH=. alembic upgrade head

# Start the FastAPI dev server
PYTHONPATH=. uvicorn app.main:app --reload --port 8000
```

**Code analysis worker** (required for ZIP/Git project analysis):

Either use Docker (started with `docker compose up -d` above), or run locally:

```bash
cd backend && source venv/bin/activate
PYTHONPATH=. celery -A app.workers.celery_app worker --loglevel=info
```

The backend API will be available at **http://127.0.0.1:8000**.
Health check: `curl http://127.0.0.1:8000/health`

### 3. Set Up the Frontend

Open a **new terminal** and run:

```bash
# Navigate to frontend
cd frontend

# Install dependencies
npm install

# Start the Vite dev server
npm run dev
```

The frontend will be available at **http://localhost:5173**.

---

## Quick Start (after initial setup)

Once everything is installed, starting the full stack:

```bash
# Terminal 1 — Database, Redis, Celery worker
docker compose up -d

# Terminal 2 — Backend API
cd backend && source venv/bin/activate && PYTHONPATH=. uvicorn app.main:app --reload --port 8000

# Terminal 3 — Frontend
cd frontend && npm run dev
```

If not using the Docker worker, add a fourth terminal for local Celery (see above).

---

## Useful Commands

### Docker

```bash
docker compose up -d       # Start containers in background
docker compose down        # Stop and remove containers
docker compose ps          # Check container status
docker compose logs db     # View PostgreSQL logs
docker compose logs redis  # View Redis logs
docker compose logs worker  # View Celery worker logs
```

### Alembic (Database Migrations)

```bash
# Always run from the backend/ directory with PYTHONPATH=.

# Create a new migration after changing models
PYTHONPATH=. alembic revision --autogenerate -m "describe your changes"

# Apply all pending migrations
PYTHONPATH=. alembic upgrade head

# Rollback the last migration
PYTHONPATH=. alembic downgrade -1

# View migration history
PYTHONPATH=. alembic history
```

### Frontend

```bash
npm run dev      # Start dev server with hot reload
npm run build    # Production build
npm run preview  # Preview production build locally
```

---

## Environment Variables

### Backend (`backend/.env`)

| Variable                    | Description                            | Default                          |
|-----------------------------|----------------------------------------|----------------------------------|
| `DATABASE_URL`              | PostgreSQL async connection string     | `postgresql+asyncpg://pagemark:pagemark_dev@localhost:5433/pagemark` |
| `REDIS_URL`                 | Redis connection string                | `redis://localhost:6379/0`       |
| `SECRET_KEY`                | JWT signing key                        | *(must be changed)*              |
| `FRONTEND_URL`              | Frontend URL (used for CORS & emails)  | `http://localhost:5173`          |
| `ENCRYPTION_KEY`            | Fernet key for OAuth + AI API keys     | *(required for Git + BYOK)*      |
| `MAIL_USERNAME`             | SMTP username                          | *(required for email features)*  |
| `MAIL_PASSWORD`             | SMTP password                          | *(required for email features)*  |
| `MAIL_FROM`                 | Sender email address                   | `noreply@pagemark.dev`           |
| `MAIL_PORT`                 | SMTP port                              | `587`                            |
| `MAIL_SERVER`               | SMTP server                            | `smtp.gmail.com`                 |
| `LIVEBLOCKS_SECRET_KEY`     | Liveblocks secret key for room auth    | *(required for collaboration)*   |
| `LIVEBLOCKS_API_BASE_URL`   | Liveblocks API base URL                | `https://api.liveblocks.io`      |

### Frontend (`frontend/.env`)

| Variable                       | Description                         | Default                  |
|--------------------------------|-------------------------------------|--------------------------|
| `VITE_API_URL`                 | Backend API base URL                | `http://127.0.0.1:8000`  |
| `VITE_COLLABORATION_ENABLED`   | Set to `true` to enable Liveblocks editor rooms | disabled |

---

## Key Features & Architecture Rules

- **Project/Document Model**: A Project is the source-connected workspace. It contains one or more purpose-specific Documents.
- **Section Lifecycle**: Sections are the durable unit for content lifecycle, review, freshness, generation, evidence, and collaboration snapshots.
- **Editor**: The canonical editor route is `/projects/{projectId}/documents/{documentId}`. It renders all active Sections in one continuous writing surface.
- **Realtime Collaboration**: Liveblocks rooms are Section-scoped. Room ids follow `project:{project_id}:document:{document_id}:section:{section_id}`.
- **Collaboration Persistence**: Liveblocks/Yjs is live editing state; PostgreSQL `Section.content_md` is the Markdown snapshot used by AI, export, review, freshness, and search.
- **Document Sharing**: Organization members can receive Document-scoped `view`, `comment`, or `edit` access. Sharing one Document must not expose sibling Documents.
- **Background Processes**: Code analysis, quality reporting, notifications, and generation work run asynchronously through Celery where appropriate.
- **Secure Authentication**: JWT-based session security using secure, `httpOnly` cookies.

## Developer Docs

- `CONTEXT.md` — domain language and relationships.
- `docs/CURRENT_SYSTEM_STATE.md` — current implementation snapshot for future work.
- `frontend/VISUAL_SPEC.md` — design system and interaction direction.
- `docs/adr/` — architectural decisions, including multi-Document Projects and section-scoped Liveblocks collaboration.
