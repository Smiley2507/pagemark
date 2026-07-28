# Prompt 003: Notion-like Editor, Dynamic Sections & AI Generation Polish

## Objective
Overhaul the rigid editor layout into a continuous, Notion-like scroll editor with reorderable dynamic sections, and add AI confidence scoring, terminology checks, and phrasing suggestions.

---

## Part 1: Database & Backend Tasks

1. **Update Section Model (`backend/app/models/section.py`):**
   - Add columns to `Section`:
     - `sort_order` (Integer, default 0, nullable=False).
     - `title` (String, nullable=True) — overrides the original template title.
     - `is_custom` (Boolean, default False) — flags if a section was manually added by a user.
     - `status` (Enum/String: 'ACTIVE', 'DELETED', 'ARCHIVED', default 'ACTIVE').
     - `confidence_score` (Integer, nullable=True) — stores AI confidence percentage (0-100).
   - Generate and run the Alembic migration.

2. **Build Dynamic Editor Endpoints (`backend/app/routers/sections.py`):**
   - `PUT /sections/reorder`:
     - Accept `{ "section_ids": [10, 12, 11] }`.
     - In a single SQL transaction, update the `sort_order` of each section matching the order of IDs in the array.
   - `PUT /sections/{section_id}/title`:
     - Accept `{ "title": "..." }`. Update the `title` field.
   - `POST /projects/{project_id}/sections`:
     - Accept `{ "title": "..." }` and create a custom section with `is_custom=True`, `status='ACTIVE'`, and `sort_order` computed as `max(sort_order) + 1` for the project.
   - `DELETE /sections/{section_id}`:
     - Soft-delete by setting `status = 'DELETED'`. Filter out `DELETED` sections in all fetch routes unless explicitly requested.

3. **Build Terminology Consistency Checker Router (`backend/app/routers/terminology.py` [NEW]):**
   - `GET /projects/{project_id}/terminology-check`:
     - Fetch all active sections for the project.
     - Use a simple regex dictionary check (or prompt the LLM with the raw text of the document) to find acronym/term inconsistencies (e.g. "REST API" vs "rest-api" vs "HTTP endpoints").
     - Return a list of conflicts:
       ```json
       [
         {
           "term_a": "REST API",
           "term_b": "rest-api",
           "conflicts": [
             { "section_id": 12, "context": "...calls the rest-api endpoint..." }
           ]
         }
       ]
       ```
   - `POST /projects/{project_id}/terminology-resolve`:
     - Accept `{ "term_to_replace": "rest-api", "correct_term": "REST API" }`.
     - Replace all occurrences across all sections in the database.

4. **Integrate AI Confidence Scores & Phrasing Suggestions:**
   - In the Celery generation prompts:
     - Direct the LLM to output a JSON field: `{"confidence_score": 92}` based on its evaluation of code clarity and context completeness. Save this in `Section.confidence_score`.
   - Create endpoint `POST /sections/{section_id}/phrasing-suggestions` in `backend/app/routers/ai.py`:
     - Accept a specific sentence or paragraph from the section.
     - Prompt the LLM to return 3 distinct phrasing alternatives (Professional, Academic, Concise). Return as an array of strings.

---

## Part 2: Frontend Tasks

1. **Build the Continuous Scroll Editor with Drag-and-Drop:**
   - In `frontend/src/pages/EditorPage.tsx`:
     - Fetch and render all sections ordered by `sort_order`. Filter out `DELETED` sections.
     - Replace the individual scroll cards with a single continuous page.
     - Install `@dnd-kit/core` and `@dnd-kit/sortable`.
     - Add a grip icon handle `[::]` to the left of each section header. Allow dragging sections up/down.
     - On drag-end, update local Zustand state, and trigger `PUT /sections/reorder` with the updated ID list.

2. **Inline Heading Editing & Section Operations:**
   - Make the section headers editable inline (e.g. contenteditable or custom Input). On blur, trigger `PUT /sections/{id}/title`.
   - Add a "+" button between sections to trigger `POST /projects/{id}/sections`.
   - Add a trash/delete icon button next to each section to call `DELETE /sections/{id}`.

3. **Render Confidence Scores & Phrasing Tooltips:**
   - Render a colored badge next to each section title indicating `confidence_score` (Green for 80-100%, Yellow for 50-79%, Red for <50%).
   - In the text editor panel:
     - When the user highlights a block of text, show a bubble menu with a "Suggest Alternative Phrasings" option.
     - On click, fetch phrasing suggestions and show them in a popover. Selecting an alternative replaces the highlighted text.

4. **Build Terminology Checker UI:**
   - Add a "Check Terminology" button to the editor header toolbar.
   - Open a modal showing any detected conflicts. Provide a check box list of conflicts and a "Resolve All" button which calls the backend terminology resolve API.

---

## Testing & Validation Checklist
- [ ] Section reordering persists correctly upon page refresh.
- [ ] Adding a custom section places it at the bottom of the list and saves it.
- [ ] Soft-deleted sections do not appear in the continuous scroll view.
- [ ] Bubble menu displays phrasing alternatives and replaces highlighted text cleanly.
- [ ] Modifying a header inline successfully commits the new title to the database.
