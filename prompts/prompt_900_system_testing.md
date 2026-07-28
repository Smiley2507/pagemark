# Prompt 900: System & Security Pytest Suite

## Objective
Write automated backend pytest security suites verifying organization boundaries, IDOR prevention, path traversal blocking, API key scopes, and XSS input sanitization.

---

## Part 1: Automated Test Setup

1. **Create Security Test Module (`backend/tests/test_security.py` [NEW]):**
   - Import `pytest`, `httpx`, and the FastAPI test client.
   - Set up standard fixtures:
     - `test_db`: Session fixture that runs migrations on an in-memory SQLite database or a test PostgreSQL instance, then cleans up.
     - `user_a` & `user_b`: Users registered in the database.
     - `org_a` & `org_b`: Organization A and Organization B. User A belongs to Org A; User B belongs to Org B.
     - `project_a`: A project belonging to Org A created by User A.
     - `project_b`: A project belonging to Org B created by User B.
     - `client_a` & `client_b`: Test client instances initialized with authorization headers for User A and User B respectively.

2. **Implement Security Test Cases:**
   - **Test 1: IDOR Project Access Isolation**
     - Use `client_b` to issue a request `GET /organizations/{org_a.id}/projects/{project_a.id}`.
     - Assert that the response returns `404 Not Found` (never `403 Forbidden` to prevent exposing that the project exists).
   - **Test 2: IDOR Section Update Isolation**
     - Fetch active sections for `project_a`.
     - Use `client_b` to issue a `PUT /sections/{section_a.id}` containing updated markdown payload.
     - Assert that the response returns `404 Not Found` and that the section's contents in the database are unmodified.
   - **Test 3: Webhook HMAC Validation Security**
     - Issue a POST request to `/webhooks/github` with a dummy payload but without the `X-Hub-Signature-256` header.
     - Assert that it returns `401 Unauthorized`.
     - Issue a POST request with an invalid signature header.
     - Assert that it returns `401 Unauthorized`.
   - **Test 4: Tree-sitter Path Traversal Mitigation**
     - Issue a mock analysis execution using files containing directory traversal paths (e.g. `../../../../etc/passwd` or `/etc/passwd`).
     - Assert that the parser raises an exception or gracefully filters files that fall outside the project's root sandbox directory.
   - **Test 5: API Key Auth Header (`X-API-Key`) Verification**
     - Generate a valid API key for User A.
     - Send a request to `GET /organizations/{org_a.id}/projects` using a blank HTTP client but including the `X-API-Key: <raw_key>` header.
     - Assert that the request succeeds and returns User A's projects.
     - Repeat with an expired/revoked key and assert a `401 Unauthorized` status.

---

## Part 2: Frontend Sanitization Verification

1. **Verify XSS Sanitization:**
   - Write a frontend Jest/Cypress/Playwright test or verify that React components (`ReactMarkdown`) are configured to sanitize HTML tags.
   - Specifically, ensure `rehype-sanitize` is included as a plugin in ReactMarkdown rendering tags:
     ```tsx
     <ReactMarkdown rehypePlugins={[rehypeSanitize]}>{content}</ReactMarkdown>
     ```
   - Attempt to render a section containing: `<script>alert('XSS')</script> <iframe src="javascript:alert('XSS')"></iframe>` and verify that the HTML tag is escaped/omitted and not executed.

---

## Testing & Validation Checklist
- [ ] Run `pytest backend/tests/test_security.py` and verify all tests pass.
- [ ] Attempt a manual path traversal attack and verify backend rejects it.
- [ ] Confirm no database queries on org-scoped resources omit the `org_id` constraint.
