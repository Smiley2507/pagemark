# Pagemark Redesign Phase Prompts

Use these prompts one phase at a time. Do not ask an agent to implement the whole redesign in a single run.

These prompts are secondary to the canonical execution prompt in `docs/CANONICAL_EXECUTION_PROMPT.md`.
When using any prompt below, treat only these files as normative sources of product truth:

- `CONTEXT.md`
- `frontend/VISUAL_SPEC.md`
- `docs/adr/0001-projects-contain-multiple-documents.md`

Do not use `docs/REDESIGN_IMPLEMENTATION_PLAN.md`, `docs/MASTER_ROADMAP.md`, or any other markdown file as a decision source unless the phase prompt explicitly names it for a narrow, mechanical reason.

## Phase 1 — Domain Schema Foundation

```text
Read docs/CANONICAL_EXECUTION_PROMPT.md first.
Then read only CONTEXT.md, frontend/VISUAL_SPEC.md, and docs/adr/0001-projects-contain-multiple-documents.md.

Implement Phase 1 only: Domain Schema Foundation.

Scope:
- Update backend SQLAlchemy models and Alembic migrations so the domain model matches the multi-Document Project architecture.
- Project is the source-connected workspace.
- Document owns Template choice, setup stage, Outline Proposals, Sections, generation, quality, export settings, review, sharing, and freshness.
- Analysis is immutable and Project-scoped.
- Add models/tables for Outline Proposals, Template Recommendations, Generation Runs and Section tasks, Evidence References, Activity Events, and Workspace Preferences.
- Split Section state into content lifecycle and workflow flags.
- Normalize Project source metadata and source exclusions.

Do not implement API route rewrites, frontend screens, generation workers, or design-system work in this phase.

Add focused backend tests or smoke checks proving:
- migrations apply cleanly from an empty database,
- a Project can have two Documents,
- both Documents can reference the same Project-level Analysis snapshot,
- model imports do not create circular dependency errors.

Run the relevant backend tests and report exactly what passed or failed.
```

## Phase 2 — Project And Nested Document APIs

```text
Read docs/CANONICAL_EXECUTION_PROMPT.md first.
Then read only CONTEXT.md, frontend/VISUAL_SPEC.md, and docs/adr/0001-projects-contain-multiple-documents.md.

Implement Phase 2 only: Project And Nested Document APIs.

Scope:
- Replace singular Document assumptions with explicit nested routes under /projects/{project_id}/documents/{document_id}/...
- Project creation creates only the source-connected container; it must not auto-create a generic Document or default Sections.
- Add list/create/get/update Document endpoints under Project.
- Add nested Section tree endpoints under Document.
- Ensure every nested Document route authorizes through the parent Project organization membership.
- Return Document setup stage, derived Document status, freshness, Template, progress, tags, and last activity where appropriate.

Do not implement Analysis rewrites, Template recommendation logic, generation runs, freshness detection, or frontend redesign work in this phase.

Add focused API tests proving:
- Project creation does not create a Document,
- users can create and list multiple Documents in one Project,
- nested Document routes reject access for users outside the Project organization,
- legacy singular /projects/{id}/document behavior is removed or clearly isolated if temporarily unavoidable.

Run the relevant backend tests and report exactly what passed or failed.
```

## Phase 3 — Shared Analysis And Source Health

```text
Read docs/CANONICAL_EXECUTION_PROMPT.md first.
Then read only CONTEXT.md, frontend/VISUAL_SPEC.md, and docs/adr/0001-projects-contain-multiple-documents.md.

Implement Phase 3 only: Shared Analysis And Source Health.

Scope:
- Make source connection and Analysis Project-scoped.
- Store normalized GitHub/repository metadata on Project.
- Support GitHub-first source connection, repository URL fallback, ZIP fallback, and secondary start-without-source behavior.
- Persist Project-level source exclusion rules.
- Record each Analysis snapshot's effective exclusions.
- Treat Analysis snapshots as immutable, with one current Project snapshot.
- Expose progressive Analysis facts and partial-failure metadata.
- ZIP uploads create comparable snapshots but do not support automatic sync.

Do not implement Template Recommendations, Outline Proposals, Generation Runs, frontend journey screens, or design-system work in this phase.

Add tests proving:
- a Project can have multiple Analysis snapshots,
- only one snapshot is current,
- effective exclusions are preserved per snapshot,
- partial Analysis can preserve available facts and disclose unavailable facts.

Run the relevant backend tests and report exactly what passed or failed.
```

## Phase 4 — Template Recommendations And Document Setup

```text
Read docs/CANONICAL_EXECUTION_PROMPT.md first.
Then read only CONTEXT.md, frontend/VISUAL_SPEC.md, and docs/adr/0001-projects-contain-multiple-documents.md.

Implement Phase 4 only: Template Recommendations And Document Setup.

Scope:
- Expand Template data to include purpose, intended audience, expected outcome, compatible repository traits, estimated generation scope, outline preview, and guidance/system prompt.
- Implement rule-based Template Recommendations from Project Analysis facts without requiring a Provider credential.
- Persist Template Recommendations per Document setup with basis enum: rule_based, ai_personalized, custom_outline_seeded.
- Add AI-personalized recommendation path only behind Active provider checks and provider usage recording.
- Support Custom Outline creation when built-in Templates do not fit.
- Add Document-owned Outline Proposals with draft, approved, and superseded states.
- Approving an Outline Proposal materializes editable Sections and preserves the approved proposal as immutable.
- Support Clarification Requests during Outline review and allow skipping with affected Sections and confidence tradeoff.

Do not implement prose generation, freshness detection, full frontend journey, or design-system enforcement in this phase.

Add tests proving:
- rule-based recommendations work without Provider credential,
- AI-personalized recommendations require an Active provider,
- recommendations are persisted and resumable,
- approving an Outline Proposal creates Sections and keeps the approved proposal immutable,
- Document setup stage can resume at template selection, outline review, and generation choice.

Run the relevant backend tests and report exactly what passed or failed.
```

## Phase 5 — Generation Runs, Usage, And Review States

```text
Read docs/CANONICAL_EXECUTION_PROMPT.md first.
Then read only CONTEXT.md, frontend/VISUAL_SPEC.md, and docs/adr/0001-projects-contain-multiple-documents.md.

Implement Phase 5 only: Generation Runs, Usage, And Review States.

Scope:
- Implement provider usage estimation before generation, including relative usage, approximate cost, uncertainty, and Section-level breakdown.
- Persist Generation Runs for complete-Document and on-demand Section generation modes.
- Persist child Section tasks with dependencies, status, provider/model actually used, usage, and errors.
- Use limited provider-aware parallelism for complete-Document generation.
- Generate foundational Sections before dependent Sections when dependencies exist.
- If a foundational task fails, pause only dependent tasks.
- Implement provider failover prompt state for quota, sustained rate-limit, or outage conditions only.
- Generated prose enters as Generated Draft.
- Manual edits do not automatically mark a draft reviewed.
- Explicit acceptance marks generated or manual content reviewed and records review metadata plus Analysis snapshot.

Do not implement stale detection, source-grounded update diffs, frontend editor redesign, or design-system work in this phase.

Add tests proving:
- Generation Runs and Section tasks are durable,
- failed foundational tasks pause only dependents,
- usage is recorded at run and task level,
- provider failover requires explicit confirmation,
- reviewed state is explicit and not triggered by normal edits.

Run the relevant backend tests and report exactly what passed or failed.
```

## Phase 6 — Freshness, Evidence, Activity, Quality, Export

```text
Read docs/CANONICAL_EXECUTION_PROMPT.md first.
Then read only CONTEXT.md, frontend/VISUAL_SPEC.md, and docs/adr/0001-projects-contain-multiple-documents.md.

Implement Phase 6 only: Freshness, Evidence, Activity, Quality, Export.

Scope:
- Persist Evidence References connecting Sections or generated claims to Analysis artifacts, source paths, symbols, and optional line-range hints.
- Detect Potentially Stale Sections by comparing reviewed Section evidence against newer Analysis snapshots.
- Propose source-grounded diffs for stale Sections and require explicit accept/reject.
- Move Quality Reports to Document scope.
- Move export settings to Document scope, with optional organization defaults.
- Export one Document at a time by default.
- Make external sharing Document-scoped by default.
- Scope collaboration notes to Documents and Sections.
- Persist typed Activity Events and derive Project Activity from them.
- Add GitHub-style weighted activity heatmap data.
- Update global search to span accessible Projects and Documents with filters for Project, Document, tag, status, and freshness.

Do not implement the full frontend redesign or design-system enforcement in this phase.

Add tests proving:
- new Analysis snapshots can mark only affected reviewed Sections potentially stale,
- stale update proposals require explicit acceptance,
- quality and export endpoints require Document id,
- Activity excludes routine autosave/edit noise,
- heatmap intensity is derived from weighted Activity Events.

Run the relevant backend tests and report exactly what passed or failed.
```

## Phase 7 — Design System Foundation

```text
Read docs/CANONICAL_EXECUTION_PROMPT.md first.
Then read only CONTEXT.md, frontend/VISUAL_SPEC.md, and docs/adr/0001-projects-contain-multiple-documents.md.

Implement Phase 7 only: Design System Foundation.

Scope:
- Establish the calm developer workspace design system before rebuilding screens.
- Replace inconsistent Inter/Geist setup with the documented Geist Sans and Geist Mono system.
- Define semantic tokens for canvas, workspace, sidebar, panel, elevated overlay, separators, text hierarchy, interaction accent, and workflow statuses.
- Implement governed variants for shared UI primitives: Button, Badge/status, Notice/banner, Surface, Input/select, Tabs/segmented control, Progress, Empty state, Tooltip/popover/dialog.
- Add automated enforcement for raw product UI colors, arbitrary visual values, arbitrary radii/shadows, and recurring style patterns outside governed variants.
- Preserve computed inline style exceptions only for runtime values such as progress width, editor geometry, and user-selected export branding.
- Meet WCAG 2.2 AA for core primitives: keyboard operation, visible focus, contrast, reduced motion, and non-color-only status indicators.

Do not redesign the full first-Document journey or editor in this phase except as needed to prove primitives.

Add tests or checks proving:
- npm run lint catches hardcoded product UI colors in changed files,
- shared variants can render core states without local restyling,
- focus and contrast are acceptable for core primitives.

Run frontend lint/build or the closest available verification and report exactly what passed or failed.
```

## Phase 8 — First-Document Journey Frontend

```text
Read docs/CANONICAL_EXECUTION_PROMPT.md first.
Then read only CONTEXT.md, frontend/VISUAL_SPEC.md, and docs/adr/0001-projects-contain-multiple-documents.md.

Implement Phase 8 only: First-Document Journey Frontend.

Scope:
- Build the focused full-page first-Document journey using the new backend APIs and design system.
- Include persistent progress and a live summary rail that collapses to a review drawer on smaller screens.
- Implement GitHub-first source connection with URL, ZIP, and start-without-source fallback paths.
- Infer Project name from repository metadata and collect optional human context after connection.
- Show progressive Analysis facts and partial-failure messaging.
- Show rule-based Template Recommendations without Provider credential.
- Distinguish rule-based recommendations from AI-personalized recommendations.
- Provide embedded Provider credential setup only when the maintainer chooses an AI-powered action.
- Implement editable Outline review with Section purpose, repository evidence, add/remove/rename/reorder, and Clarification Requests.
- Implement Generation mode choice with provider usage estimate.
- Enter the Document editor as soon as useful work is available.
- Ensure setup can resume after reload from persisted Document setup stage.

Do not redesign the global Project workspace or full editor layout beyond the entry points required for this journey.

Add frontend tests or flow checks proving:
- a maintainer can create a Project, run Analysis, choose Template, approve Outline, choose on-demand generation, and reach editor,
- the same flow can resume after reload,
- source-less path clearly disables Analysis-grounded features,
- Provider credential setup does not redirect away from the flow.

Run frontend lint/build or the closest available verification and report exactly what passed or failed.
```

## Phase 9 — Project Workspace And Editor Integration

```text
Read docs/CANONICAL_EXECUTION_PROMPT.md first.
Then read only CONTEXT.md, frontend/VISUAL_SPEC.md, and docs/adr/0001-projects-contain-multiple-documents.md.

Implement Phase 9 only: Project Workspace And Editor Integration.

Scope:
- Build global Home with recent and active Projects first, followed by searchable Projects library.
- Support list/grid preferences per user and per surface.
- Restrict global navigation to Home, Projects, Templates, and Settings.
- Build Project workspace with Documents, Source, and Activity sub-navigation.
- Build Document library with list/grid toggle, search, sort, lightweight tags, status, freshness, Template, progress, and last activity.
- Build Source page showing repository metadata, sync status, Analysis snapshots, and exclusions.
- Build Activity page using typed timeline plus GitHub-style weighted heatmap.
- Integrate editor with the multi-Document model.
- Make Document the dominant workspace.
- Make Outline collapsible.
- Make AI contextual, with an optional assistant panel for longer conversations.
- Show generated draft, reviewed, stale, generating, and failed states clearly.
- Show source evidence markers that open contextual details.
- Resume repeat visits to the last active Section.
- Show source-change notices non-blockingly.

Do not introduce team queues, nested folders, batch export, or automatic provider failover in this phase.

Add frontend tests or flow checks proving:
- a Project with multiple Documents is navigable without ambiguity,
- Document library list/grid preferences persist correctly,
- repeat opening a Document resumes the last active Section,
- meaningful source changes show non-blocking notices,
- editor no longer assumes a permanent equal-weight three-panel layout.

Run frontend lint/build or the closest available verification and report exactly what passed or failed.
```
