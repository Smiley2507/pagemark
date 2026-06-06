# Pagemark SaaS Usability Recovery Phase Prompts

Use these prompts one phase at a time. Each phase must begin from the canonical execution prompt and canonical product sources.

## Phase 1 - Manual Document Foundation And Contract Hardening

```text
Read docs/CANONICAL_EXECUTION_PROMPT.md first.
Then read only CONTEXT.md, frontend/VISUAL_SPEC.md, docs/adr/0001-projects-contain-multiple-documents.md, docs/SAAS_USABILITY_RECOVERY_PLAN.md, and this phase prompt.

Do not read or rely on older roadmap, architecture, phase, or landing-copy docs.

Implement Phase 1 only: Manual Document Foundation And Contract Hardening.

Goal:
Make a blank Project/Document usable without source, Template, or AI.

Required behavior:
- A source-less Project can create a blank Document.
- A blank Document can enter the editor with zero Sections.
- The user can create, rename, update content, reorder, and soft-delete Sections through Document-scoped routes.
- Document section listing returns active Sections only, ordered by order_index.
- Export uses current active Sections only, with current Section headings/titles.
- Deleted Sections never appear in export.
- Renamed Sections do not revert during export.
- Frontend API adapters normalize backend response shapes at the API boundary.
- Legacy section routes may remain only as temporary compatibility; new UI work should use nested Document routes.

Do not:
- Rebuild the editor UI in this phase.
- Redesign dashboard/settings/public pages.
- Add AI features.
- Relax design-system checks.

Add or update tests proving:
- Blank Project/Document path works.
- Document-scoped Section create/rename/update/reorder/delete works.
- Soft-deleted Sections are excluded from Document section listing and export.
- Export reflects renamed headings.
- Nested Document authorization still protects guessed IDs.

Run:
- frontend lint/build
- relevant backend pytest files for nested documents, Section CRUD, and export
Report exactly what passed or failed.
Commit when complete.
```

## Phase 2 - Continuous Document Editor Recovery

```text
Read docs/CANONICAL_EXECUTION_PROMPT.md first.
Then read only CONTEXT.md, frontend/VISUAL_SPEC.md, docs/adr/0001-projects-contain-multiple-documents.md, docs/SAAS_USABILITY_RECOVERY_PLAN.md, and this phase prompt.

Do not read or rely on older roadmap, architecture, phase, or landing-copy docs.

Implement Phase 2 only: Continuous Document Editor Recovery.

Goal:
Make the editor a usable continuous document workspace while preserving persisted Section lifecycle.

Required behavior:
- The canonical editor route is /projects/{projectId}/documents/{documentId}.
- The editor is full-screen and not wrapped in the main sidebar/topbar shell.
- The editor renders all active Sections in order in one continuous writing surface.
- Each Section has editable heading and content.
- The user can add Sections above/below, delete Sections with confirmation, and reorder Sections.
- The Document title is editable in the editor topbar.
- Save/autosave state is visible but compact.
- Document status is displayed as a derived read-only badge, not an arbitrary dropdown.
- Left TOC shows Section/H1/H2 navigation, highlights current location, and supports keyboard navigation.
- TOC bottom stats show word count, review progress, and grammar/style issue count where available.
- Right panel is collapsed by default and reserved for AI/notes/review tools added in later phases.

Do not:
- Implement the full AI panel in this phase.
- Rewrite Markdown parsing beyond what is necessary for continuous editor stability.
- Add marketing/public page work.
- Keep the old section-switching editor as the primary UX.

Add or update tests/checks proving:
- Editor loads a blank Document.
- User can add, rename, write, reorder, and delete Sections from the editor.
- Reordered Sections persist after reload.
- Deleted Sections disappear after reload.
- Document title updates persist.
- Keyboard focus is visible in topbar, TOC, Section controls, and editor actions.

Run:
- frontend lint/build
- relevant backend tests from Phase 1
- browser/manual verification of blank Document editor flow if no automated browser test exists
Report exactly what passed or failed.
Commit when complete.
```

## Phase 3 - Markdown, Tables, Slash Menu, And Writing Quality

```text
Read docs/CANONICAL_EXECUTION_PROMPT.md first.
Then read only CONTEXT.md, frontend/VISUAL_SPEC.md, docs/adr/0001-projects-contain-multiple-documents.md, docs/SAAS_USABILITY_RECOVERY_PLAN.md, and this phase prompt.

Do not read or rely on older roadmap, architecture, phase, or landing-copy docs.

Implement Phase 3 only: Markdown, Tables, Slash Menu, And Writing Quality.

Goal:
Make the writing surface reliable enough for real documentation work.

Required behavior:
- CodeMirror live preview remains source-as-truth.
- Bold, italic, links, inline code, headings, fenced code, checkboxes, and horizontal rules render correctly without corrupting markdown.
- Table editing supports insert table, add/remove row, add/remove column, and keeps valid markdown.
- Table UX should follow an Obsidian Advanced Tables-style interaction model as closely as practical.
- Slash menu is compact, keyboard-first, and command-oriented.
- Slash commands include paragraph, headings, checklist, code block, table, quote/callout, and horizontal rule.
- Grammar/style indicators are visible but not visually dominant.
- Changed editor files must use semantic tokens and governed variants.

Do not:
- Replace CodeMirror with another editor.
- Add decorative editor UI.
- Implement AI chat features.
- Hardcode product UI colors or arbitrary visual values.

Add or update tests/checks proving:
- Markdown formatting survives editing and reload.
- Links/bold/italic render correctly in live preview.
- Table row/column operations preserve markdown.
- Slash menu keyboard navigation works.
- Reduced motion and visible focus still pass.

Run:
- frontend lint/build
- targeted editor tests or browser checks for markdown/table/slash commands
Report exactly what passed or failed.
Commit when complete.
```

## Phase 4 - Workspace Navigation, Dashboard, Search, And Settings

```text
Read docs/CANONICAL_EXECUTION_PROMPT.md first.
Then read only CONTEXT.md, frontend/VISUAL_SPEC.md, docs/adr/0001-projects-contain-multiple-documents.md, docs/SAAS_USABILITY_RECOVERY_PLAN.md, and this phase prompt.

Do not read or rely on older roadmap, architecture, phase, or landing-copy docs.

Implement Phase 4 only: Workspace Navigation, Dashboard, Search, And Settings.

Goal:
Make the surrounding workspace feel like a complete professional SaaS product without distracting from writing.

Required behavior:
- Sidebar contains logo, New Project action, Dashboard/Home, Projects, Templates, top 3 tags with counts, Settings, and user/org card at bottom.
- Topbar contains page title, global search, theme toggle if kept, and notifications popover.
- Global search supports Projects, Documents, Sections, tag filters, status filters, and sort by name, last opened, last added, last modified.
- Dashboard/Home shows recent Documents, recent Projects, needs review, source changed, drafts in progress, quick actions, and work-oriented KPIs.
- Project workspace supports editing Project name and description.
- Project workspace exposes Documents, Source, Activity, and Settings.
- Stub menu actions must be implemented, removed, or disabled with clear unavailable state.
- Settings is a one-stop center with profile, organization, members, AI providers/models, source connections, export defaults, templates, notifications, API keys/security.
- Settings search matches labels and keywords.

Do not:
- Rebuild the editor in this phase.
- Add generic analytics charts.
- Add wordy explanatory text to routine panels.
- Reintroduce old dashboard routes as primary navigation.

Add or update tests/checks proving:
- Topbar search filters and sorting work.
- Sidebar tag counts render from real data.
- Project name/description edits persist.
- Settings search finds settings by keyword.
- No visible stub actions remain in primary workspace menus.

Run:
- frontend lint/build
- relevant backend tests for search/project update if changed
Report exactly what passed or failed.
Commit when complete.
```

## Phase 5 - AI Assistant, Notes, Review, Quality, And Export Tools

```text
Read docs/CANONICAL_EXECUTION_PROMPT.md first.
Then read only CONTEXT.md, frontend/VISUAL_SPEC.md, docs/adr/0001-projects-contain-multiple-documents.md, docs/SAAS_USABILITY_RECOVERY_PLAN.md, and this phase prompt.

Do not read or rely on older roadmap, architecture, phase, or landing-copy docs.

Implement Phase 5 only: AI Assistant, Notes, Review, Quality, And Export Tools.

Goal:
Make document operations available from the editor without cluttering the writing surface.

Required behavior:
- Right panel is resizable and collapsed by default.
- AI assistant has one conversation/composer surface, not multiple dashboard-like tabs.
- AI composer supports @section, @document, @source, and @template references.
- AI panel shows active provider/model and allows model switching/settings where backend support exists.
- AI output has clear apply, replace, and insert actions.
- Notes are accessible in the right panel and can be tied to Document or active Section.
- Quality/grammar/style checks are accessible from editor tools and can jump to affected Section.
- Review actions are explicit: accept current Section, and optionally accept all review-ready Sections only when safe.
- Editing reviewed content clears current review state.
- Export action is available from the editor topbar and exports current active Document content.

Do not:
- Add unrelated collaboration redesign.
- Make AI visually dominate the Document.
- Add provider-consuming actions without explicit usage/cost state where applicable.
- Reintroduce multi-tab AI dashboard clutter.

Add or update tests/checks proving:
- AI @ references attach intended context.
- AI apply/replace/insert changes editor content correctly.
- Notes create/list against Document or Section.
- Review acceptance and edit invalidation still pass.
- Export from editor matches current active Sections.

Run:
- frontend lint/build
- relevant backend tests for AI/review/notes/export
Report exactly what passed or failed.
Commit when complete.
```

## Phase 6 - Public/Auth, Copy Reduction, Visual Polish, And Legacy Retirement

```text
Read docs/CANONICAL_EXECUTION_PROMPT.md first.
Then read only CONTEXT.md, frontend/VISUAL_SPEC.md, docs/adr/0001-projects-contain-multiple-documents.md, docs/SAAS_USABILITY_RECOVERY_PLAN.md, and this phase prompt.

Do not read or rely on older roadmap, architecture, phase, or landing-copy docs.

Implement Phase 6 only: Public/Auth, Copy Reduction, Visual Polish, And Legacy Retirement.

Goal:
Make the app feel like one minimal professional SaaS product and remove prototype residue.

Required behavior:
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

Do not:
- Create a competing visual spec or product truth document.
- Use old landing-copy docs as source of truth.
- Add decorative gradient/orb-heavy marketing UI.
- Leave old and new product models both reachable from primary navigation.

Add or update checks proving:
- Old conflicting routes redirect to canonical routes or are unreachable.
- Public/auth pages pass lint/build and design-system checks.
- Workspace copy reduction does not remove required accessibility labels.
- No hardcoded product UI colors or arbitrary local visual values in changed files.

Run:
- frontend lint/build
- browser verification of unauthenticated landing to auth to workspace path
- relevant backend tests if route behavior changes backend contracts
Report exactly what passed or failed.
Commit when complete.
```
