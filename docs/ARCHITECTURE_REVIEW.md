# Pagemark Architecture Review

This document summarizes the current architectural decisions for Pagemark. Older workshop notes that conflict with `CONTEXT.md`, `docs/CURRENT_SYSTEM_STATE.md`, or ADRs should be treated as superseded.

## 1. System Architecture
Pagemark remains a hybrid monolith built for source-grounded AI documentation workflows.
- **Frontend:** React 19, Vite, Zustand, Tailwind CSS, TipTap/ProseMirror, Liveblocks.
- **Backend:** FastAPI (Python 3.12), async SQLAlchemy, PostgreSQL 16.
- **Workers:** Celery + Redis for asynchronous repository parsing and AI generation.
- **Deployment:** Docker Compose for local development, with future-proofing for cloud deployments.

## 2. Database & Tenancy Architecture (What Changes)
- **Organization-First Multi-Tenancy:** The active model is `User -> Organization -> Project -> Document`.
- **Multi-Document Projects:** Projects are source-connected containers. Documents are purpose-specific documentation artifacts inside Projects.
- **Dynamic Sections:** Sections support editable titles, ordering, custom sections, soft-delete lifecycle, review lifecycle, freshness flags, evidence references, and collaborative snapshots.
- **Data Integrity:** Strict Row-Level-Security (RLS) or application-level ownership checks will be enforced via FastAPI dependencies to prevent IDOR vulnerabilities.

## 3. Authentication & Authorization Strategy
- **Authentication Flow:** Email Link Verification on signup -> JWT-based Session cookies -> Optional OTP for secondary verification in user settings.
- **Authorization:** Organization membership gates Projects. Document-level sharing grants organization members `view`, `comment`, or `edit` access to individual Documents without exposing sibling Documents.

## 4. AI Architecture & The Agentic Loop
- **Strict BYOK:** Users configure provider credentials in Settings. AI-consuming paths should use the active provider abstraction rather than platform-owned inference capacity.
- **Human-in-the-Loop (HITL):** Low-confidence or missing business context is represented through Clarification Requests tied to affected Sections.

## 5. Export Pipeline
- **Sync Export:** WeasyPrint handles PDF generation. We are adding a customization layer (Logo, Colors, Fonts) injected via CSS variables to give outputs a premium, branded feel.

## 6. Editor And Collaboration

- **Canonical Editor:** `/projects/{project_id}/documents/{document_id}` renders the full-screen Document editor.
- **Editor Engine:** TipTap/ProseMirror is the current editor engine, with Markdown snapshots persisted to `Section.content_md`.
- **Collaboration:** Liveblocks provides section-scoped collaborative sessions, presence/cursors, Yjs state, and anchored Section comment threads.
- **Persistence Boundary:** Liveblocks/Yjs is the live editing state. PostgreSQL remains the durable source for AI, export, review, search, and freshness through Collaboration Snapshots.
- **Header UX:** The editor header exposes Quality, Share, Export, save state, and a user avatar menu for theme switching. Dead/stub header actions should be removed rather than left inert.

## 7. What Stays, Changes, and Removes

### What Stays
- FastAPI router structures and prompt organization.
- Tree-sitter AST parsing logic (focused strictly on Python, JS/TS, and Java).
- Section lifecycle as the durable backend workflow boundary.

### What Changes
- Legacy one-Document Project assumptions must stay retired.
- Collaboration work must respect DocumentShare permissions and section-scoped rooms.
- AI apply/replace actions should flow through the active editor when possible so collaborative operations remain coherent.

### What Gets Removed
- Dead/stub UI actions, especially topbar menus without behavior.
- Whole-Document collaboration assumptions unless a future ADR supersedes ADR 0002.
