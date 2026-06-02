# Prompt 999: Release Readiness & Docker Hardening

## Objective
Finalize the Pagemark codebase for academic submission. Ensure the Docker multi-container environment spins up cleanly from a cold start, includes WeasyPrint system dependencies, handles database migrations automatically, and provides a polished, evaluator-friendly README.

---

## Part 1: Docker Container Hardening

1. **Update `backend/Dockerfile`:**
   - Modify the Python base image configuration to install all required shared libraries for WeasyPrint (PDF engine):
     ```dockerfile
     RUN apt-get update && apt-get install -y \
         libpango1.0-0 \
         libcairo2 \
         libgdk-pixbuf2.0-0 \
         shared-mime-info \
         libffi-dev \
         && rm -rf /var/lib/apt/lists/*
     ```
   - Ensure the app is run as a non-root user (`appuser`) for security compliance.

2. **Configure Auto-Migration on Startup (`backend/docker-entrypoint.sh` [NEW]):**
   - Create an entrypoint shell script for the backend container:
     ```bash
     #!/bin/sh
     echo "Running database migrations..."
     alembic upgrade head
     echo "Starting API server..."
     exec uvicorn app.main:app --host 0.0.0.0 --port 8000
     ```
   - Make this script executable and configure it as the `ENTRYPOINT` in `Dockerfile`.

3. **Verify `docker-compose.yml` Config:**
   - Define four services: `db` (PostgreSQL), `redis` (Broker), `web` (FastAPI), `worker` (Celery).
   - Ensure the `web` and `worker` services declare `depends_on: - db - redis`.
   - Setup healthy check parameters on `db` to prevent `web` from executing migrations before Postgres is fully accepting connections:
     ```yaml
     healthcheck:
       test: ["CMD-SHELL", "pg_isready -U postgres"]
       interval: 5s
       timeout: 5s
       retries: 5
     ```

---

## Part 2: Environment Safety & Documentation

1. **Verify Environment Variables (`backend/app/config.py`):**
   - Read variables from a `.env` file.
   - If `ENCRYPTION_KEY` (used for BYOK encrypting) is missing:
     - Log a fatal error and exit: `sys.exit("Fatal: ENCRYPTION_KEY environment variable is not defined.")` rather than silently generating a key in-memory (which breaks decryptions on server restart).

2. **Evaluator README (`README.md`):**
   - Write a structured, clean `README.md` at the root of the project:
     - **Introduction:** 1-sentence product summary (Notion-like doc gen platform with HITL AI parsing).
     - **Quick Start:**
       1. Clone repository.
       2. Copy `.env.example` to `.env` and fill keys (including encryption key and email server credentials).
       3. Run `docker-compose up --build`.
       4. Visit `http://localhost:3000` for frontend and `http://localhost:8000/docs` for API documentation.
     - **Feature Showcase Guide:**
       - Section explaining how to trigger the **Agentic Clarification Loop** (upload the provided test repo, open the editor, watch the yellow prompt appear in the chat panel).
       - Section showing how to test the **Branded PDF Export** (setting colors/logo, clicking download).
       - Section showing how to use the **NLP dashboard**.

---

## Testing & Validation Checklist
- [ ] Delete all local Docker volumes and containers, run `docker-compose up --build`, and verify the entire system spins up without errors.
- [ ] Check `docker logs web` and confirm migrations ran successfully.
- [ ] Attempt to export a PDF from the UI and verify that WeasyPrint runs without missing library errors inside the docker container.
- [ ] Start the backend without an `ENCRYPTION_KEY` and verify it raises a clean exit code.
