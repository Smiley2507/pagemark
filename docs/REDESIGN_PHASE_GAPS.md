# Gap-Fill Execution Plan

This plan closes the remaining product gaps introduced while the codebase was still being shaped by multiple sources of truth.
It uses only `CONTEXT.md`, `frontend/VISUAL_SPEC.md`, and `docs/adr/0001-projects-contain-multiple-documents.md` as normative product sources.

## Summary

The current backend is closer to the intended domain model than the frontend, but both still carry legacy assumptions.
The highest-risk issue is not polish. It is that several screens and routes still behave like the older product, so the app reads as a set of good parts that do not yet form the calm, document-first workspace described in the canonical docs.

This plan repairs the product in the order that reduces drift fastest:
1. normalize backend contracts and remove stale assumptions,
2. rebuild the authenticated dashboard/workspace shell,
3. align public entry and onboarding surfaces,
4. harmonize the remaining editor and utility surfaces,
5. enforce the system so drift does not reappear.

## Phase 1 - Backend Contract Cleanup

Goal: remove stale data-model assumptions before more frontend work lands on them.

Key changes:
- Stop treating `completion_pct` as stored truth for Projects; derive Project summary state from Documents and Sections.
- Remove or quarantine stale `project.template_id` assumptions from active services and routes.
- Align project/document responses with the multi-Document model from the ADR.
- Keep Section review, generation, and freshness state explicit and Document-scoped.
- Preserve the backend as the contract source for the frontend, not a parallel design space.

Implementation notes:
- Update the Project and Document response schemas so they expose the derived state the UI actually needs.
- Remove legacy singular-document assumptions from active API paths rather than extending them.
- Make sure the domain names in `CONTEXT.md` are reflected in the API and service layers.

Tests:
- project summary values are derived rather than stored as a second truth,
- stale template assumptions no longer appear in active generation/analysis paths,
- nested Document access still respects Project membership and ownership.

## Phase 2 - Dashboard And Workspace Shell

Goal: make the authenticated app feel like one governed system, not a collection of separately styled screens.

Key changes:
- Rebuild global home/dashboard around recent and active Projects, resume-work signals, and the searchable Project library.
- Replace KPI-card framing and generic admin-dashboard composition with the calmer workspace hierarchy from `frontend/VISUAL_SPEC.md`.
- Make the sidebar compact, dark-neutral, and stable across project contexts.
- Make the Project workspace document-first, with Documents, Source, and Activity as the primary sub-navigation.
- Replace ad hoc screen-level styling with governed primitives and semantic tokens.

Implementation notes:
- Home should prioritize recent work, active generation, sections needing input, and source changes.
- Project views should surface document generation/review/freshness state before analytics noise.
- Workspace chrome should be restrained; depth should come from tonal surfaces and separators, not decorative cards.

Tests:
- dashboard and workspace render through shared primitives without local restyling,
- keyboard focus and contrast remain acceptable in the shell surfaces,
- list/grid, search, and navigation states still work after the shell refresh.

## Phase 3 - Public Entry And First-Document Journey

Goal: align landing, login, and the initial create-project flow with the same professional SaaS direction.

Key changes:
- Retune landing and auth pages so they match the product system, not a separate marketing layer.
- Rebuild the first-Document journey as the real product flow: source connection, progressive Analysis, Template recommendation, Outline review, generation choice, and editor entry.
- Keep the live summary rail and progressive trust-building behavior central.
- Make provider usage and generation cost explicit before any credit-consuming action.

Implementation notes:
- GitHub-first source connection remains primary, with URL, ZIP, and start-without-source fallback paths preserved where the canonical docs allow them.
- The onboarding flow should reveal useful work as soon as possible instead of forcing a generic wizard rhythm.
- Public pages should still share the same semantic tokens, typography, and spacing system as the authenticated workspace.

Tests:
- onboarding flow reaches the editor through the intended sequence,
- provider-less paths still allow static Analysis and rule-based recommendations,
- landing and auth screens visually match the product system direction.

## Phase 4 - Editor, Settings, And Utility Surfaces

Goal: finish the remaining surfaces so the product feels cohesive rather than partially redesigned.

Key changes:
- Bring the editor to the calm, document-first visual language from the spec.
- Replace leftover amber/green review banners, status chips, and legacy panel treatment with governed states.
- Align settings, templates, analysis, export, and activity views with the same token system and interaction rules.
- Keep generated prose visibly reviewable until explicitly accepted.

Implementation notes:
- The editor should continue to treat the Document as the dominant workspace and AI as a secondary tool.
- Utility modals, overlays, and banners should use governed variants rather than one-off styling.
- Maintain the non-color-only workflow status conventions defined in the visual spec.

Tests:
- review state is explicit and not triggered by normal edits,
- generated drafts remain reviewable until acceptance,
- core utility surfaces render through shared primitives without reintroducing raw styling patterns.

## Phase 5 - Enforcement And Regression Protection

Goal: prevent the codebase from drifting back into multiple visual and product sources of truth.

Key changes:
- Keep the canonical docs as the only normative references for product decisions.
- Enforce raw product color bans, arbitrary visual values, arbitrary radii/shadows, and recurring pattern violations.
- Preserve only narrow runtime inline-style exceptions such as progress widths, editor geometry, and export branding values.
- Keep WCAG 2.2 AA checks in the normal verification path for core primitives.

Tests and checks:
- lint catches hardcoded product UI colors in changed files,
- governed primitives cover core states without local restyling,
- focus, contrast, reduced motion, and status signaling remain acceptable.

## Assumptions

- `docs/REDESIGN_PHASE_GAPS.md` now serves as the new execution plan, not as a gap analysis.
- `docs/REDESIGN_IMPLEMENTATION_PLAN.md` remains historical guidance and does not override the canonical docs.
- Backend cleanup comes before visible shell work because stale contract assumptions can otherwise keep leaking into the UI.
- Public entry pages are in scope because the product mismatch is visible there as well, not only inside the authenticated app.

