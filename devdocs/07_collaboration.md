# Collaboration Documentation

## Overview

Pagemark's collaboration features enable multiple users to work on the same project's documentation through organization membership, document-level sharing, section-scoped real-time editing, Liveblocks comment threads, and collaboration notes. The collaboration model is built around organizations that own projects, with document permissions controlling who can view, comment, or edit.

Real-time editing is section-scoped. Each section opens its own Liveblocks room using the room id format:

```
project:{project_id}:document:{document_id}:section:{section_id}
```

Liveblocks handles presence, cursors, conflict-free editor synchronization, and comment threads. Pagemark remains the source of truth for authentication, authorization, and durable section content in PostgreSQL.

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

These Pagemark permissions are mapped to Liveblocks room permissions during authorization:

| Pagemark Permission | Liveblocks Access |
|---------------------|-------------------|
| `VIEW` | `room:read`, `room:presence:write`, `comments:read` |
| `COMMENT` | View access plus `comments:write` |
| `EDIT` | Comment access plus `room:write`, unless the document is `APPROVED` |

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

## Real-Time Section Editing

The editor uses Liveblocks with Tiptap/Yjs for concurrent section editing. Every rendered section mounts a collaborative editor for its own room when collaboration is enabled. The frontend feature flag is:

```
VITE_COLLABORATION_ENABLED=true
```

When the flag is set to `true`, collaborative editing is enabled. When it is absent or any other value, the editor uses the non-collaborative REST autosave path. In collaborative mode, the normal debounced REST autosave is disabled for the section editor. Instead, the Liveblocks-backed Tiptap instance emits document updates, converts the editor state to Markdown, and persists snapshots through the backend.

### Collaboration Auth

The frontend calls Liveblocks through a backend auth endpoint. The backend validates the current Pagemark session and document access before asking Liveblocks for an access token.

| Method | Route | Description |
|--------|-------|-------------|
| POST | `/projects/{project_id}/documents/{document_id}/sections/{section_id}/collaboration/auth` | Authorize the current user for a section Liveblocks room |

Authorization flow:

1. The frontend derives the room id from project, document, and section ids.
2. LiveblocksProvider calls `collaborationApi.authorize(roomId)`.
3. The backend verifies project membership, document access, and that the section belongs to the document.
4. The backend resolves the user's effective document permission (`view`, `comment`, `edit`).
5. The backend maps that permission into Liveblocks room permissions.
6. The backend calls `LIVEBLOCKS_API_BASE_URL/v2/authorize-user` with `LIVEBLOCKS_SECRET_KEY`.
7. Liveblocks returns the token payload to the frontend.

### Snapshot Persistence

Liveblocks synchronizes active editor state, but PostgreSQL stores the durable Markdown snapshot used by exports, AI generation, review workflows, and non-collaborative reads.

| Method | Route | Description |
|--------|-------|-------------|
| PATCH | `/projects/{project_id}/documents/{document_id}/sections/{section_id}/collaboration/snapshot` | Persist the current collaborative section content to `sections.content_md` |

Snapshot rules:

- Requires effective `EDIT` permission.
- Rejects writes to `APPROVED` documents.
- If content changed, updates `sections.content_md`, `sections.updated_at`, and `documents.updated_at`.
- Clears reviewed state via `clear_review_state_for_content_edit()`, matching normal section edits.
- Returns `saved=false` when the incoming Markdown equals the stored content.

### Runtime Configuration

Backend environment:

| Variable | Default | Description |
|----------|---------|-------------|
| `LIVEBLOCKS_SECRET_KEY` | `""` | Required for Liveblocks authorization. If empty, collaboration auth returns 503. |
| `LIVEBLOCKS_API_BASE_URL` | `https://api.liveblocks.io` | Liveblocks REST API base URL. |

Frontend environment:

| Variable | Default | Description |
|----------|---------|-------------|
| `VITE_COLLABORATION_ENABLED` | disabled | Set to `true` to use Liveblocks collaborative editor rooms. |

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

## Liveblocks Comment Threads

The collaborative Tiptap editor also renders Liveblocks thread UI for section-scoped inline discussion. These threads are distinct from the legacy `collaboration_notes` table:

- Liveblocks threads live in the Liveblocks room and support real-time discussion around collaborative editor state.
- `collaboration_notes` remain backend-owned, append-only notes shown in the Notes Panel.
- Export, AI generation, and review workflows use the persisted section Markdown snapshot, not the Liveblocks thread store.

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

1. **Document-level presence is section-scoped**: Users collaborate inside individual section rooms. There is no aggregate document room that shows every active collaborator across the whole document.
2. **Offline conflict recovery is delegated to Liveblocks/Yjs**: Pagemark persists Markdown snapshots but does not store its own CRDT history.
3. **Legacy notes are flat**: Backend `collaboration_notes` have no replies, edit, or delete. Threaded discussion is available through Liveblocks threads in collaborative editor rooms.
4. **No section assignment**: Sections cannot be explicitly assigned to team members. The `reviewer_id` field on documents exists but section-level `reviewed_by` is a post-facto record, not an assignment.
5. **Role enforcement is incomplete**: `require_org_role()` exists but is not consistently applied across all endpoints. Most endpoints use the broader `verify_project_ownership` which only checks active membership.
6. **No notifications for collaboration events**: While the `notifications_service.py` module exists and preferences are stored, actual push/email notifications for collaboration events (new notes, review requests, content updates) appear to be **not fully implemented** — the notification service primarily handles transactional emails (verification, password reset, invites).
