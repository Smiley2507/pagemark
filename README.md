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
└── README.md           # Root project overview & setup guide
```

---

## Getting Started

### Prerequisites
Make sure you have the following installed:
- Python 3.11+
- Node.js (v18+) & npm
- PostgreSQL
- Redis (for Celery background workers)

### 1. Setting Up the Backend

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```
2. Create and activate a virtual environment:
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```
3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
4. Set up your environment variables by copying `.env.example` to `.env` and updating the values:
   ```bash
   cp .env.example .env
   ```
5. Run migrations:
   ```bash
   alembic upgrade head
   ```
6. Start the FastAPI development server:
   ```bash
   uvicorn app.main:app --reload
   ```

### 2. Setting Up the Frontend

1. Navigate to the frontend directory:
   ```bash
   cd ../frontend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Set up environment variables in a `.env` file (if needed).
4. Start the frontend development server:
   ```bash
   npm run dev
   ```

---

## Key Features & Architecture Rules

- **Outline Creation**: Creating a project automatically initializes a structured document with 6 default sections.
- **Background Processes**: Code analysis and quality reporting run as asynchronous Celery tasks.
- **Autosave vs Snapshotting**: Autosave updates active drafts, but standard snapshots are only captured upon manual save, status transitions, or AI accepts.
- **Secure Authentication**: JWT-based session security using secure, `httpOnly` cookies.
