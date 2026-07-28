# Prompt 103 (Future): Complete Section History & Project-level Releases

## Objective
Wire up the existing Section-level version history UI (diffing and restoring) and implement Project-level Release Snapshots (Releases).

---

## Context
Although the backend supports Section-level snapshots (`section_versions`), the frontend only lists the entries without displaying actual diffs or allowing restoration. Furthermore, teams need to create immutable project-wide snapshots (e.g., "v1.0.0 Release") for compliance.

---

## Part 1: Complete Section Version History (UI Polish)

1. **Wire up History click in `RightPanel.tsx`:**
   - Modify the history item list to load version details:
     - On clicking a version card in the "History" tab, fetch the diff details via the react-query hook `useVersionDiff(versionId)`.
     - Call `onDiffReceived` passing `{ original: diff.content_old, refined: diff.content_new }` to trigger the editor's Diff Mode in the middle panel.
     - Add a "Restore Version" button in the history card:
       - On click, trigger the `useRestoreVersion` mutation (which calls `POST /versions/{version_id}/restore`).
       - On success, update the active section's content in the Zustand store and show a success toast.

2. **Fix Backend Import Bug:**
   - In `backend/app/routers/versions.py` (Line 107):
     - Import `from datetime import datetime` and ensure `datetime.utcnow()` is valid.

---

## Part 2: Project-level Releases (Backend & DB)

1. **Create Database Models:**
   - In `backend/app/models/release.py` [NEW]:
     - `ProjectRelease`: `id` (PK), `project_id` (FK -> projects.id), `tag_name` (str, e.g., "v1.0.0"), `description` (str), `created_at` (DateTime), `created_by` (FK -> users.id).
     - `ReleaseSectionSnapshot`: `id` (PK), `release_id` (FK -> project_releases.id), `section_id` (FK -> sections.id), `title` (str), `content_md` (str), `sort_order` (Integer).
   - Export models in `backend/app/models/__init__.py`. Run Alembic migrations.

2. **Build Release Router (`backend/app/routers/releases.py` [NEW]):**
   - `POST /projects/{project_id}/releases`:
     - Accept `{ "tag_name": "v1.0.0", "description": "Production API doc" }`.
     - Verify project access.
     - Copy the *current* state of all active sections of the project into `ReleaseSectionSnapshot` records linked to the new `ProjectRelease`.
   - `GET /projects/{project_id}/releases`:
     - Return list of releases.
   - `GET /releases/{release_id}/export`:
     - Compile the release's section snapshots and trigger the PDF generator (WeasyPrint) using the stored snapshots instead of current sections.

---

## Part 3: Project-level Releases (Frontend)

1. **Releases Tab in Project Settings:**
   - Create a "Releases" view in the project dashboard / settings tab.
   - List past releases showing tag name, date, description, and author.
   - Provide a "Create New Release" form (requires Admin or PM roles).
   - Provide a "Download PDF" button next to each past release to export that historical snapshot.

---

## Testing & Validation Checklist
- [ ] Clicking a history item in the right panel displays the red/green line differences in the middle editor.
- [ ] Clicking "Restore" successfully updates the editor content and registers a new history entry.
- [ ] Creating a release (v1.0.0) copy-saves all section contents. Edits made to sections *after* creating the release do not alter the release's content when exporting its PDF.
