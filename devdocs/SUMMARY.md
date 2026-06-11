# Pagemark — Technical Documentation Summary

## System Overview

Pagemark converts source code into structured technical documentation. Developers connect a repo (ZIP, Git URL, or GitHub OAuth), Pagemark analyzes it, then AI generates documentation prose that the developer reviews and approves section by section.

**Stack**: Python FastAPI backend + React 19 / TypeScript / Vite 8 frontend + PostgreSQL 16 + Redis (Celery broker). AI providers are BYOK (Anthropic Claude, Google Gemini, OpenCode Go). Integrates with GitHub OAuth, LanguageTool, SMTP email.

**Layers**: Frontend ↔ REST/SSE ↔ Backend ↔ PostgreSQL + Celery workers ↔ AI providers. JWT cookies for auth, `X-Organization-ID` header for multi-tenant org scoping.

---

## Database (35 tables)

**Users & Auth**: `users`, `user_roles`, `user_settings`, `user_api_keys`, `oauth_tokens`, `user_ai_credentials`

**Organizations**: `organizations`, `organization_members`, `organization_join_links`

**Projects**: `projects`, `project_source_exclusions`

**Documents & Content**: `documents`, `sections`, `section_versions`, `evidence_references`

**Templates**: `templates` (8 built-in seeded at startup)

**Analysis**: `analyses` (immutable snapshots with file_tree, languages, endpoints, complexity, file_contents as JSON blobs)

**Outlines**: `outline_proposals` (immutable after approval), `template_recommendations`

**Generation**: `generation_runs`, `generation_section_tasks` (token/cost tracking, failover state)

**Collaboration**: `collaboration_notes`, `document_shares` (VIEW/COMMENT/EDIT)

**Quality**: `quality_reports`, `quality_issues`, `broken_links`

**Other**: `chat_threads`, `chat_messages`, `chat_message_resources`, `resources`, `activity_events`, `audit_logs`, `clarification_requests`, `nlp_reports`, `workspace_preferences`

**Key design decisions**: Immutable analysis snapshots, content_lifecycle separated from workflow flags, Fernet-encrypted API keys and OAuth tokens, full-content version snapshots (not diffs).

---

## Backend (FastAPI)

**22 routers** at `backend/app/routers/`: auth (login/register/OAuth/password/credentials), projects (CRUD/analysis/source/exclusions/activity), documents (CRUD/setup/recommendations/outlines/generation/freshness), sections (CRUD/autosave/review/reorder), AI (generate/refine/suggest-structure/chat-streaming), export (markdown/html/pdf/preview/batch), templates, organizations, search, git, shares, versions, quality, notes, grammar, terminology, keys, uploads, resources, clarification, NLP, context-search.

**~100 endpoints total**, most guarded by `get_current_user` JWT dependency. Project/document access uses a chain of `verify_project_ownership` → `verify_document_access` → `require_document_permission`. Org roles (ADMIN/PM/DEVELOPER/TECHNICAL_WRITER/VIEWER) enforced by `require_org_role()`.

**18 service files** at `backend/app/services/`: auth (bcrypt + JWT), crypto (Fernet), AI provider adapters, AI document service (generate/refine/chat/structure), context assembly (token-budgeted), code analysis (9-step pipeline), generation orchestration, template recommendation, export (markdown/html/pdf with 40+ CSS settings), git, GitHub OAuth, freshness/staleness, version diff/restore, activity events, NLP, grammar, terminology, notifications.

**4 Celery workers**: analysis (ZIP extract + static analysis), clone-and-analyze (git clone + analysis), quality report generation, notification sending.

---

## AI Pipeline

**BYOK model**: Users add their own API keys for Anthropic, Google, or OpenCode Go. Keys are Fernet-encrypted in `user_ai_credentials`. Active credential per provider.

**3 provider adapters** in `ai_service.py`: Anthropic SDK (`messages.create`), Google SDK (`generate_content`), OpenCode Go (HTTP POST). All return text, all configurable by model.

**High-level service** (`ai_doc_service.py` singleton):
- `generate_section()`: Builds prompt with project context + analysis facts + template instructions → calls AI → parses JSON response (content + evidence + confidence) → creates `EvidenceReference` records → sets section to `GENERATED_DRAFT`. If AI requests clarification, raises `NeedsClarificationException`.
- `refine_section()`: Current content + user instruction → AI → diff via `difflib.SequenceMatcher`.
- `stream_chat()`: Anthropic uses native SDK streaming (SSE `data: ` events); other providers fall back to complete_text then yield once.
- `phrasing_suggestions()`: 3 alternatives for selected text.
- `suggest_structure()`: AI proposes outline changes (reorder/rename/add/remove/merge).

**Prompt templates** at `backend/app/prompts/`: outline.py (system + user message for AdaptTemplate), section.py (code context + template instructions + section details → JSON output), chat.py (project context + message history), refine.py (current content + instruction → refined markdown).

**Generation orchestration** (`generation_service.py`): `COMPLETE_DOCUMENT` mode creates per-section tasks with dependency ordering, uses `asyncio.Semaphore` for provider-aware parallelism (Claude=2, Gemini=5, default=3). Tasks pause on clarification requests, pause entire run on provider failure (requires user confirmation to failover). Token/cost estimated before run, actual recorded after each task.

**No caching, no retry** on AI calls. Chat uses SSE streaming; section generation does not.

---

## Code Analysis (9-step pipeline)

Located in `analysis_service.py` (1285 lines), executed by Celery workers.

**Steps**: 1-Connect source → 2-Extract/clone → 3-Detect languages → 4-Parse with tree-sitter → 5-Detect endpoints (regex) → 6-Compute complexity → 7-Save artifacts → 8-Generate outline (AI, optional) → 9-NLP analysis

**File collection**: Walks dir tree, respects `.gitignore`-style exclusions, skips files >2MB, caps at 8000 files. Extension-to-language map covers 30+ extensions.

**Tree-sitter**: Parsers for Python, JavaScript/TypeScript, Java. **However** — AST is parsed for statistics only; no structural querying (classes, methods, types). Endpoints and dependencies are regex-based.

**Endpoint detection**: Regex patterns for FastAPI, Flask, Express, Spring. Deduplicated by (method, path), capped at 200.

**Complexity**: Keyword-count heuristic (if/for/while/case/catch = +1). Not true cyclomatic complexity.

**Dependencies**: Regex import extraction for Python/JS/Java. Simple source→target edges.

**Output stored** in `analyses` table as JSON blobs: `file_tree_json`, `languages_json`, `endpoints_json`, `complexity_json`, `file_contents_json` (50 files × 100KB max), `analysis_data` (dependencies, fact availability).

**Outline step**: If user has active AI credential, calls `generate_outline_with_ai()` — builds analysis summary → calls AI with outline prompt → parses JSON → auto-applies if sections are untouched.

**12 documented limitations** including: no class/method extraction, fragile regex endpoints, no build system analysis, no test detection, no incremental analysis.

---

## Frontend (React SPA)

**Pages**: Home (dashboard with project library), Project workspace (tabs: Documents/Source/Activity/Settings), Document editor (three-panel), Document setup wizard (5-step), Settings (profile/org/notifications/AI/keys/audit), Templates, Export, Git connect, Analysis results, NLP dashboard, Members.

**State**: TanStack React Query for server state, Zustand for client state (auth, org, editor UI, AI chat, theme, view preferences).

**Three-panel editor**:
- **Left panel**: Outline tree (collapsible, drag-reorder, status dots) or Notes panel
- **Middle panel**: Sections with Tiptap markdown editor, write/preview/diff modes, autosave (3s debounce), status indicators, generate/refine/accept action buttons
- **Right panel**: AI chat (streaming via SSE), model selector, quick action chips (generate/refine/suggest-structure), clarification requests

**Document setup wizard** (5 steps): SourceStep → AnalysisFactsStep → TemplateRecommendationStep → OutlineReviewStep → GenerationChoiceStep. State persisted via `document.setup_stage`. Progressively reveals as each step completes.

**Key components**: DiffViewer (react-diff-viewer-continued), VersionHistory (modal with restore), QualityModal (circular scores + issues + broken links), ExportModal (40+ settings + live iframe preview), ShareDialog, StructuralSuggestions, OutlineDiffBanner, ResourcePalette, EditorContextMenu.

---

## Collaboration

**Organizations** own projects. Roles: ADMIN (full), PROJECT_MANAGER (audit), DEVELOPER (default), TECHNICAL_WRITER (doc focus), VIEWER (read-only). Invite via email or join links.

**Document sharing**: Share documents with VIEW/COMMENT/EDIT permissions to org members or external users. Revocable.

**Notes**: Append-only per-document or per-section comments. No threading, no editing, no deleting.

**Review workflow**: AI generates → section is `GENERATED_DRAFT` → user accepts → becomes `REVIEWED` with reviewer ID + analysis snapshot. Editing reviewed content clears review state.

**Activity events**: All meaningful actions recorded with weights (review=3.0, generate=1.0, etc.) → timeline + GitHub-style heatmap.

**Limitations**: No real-time (no WebSocket), no section assignment, role enforcement incomplete, notifications not fully implemented.

---

## Version Control

**Snapshot-based**: Every content change stores full `content_md` in `section_versions`. No diffs stored. Author type (`USER`/`AI`) recorded.

**Triggers**: Manual save, status update, AI generation, AI refine accept, autosave, terminology resolve, version restore.

**Diff**: Python `difflib.unified_diff` for version-to-predecessor comparison. Frontend renders with `react-diff-viewer-continued` (unified/split, word-level highlighting).

**Rollback**: POST `/versions/{id}/restore` restores content + creates new version (preserving history). Review state is cleared on restore.

**Staleness tracking** (freshness_service): Compares old vs new analysis snapshots -> detects changes in source_commit, file_tree, endpoints, languages -> flags affected sections. AI generates update proposals shown as diffs for accept/reject.

**Limitations**: No semantic versioning, no branch/merge, no document-level snapshots, no version pruning.

---

## Export

**3 formats**: Markdown (concatenated sections), HTML (full styled document with CSS), PDF (HTML → WeasyPrint).

**40+ configurable settings**: Paper size, margins, fonts, colors (7), code theme, header/footer, logo, watermark, table style, TOC, cover page, page breaks.

**Batch export**: Up to 50 projects as PDFs in a ZIP.

**Missing**: No DOCX (library present but unused), no ePub, markdown export is plain (no TOC/styling), diagrams not rendered in export (mermaid source included but WeasyPrint may not execute JS).

---

## Authentication

**JWT in httponly cookies**: Access token (30min) + refresh token (7d). 401 interceptor auto-refreshes. Cross-tab logout via BroadcastChannel.

**Registration**: bcrypt password → email verification token → verified before login allowed.

**OAuth**: GitHub OAuth (repo/user/read:org scopes) — complete. GitLab OAuth — **incomplete** (no callback handler).

**API keys**: Programmatic keys stored as SHA-256 hashes. Middleware for Bearer token auth may not be fully wired.

**Security**: bcrypt hashing, Fernet encryption for stored tokens, httponly+samesite cookies. **Missing**: rate limiting, MFA, session invalidation on password change, refresh token rotation.

---

## GitHub/GitLab Integration

**GitHub OAuth**: Authorize → exchange code → Fernet-encrypt token → store in `oauth_tokens`. Used for repo listing (`/projects/git/repos`), branch listing, and authenticated clone URLs.

**Git clone**: GitPython shallow clone (`depth=1`) with exclusion patterns. HEAD commit recorded.

**Re-sync**: Manual trigger only (no webhooks). New analysis snapshot → stale section detection.

**GitLab**: Authorization endpoint exists. **Callback missing** — integration is non-functional.

**7 noted limitations**: No webhooks, shallow clones only, token embedded in clone URL (may leak to logs), no fine-grained PAT support.
