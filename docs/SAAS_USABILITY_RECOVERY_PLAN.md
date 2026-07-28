# Pagemark SaaS Usability Recovery Plan

> Historical plan note: this document predates the current TipTap/Liveblocks editor implementation. For current product truth, read `CONTEXT.md`, `docs/CURRENT_SYSTEM_STATE.md`, `frontend/VISUAL_SPEC.md`, and the ADRs first.

## Summary

Goal: turn the current visually polished but weakly usable app into an 8/10 professional SaaS documentation writing product.

Canonical direction:
- Keep `CONTEXT.md`, `frontend/VISUAL_SPEC.md`, and `docs/adr/0001-projects-contain-multiple-documents.md` as product truth.
- Treat the editor as the core product.
- Use continuous section-backed editing: one document-like writing surface, while preserving persisted Sections for review, freshness, generation, export, and AI.
- Retire or redirect conflicting legacy UX instead of keeping parallel product models.
- Keep public/auth product-led and minimal, not a generic marketing or split-image app.

Assumption: the current uncommitted `outline` to `outline_json` frontend API normalization fix should be committed before Phase 1, or included as the first small commit in Phase 1.

## Phase 1 - Manual Document Foundation And Contract Hardening

Implement the minimum backend/frontend contract work that makes a blank Project/Document usable without source, Template, or AI.

Key changes:
- Make blank Project to blank Document to editor a first-class path.
- Add or complete nested Document-scoped Section operations: create Section, rename Section, update content, reorder Sections, soft-delete Section, and list only active Sections.
- Frontend APIs must use nested Document routes for document content work; keep legacy `/sections/...` only as temporary compatibility where unavoidable.
- Fix export correctness so deleted Sections never export and renamed Sections export with current titles.
- Normalize backend/frontend response shapes at API boundaries, not inside components.
- Add backend tests for manual Section CRUD, reorder persistence, soft-delete exclusion, renamed/deleted export behavior, and blank Document setup.

Acceptance:
- A user can create a source-less Project and blank Document, add Sections, write content, rename/delete/reorder Sections, and export current content.
- No UI route should require source or Template before basic writing is possible.

## Phase 2 - Continuous Document Editor Recovery

Rebuild the editor around the real writing workflow.

Key changes:
- Replace section-switching editor UX with a continuous document surface showing all active Sections in order.
- Keep each persisted Section as an editable block with minimal chrome: editable heading, content editor, small status/review affordance, and contextual section menu.
- Editor must be full-screen product workspace, not inside the main app shell.
- Editor topbar includes editable Document title, compact save state, Quality, Share, Export, review/status badge as read-only derived state, and a user avatar menu for account-local actions such as theme switching.
- Left TOC shows minimal H1/H2/Section navigation, current location highlight, and bottom stats for word count, grammar/style issue count, and review progress.
- Section actions include add Section above/below, delete with confirmation, drag or keyboard reorder, and optional duplicate only if cheap.
- Keep AI and notes in a right-side resizable panel, collapsed by default.

Acceptance:
- User can write a full document without jumping Section-to-Section.
- Section lifecycle remains explicit, but does not dominate writing.
- Editor feels closer to Notion/Obsidian than a dashboard.

## Phase 3 - Markdown, Tables, Slash Menu, And Writing Quality

Stabilize the actual writing experience.

Key changes:
- Audit and fix TipTap/Markdown behavior for bold, italic, links, inline code, fenced code, headings, checkboxes, tables, and horizontal rules.
- Rework tables using an Obsidian Advanced Tables-style interaction: insert table, add/remove row, add/remove column, and preserve valid markdown.
- Revamp slash command menu as a compact, keyboard-first command list.
- Slash commands include paragraph, headings, checklist, code block, table, quote/callout, and horizontal rule.
- Integrate grammar/style indicators without making the editor noisy.
- Remove raw product colors and local visual hacks from changed editor files.

Acceptance:
- Markdown syntax remains editable and previewed without corrupting source.
- Tables are useful enough for real writing.
- Slash commands feel like writing tools, not prototype controls.

## Phase 4 - Workspace Navigation, Dashboard, Search, And Settings

Make the surrounding app feel like a complete SaaS workspace.

Key changes:
- Sidebar contains logo, New Project action, Dashboard/Home, Projects, Templates, top 3 tags with counts, Settings, and user/org card at bottom.
- Topbar contains page title, global search, theme toggle if kept, and notifications popover.
- Global search supports Projects, Documents, Sections, tag filters, status filters, and sort by name, last opened, last added, last modified.
- Dashboard/Home shows recent Documents, recent Projects, needs review, source changed, drafts in progress, quick actions, and work-oriented KPIs.
- Project workspace supports editing Project name and description.
- Project workspace exposes Documents, Source, Activity, and Settings.
- Stub menu actions must be implemented, removed, or disabled with clear unavailable state.
- Settings is a one-stop center with profile, organization, members, AI providers/models, source connections, export defaults, templates, notifications, API keys/security.
- Settings search matches labels and keywords.

Acceptance:
- A user can navigate the product without discovering dead/stub actions.
- Search belongs in the topbar and is useful.
- Settings feels complete enough for a SaaS product.

## Phase 5 - AI Assistant, Notes, Review, Quality, And Export Tools

Make document operations available from the editor in a minimal way.

Key changes:
- Replace cluttered AI panel with one resizable assistant panel: chat/composer only, model selector, model settings popover, `@section`, `@document`, `@source`, and `@template` references.
- AI output has clear apply, replace, and insert actions.
- Notes are accessible in the right panel and can be tied to Document or active Section.
- Quality/grammar/style checks are accessible from editor tools and can jump to affected Section.
- Review actions are explicit: accept current Section, and optionally accept all review-ready Sections only when safe.
- Editing reviewed content clears current review state.
- Export action is available from the editor topbar and exports current active Document content.

Acceptance:
- User can write, ask AI for help, review, check quality, take notes, and export without leaving the editor.
- AI feels like Cursor/VS Code assistant, not a multi-tab dashboard.

## Phase 6 - Public/Auth, Copy Reduction, Visual Polish, And Legacy Retirement

Finish the product feel and remove prototype residue.

Key changes:
- Landing is product-led, minimal, and conversion-aware.
- Landing shows real product workflow/state rather than generic decorative marketing.
- Login/register are polished, concise, and aligned with the product workspace.
- Remove excessive explanatory text from routine workspace screens.
- Prefer icon buttons with tooltips for obvious actions.
- Use visible helper text only for irreversible, costly, provider-consuming, or genuinely confusing actions.
- Dialogs, menus, panels, loading states, empty states, and error states use governed primitives.
- Retire, redirect, or remove old routes that conflict with canonical Project/Document UX, including old new-project/editor/dashboard paths where replacement behavior exists.
- Remove old navigation entries and unreachable legacy components after verifying replacements.
- Keep design-system enforcement strict.

Acceptance:
- The app no longer feels like two products.
- A first-time user lands, signs in, creates a blank or source-backed Document, writes, and exports without hitting prototype dead ends.

## Cross-Phase Test Plan

Required checks by the end of every phase:
- `cd frontend && npm run lint`
- `cd frontend && npm run build`
- relevant backend pytest files for changed API behavior

Add by Phase 2 or Phase 3:
- browser-level regression tests for blank Project/Document creation, manual Section CRUD, continuous editor writing, Section reorder/delete/rename, export excluding deleted Sections, and editor topbar/TOC keyboard navigation.

Backend regression coverage:
- nested Document authorization
- Section lifecycle transitions
- derived Project/Document progress
- explicit review acceptance
- export source-of-truth behavior

Frontend regression coverage:
- API response normalization
- editor state preservation during reorder/delete
- no hardcoded product colors in changed files
- no local repeated card/panel styling outside primitives
