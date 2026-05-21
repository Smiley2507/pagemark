# PAGEMARK — Backend Context File for AI Agents

## What This Project Is
Pagemark is an AI-assisted software documentation generation system.
Developers upload source code, an AI analyses it and generates structured
technical documentation, and the developer refines it section by section
through a conversational AI interface.

## Tech Stack
- API: FastAPI (Python 3.11)
- ORM: SQLAlchemy 2.0 (async)
- Migrations: Alembic
- Database: PostgreSQL
- Auth: JWT stored in httpOnly cookies
- AI: Anthropic Claude API (claude-sonnet-4-5)
- Background jobs: Celery + Redis
- Code analysis: Tree-sitter

## Project Conventions
- One router file per domain in app/routers/
- Business logic lives in app/services/, never in routers
- All DB models in app/models/, one file per table
- All Pydantic schemas in app/schemas/, one file per domain
- Roles stored in user_roles table, NEVER on the users table
- Soft delete using deleted_at field (never hard delete projects)
- All AI prompts in app/prompts/, never hardcoded in routers
- Background jobs (analysis, quality, export) always async via Celery
- JWT in httpOnly cookies, never in response body or localStorage

## Database Tables (summary)
users, user_roles, user_settings,
projects, templates,
documents, sections, section_versions,
analyses, quality_reports, quality_issues,
chat_threads, chat_messages,
shares, comments,
kb_articles, audit_logs

## API Base URL
http://localhost:8000

## Frontend URL (for CORS)
http://localhost:5173

## Key Business Rules
- Creating a project auto-creates a document and 6 default sections
- Section statuses: pending → draft → finalized
- Completion % = finalized sections / total sections * 100
- Autosave does NOT create a version snapshot
- Version snapshot created on: AI accept, manual save, status change
- AI refine returns diff but does NOT auto-save (user must accept)
- Code analysis runs as background Celery job, never inline
- Quality scoring runs as background Celery job, never inline

## Folder Structure
pagemark/
├── backend/
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py
│   │   ├── config.py
│   │   ├── database.py
│   │   ├── dependencies.py
│   │   ├── models/
│   │   │   ├── __init__.py
│   │   │   ├── user.py
│   │   │   ├── project.py
│   │   │   ├── template.py
│   │   │   ├── document.py
│   │   │   ├── section.py
│   │   │   ├── version.py
│   │   │   ├── analysis.py
│   │   │   ├── quality.py
│   │   │   ├── chat.py
│   │   │   ├── share.py
│   │   │   └── audit.py
│   │   ├── schemas/
│   │   │   ├── __init__.py
│   │   │   ├── auth.py
│   │   │   ├── user.py
│   │   │   ├── project.py
│   │   │   ├── template.py
│   │   │   ├── document.py
│   │   │   ├── section.py
│   │   │   ├── version.py
│   │   │   ├── analysis.py
│   │   │   ├── quality.py
│   │   │   ├── chat.py
│   │   │   └── share.py
│   │   ├── routers/
│   │   │   ├── __init__.py
│   │   │   ├── auth.py
│   │   │   ├── users.py
│   │   │   ├── projects.py
│   │   │   ├── templates.py
│   │   │   ├── documents.py
│   │   │   ├── sections.py
│   │   │   ├── versions.py
│   │   │   ├── analysis.py
│   │   │   ├── ai.py
│   │   │   ├── quality.py
│   │   │   ├── export.py
│   │   │   ├── sharing.py
│   │   │   └── knowledge.py
│   │   ├── services/
│   │   │   ├── __init__.py
│   │   │   ├── auth_service.py
│   │   │   ├── ai_service.py
│   │   │   ├── analysis_service.py
│   │   │   ├── quality_service.py
│   │   │   └── export_service.py
│   │   ├── workers/
│   │   │   ├── __init__.py
│   │   │   ├── celery_app.py
│   │   │   ├── analysis_worker.py
│   │   │   ├── quality_worker.py
│   │   │   └── export_worker.py
│   │   └── prompts/
│   │       ├── __init__.py
│   │       ├── outline.py
│   │       ├── section.py
│   │       ├── refine.py
│   │       └── chat.py
│   ├── alembic/
│   │   ├── versions/
│   │   └── env.py
│   ├── tests/
│   │   ├── test_auth.py
│   │   ├── test_projects.py
│   │   └── test_ai.py
│   ├── .env
│   ├── .env.example
│   ├── alembic.ini
│   ├── requirements.txt
│   └── PAGEMARK.md          ← context file for Claude Code
│
├── frontend/
│   ├── src/
│   │   ├── api/
│   │   │   ├── client.ts        ← axios instance
│   │   │   ├── auth.ts
│   │   │   ├── projects.ts
│   │   │   ├── templates.ts
│   │   │   ├── sections.ts
│   │   │   ├── versions.ts
│   │   │   ├── analysis.ts
│   │   │   ├── ai.ts
│   │   │   ├── quality.ts
│   │   │   ├── export.ts
│   │   │   └── sharing.ts
│   │   ├── components/
│   │   │   ├── ui/              ← shadcn generated, never hand-edit
│   │   │   ├── layout/
│   │   │   │   ├── AppLayout.tsx
│   │   │   │   ├── AuthLayout.tsx
│   │   │   │   └── Header.tsx
│   │   │   ├── editor/
│   │   │   │   ├── LeftPanel.tsx
│   │   │   │   ├── MiddlePanel.tsx
│   │   │   │   ├── RightPanel.tsx
│   │   │   │   ├── SectionEditor.tsx
│   │   │   │   ├── DiffViewer.tsx
│   │   │   │   └── ExportModal.tsx
│   │   │   ├── dashboard/
│   │   │   │   ├── ProjectCard.tsx
│   │   │   │   ├── TemplateCard.tsx
│   │   │   │   └── SearchBar.tsx
│   │   │   └── shared/
│   │   │       ├── LoadingSpinner.tsx
│   │   │       ├── ErrorBoundary.tsx
│   │   │       └── ProtectedRoute.tsx
│   │   ├── hooks/
│   │   │   ├── useAuth.ts
│   │   │   ├── useProjects.ts
│   │   │   ├── useSections.ts
│   │   │   ├── useVersions.ts
│   │   │   ├── useAI.ts
│   │   │   ├── useAutosave.ts
│   │   │   └── useQuality.ts
│   │   ├── pages/
│   │   │   ├── auth/
│   │   │   │   ├── LoginPage.tsx
│   │   │   │   ├── RegisterPage.tsx
│   │   │   │   ├── ForgotPasswordPage.tsx
│   │   │   │   └── ResetPasswordPage.tsx
│   │   │   ├── DashboardPage.tsx
│   │   │   ├── NewProjectPage.tsx
│   │   │   ├── EditorPage.tsx
│   │   │   ├── AnalysisPage.tsx
│   │   │   ├── QualityPage.tsx
│   │   │   └── KnowledgePage.tsx
│   │   ├── store/
│   │   │   ├── authStore.ts
│   │   │   ├── editorStore.ts
│   │   │   └── themeStore.ts
│   │   ├── types/
│   │   │   └── index.ts         ← all TypeScript interfaces
│   │   ├── lib/
│   │   │   └── utils.ts         ← cn() and helpers
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── public/
│   ├── index.html
│   ├── package.json
│   ├── tsconfig.json
│   ├── vite.config.ts
│   └── tailwind.config.ts
│
├── .gitignore
└── README.md
