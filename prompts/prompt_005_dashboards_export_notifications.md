# Prompt 005: NLP Dashboard, Branded PDF Export, Email Notifications & BYOK Settings

## Objective
Finalize the codebase by implementing the NLP Processing Dashboard, visual PDF export customizations (CSS injection with WeasyPrint), SMTP email alerts, and the simplified BYOK settings UI.

---

## Part 1: Database & Backend Tasks

1. **Update Models and Database Schemas:**
   - In `backend/app/models/nlp.py` [NEW]:
     - `NLPReport`: `id` (PK), `project_id` (FK -> projects.id), `readability_score` (float), `entities` (JSON), `style_analysis` (JSON), `suggestions` (JSON), `created_at` (DateTime).
   - In `backend/app/models/project.py`:
     - Add `export_settings` JSON column to `Project` (default: `{"logo_url": null, "primary_color": "#0F172A", "font_family": "Inter"}`).
   - In `backend/app/models/organization.py`:
     - Add `ai_provider` (String, nullable=True) — either 'anthropic' or 'google'.
     - Add `ai_key_encrypted` (String, nullable=True) — encrypted using Fernet.
   - Export these new models in `backend/app/models/__init__.py`. Run Alembic migrations.

2. **Build the NLP Processing Pipeline & Router (`backend/app/routers/nlp.py` [NEW]):**
   - In `backend/app/workers/analysis_worker.py`:
     - Calculate readability scores (e.g. Flesch-Kincaid formula) on the generated markdown.
     - Extract entities (databases, technologies, packages) and style metrics (formal/informal percentage) using LLM analysis.
     - Store the output in the `nlp_reports` table.
   - Create `GET /projects/{project_id}/nlp-report`:
     - Verify organization access, fetch and return the latest `NLPReport`.

3. **Build Branded Export & Batch ZIP Export (`backend/app/routers/export.py`):**
   - Update the WeasyPrint PDF generator in `backend/app/services/export_service.py`:
     - Load `Project.export_settings`.
     - Inject a `<style>` block into the top of the HTML payload before compiling:
       ```html
       <style>
         :root {
           --primary-color: {{ export_settings.primary_color }};
           --font-family: '{{ export_settings.font_family }}';
         }
         h1, h2, h3 { color: var(--primary-color); font-family: var(--font-family); }
       </style>
       ```
     - If `export_settings.logo_url` is present, render it as an `<img>` tag on the title page of the PDF.
   - Create `POST /projects/batch-export`:
     - Accept `{ "project_ids": [10, 12, 13] }`.
     - Generate PDF files for all requested projects, compress them into a single memory ZIP archive using Python's `zipfile` and `io.BytesIO`, and return as a streaming file response with `media_type="application/zip"`.

4. **SMTP Email Notifications (`backend/app/services/notification_service.py` [NEW]):**
   - Configure `fastapi-mail` ConnectionConfig (SMTP host, port, username, password, SSL/TLS).
   - Write a Celery task `send_async_email(email_to: str, subject: str, template_body: str)`:
     - Sends email alerts when:
       - A review is assigned to a member.
       - A user leaves a comment on a document.
       - The quality score of a document falls below the set threshold.

5. **Clean GitLab Integration:**
   - In `backend/app/routers/git.py` and `frontend/src/pages/NewProjectPage.tsx`:
     - Delete all GitLab OAuth routing, GitLab API integrations, and buttons, maintaining only the GitHub path.

---

## Part 2: Frontend Tasks

1. **Build the NLP Processing Dashboard:**
   - Create `frontend/src/pages/NLPDashboard.tsx`:
     - Render progress rings for readability (e.g. Flesch-Kincaid score mapping).
     - Render a radar chart or custom bar cards displaying document formality, conciseness, and jargon density.
     - Render a table list of detected technical entities (APIs, Databases, Libraries).
     - List bullet points containing AI style/grammar suggestions.

2. **Build Export Settings Modal:**
   - In the Export modal (`frontend/src/components/editor/ExportModal.tsx`):
     - Add an "Export Styles" section.
     - Color Picker: An input element mapped to `export_settings.primary_color`.
     - Font Family: A select dropdown offering Google Fonts (Inter, Roboto, Playfair Display, Source Code Pro).
     - Logo Uploader: A drag-and-drop file upload component that POSTs to `/upload` and saves the static file URL in `export_settings.logo_url`.
     - Add checkboxes to allow selecting multiple projects, with a "Download ZIP" button calling the batch export endpoint.

3. **Build the Simplified BYOK UI:**
   - In the Organization Settings panel, create an "AI Configuration" tab:
     - Provider Selection: Radio buttons for "Anthropic (Claude)" and "Google (Gemini)".
     - API Key input: A password-masked input field.
     - Save button: Calls `POST /organizations/{org_id}/ai-credentials` to save and encrypt the key.

---

## Testing & Validation Checklist
- [ ] Changing the color picker to `#FF0000` (Red) renders all PDF headers in Red.
- [ ] Exporting multiple projects returns a valid ZIP file containing all PDFs.
- [ ] Assigning a document review sends a test email to the reviewer's inbox.
- [ ] Select Google Gemini in settings, generate outline, verify outline is generated successfully using Google BYOK credentials.
- [ ] GitLab links and references are completely removed from the New Project form.
