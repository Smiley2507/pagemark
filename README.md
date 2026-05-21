# Pagemark 📖

Pagemark is an AI-assisted software documentation generation system. Developers upload source code, an AI analyzes it to generate structured technical documentation, and developers can refine it section by section through an interactive, conversational AI interface.

## Tech Stack

### Backend
- **API Framework**: FastAPI (Python 3.11)
- **ORM & Database**: SQLAlchemy 2.0 (async) + PostgreSQL
- **Migrations**: Alembic
- **Background Jobs**: Celery + Redis
- **Code Analysis**: Tree-sitter
- **AI Integration**: Anthropic Claude API (claude-sonnet)

### Frontend
- **Framework**: React + TypeScript + Vite
- **Styling**: Tailwind CSS + shadcn UI
- **State Management**: Zustand
- **API Client**: Axios

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
├── docker-compose.yml  # PostgreSQL & Redis containers
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

The backend API will be available at **http://localhost:8000**.  
Health check: `curl http://localhost:8000/health`

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

Once everything is installed, starting the full stack only requires three commands in separate terminals:

```bash
# Terminal 1 — Database services
docker compose up -d

# Terminal 2 — Backend API
cd backend && source venv/bin/activate && PYTHONPATH=. uvicorn app.main:app --reload --port 8000

# Terminal 3 — Frontend
cd frontend && npm run dev
```

---

## Useful Commands

### Docker

```bash
docker compose up -d       # Start containers in background
docker compose down        # Stop and remove containers
docker compose ps          # Check container status
docker compose logs db     # View PostgreSQL logs
docker compose logs redis  # View Redis logs
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
| `ANTHROPIC_API_KEY`         | Claude API key for AI features         | *(required for AI features)*     |
| `MAIL_USERNAME`             | SMTP username                          | *(required for email features)*  |
| `MAIL_PASSWORD`             | SMTP password                          | *(required for email features)*  |
| `MAIL_FROM`                 | Sender email address                   | `noreply@pagemark.dev`           |
| `MAIL_PORT`                 | SMTP port                              | `587`                            |
| `MAIL_SERVER`               | SMTP server                            | `smtp.gmail.com`                 |

### Frontend (`frontend/.env`)

| Variable       | Description            | Default                  |
|----------------|------------------------|--------------------------|
| `VITE_API_URL` | Backend API base URL   | `http://localhost:8000`  |

---

## Key Features & Architecture Rules

- **Outline Creation**: Creating a project automatically initializes a structured document with 6 default sections.
- **Background Processes**: Code analysis and quality reporting run as asynchronous Celery tasks.
- **Autosave vs Snapshotting**: Autosave updates active drafts, but standard snapshots are only captured upon manual save, status transitions, or AI accepts.
- **Secure Authentication**: JWT-based session security using secure, `httpOnly` cookies.
