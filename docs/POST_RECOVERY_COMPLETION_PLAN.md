# Pagemark Post-Recovery Completion Plan

## Summary

This plan completes the remaining recovery work first, then adds the multitenancy, member-management, notification, sharing, and audit-log work needed to make Pagemark feel like a complete professional SaaS product.

Product truth remains:

- `CONTEXT.md`
- `frontend/VISUAL_SPEC.md`
- `docs/adr/0001-projects-contain-multiple-documents.md`

Execution rules:

- Implement one phase at a time.
- Keep each phase independently testable and committable.
- Do not reintroduce old Project/Document models or duplicate settings surfaces.
- Keep frontend changes inside governed design-system primitives.

## Phase 1: AI Integration Completion

Finish wiring provider-backed AI after the Anthropic, Google, and OpenCode Go provider work.

Key changes:

- Audit all AI-consuming paths: project analysis outline, template recommendation, document generation, section chat/refine, quality analysis, phrasing, and model selection.
- Ensure every provider-consuming path uses the active provider adapter, never direct Anthropic-only logic.
- Add real-key smoke instructions for Anthropic, Google, and OpenCode Go, but keep CI mocked.
- Improve AI error messages so provider validation, model unsupported, quota/rate-limit, and malformed response failures are distinct.

Acceptance:

- OpenCode Go works through the same provider path as Anthropic and Google where the operation is supported.
- No route rejects a valid active provider merely because it is not Anthropic.
- Provider errors are clear enough for users to fix settings or retry later.

Tests:

- Backend tests proving OpenCode Go works through outline, generation, chat, and section actions with mocked provider calls.
- Frontend lint/build.
- Manual real-key checklist for Settings -> save key -> autoload models -> run one editor AI action.

## Phase 2: Document Creation Repair

Fix the broken new-Document flow now that Projects are containers and Documents are items inside them.

Key changes:

- Diagnose `/document-setup?projectId=...` from the Project Document library.
- If `projectId` exists, create a Document inside the existing Project instead of creating a new Project.
- Keep first-Project creation behavior separate from additional-Document creation.
- After creating a Document, route to the correct setup stage or editor based on the chosen setup path.
- Preserve activity event `document_created`.

Acceptance:

- Existing Project -> New Document creates only a Document.
- New Project onboarding still creates Project plus first Document.
- Incomplete Document setup can be resumed.

Tests:

- Existing Project -> New Document -> setup/editor browser path.
- New Project -> first Document browser path.
- Backend document setup tests.
- Frontend lint/build.

## Phase 3: Dashboard And Settings Cleanup

Remove remaining wordiness, dead settings, unclear badges, and inconsistent dashboard cards.

Key changes:

- Audit dashboard and settings screens for helper text that does not explain a costly, irreversible, provider-consuming, or confusing action.
- Remove unclear badges such as "fresh" and "active" where they are decorative or redundant.
- Keep stat cards compact and consistent.
- Hide or implement settings pages that still have no backend-backed behavior.
- Keep AI Providers as the only model/provider settings surface.

Acceptance:

- Dashboard and settings feel compact and operational.
- Settings has no visible empty/stub sections.
- AI provider/model settings remain single-sourced.

Tests:

- Frontend lint/build and design-system checks.
- Workspace check proving no duplicate AI provider/model settings surface.
- Visual browser pass over Home, Projects, Project workspace, Settings.

## Phase 4: Notifications And Notification Settings

Make notifications useful and configurable.

Key changes:

- Add notification preferences in Settings with toggles for: member activity, document sharing, document comments/notes, generation completion/failure, quality failures, stale sections, source sync, and invites.
- Store preferences per user, scoped by organization where needed.
- Keep notifications derived from meaningful events, not routine autosaves.
- Add unread badge behavior and periodic refresh or polling.
- Wire member/admin events into notifications after Phases 5 and 6.

Acceptance:

- Users can control which notification categories they receive.
- Disabled categories do not appear in the notification popover.
- Unread counts update and clear predictably.

Tests:

- Preferences persist and default sensibly.
- Notification filtering honors preferences.
- Frontend lint/build and backend preference tests.

## Phase 5: GitLab-Style Organization Member Management

Finish multitenant organization management.

Key changes:

- Rebuild Members settings as an owner/admin screen with searchable member table.
- Support search by name/email, filter by role/status, role change, remove member, resend/cancel pending invite.
- Keep email invite flow, but improve UX and return enough data to show pending invites.
- Use governed UI primitives; avoid raw local table/card styling.
- Record admin actions in `AuditLog`.

Backend:

- Add list/search endpoint if current `/members` response is insufficient.
- Add pending invite management endpoints if needed.
- Preserve role authorization: Admin can manage all, Project Manager can view but not mutate unless existing policy says otherwise.

Acceptance:

- Admins can manage organization members from one professional screen.
- Pending invites are visible and actionable.
- Non-admin users cannot mutate members.

Tests:

- Admin can search, invite, resend/cancel pending invite, update role, remove member.
- Non-admin cannot mutate members.
- Audit log records member actions.
- Frontend lint/build and backend org tests.

## Phase 6: Organization Join Links

Add shareable organization join tokens.

Key changes:

- Add `OrganizationJoinLink` model/table with token hash, org id, default role, expiry, max uses, use count, revoked timestamp, created_by.
- Add admin endpoints to create, list, revoke, and accept join links.
- Accepting a valid link adds the current user to the organization with the configured role.
- Surface join links in Members settings as a separate section from email invites.
- Log create/revoke/accept actions and feed accepted joins into member notifications.

Acceptance:

- Organization admins can generate and revoke shareable join links.
- Users can join via valid links.
- Invalid, expired, revoked, and exhausted links fail safely.

Tests:

- Create link, accept link, revoke link, expired link, max-use link.
- Cannot use revoked/expired/exhausted token.
- Non-admin cannot create/revoke.
- Frontend lint/build and backend org join-link tests.

## Phase 7: Document Sharing With Organization Members

Implement v1 sharing as organization-member sharing only.

Key changes:

- Add Document-level sharing permissions for org members: view, comment, edit.
- Do not implement public links in v1.
- Document owner/admin can grant, update, revoke member access.
- Nested Document routes must authorize through Project membership plus Document share rules.
- Add Share dialog in editor/document library with member search and permission controls.
- Add share notifications and audit/activity entries.

Backend:

- Add `DocumentShare` model/table with document id, user id or member id, permission, created_by, created_at, revoked_at.
- Add endpoints to list shares, add/update share, revoke share.
- Enforce permission checks consistently for read/comment/edit operations.

Acceptance:

- Sharing one Document does not expose sibling Documents in the same Project.
- View-only users cannot edit.
- Edit users can use the existing editor paths.
- Revoked users lose access.

Tests:

- Viewer can read shared Document but cannot edit.
- Editor can edit shared Document.
- Revoked access loses access.
- Sharing one Document does not expose sibling Documents.
- Frontend lint/build and backend authorization tests.

## Phase 8: Audit Log And Activity Reconciliation

Fix the Settings Activity Log by separating admin audit from Project activity.

Key changes:

- Keep `ActivityEvent` for Project/Document workflow history.
- Keep `AuditLog` for administrative and security history.
- Expand `AuditLog` coverage for org create/update, member invite/accept/remove/role change, join link create/revoke/accept, document share grant/update/revoke, API key actions, provider credential actions.
- Rename Settings "Activity Log" to "Audit Log" if it remains administrative.
- If users need personal account activity, add a separate "Account activity" view backed by audit events involving the user.
- Do not mix Project Activity heatmap events into admin Audit Log.

Acceptance:

- Settings Audit Log shows real admin/security history after normal organization actions.
- Project Activity remains workflow-only.
- The two concepts are not mixed in UI copy or backend naming.

Tests:

- Audit log receives all admin/security actions.
- Project Activity remains workflow-only.
- Settings audit log shows more than the seed record after actions.
- Frontend lint/build and backend audit tests.

## Phase 9: Final Browser Verification And Legacy Retirement

Verify end-to-end SaaS behavior and remove remaining prototype residue.

Key changes:

- Browser-test unauthenticated landing -> auth -> create Project -> create Document -> editor.
- Browser-test members, invites, join links, notifications, sharing, audit log, and document creation.
- Remove unreachable legacy components/routes only after replacement behavior is verified.
- Update `workspace-check.mjs` to lock canonical routes and prevent reintroduction of duplicate settings/model/member surfaces.
- Create final manual QA checklist in docs.

Acceptance:

- The product works end-to-end as one SaaS workspace.
- Old conflicting routes/components are retired or redirected.
- Browser verification covers the core workflow.

Tests:

- Frontend lint/build.
- Relevant backend suites.
- Browser verification for the core paths above.
- No hardcoded product colors or arbitrary local visual values in changed frontend files.

## Assumptions And Defaults

- V1 Document sharing is organization-member only: view/comment/edit.
- Public links and email-based external Document sharing are deferred.
- Member management follows GitLab-style admin tables using existing Pagemark roles: Admin, Project Manager, Developer, Technical Writer, Viewer.
- Audit Log is administrative/security history; Project Activity remains workflow history.
- Notification settings are per user, with organization scoping where events are organization-specific.
- Join-link tokens are stored hashed, revocable, expirable, and optionally max-use limited.
- Each phase should update this plan's status and keep `docs/POST_RECOVERY_COMPLETION_PHASE_PROMPTS.md` aligned when implemented.
