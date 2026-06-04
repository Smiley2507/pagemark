# Pagemark Redesign Implementation Plan

This plan implements the product direction captured in `CONTEXT.md`, `frontend/VISUAL_SPEC.md`, and `docs/adr/0001-projects-contain-multiple-documents.md`.

The core shift is from a single-document project editor to a source-connected Project workspace containing multiple purpose-specific Documents. Implement backend schema and contracts first, then rebuild the first-Document journey and design system on top of them.

## Guiding Constraints

- Project is the source-connected workspace.
- Document owns Template choice, setup stage, Outline Proposals, Sections, generation, quality, export settings, review, sharing, and freshness.
- Analysis is an immutable Project-level snapshot reused by all Documents.
- The first redesign slice is the complete first-Document journey.
- Static Analysis and rule-based Template Recommendations work without a Provider credential.
- AI-personalized recommendations, AdaptTemplate, and prose generation require an Active provider.
- No long-lived legacy compatibility layer is needed because there are no existing Project records to preserve.

## Phase 1 — Domain Schema Foundation

Goal: make the data model match the new product model before changing behavior.

Backend targets:

- `backend/app/models/project.py`
- `backend/app/models/document.py`
- `backend/app/models/analysis.py`
- `backend/app/models/template.py`
- new model files as needed:
  - `outline_proposal.py`
  - `template_recommendation.py`
  - `generation.py`
  - `evidence.py`
  - `activity.py`
  - `workspace_preference.py`
- `backend/app/models/__init__.py`
- Alembic migration under `backend/alembic/versions/`

Required model changes:

- Remove Document-specific fields from Project:
  - `template_id`
  - `completion_pct` as stored truth
  - `export_settings`
- Normalize Project source metadata:
  - provider
  - owner
  - repository name
  - selected branch
  - default branch
  - visibility
  - last synced commit
  - provider-specific metadata JSON
- Add Project-level source exclusion rules.
- Keep Analysis Project-scoped and immutable.
- Add `is_current` or equivalent current-snapshot pointer.
- Store each Analysis snapshot’s effective exclusions.
- Move Template ownership to Document:
  - `template_id`
  - custom outline metadata
  - setup stage
  - purpose
  - audience
  - context
  - tags
  - export settings
- Add Outline Proposal records:
  - document id
  - analysis id
  - basis
  - status: draft, approved, superseded
  - outline JSON
  - explanation/evidence JSON
  - immutable approval metadata
- Split Section state:
  - content lifecycle: empty, generated_draft, reviewed
  - workflow flags: needs_input, generating, failed, potentially_stale
- Add Section review metadata:
  - reviewed by
  - reviewed at
  - reviewed against analysis id
- Add Evidence References:
  - section id
  - optional claim anchor
  - analysis id
  - artifact type
  - path
  - symbol
  - optional line range hint
  - metadata JSON
- Add Template Recommendations:
  - document id
  - analysis id
  - template id nullable
  - basis: rule_based, ai_personalized, custom_outline_seeded
  - score
  - explanation
  - supporting facts JSON
  - provider usage reference nullable
- Add Generation Runs and Section tasks:
  - document id
  - generation mode
  - intended provider/model
  - run status
  - estimates and actual usage
  - failover state
  - child task status, dependencies, provider/model actually used, usage, errors
- Add typed Activity Events:
  - project id
  - type
  - weight
  - optional analysis/document/section/generation references
  - payload JSON
- Add per-user workspace preferences:
  - user id
  - surface
  - optional context id
  - preferences JSON

Acceptance checks:

- Migrations apply cleanly from an empty database.
- Model imports work without circular dependency errors.
- Tests or smoke scripts can create a Project with two Documents sharing one Analysis snapshot.

## Phase 2 — Project And Nested Document APIs

Goal: replace singular document assumptions with explicit nested Document contracts.

Backend targets:

- `backend/app/routers/projects.py`
- `backend/app/routers/documents.py`
- `backend/app/routers/sections.py`
- `backend/app/routers/export.py`
- `backend/app/routers/quality.py`
- `backend/app/routers/search.py`
- `backend/app/routers/notes.py`
- `backend/app/routers/clarification.py`
- `backend/app/dependencies.py`
- `backend/app/schemas/project.py`
- `backend/app/schemas/section.py`
- new `backend/app/schemas/document.py`

API shape:

- `POST /projects`
  - creates Project source container only.
- `GET /projects`
  - returns recent/active signals and source health summary.
- `GET /projects/{project_id}`
  - returns Project workspace summary.
- `GET /projects/{project_id}/documents`
  - list Documents with status, freshness, setup stage, tags, Template, progress, and last activity.
- `POST /projects/{project_id}/documents`
  - creates draft Document setup record.
- `GET /projects/{project_id}/documents/{document_id}`
  - returns Document summary.
- `PATCH /projects/{project_id}/documents/{document_id}`
  - updates purpose, audience, tags, setup stage, export settings, etc.
- `GET /projects/{project_id}/documents/{document_id}/sections`
  - replaces `/projects/{id}/document`.
- `POST/PATCH` nested Section routes under Document where needed.

Authorization:

- Every nested Document route verifies Project organization membership.
- Shared document-token access remains separate from authenticated Project membership.

Required behavior changes:

- Project creation no longer creates a default Document or default Sections.
- Document setup can be resumed from persisted setup stage.
- Document status is derived from Section states.
- Project completion/progress is derived from Documents, not stored as a single Project truth.

Acceptance checks:

- Legacy singular `/projects/{id}/document` usage is removed or isolated behind temporary internal adapters only if unavoidable.
- Frontend API clients can list Project Documents and fetch a specific Document tree.
- Unauthorized users cannot access nested Documents through guessed ids.

## Phase 3 — Shared Analysis And Source Health

Goal: make source connection and Analysis Project-scoped, progressive, resumable, and reusable by every Document.

Backend targets:

- `backend/app/routers/projects.py`
- `backend/app/routers/git.py`
- `backend/app/routers/uploads.py`
- `backend/app/routers/analysis.py` if split out
- `backend/app/services/analysis_service.py`
- `backend/app/workers/analysis_worker.py`
- `backend/app/services/git_service.py`
- `backend/app/services/github_service.py`
- `backend/app/schemas/analysis.py`

Required behavior:

- GitHub-first source connection with normalized repository metadata.
- Repository URL and ZIP fallback remain supported.
- Start-without-source remains secondary.
- Smart exclusions are saved at Project level.
- Each Analysis snapshot records effective exclusions.
- Analysis progress exposes completed facts progressively:
  - stack/languages
  - file tree summary
  - endpoints
  - dependency/complexity facts
  - unsupported or failed stages
- Partial Analysis can complete with warnings and unavailable-results metadata.
- Current Analysis snapshot is updated only after successful enough ingest.
- ZIP uploads create comparable snapshots but no automatic sync.

Acceptance checks:

- A Project can have multiple Analysis snapshots.
- Documents can reference any current Analysis snapshot for recommendations and evidence.
- Partial Analysis responses disclose missing facts.

## Phase 4 — Template Recommendations And Document Setup

Goal: implement guided first-Document creation after Analysis.

Backend targets:

- `backend/app/routers/templates.py`
- `backend/app/routers/documents.py`
- new recommendation service, for example:
  - `backend/app/services/template_recommendation_service.py`
- `backend/app/services/analysis_service.py`
- `backend/app/services/ai_doc_service.py`
- `backend/app/prompts/outline.py`
- `backend/app/schemas/template.py`

Required behavior:

- Built-in Templates include:
  - purpose
  - intended audience
  - expected outcome
  - compatible repository traits
  - estimated generation scope
  - outline preview
  - guidance/system prompt
- Rule-based Template Recommendations work from Analysis facts without provider usage.
- AI-personalized recommendations require Active provider and record usage.
- Recommendation basis enum:
  - rule_based
  - ai_personalized
  - custom_outline_seeded
- Persist recommendations per Document setup.
- Allow Custom Outline creation when built-ins do not fit.
- Allow promoting a proven Custom Outline to reusable Template later.
- Create Outline Proposals per Document.
- Approving an Outline Proposal materializes Sections and preserves the approved proposal.
- Clarification Requests appear during Outline review and can be skipped with explicit affected Sections.

Acceptance checks:

- A Document can resume at template selection, outline review, or generation choice.
- Rule-based recommendation path works with no Provider credential.
- AI path prompts for credential only when selected.
- Approved Outline Proposal is immutable after materialization.

## Phase 5 — Generation Runs, Usage, And Review States

Goal: make generation durable, cost-transparent, and Section-review aware.

Backend targets:

- `backend/app/routers/ai.py`
- `backend/app/routers/documents.py`
- `backend/app/routers/sections.py`
- `backend/app/services/ai_doc_service.py`
- `backend/app/services/ai_service.py`
- `backend/app/ai_providers.py`
- Celery worker for generation if split from current AI calls
- `backend/app/services/version_service.py`

Required behavior:

- Estimate provider usage before generation:
  - relative usage
  - approximate cost
  - uncertainty
  - Section-level breakdown
- Create persisted Generation Run for both modes:
  - complete Document
  - Sections on demand
- Create child Section tasks with dependencies.
- Complete generation uses limited provider-aware parallelism.
- Foundational Sections generate first when dependencies exist.
- Failed foundational tasks pause only dependent tasks.
- Provider failover:
  - run records intended provider/model
  - each task records actual provider/model
  - pause and ask confirmation before failover
  - offer only for quota/rate-limit/outage conditions
- Generated prose enters Section as generated draft.
- Manual edits do not mark generated drafts reviewed.
- Maintainer explicitly accepts generated or manual content as reviewed.
- Acceptance records review metadata and Analysis snapshot.

Acceptance checks:

- A complete generation run can be resumed after process restart.
- Per-Section retries do not restart the whole run.
- Cost and token records exist at run and task level.
- Reviewed state remains explicit after edits.

## Phase 6 — Freshness, Evidence, Activity, Quality, Export

Goal: support ongoing maintenance after the first useful Document exists.

Backend targets:

- `backend/app/routers/quality.py`
- `backend/app/routers/export.py`
- `backend/app/routers/search.py`
- `backend/app/routers/notes.py`
- `backend/app/services/export_service.py`
- `backend/app/workers/quality_worker.py`
- new services:
  - freshness detection
  - activity event recording
  - evidence reference handling

Required behavior:

- Evidence References connect generated claims and Sections to Analysis artifacts.
- Reviewed Sections can become potentially stale when relevant evidence changes.
- Stale updates are proposed as diffs and require explicit acceptance.
- Quality reports are Document-level.
- Export settings are Document-level with optional org defaults.
- Exports produce one Document at a time.
- Sharing is Document-scoped by default.
- Notes/comments are Document-level and Section-level.
- Activity Events are persisted and typed.
- Activity heatmap uses weighted meaningful events.
- Search spans accessible Projects and Documents with filters.

Acceptance checks:

- New Analysis snapshot can mark only affected reviewed Sections as potentially stale.
- Export and quality endpoints require document id.
- Project Activity excludes autosave/edit noise.
- Heatmap data is derived from typed Activity Events.

## Phase 7 — Design System Foundation

Goal: establish enforceable UI primitives before rebuilding the journey.

Frontend targets:

- `frontend/src/index.css`
- `frontend/tailwind.config.cjs`
- `frontend/src/components/ui/*`
- `frontend/src/lib/utils.ts`
- ESLint/Tailwind enforcement config

Required work:

- Replace inconsistent Inter/Geist setup with the documented Geist system.
- Define semantic tokens for:
  - canvas
  - workspace
  - sidebar
  - panel
  - elevated overlay
  - separators
  - text hierarchy
  - interaction accent
  - status states
- Implement governed component variants:
  - Button
  - Badge/status
  - Notice/banner
  - Surface
  - Input/select
  - Tabs/segmented control
  - Progress
  - Empty state
  - Tooltip/popover/dialog
- Add automated enforcement for:
  - raw product UI hex colors
  - arbitrary colors/radii/shadows outside allowed exceptions
  - component-scoped styling that duplicates governed variants
- Keep computed inline styles only for runtime values:
  - progress width
  - editor geometry
  - user-selected export branding

Acceptance checks:

- `npm run lint` catches hardcoded product UI colors in changed files.
- Shared variants can build the first-document journey without local visual restyling.
- WCAG 2.2 AA contrast and visible focus are checked for core primitives.

## Phase 8 — First-Document Journey Frontend

Goal: implement the first redesign slice end to end.

Frontend targets:

- `frontend/src/App.tsx`
- `frontend/src/pages/NewProject.tsx`
- new first-document journey pages/components, for example:
  - `pages/ProjectCreatePage.tsx`
  - `pages/DocumentSetupPage.tsx`
  - `components/onboarding/SourceStep.tsx`
  - `components/onboarding/AnalysisFactsStep.tsx`
  - `components/onboarding/TemplateRecommendationStep.tsx`
  - `components/onboarding/OutlineReviewStep.tsx`
  - `components/onboarding/GenerationChoiceStep.tsx`
  - `components/onboarding/SetupSummaryRail.tsx`
- API clients:
  - `frontend/src/api/projects.ts`
  - `frontend/src/api/documents.ts`
  - `frontend/src/api/analysis.ts`
  - `frontend/src/api/templates.ts` if split out
  - `frontend/src/api/generation.ts`
- Hooks:
  - `frontend/src/hooks/useProject.ts`
  - `frontend/src/hooks/useDocuments.ts`
  - `frontend/src/hooks/useAnalysis.ts`
  - `frontend/src/hooks/useGeneration.ts`

Required UX:

- Full-page focused workflow.
- Persistent progress.
- Live summary rail, collapsed to drawer on small screens.
- GitHub-first repository selection.
- URL, ZIP, and start-without-source fallback paths.
- Project name inferred from repository metadata.
- Optional context after source connection.
- Progressive Analysis facts with partial failure messaging.
- Rule-based Template Recommendation labels.
- AI-personalized recommendation entry point with embedded Provider credential setup when needed.
- Editable Outline review with evidence and Clarification Requests.
- Generation mode choice with provider usage estimate.
- Enter editor as soon as useful work is available.

Acceptance checks:

- Maintainer can create a Project, run Analysis, choose Template, approve Outline, choose on-demand generation, and reach editor.
- Same flow can be resumed after reload.
- Source-less path clearly disables Analysis-grounded features.
- Provider credential setup does not redirect away from the flow.

## Phase 9 — Project Workspace And Document Editor Integration

Goal: make Projects useful as multi-Document workspaces and keep the Document dominant in the editor.

Frontend targets:

- `frontend/src/pages/Dashboard.tsx`
- `frontend/src/components/dashboard/*`
- new Project workspace page/components
- `frontend/src/pages/Editor.tsx`
- `frontend/src/pages/EditorPage.tsx`
- `frontend/src/components/editor/*`
- `frontend/src/api/search.ts`
- `frontend/src/store/editorStore.ts`

Required UX:

- Global Home:
  - recent and active Projects first
  - searchable Projects library
  - list/grid preference
- Global navigation:
  - Home
  - Projects
  - Templates
  - Settings
- Project workspace:
  - Documents
  - Source
  - Activity
- Document library:
  - list/grid toggle
  - remember preference per user/surface/context
  - search, sort, lightweight tags
  - status, freshness, Template, progress, last activity
- Source page:
  - repository metadata
  - sync status
  - Analysis snapshots
  - exclusions
- Activity page:
  - typed timeline
  - GitHub-style weighted heatmap
- Editor:
  - Document dominates
  - Outline collapsible
  - AI appears as contextual actions plus optional assistant panel
  - generated draft/reviewed/stale states visible
  - source evidence markers open contextual details

Acceptance checks:

- A Project with multiple Documents is navigable without ambiguity.
- Opening a repeat Document resumes last active Section.
- Meaningful source changes show non-blocking notices.
- The editor no longer assumes permanent equal-width three-panel layout.

## Testing And Verification Strategy

Backend:

- Unit tests for derived Document status.
- Unit tests for Section review and stale-state transitions.
- API tests for nested Document authorization.
- API tests for Project creation without auto Document creation.
- API tests for Document setup-stage resume.
- Worker/service tests for Analysis snapshots and effective exclusions.
- Generation Run tests for task retry, dependency pause, and failover prompt state.

Frontend:

- Component tests for design-system variants.
- Flow tests for first-document journey.
- Accessibility checks for keyboard navigation, focus, reduced motion, and non-color status indicators.
- Lint enforcement tests for hardcoded visual values.

Manual smoke:

1. Connect GitHub repository.
2. Run Analysis and observe progressive facts.
3. Use rule-based Template Recommendation without Provider credential.
4. Choose AI action and complete embedded Provider setup.
5. Approve Outline.
6. Choose on-demand generation.
7. Generate one Section.
8. Accept as reviewed.
9. Create a second Document in the same Project.
10. Confirm shared Analysis and separate Document state.

## Explicit Non-Goals For The First Slice

- Full team task queues.
- Project-level batch export.
- Nested folders inside Projects.
- Advanced per-run model selection.
- Automatic provider failover without confirmation.
- Paragraph-level freshness lifecycle.
- Decorative animation or marketing-style motion inside the authenticated workspace.

