# Pagemark Current System State

This document is a developer-facing snapshot of the current implementation. Use it to orient later work before reading older phase plans, which may describe superseded intent.

## Core Architecture

- Pagemark is a FastAPI + React workspace for creating and maintaining source-grounded technical documentation.
- A **Project** is the source-connected workspace. A Project contains multiple **Documents**.
- A **Document** owns its setup stage, Template or Custom Outline, Sections, generation/review state, export settings, quality reports, sharing, and collaboration surface.
- A **Section** remains the durable unit for content lifecycle, review state, freshness, evidence, generation tasks, and real-time collaboration.
- PostgreSQL is the durable application store. Redis/Celery handle asynchronous analysis, notifications, quality, and generation work.

## Editor And Collaboration

- The canonical editor route is `/projects/{projectId}/documents/{documentId}`.
- The editor is a full-screen document workspace with:
  - editable Document title,
  - compact save state,
  - Quality, Share, and Export actions,
  - user avatar menu with Light/Dark/System theme switching,
  - left Outline/TOC,
  - continuous Section-backed writing surface,
  - right panel for AI and Notes.
- The writing surface uses TipTap/ProseMirror with Markdown persistence.
- Liveblocks powers section-scoped collaboration:
  - room id format: `project:{project_id}:document:{document_id}:section:{section_id}`,
  - FastAPI issues Liveblocks access tokens after checking Pagemark document permissions,
  - Liveblocks/Yjs is the live collaboration state,
  - `Section.content_md` is the persisted Markdown snapshot for AI, export, review, search, and freshness workflows.
- Section-level inline discussions are Liveblocks comment threads. Existing document/section notes remain a separate notes surface unless deliberately migrated.

## Authorization And Sharing

- Authentication uses JWT session cookies.
- Organization membership gates Project access.
- Document sharing is organization-member scoped with `view`, `comment`, and `edit` permissions.
- Sharing one Document must not expose sibling Documents in the same Project.
- Collaboration auth must use the nested Project/Document/Section permission path, not broad legacy Section access helpers.

## Configuration

Backend:

- `DATABASE_URL`
- `REDIS_URL`
- `SECRET_KEY`
- `FRONTEND_URL`
- `BACKEND_URL`
- `ENCRYPTION_KEY`
- `LIVEBLOCKS_SECRET_KEY`
- `LIVEBLOCKS_API_BASE_URL` defaults to `https://api.liveblocks.io`

Frontend:

- `VITE_API_URL`
- `VITE_COLLABORATION_ENABLED=false` disables the Liveblocks editor path.

## Checks For Later Work

- Frontend build: `cd frontend && npm run build`
- Backend collaboration tests: `cd backend && venv/bin/python -m pytest tests/test_collaboration_api.py`
- Sharing/nested route tests: `cd backend && venv/bin/python -m pytest tests/test_phase7_document_sharing.py tests/test_nested_document_api.py`

## Do Not Reintroduce

- Single-Document Project assumptions.
- Whole-Document collaboration rooms unless a future ADR replaces ADR 0002.
- Last-write-wins autosave as the collaborative editing source of truth.
- Dead topbar menu actions; implement, remove, or clearly disable unavailable controls.
