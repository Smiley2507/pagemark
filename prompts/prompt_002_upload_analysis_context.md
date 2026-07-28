# Prompt 002: Upload, Analysis & Human-in-the-Loop (HITL) Context

## Objective
Bulletproof the repository upload flow with file exclusion, visualize code dependencies, and implement the dynamic Human-in-the-Loop (HITL) Agentic Clarification loop.

---

## Part 1: Database & Backend Tasks

1. **Implement File Exclusion during Repository Ingestion:**
   - In `backend/app/services/git_service.py` (or repository extraction service):
     - Update the ZIP extraction logic to accept a list of glob patterns (`ignore_patterns: list[str]`).
     - Use Python's `fnmatch` to skip files/folders matching patterns like `node_modules/*`, `vendor/*`, `dist/*`, `build/*`, `.git/*`, `*.log`, `*.bin`.
   - Update `POST /projects/upload` to accept `ignore_patterns` (list of strings) in the request body/form.

2. **Add Complexity Metrics and Dependency Analysis:**
   - In the Celery analysis worker (`backend/app/workers/analysis_worker.py`):
     - Extract file-level metrics: LOC (Lines of Code) and Cyclomatic Complexity (using tree-sitter or regex-based checks for loops/branches).
     - Extract imports to determine relationships between modules/files (e.g. `import X` in Python, `import X from 'y'` in TSX, or imports in Java).
     - Save this data as a JSON field `analysis_data` on the `Analysis` model:
       ```json
       {
         "complexity_metrics": [
           { "file_path": "app/main.py", "loc": 120, "complexity": 14 }
         ],
         "dependencies": [
           { "source": "app/main.py", "target": "app/routers/auth.py" }
         ]
       }
       ```

3. **Database Model for Clarification Requests:**
   - Create `backend/app/models/clarification.py` [NEW]:
     - `ClarificationRequest`: `id` (PK), `section_id` (FK -> sections.id), `question` (str), `user_answer` (str, nullable), `status` (enum: 'pending', 'resolved'), `created_at` (datetime), `resolved_at` (datetime, nullable).
   - Export this model in `backend/app/models/__init__.py`.

4. **Celery Worker Interrupt Logic:**
   - In `backend/app/workers/analysis_worker.py` (or generation worker):
     - Modify the AI generation step to instruct the LLM: *"If you do not have enough business logic or context to document this section accurately, return a JSON output: `{"action": "ask_user", "question": "<write a clear, targeted question asking for the missing detail>"}`."*
     - If the LLM returns this JSON:
       - Raise a custom Python exception `NeedsClarificationException(question, section_id)`.
       - Catch this exception in the Celery task. Update `Section.status = 'NEEDS_INPUT'`.
       - Create a `ClarificationRequest` row with `status='pending'` and store the question.
       - Gracefully complete the task (without retrying).

5. **End-to-End API Router for HITL (`backend/app/routers/clarification.py` [NEW]):**
   - Create endpoints:
     - `POST /sections/{section_id}/clarify`:
       - Accept `{ "answer": "..." }`.
       - Verify project access via `verify_section_ownership`.
       - Find the pending `ClarificationRequest` for the section. Update `user_answer` and set `status = 'resolved'`, `resolved_at = datetime.utcnow()`.
       - Update `Section.status = 'GENERATING'`.
       - Dispatch a new Celery task `resume_generation_task.delay(section_id, answer)` passing the user's answer as supplementary context to the LLM prompt.

6. **Generate Alembic Migration:**
   - Run `alembic revision --autogenerate -m "add HITL clarification"`
   - Run `alembic upgrade head`.

---

## Part 2: Frontend Tasks

1. **Upload Wizard File Exclusion UI:**
   - In `frontend/src/components/wizard/UploadStep.tsx` (or folder upload UI):
     - Add a card showing common folder checkboxes (`node_modules`, `vendor`, `build`, `dist`, `.git`).
     - Provide a text field for custom comma-separated patterns (e.g. `*.tmp, *.bak`).
     - Pass these patterns to the Axios upload call.

2. **Dependency Graph & Metrics Visualizer:**
   - In `frontend/src/pages/AnalysisPage.tsx`:
     - Render a paginated table of files, LOC, and Complexity. Highlight files with complexity > 15 in red.
     - Implement a visual graph showing file dependencies. Use `@xyflow/react` (or `vis-network` for React):
       - Map module imports to nodes and lines (directed edges).
       - Allow zooming, dragging, and clicking a node to display that file's specific metrics.

3. **Editor HITL UI Integration:**
   - In the Section Editor view (`frontend/src/pages/EditorPage.tsx`):
     - If a section's status is `NEEDS_INPUT`, display a yellow border and warning banner: *"AI needs clarification before generating this section. Check the AI Chat Panel."*
   - In `frontend/src/components/editor/RightPanel.tsx` (AI Panel):
     - Add a "Clarification" tab or conditional card when the active section needs input.
     - Display the AI's question text.
     - Provide a `textarea` for the user's reply, with a "Submit Answer" button.
     - On click, trigger `POST /sections/{section_id}/clarify`, show a toast notification, set the section state to generating, and show a spinner.

---

## Testing & Validation Checklist
- [ ] Uploading a project with a dummy mock script matching the exclusion pattern ignores the file.
- [ ] Dependency graph displays correct nodes and edges representing file imports.
- [ ] Celery task correctly intercepts LLM `ask_user` JSON payloads, saving the question and setting the section status to `NEEDS_INPUT`.
- [ ] Answering the question in the UI resumes the Celery worker, which successfully integrates the answer into the final markdown output.
