# Pagemark Architecture Review

This document summarizes the final architectural decisions for Pagemark, established during the Architecture Workshop.

## 1. System Architecture
Pagemark remains a hybrid monolith built for high-throughput AI document generation.
- **Frontend:** React 19, Vite, Zustand, Tailwind CSS, CodeMirror 6.
- **Backend:** FastAPI (Python 3.12), async SQLAlchemy, PostgreSQL 16.
- **Workers:** Celery + Redis for asynchronous repository parsing and AI generation.
- **Deployment:** Docker-compose (Local only for V1), with future-proofing for cloud deployments.

## 2. Database & Tenancy Architecture (What Changes)
- **Organization-First Multi-Tenancy:** We are moving away from `User -> Project` to `User -> Organization -> Project`.
- **Dynamic Sections:** Sections will no longer be strictly bound to templates. We are adding `sort_order`, `title`, `is_custom`, and soft-delete states to `sections` to support a Notion-like fluid editing experience.
- **Data Integrity:** Strict Row-Level-Security (RLS) or application-level ownership checks will be enforced via FastAPI dependencies to prevent IDOR vulnerabilities.

## 3. Authentication & Authorization Strategy
- **Authentication Flow:** Email Link Verification on signup -> JWT-based Session cookies -> Optional OTP for secondary verification in user settings.
- **Authorization:** `user_roles` will be strictly enforced at the Organization level (Admin, Member, Viewer).

## 4. AI Architecture & The Agentic Loop
- **Simplified BYOK:** The backend will support a 1:1 API key mapping. Users provide either an Anthropic or Google key via a premium settings UI. Complex fallback logic is removed to reduce technical debt.
- **Human-in-the-Loop (HITL):** Instead of a static pre-generation Q&A wizard, we are implementing an Agentic Clarification Loop. If the Celery worker lacks business context, it sets the Section status to `NEEDS_INPUT`, creating a `ClarificationRequest`. The user provides context via the Editor Chat Panel, and the worker resumes.

## 5. Export Pipeline
- **Sync Export:** WeasyPrint handles PDF generation. We are adding a customization layer (Logo, Colors, Fonts) injected via CSS variables to give outputs a premium, branded feel.

## 6. What Stays, Changes, and Removes

### What Stays
- FastAPI router structures and prompt organization.
- Tree-sitter AST parsing logic (focused strictly on Python, JS/TS, and Java).
- Core CodeMirror editor infrastructure (but heavily restyled).

### What Changes
- Complete replacement of `owner_id` logic with `org_id`.
- The Editor UI layout: moving from boxed sections to a continuous, fluid scroll container.
- AI Generation Pipeline: Halting for user input (HITL) instead of hallucinating.

### What Gets Removed
- GitLab OAuth integration (focusing exclusively on GitHub for Phase 1).
- Over-engineered BYOK multi-key rotation logic.
- Complex real-time collaboration requirements (deferred to post-V1 via Liveblocks).
