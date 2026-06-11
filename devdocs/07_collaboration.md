# Collaboration Documentation

## Overview

Pagemark's collaboration features enable multiple users to work on the same project's documentation through organization-based membership, shared document access, and collaboration notes. The collaboration model is built around organizations that own projects, with role-based permissions controlling what each member can do.

## Organization Model

All projects belong to an organization. Every user gets a personal organization automatically on registration (the `personal` flag). Users can create or join additional organizations.

### Organization Roles

| Role | Description | Permissions |
|------|-------------|-------------|
| `ADMIN` | Full control | Can manage members, edit org settings, view audit logs, access all projects and documents |
| `PROJECT_MANAGER` | Project oversight | Can view audit logs, manage projects, but not manage org settings or members |
| `DEVELOPER` | Default role | Can create and edit projects and documents, use AI features |
| `TECHNICAL_WRITER` | Documentation focus | Can create and edit documents, use AI features, but may have restricted project management |
| `VIEWER` | Read-only | Can view projects and documents but cannot edit |

**Note on role granularity**: The codebase defines these 5 roles in the `OrgMemberRole` enum, and the `require_org_role()` dependency enforces minimum role levels. However, **fine-grained permission checks (what each role can/cannot do at the endpoint level) are not fully implemented**. Most document/section endpoints use `verify_project_ownership` (checks any active membership) rather than `require_org_role([specific_roles])`. The `PermissionGate` React component allows role-based conditional rendering in the frontend.

### Membership Management

- **Invites**: Admins can send email invites via `POST /organizations/{id}/invites`
- **Join Links**: Admins can create shareable join links with predefined role, optional max uses and expiry
- **Invite acceptance**: Users accept invites via token link or join link code
- **Member removal**: Admins can remove members or update their role
- **Member statuses**: ACTIVE (normal), INVITED (pending acceptance), SUSPENDED (temporarily disabled)

### Audit Logging

Organizations have audit logs (`audit_logs` table) recording actions like member role changes, credential management, org settings changes. Available to ADMIN and PROJECT_MANAGER roles.

## Document Sharing

Beyond organization membership, documents can be individually shared with users who are not org members, or with org members who need explicitly different access.

### Share Permissions

| Permission | Description |
|------------|-------------|
| `VIEW` | Can read the document and its sections |
| `COMMENT` | Can view and add collaboration notes |
| `EDIT` | Can view, add notes, and edit sections |

### Share Management

- Shares are created via `POST /projects/{project_id}/documents/{document_id}/shares`
- Shares are upserted (creating a new share for the same user+document reactivates a revoked one)
- Shares can be revoked (soft-delete via `revoked_at` timestamp)
- Active (non-revoked) shares are returned by `GET /.../shares`
- Document access resolution order:
  1. If user is org member with ADMIN or PROJECT_MANAGER → full access
  2. If user is document creator → full access (bypasses shares)
  3. If user has a share record → access at share permission level
  4. Otherwise → 403 Forbidden

### Endpoints

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/projects/{project_id}/documents/{document_id}/shares` | List active shares |
| POST | `/projects/{project_id}/documents/{document_id}/shares` | Create/update share |
| DELETE | `/projects/{project_id}/documents/{document_id}/shares/{share_id}` | Revoke share |

## Collaboration Notes

Notes allow team members to leave comments on documents and sections.

### Note Model

- Scoped to a document, optionally to a specific section
- Contains: content (markdown text), author (user), timestamp
- Notes are not editable or deletable after creation (append-only)

### Endpoints

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/projects/{project_id}/documents/{document_id}/notes` | List notes (optional section_id filter) |
| POST | `/projects/{project_id}/documents/{document_id}/notes` | Create note |

### Frontend UI

The Notes Panel (`components/editor/NotesPanel.tsx`) is accessible from the left panel toggle. It displays notes for the current document or active section:
- Notes listed with user avatar, name, timestamp, content
- Create new note via text input at the bottom
- No reply threading or edit/delete functionality

## Section Review Workflow

The review workflow enables structured quality control:

1. **Generation**: AI generates section content (or user writes manually)
2. **Content lifecycle**: Section enters `GENERATED_DRAFT` state
3. **Review**: Another team member (or the author) reads the content
4. **Acceptance**: Clicking "Accept Review" transitions section to `REVIEWED` state
5. **Recording**: The reviewer's user ID, timestamp, and current analysis snapshot ID are stored
6. **Staleness tracking**: When source code changes, review state is re-evaluated

### Review States

| State | Meaning |
|-------|---------|
| `EMPTY` | No content has been written or generated |
| `GENERATED_DRAFT` | AI-generated or user-written content, not yet reviewed |
| `REVIEWED` | Content has been reviewed and accepted |

### Workflow Actions

- **Edit after review**: If a user edits reviewed content, `clear_review_state_for_content_edit()` resets `content_lifecycle` to `GENERATED_DRAFT` and clears `reviewed_by`/`reviewed_at`/`reviewed_against_analysis_id`. The document status is derived from section states.
- **Accept review**: Sets `content_lifecycle = REVIEWED`, records reviewer, timestamp, and current analysis snapshot ID
- **Generation after edit**: AI can regenerate content for any section regardless of review state

## Document Status

Document status is derived from its sections:
- `DRAFT` — One or more sections are not reviewed
- `IN_REVIEW` — All sections have content, some are under review
- `APPROVED` — All sections are reviewed

**Note**: The derived status logic is partially implemented. The `completion_pct` is computed from sections but the status derivation from section states uses the stored `status` field directly rather than being fully dynamic.

## Activity Events

All meaningful collaboration actions are recorded as activity events:

| Event Type | Weight | Description |
|------------|--------|-------------|
| `section.reviewed` | 3.0 | Section content was accepted |
| `section.generated` | 1.0 | AI generated section content |
| `section.edited` | 1.0 | User edited section content |
| `document.created` | 1.0 | New document created |
| `analysis.completed` | 2.0 | Code analysis finished |
| `source.synced` | 1.5 | Source code was re-synced |
| `project.created` | 1.0 | New project created |
| Various others | 0.3-2.0 | Mixed workflow events |

Events feed into:
- **Timeline view**: Chronological activity feed on the project activity page
- **Heatmap**: GitHub-style contribution heatmap using weighted event counts per day
- **Recent activity**: Homepage dashboard showing recent workspace events

## Current Collaboration Limitations

1. **No real-time collaboration**: There is no WebSocket support. Users must refresh to see others' changes.
2. **No simultaneous editing**: Documents do not support collaborative real-time editing (no CRDT or OT).
3. **No note reply/threading**: Notes are flat — no replies, no threading, no edit/delete.
4. **No section assignment**: Sections cannot be explicitly assigned to team members. The `reviewer_id` field on documents exists but section-level `reviewed_by` is a post-facto record, not an assignment.
5. **Role enforcement is incomplete**: `require_org_role()` exists but is not consistently applied across all endpoints. Most endpoints use the broader `verify_project_ownership` which only checks active membership.
6. **No notifications for collaboration events**: While the `notifications_service.py` module exists and preferences are stored, actual push/email notifications for collaboration events (new notes, review requests, content updates) appear to be **not fully implemented** — the notification service primarily handles transactional emails (verification, password reset, invites).
