# Gap-Fill Phase Prompts

Use these prompts one phase at a time. Each prompt is intended for a fresh implementation run.

Before using any phase prompt, read `docs/CANONICAL_EXECUTION_PROMPT.md`.

Canonical product sources:
- `CONTEXT.md`
- `docs/CURRENT_SYSTEM_STATE.md`
- `frontend/VISUAL_SPEC.md`
- `docs/adr/0001-projects-contain-multiple-documents.md`
- `docs/adr/0002-section-scoped-liveblocks-collaboration.md`

Execution plan:
- `docs/REDESIGN_PHASE_GAPS.md`

Do not use any other markdown document as product truth. In particular, do not rely on `docs/REDESIGN_IMPLEMENTATION_PLAN.md`, `docs/REDESIGN_PHASE_PROMPTS.md`, `docs/MASTER_ROADMAP.md`, `docs/ARCHITECTURE_REVIEW.md`, or `docs/LANDING_PAGE_COPY.md` for product decisions. If a stale document conflicts with the canonical sources, follow the canonical sources and report the conflict.

## Phase 1 - Backend Contract Cleanup

```text
Read docs/CANONICAL_EXECUTION_PROMPT.md first.
Then read only CONTEXT.md, docs/CURRENT_SYSTEM_STATE.md, frontend/VISUAL_SPEC.md, docs/adr/0001-projects-contain-multiple-documents.md, docs/adr/0002-section-scoped-liveblocks-collaboration.md, and docs/REDESIGN_PHASE_GAPS.md.

Do not read or rely on older roadmap, architecture, phase, or landing-copy docs.
Treat CONTEXT.md, docs/CURRENT_SYSTEM_STATE.md, frontend/VISUAL_SPEC.md, docs/adr/0001-projects-contain-multiple-documents.md, and docs/adr/0002-section-scoped-liveblocks-collaboration.md as the only product truth.
Treat docs/REDESIGN_PHASE_GAPS.md as the execution plan only.

Implement Phase 1 only: Backend Contract Cleanup.

Goal:
Make the API and service layer reflect the canonical Project and Document model before more frontend work depends on it.

Scope:
- Project is the source-connected workspace.
- Document owns Template choice, setup stage, Outline, Sections, generation, quality, export, review, sharing, and freshness.
- Remove active dependencies on stored Project completion truth.
- Remove active project.template_id assumptions.
- Align active Project and Document responses with the multi-Document ADR.
- Preserve explicit Section content lifecycle and workflow flags.
- Keep review, generation, quality, export, evidence, and freshness behavior Document-scoped where they touch Document content.

Required behavior:
- Project summary state must be derived from Documents and Sections.
- Project responses may expose derived resume-work signals such as document count, active generation, Sections needing input, review state, freshness state, and recent activity when available.
- Template choice must resolve through Document ownership, not Project ownership.
- Active analysis and generation code must not read project.template_id.
- Any legacy adapter that remains must be temporary, isolated, and not extended as a product path.
- Nested Document access must continue to authorize through Project organization membership.

Do not:
- Redesign frontend screens except for minimal API contract fixes.
- Add new product concepts not present in the canonical docs.
- Use docs/REDESIGN_IMPLEMENTATION_PLAN.md to justify route shape, schema names, or behavior.

Add or update tests proving:
- Project summary values are derived rather than stored as a second truth.
- Active analysis/generation paths no longer depend on project.template_id.
- Nested Document routes reject unauthorized access through guessed ids.
- Existing Generation Run, Section task, and review-state behavior still persists correctly.

Run the relevant backend tests and report exactly what passed or failed.
Commit the changes when the phase is complete.
```

## Phase 2 - Authenticated Shell, Dashboard, And Project Workspace

```text
Read docs/CANONICAL_EXECUTION_PROMPT.md first.
Then read only CONTEXT.md, docs/CURRENT_SYSTEM_STATE.md, frontend/VISUAL_SPEC.md, docs/adr/0001-projects-contain-multiple-documents.md, docs/adr/0002-section-scoped-liveblocks-collaboration.md, and docs/REDESIGN_PHASE_GAPS.md.

Do not read or rely on older roadmap, architecture, phase, or landing-copy docs.
Treat CONTEXT.md, docs/CURRENT_SYSTEM_STATE.md, frontend/VISUAL_SPEC.md, docs/adr/0001-projects-contain-multiple-documents.md, and docs/adr/0002-section-scoped-liveblocks-collaboration.md as the only product truth.
Treat docs/REDESIGN_PHASE_GAPS.md as the execution plan only.

Implement Phase 2 only: Authenticated Shell, Dashboard, And Project Workspace.

Goal:
Make the signed-in product feel like one governed, calm developer workspace.

Scope:
- Rebuild global home/dashboard around recent work, active Projects, resume signals, and the searchable Project library.
- Replace KPI-led admin-dashboard composition with the document-first workspace hierarchy from frontend/VISUAL_SPEC.md.
- Make global navigation compact, dark-neutral, stable, and context-aware.
- Make Project workspace navigation contain Documents, Source, and Activity.
- Make Documents the dominant Project workspace surface.
- Use governed primitives and semantic tokens for recurring UI.

Required behavior:
- Home prioritizes recent Projects, active generation, Sections needing input, source changes, and resume-work signals before the full Project library.
- Project library supports list and grid views, with list as the default scanning mode.
- Project workspace surfaces Document generation, review, freshness, Template, progress, tags, and last activity where available.
- Source and Activity are supporting Project views; repository analytics must not dominate the workspace.
- Global navigation contains Home, Projects, Templates, and Settings.
- Project-specific Documents, Source, and Activity appear only after entering a Project.
- Sidebar uses the compact dark-neutral direction from the visual spec.
- Existing user preferences for list/grid/search should keep working where already implemented.

Do not:
- Rebuild editor internals in this phase.
- Add decorative charts or analytics unless they represent meaningful Activity or source health.
- Use raw product colors, arbitrary visual values, arbitrary radii/shadows, or local recurring style patterns.
- Create UI cards inside UI cards.

Add or update checks proving:
- Dashboard and workspace render through shared primitives without local restyling.
- Keyboard focus and contrast are acceptable in shell surfaces.
- Project library search/filter and list/grid preference still work.
- Navigation enters and exits Project workspace correctly.

Run frontend lint/build or the closest available verification and report exactly what passed or failed.
Start the frontend dev server if useful for visual inspection, and report the URL.
Commit the changes when the phase is complete.
```

## Phase 3 - Public Entry And First-Document Journey

```text
Read docs/CANONICAL_EXECUTION_PROMPT.md first.
Then read only CONTEXT.md, docs/CURRENT_SYSTEM_STATE.md, frontend/VISUAL_SPEC.md, docs/adr/0001-projects-contain-multiple-documents.md, docs/adr/0002-section-scoped-liveblocks-collaboration.md, and docs/REDESIGN_PHASE_GAPS.md.

Do not read or rely on older roadmap, architecture, phase, or landing-copy docs.
Treat CONTEXT.md, docs/CURRENT_SYSTEM_STATE.md, frontend/VISUAL_SPEC.md, docs/adr/0001-projects-contain-multiple-documents.md, and docs/adr/0002-section-scoped-liveblocks-collaboration.md as the only product truth.
Treat docs/REDESIGN_PHASE_GAPS.md as the execution plan only.

Implement Phase 3 only: Public Entry And First-Document Journey.

Goal:
Align landing, auth, and first-Document creation with the same professional SaaS direction and the canonical first-Document flow.

Scope:
- Retune landing, login, registration, and auth-adjacent screens so they share the product system.
- Rebuild the first-Document journey around source connection, progressive Analysis, Template recommendation, Outline review, generation choice, and editor entry.
- Preserve source-less and provider-less paths, but make their limitations clear.
- Make provider usage and cost explicit before provider-consuming actions.

Required behavior:
- Landing copy describes Pagemark as a source-connected Project workspace that creates multiple purpose-specific Documents.
- Landing visuals show the product or product state, not generic decorative marketing composition.
- Auth screens use the same typography, spacing, semantic tokens, and restrained surface treatment as the workspace.
- First-Document flow uses a persistent progress area and live summary rail on desktop.
- On smaller screens, the live summary rail becomes an accessible review drawer.
- GitHub source connection is primary.
- Repository URL, ZIP upload, and start-without-source remain fallback paths.
- Analysis facts appear progressively and disclose partial failure clearly.
- Template recommendations distinguish rule-based recommendations from AI-personalized recommendations.
- Provider credential setup is embedded only when a maintainer chooses an AI-powered action.
- Generation mode choice shows relative usage, approximate cost, uncertainty, and Section-level breakdown.
- The maintainer reaches the editor as soon as useful work is available.

Do not:
- Use docs/LANDING_PAGE_COPY.md as product truth.
- Use decorative page animation, gradient orbs, bokeh, generic hero art, or generic feature-card marketing layout.
- Redirect away from the first-Document journey for provider credential setup.
- Present approximate provider cost as guaranteed billing.

Add or update checks proving:
- First-Document flow can reach the editor through the intended sequence.
- Reload/resume follows persisted Document setup stage where available.
- Provider-less flow allows static Analysis and rule-based recommendations.
- Source-less path clearly disables Analysis-grounded features.
- Landing and auth screens pass design-system checks.

Run frontend lint/build or the closest available verification and report exactly what passed or failed.
Start the frontend dev server if useful for visual inspection, and report the URL.
Commit the changes when the phase is complete.
```

## Phase 4 - Editor, Review States, Settings, And Utility Surfaces

```text
Read docs/CANONICAL_EXECUTION_PROMPT.md first.
Then read only CONTEXT.md, docs/CURRENT_SYSTEM_STATE.md, frontend/VISUAL_SPEC.md, docs/adr/0001-projects-contain-multiple-documents.md, docs/adr/0002-section-scoped-liveblocks-collaboration.md, and docs/REDESIGN_PHASE_GAPS.md.

Do not read or rely on older roadmap, architecture, phase, or landing-copy docs.
Treat CONTEXT.md, docs/CURRENT_SYSTEM_STATE.md, frontend/VISUAL_SPEC.md, docs/adr/0001-projects-contain-multiple-documents.md, and docs/adr/0002-section-scoped-liveblocks-collaboration.md as the only product truth.
Treat docs/REDESIGN_PHASE_GAPS.md as the execution plan only.

Implement Phase 4 only: Editor, Review States, Settings, And Utility Surfaces.

Goal:
Make the rest of the app consistent with the document-first workspace and explicit review model.

Scope:
- Bring the editor to the calm, document-first visual language in frontend/VISUAL_SPEC.md.
- Make Outline and AI assistance secondary, contextual tools.
- Replace legacy review banners, status chips, panel treatments, and utility layouts with governed variants.
- Align settings, templates, analysis, quality, export, and activity views with the same system.
- Preserve the existing TipTap/Markdown writing strengths while changing layout and chrome.

Required behavior:
- The Document is the dominant editor surface.
- Outline remains collapsible and visually secondary.
- AI assistance appears near active Section or selected text; longer conversation belongs in a collapsible assistant panel.
- Generated prose enters as Generated Draft.
- Generated Draft remains reviewable until explicit acceptance.
- Manual edits do not automatically mark generated or manual content reviewed.
- Explicit acceptance records review metadata and Analysis snapshot where evidence exists.
- Potentially Stale, needs-input, generating, failed, Generated Draft, and Reviewed states are visible without relying on color alone.
- Activity shows meaningful workflow events and excludes routine autosave/edit noise.
- Settings, templates, analysis, quality, and export use compact work-focused layouts rather than standalone card-heavy designs.

Do not:
- Add a full collaboration redesign.
- Make AI visually dominate the Document.
- Implement source-grounded stale update diffs unless the backend contract already supports them and the current task explicitly scopes them.
- Use local raw colors or one-off status styling.

Add or update tests proving:
- Normal edits do not mark a draft reviewed.
- Explicit acceptance marks generated or manual content reviewed.
- Review metadata is recorded when acceptance occurs.
- Core utility surfaces render through governed primitives.
- Status indicators include non-color-only meaning.

Run relevant backend tests for review state behavior.
Run frontend lint/build or the closest available verification and report exactly what passed or failed.
Start the frontend dev server if useful for visual inspection, and report the URL.
Commit the changes when the phase is complete.
```

## Phase 5 - Enforcement And Regression Protection

```text
Read docs/CANONICAL_EXECUTION_PROMPT.md first.
Then read only CONTEXT.md, docs/CURRENT_SYSTEM_STATE.md, frontend/VISUAL_SPEC.md, docs/adr/0001-projects-contain-multiple-documents.md, docs/adr/0002-section-scoped-liveblocks-collaboration.md, and docs/REDESIGN_PHASE_GAPS.md.

Do not read or rely on older roadmap, architecture, phase, or landing-copy docs.
Treat CONTEXT.md, docs/CURRENT_SYSTEM_STATE.md, frontend/VISUAL_SPEC.md, docs/adr/0001-projects-contain-multiple-documents.md, and docs/adr/0002-section-scoped-liveblocks-collaboration.md as the only product truth.
Treat docs/REDESIGN_PHASE_GAPS.md as the execution plan only.

Implement Phase 5 only: Enforcement And Regression Protection.

Goal:
Prevent the product from drifting back into multiple visual and domain sources of truth.

Scope:
- Keep canonical docs as the only normative product references in prompts and planning docs.
- Tighten design-system enforcement for changed frontend files.
- Protect derived Project/Document state and explicit review lifecycle with tests.
- Keep accessibility checks in the normal verification path.

Required behavior:
- Phase prompts and future execution instructions must point to docs/CANONICAL_EXECUTION_PROMPT.md first.
- Checks reject hardcoded product UI colors in changed files.
- Checks reject arbitrary visual values, arbitrary radii/shadows, and repeated local styling patterns outside governed variants.
- Inline style exceptions remain limited to runtime-computed values: progress width, editor geometry, and user-selected export branding.
- WCAG 2.2 AA expectations remain covered for core primitives: keyboard operation, visible focus, contrast, reduced motion, and non-color-only status indicators.
- Backend tests protect derived Project/Document state.
- Backend or frontend tests protect explicit review acceptance behavior.

Do not:
- Create a new competing source-of-truth document.
- Relax design-system checks to make implementation easier.
- Let docs/REDESIGN_IMPLEMENTATION_PLAN.md or older docs become prompt references again.

Add or update checks proving:
- npm run lint catches hardcoded product UI colors in changed files.
- Shared variants render core states without local restyling.
- Focus and contrast remain acceptable for core primitives.
- Derived Project/Document state tests pass.
- Review lifecycle tests pass.

Run frontend lint/build and relevant backend tests.
Report exactly what passed or failed.
Commit the changes when the phase is complete.
```
