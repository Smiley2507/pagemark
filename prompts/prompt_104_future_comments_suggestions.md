# Prompt 104 (Future): Document Commenting, Suggestions & User Mentions

## Objective
Implement Google Docs-style asynchronous comments, suggested edits, user `@mentions`, and a project access list in the editor.

---

## Context
While real-time multiplayer editing (Prompt 101) handles concurrent typing, team collaboration is often asynchronous. Users need to highlight text, leave comments, make suggestions (which admins can accept/reject), mention teammates to get their attention, and view who has permission to access the project.

---

## Part 1: Database & Backend Tasks

1. **Create Comments & Suggestions Models:**
   - In `backend/app/models/collaboration.py` [NEW]:
     - `Comment`: `id` (PK), `section_id` (FK -> sections.id), `user_id` (FK -> users.id), `content` (str), `resolved` (bool, default False), `created_at` (DateTime), `parent_id` (FK -> comments.id, nullable=True) — supports threaded replies.
     - `CommentAnchor`: `id` (PK), `comment_id` (FK -> comments.id), `range_start` (int), `range_end` (int) — stores highlight character offsets.
     - `Suggestion`: `id` (PK), `section_id` (FK -> sections.id), `user_id` (FK -> users.id), `original_text` (str), `suggested_text` (str), `range_start` (int), `range_end` (int), `status` (enum: 'PENDING', 'ACCEPTED', 'REJECTED', default 'PENDING'), `created_at` (DateTime).
   - Export models in `backend/app/models/__init__.py` and run migrations.

2. **Build API Router (`backend/app/routers/collaboration.py` [NEW]):**
   - `GET /sections/{section_id}/comments`: Return comments, anchors, and threaded replies.
   - `POST /sections/{section_id}/comments`:
     - Accept `{ "content": "...", "range_start": 0, "range_end": 10, "parent_id": null }`.
     - Parse comment body for `@mentions` (e.g. `@alice@example.com` or `@alice`).
     - If user mentions exist and match organization members, create a notification row and trigger a Celery task to email the mentioned user.
   - `POST /comments/{comment_id}/resolve`: Toggle `resolved = True`.
   - `POST /sections/{section_id}/suggestions`:
     - Accept `{ "original_text": "...", "suggested_text": "...", "range_start": 0, "range_end": 10 }`.
   - `POST /suggestions/{suggestion_id}/accept`:
     - Verify user has Admin/PM role.
     - Replace the text range in `Section.content_md` from `original_text` to `suggested_text`.
     - Update suggestion status to `'ACCEPTED'`.
   - `POST /suggestions/{suggestion_id}/reject`: Set status to `'REJECTED'`.

---

## Part 2: Frontend Tasks

1. **Project Access Avatars:**
   - In the Editor Header toolbar:
     - Render an avatar list of users who have access to the project (fetching `/organizations/{org_id}/members`).
     - Hovering over an avatar displays their name, email, and role.
     - Add a "Share" button next to it that opens a modal showing the access list and allows inviting new users.

2. **Render Highlights, Comments Sidebar & Mentions:**
   - In the editor panel (using CodeMirror 6 decorators):
     - Highlight ranges that have active, unresolved comments in yellow.
     - On selecting text, show a popup bubble with a "Comment" and "Suggest Edit" action.
     - Selecting "Comment" opens a small tooltip card to enter the comment text:
       - Autocomplete dropdown of org members when typing `@`.
     - Thread comments in a side panel next to the main editor (or floating cards pinned to the highlights).

3. **Inline Suggestions View:**
   - Render suggestions inline in the editor as a diff (red strikethrough for deleted text, green underline for suggestion).
   - Show a card next to the suggestion with "Accept [✓]" and "Reject [✗]" buttons.
   - On click of Accept, swap the text block and update the backend.

---

## Testing & Validation Checklist
- [ ] Leaving a comment highlights the exact text range and persists upon refresh.
- [ ] Replying to a comment groups the reply under the parent comment.
- [ ] Commenting with a `@user` mention triggers an email notification.
- [ ] Accepting a suggestion modifies the document content successfully, updates the editor view, and marks the suggestion status as `ACCEPTED`.
