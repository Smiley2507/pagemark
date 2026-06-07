# Pagemark Post-Recovery Completion Phase Prompts

Use one prompt per execution phase. Do not combine phases unless explicitly instructed.

## Phase 1: AI Integration Completion

```text
Read docs/CANONICAL_EXECUTION_PROMPT.md first.
Then read only CONTEXT.md, frontend/VISUAL_SPEC.md, docs/adr/0001-projects-contain-multiple-documents.md, docs/POST_RECOVERY_COMPLETION_PLAN.md, and this phase prompt.

Implement Phase 1 only: AI Integration Completion.

Make every provider-consuming AI path use the active provider adapter. Remove Anthropic-only gates unless the provider truly cannot support the operation. Keep CI mocked; add real-key manual smoke instructions for Anthropic, Google, and OpenCode Go.

Run frontend lint/build and relevant backend AI/provider tests. Commit when complete.
```

## Phase 2: Document Creation Repair

```text
Read docs/CANONICAL_EXECUTION_PROMPT.md first.
Then read only CONTEXT.md, frontend/VISUAL_SPEC.md, docs/adr/0001-projects-contain-multiple-documents.md, docs/POST_RECOVERY_COMPLETION_PLAN.md, and this phase prompt.

Implement Phase 2 only: Document Creation Repair.

Fix additional Document creation from a Project workspace. Projects are containers; Documents are items. Do not create a new Project when the setup page is opened with an existing projectId.

Run frontend lint/build, backend document setup tests, and browser verification for Project -> New Document -> setup/editor. Commit when complete.
```

## Phase 3: Dashboard And Settings Cleanup

```text
Read docs/CANONICAL_EXECUTION_PROMPT.md first.
Then read only CONTEXT.md, frontend/VISUAL_SPEC.md, docs/adr/0001-projects-contain-multiple-documents.md, docs/POST_RECOVERY_COMPLETION_PLAN.md, and this phase prompt.

Implement Phase 3 only: Dashboard And Settings Cleanup.
 AI Providers.

Run frontend lint/build and browse
Reduce routine copy, remove unclear badges, hide or implement empty settings, and keep AI provider/model settings single-sourced inr verification for Home, Projects, Project workspace, and Settings. Commit when complete.
```

## Phase 4: Notifications And Notification Settings

```text
Read docs/CANONICAL_EXECUTION_PROMPT.md first.
Then read only CONTEXT.md, frontend/VISUAL_SPEC.md, docs/adr/0001-projects-contain-multiple-documents.md, docs/POST_RECOVERY_COMPLETION_PLAN.md, and this phase prompt.

Implement Phase 4 only: Notifications And Notification Settings.

Add backend-backed notification preferences and make the notification popover honor them. Keep notifications based on meaningful workflow/admin events.

Run frontend lint/build and relevant backend notification/preference tests. Commit when complete.
```

## Phase 5: GitLab-Style Organization Member Management

```text
Read docs/CANONICAL_EXECUTION_PROMPT.md first.
Then read only CONTEXT.md, frontend/VISUAL_SPEC.md, docs/adr/0001-projects-contain-multiple-documents.md, docs/POST_RECOVERY_COMPLETION_PLAN.md, and this phase prompt.

Implement Phase 5 only: GitLab-Style Organization Member Management.

Build a searchable organization member-management screen with invite, pending invite, role, and remove flows. Record admin actions in AuditLog and enforce org roles.

Run frontend lint/build and backend organization authorization tests. Commit when complete.
```

## Phase 6: Organization Join Links

```text
Read docs/CANONICAL_EXECUTION_PROMPT.md first.
Then read only CONTEXT.md, frontend/VISUAL_SPEC.md, docs/adr/0001-projects-contain-multiple-documents.md, docs/POST_RECOVERY_COMPLETION_PLAN.md, and this phase prompt.

Implement Phase 6 only: Organization Join Links.

Add admin-generated shareable organization join links with expiry, max uses, revoke, accept, audit logging, and member notifications.

Run frontend lint/build, migrations if needed, and backend organization join-link tests. Commit when complete.
```

## Phase 7: Document Sharing With Organization Members

```text
Read docs/CANONICAL_EXECUTION_PROMPT.md first.
Then read only CONTEXT.md, frontend/VISUAL_SPEC.md, docs/adr/0001-projects-contain-multiple-documents.md, docs/POST_RECOVERY_COMPLETION_PLAN.md, and this phase prompt.

Implement Phase 7 only: Document Sharing With Organization Members.

Build v1 Document sharing for organization members with view/comment/edit permissions. Do not add public links yet. Enforce permissions on nested Document routes and add share notifications.

Run frontend lint/build and backend document-sharing authorization tests. Commit when complete.
```

## Phase 8: Audit Log And Activity Reconciliation

```text
Read docs/CANONICAL_EXECUTION_PROMPT.md first.
Then read only CONTEXT.md, frontend/VISUAL_SPEC.md, docs/adr/0001-projects-contain-multiple-documents.md, docs/POST_RECOVERY_COMPLETION_PLAN.md, and this phase prompt.

Implement Phase 8 only: Audit Log And Activity Reconciliation.

Make Settings Audit Log useful by logging admin/security actions while keeping Project Activity limited to workflow events.

Run frontend lint/build and backend audit/activity tests. Commit when complete.
```

## Phase 9: Final Browser Verification And Legacy Retirement

```text
Read docs/CANONICAL_EXECUTION_PROMPT.md first.
Then read only CONTEXT.md, frontend/VISUAL_SPEC.md, docs/adr/0001-projects-contain-multiple-documents.md, docs/POST_RECOVERY_COMPLETION_PLAN.md, and this phase prompt.

Implement Phase 9 only: Final Browser Verification And Legacy Retirement.

Run end-to-end browser verification across auth, Project creation, Document creation, editor, members, join links, notifications, sharing, and audit log. Remove verified-dead legacy routes/components and strengthen workspace checks.

Run frontend lint/build, relevant backend tests, and browser verification. Commit when complete.
```
