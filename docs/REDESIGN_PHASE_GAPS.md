# Gap-Fill Execution Plan

This plan closes the product gaps introduced while the codebase was still being shaped by multiple sources of truth.

Normative product sources:
- `CONTEXT.md`
- `docs/CURRENT_SYSTEM_STATE.md`
- `frontend/VISUAL_SPEC.md`
- `docs/adr/0001-projects-contain-multiple-documents.md`
- `docs/adr/0002-section-scoped-liveblocks-collaboration.md`

Non-normative guidance:
- `docs/CANONICAL_EXECUTION_PROMPT.md` defines how agents must use the canonical sources.
- This file is the execution plan for the gap-fill work.
- Older roadmap, architecture, phase, and copy docs are historical unless a prompt explicitly names them for a narrow mechanical task.

## Current Gap

The backend mostly has the new domain nouns, but active contracts still expose legacy assumptions such as project-level completion truth and stale template ownership paths. The frontend is further from the intended product shape: the authenticated app still reads like a generic admin dashboard with individually styled screens rather than a calm, document-first developer workspace.

The repair order is:
1. normalize backend contracts,
2. rebuild the authenticated shell and dashboard,
3. align public entry and first-Document creation,
4. harmonize editor and utility surfaces,
5. strengthen enforcement and regression checks.

## Phase 1 - Backend Contract Cleanup

Goal: make the API and service layer reflect the canonical Project and Document model before more UI work depends on it.

Primary outcomes:
- Project is the source-connected workspace.
- Document owns Template choice, setup stage, Outline, Sections, generation, quality, export, review, sharing, and freshness.
- Project summaries expose derived resume-work signals, not stored document truth.
- Active services no longer assume a single Document per Project.

Implementation requirements:
- Remove active dependencies on stored `Project.completion_pct`; derive Project-level progress or attention summaries from current Documents and Sections.
- Remove active `project.template_id` reads and writes; Template selection must be Document-scoped.
- Replace frontend-facing Project response fields that imply single-document ownership with derived summaries such as document count, active generation, sections needing input, review state, freshness state, and recent activity when available.
- Keep legacy adapters only if they are required by still-existing routes during the same phase, and mark them temporary in code comments.
- Ensure generation, review, quality, export, and evidence paths resolve through Document ownership when they touch document content.

Implementation boundaries:
- Do not redesign frontend screens in this phase except to update broken API contract usage.
- Do not add new product concepts that are not present in the canonical docs.
- Do not use `docs/REDESIGN_IMPLEMENTATION_PLAN.md` to justify API shape.

Verification:
- Backend tests prove Project summary state is derived from Documents and Sections.
- Backend tests prove active analysis/generation code no longer reads `project.template_id`.
- API tests prove nested Document routes authorize through Project organization membership.
- Existing backend tests still pass or failures are reported with exact failing tests.

## Phase 2 - Authenticated Shell, Dashboard, And Project Workspace

Goal: make the signed-in product feel like one governed, calm developer workspace.

Primary outcomes:
- Global home prioritizes recent work, active Projects, and resume signals.
- The Project workspace emphasizes Documents and source health before analytics.
- Navigation is compact, stable, and context-aware.
- Screen composition uses governed primitives and semantic tokens instead of local visual inventions.

Implementation requirements:
- Rework the global home/dashboard so it is not KPI-led. It should lead with resume-work signals: recent Projects, active generation, Sections needing input, source changes, and the searchable Project library.
- Replace generic card grids and admin-dashboard composition with dense but quiet list-first views. Grid view can remain as an alternate browsing mode.
- Make global navigation contain Home, Projects, Templates, and Settings. Project-specific Documents, Source, and Activity belong inside Project workspace navigation.
- Make the sidebar compact and dark neutral as described in `frontend/VISUAL_SPEC.md`, with restrained selection and focus states.
- Rework Project workspace so Documents are the dominant tab/surface, Source and Activity are supporting views, and repository analytics never dominate the workspace.
- Use shared primitives for Button, Badge/status, Notice/banner, Surface, Input/select, Tabs/segmented control, Progress, Empty state, Tooltip/popover/dialog.

Implementation boundaries:
- Do not rebuild the editor internals in this phase.
- Do not add decorative dashboard charts unless they represent meaningful Activity or source health from the canonical docs.
- Do not use raw product colors, arbitrary shadows, or one-off card radii.

Verification:
- Frontend lint passes, including design-system enforcement.
- Frontend build passes or failures are reported exactly.
- Shell, dashboard, and Project workspace support keyboard navigation and visible focus.
- Tests or focused checks cover list/grid preference, search/filter behavior, and Project workspace navigation.

## Phase 3 - Public Entry And First-Document Journey

Goal: align landing, auth, and first-Document creation with the same product vision and visual system.

Primary outcomes:
- Public pages feel like the same professional SaaS product as the workspace.
- The first-Document flow follows the canonical sequence: source connection, progressive Analysis, Template recommendation, Outline review, generation choice, editor entry.
- Provider usage and cost are explicit before provider-consuming actions.
- Source-less and provider-less paths remain useful but clearly limited.

Implementation requirements:
- Retune landing and auth pages to use the same typography, tokens, spacing, and restraint as the authenticated workspace.
- Landing copy must describe Pagemark as a source-connected Project workspace that creates multiple purpose-specific Documents.
- Do not make the landing page feel like a separate decorative marketing site. Use product-specific surfaces or real product state as the visual proof.
- Replace the generic new-project wizard rhythm with the first-Document journey described in `frontend/VISUAL_SPEC.md`.
- Keep a persistent progress area and live summary rail on desktop; collapse the rail into an accessible review drawer on smaller screens.
- Prefer GitHub source connection first. Repository URL, ZIP upload, and start-without-source remain fallback paths.
- Show progressive Analysis facts and partial-failure messaging as they become available.
- Template recommendations must distinguish rule-based from AI-personalized recommendations.
- Embedded Provider credential setup appears only when the maintainer chooses an AI-powered action.
- Generation mode choice must show relative usage, approximate cost, uncertainty, and Section-level breakdown.

Implementation boundaries:
- Do not use old landing copy docs as product truth.
- Do not use decorative animation, gradient orbs, or generic SaaS feature-card layouts.
- Do not redirect away from the first-Document journey for Provider credential setup.

Verification:
- Frontend checks prove the first-Document flow can reach the editor.
- Reload/resume behavior follows persisted Document setup stage where available.
- Provider-less flow allows static Analysis and rule-based recommendations.
- Landing and auth pages pass lint/build and do not violate design-system checks.

## Phase 4 - Editor, Review States, Settings, And Utility Surfaces

Goal: make the rest of the app consistent with the document-first workspace and explicit review model.

Primary outcomes:
- The Document is visually dominant in the editor.
- Outline and AI assistance remain secondary, contextual tools.
- Generated Draft, Reviewed Section, Potentially Stale Section, needs-input, generating, and failed states are visible without visual noise.
- Settings, templates, analysis, quality, export, and activity use the same governed system.

Implementation requirements:
- Replace legacy amber/green banners, local status chips, and ad hoc panel treatments with governed Notice, Badge/status, Surface, Tabs, Dialog, Popover, and Progress variants.
- Generated prose must enter as Generated Draft and remain reviewable until explicit acceptance.
- Manual edits must not automatically mark content reviewed.
- Explicit acceptance must record review metadata and Analysis snapshot where evidence exists.
- The editor should preserve the existing TipTap/Markdown writing strengths while changing layout, hierarchy, and chrome.
- AI assistance should appear near active Section or selected text, with longer conversation in a collapsible assistant panel.
- Activity should show meaningful workflow events and exclude autosave/edit noise.
- Settings, templates, quality, export, and analysis screens should use compact work-focused layouts, not standalone card-heavy designs.

Implementation boundaries:
- Do not introduce full collaboration redesign in this phase.
- Do not make AI visually dominate the Document.
- Do not add source-grounded stale update diffs unless the backend contract already supports them and the phase explicitly scopes them.

Verification:
- Backend or frontend tests prove normal edits do not mark a draft reviewed.
- Tests prove explicit acceptance marks generated or manual content reviewed.
- Frontend lint/build passes.
- Design-system checks reject new local raw colors and arbitrary visual values.

## Phase 5 - Enforcement And Regression Protection

Goal: keep future implementation aligned with the canonical sources and the governed design system.

Primary outcomes:
- Future work starts from the canonical prompt and canonical docs.
- Raw product UI styling and repeated local patterns are caught automatically.
- Accessibility checks remain part of normal frontend verification.
- Tests protect the domain model and review lifecycle.

Implementation requirements:
- Keep `docs/CANONICAL_EXECUTION_PROMPT.md` as the first document referenced by future phase prompts.
- Add or tighten checks that reject hardcoded product UI colors, arbitrary visual values, arbitrary radii/shadows, and recurring local styling outside governed variants.
- Preserve inline style exceptions only for runtime-computed values: progress width, editor geometry, and user-selected export branding.
- Add focused tests around derived Project/Document state, explicit review state, provider usage visibility, and workspace navigation.
- Document any unavoidable exception inline and keep it narrow.

Implementation boundaries:
- Do not create new source-of-truth docs.
- Do not relax design-system checks to make a phase easier.
- Do not let old roadmap or architecture docs become implementation references.

Verification:
- `npm run lint` catches hardcoded product UI colors in changed files.
- Frontend build passes.
- Relevant backend tests pass.
- The final implementation report lists exactly what passed or failed.
