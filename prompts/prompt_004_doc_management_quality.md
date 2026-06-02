# Prompt 004: Tagging, Full-Text Search, Approval Workflows & Quality Thresholds

## Objective
Implement project tagging, PostgreSQL full-text search across documentation, a document approval review pipeline, a team collaboration notes sidebar, and quality threshold alerts.

---

## Part 1: Database & Backend Tasks

1. **Update Models for Search, Tagging, and Review Workflow:**
   - In `backend/app/models/project.py`:
     - Add `tags` (JSON / ARRAY of String, default `[]`) to the `Project` model.
   - In `backend/app/models/document.py`:
     - Add `status` (Enum/String: 'DRAFT', 'IN_REVIEW', 'APPROVED', default 'DRAFT').
     - Add `reviewer_id` (Integer, FK -> users.id, nullable=True).
     - Add `approved_at` (DateTime, nullable=True).
   - In `backend/app/models/note.py` [NEW]:
     - `CollaborationNote`: `id` (PK), `document_id` (FK -> documents.id), `user_id` (FK -> users.id), `content` (str), `created_at` (DateTime).
   - In `backend/app/models/organization.py`:
     - Add `quality_threshold` (Integer, default 70, nullable=False).
   - Export these new models in `backend/app/models/__init__.py`.

2. **Build Search and Tagging Routes (`backend/app/routers/search.py` [NEW]):**
   - Create `GET /projects/search`:
     - Accept query params: `q` (string), `tag` (string).
     - Verify active organization via `require_org_role`.
     - Perform a search across sections using PostgreSQL's full-text search. E.g.
       ```python
       select(Section).join(Document).join(Project)
       .where(
           Project.org_id == org_id,
           func.to_tsvector('english', Section.content_md).op('@@')(func.plainto_tsquery('english', q))
       )
       ```
     - Return matched sections, documents, and parent projects.

3. **Build Approval Workflow Routes (`backend/app/routers/documents.py`):**
   - Create `POST /documents/{doc_id}/submit-review`:
     - Accept `{ "reviewer_id": 15 }`. Verify requester has edit rights. Set `status = 'IN_REVIEW'`, save `reviewer_id`.
   - Create `POST /documents/{doc_id}/approve`:
     - Verify `current_user.id == reviewer_id` or user is Admin/PM. Set `status = 'APPROVED'`, `approved_at = datetime.utcnow()`.
   - Create `POST /documents/{doc_id}/request-changes`:
     - Verify reviewer/Admin role. Set `status = 'DRAFT'`, clear `reviewer_id`.
   - Lock `APPROVED` documents: Ensure `PUT` or `POST` edits on sections of approved documents raise `403 Forbidden` unless the document is reverted to `DRAFT`.

4. **Build Collaboration Notes Router (`backend/app/routers/notes.py` [NEW]):**
   - `GET /documents/{doc_id}/notes`: Return notes with user details.
   - `POST /documents/{doc_id}/notes`: Accept `{ "content": "..." }`, save note.

---

## Part 2: Frontend Tasks

1. **Build Tagging & Search UI:**
   - On the Dashboard:
     - Add a global Search input at the top. On typing, display matched projects/documents in a dropdown overlay.
     - Add a tag-filtering list in the sidebar (e.g. "academic", "frontend", "api").
     - On Project Cards, show editable tag pills. Clicking "Edit Tags" opens a badge-based input modal.

2. **Build Review Approval UI:**
   - In the Editor Toolbar header:
     - Display the document status badge: Draft (Gray), In Review (Yellow), Approved (Green).
     - Provide a "Submit for Review" button which opens a modal with a dropdown to select a Reviewer (Technical Writer/PM role).
   - If the user is the assigned reviewer, display a banner at the top of the editor: *"You are reviewing this document. [Approve] or [Request Changes]"*.
   - Disable editing for all sections if the document status is `APPROVED`, showing a locked padlock icon.

3. **Build Collaboration Notes Panel:**
   - In the Editor's Right Panel (`frontend/src/components/editor/RightPanel.tsx`):
     - Add a "Notes" tab.
     - Render a scrollable message board showing notes, dates, and author avatars.
     - Add a message textarea and "Add Note" button at the bottom.

4. **Implement Quality Threshold Settings:**
   - In the Organization Settings page, add a numeric slider/input for "Documentation Quality Threshold" (0-100%).
   - On the Editor Page, if the quality report score falls below this threshold, display a persistent alert banner: *"Warning: Document score (55%) is below the Organization threshold (70%). Please refine content."*

---

## Testing & Validation Checklist
- [ ] Searching for a term returns exact matches within section contents.
- [ ] Section editing is blocked if the parent document is in `APPROVED` status.
- [ ] Users without Admin/PM/Reviewer permissions cannot approve documents.
- [ ] Adding a collaboration note displays it instantly in the RightPanel thread.
- [ ] Setting a threshold of 80% shows warning banners on documents scoring 75%.
