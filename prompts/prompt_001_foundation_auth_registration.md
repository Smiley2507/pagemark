# Prompt 001: Foundation, Auth & Multi-Tenancy

## Objective
Implement organization-based multi-tenancy, registration/onboarding flows, email verification, audit logging, and API key management on the backend and frontend.

## Context
Pagemark is shifting from a single-user architecture to an organization-first team tool. All projects are owned by Organizations. Users belong to Organizations with specific roles (Admin, PM, Developer, Technical Writer, Viewer).

---

## Part 1: Database & Backend Tasks

1. **Create and Update SQLAlchemy Models:**
   - In `backend/app/models/organization.py` [NEW]:
     - `Organization`: `id` (PK), `name` (str), `slug` (str, unique), `avatar_url` (str, nullable), `created_by` (FK -> users.id), `created_at` (datetime), `personal` (bool, default False).
     - `OrganizationMember`: `id` (PK), `org_id` (FK -> organizations.id), `user_id` (FK -> users.id), `role` (enum: 'admin', 'project_manager', 'developer', 'technical_writer', 'viewer'), `invited_by` (FK -> users.id, nullable), `joined_at` (datetime), `status` (enum: 'active', 'invited', 'suspended').
   - In `backend/app/models/audit.py` [NEW]:
     - `AuditLog`: `id` (PK), `user_id` (FK -> users.id), `org_id` (FK -> organizations.id, nullable), `action` (str), `resource` (str), `created_at` (datetime).
   - In `backend/app/models/key.py` [NEW]:
     - `UserAPIKey`: `id` (PK), `user_id` (FK -> users.id), `name` (str), `key_hash` (str, unique), `created_at` (datetime), `expires_at` (datetime, nullable).
   - In `backend/app/models/user.py`:
     - Add `is_verified` (bool, default False) to `User`.
   - In `backend/app/models/project.py`:
     - Remove `owner_id` column.
     - Add `org_id` (FK -> organizations.id) and `created_by` (FK -> users.id).
   - Update `backend/app/models/__init__.py` to export these new models.

2. **Update Auth & Registration Router (`backend/app/routers/auth.py`):**
   - Update `POST /auth/register`:
     - Accept optional `organization_name` in request.
     - Set `is_verified = False` on the user.
     - Generate a verification token, store it in cache/DB, and send a verification link via `fastapi-mail`.
     - Create a Personal Organization named `{user_name}'s Workspace` (`personal=True`) if `organization_name` is omitted, or a regular organization if provided. The registering user is added to `OrganizationMember` with `role='admin'` and `status='active'`.
   - Add `GET /auth/verify-email`:
     - Accept `token` query param. Validate token, set `User.is_verified = True`.
   - Update `POST /auth/login`:
     - If `is_verified` is False, return `401 Unauthorized` with detail `"Email not verified"`.

3. **Create Organization Router (`backend/app/routers/organizations.py` [NEW]):**
   - `GET /organizations`: List all organizations the current user belongs to.
   - `POST /organizations`: Create a new organization, automatically adding the creator as Admin.
   - `GET /organizations/{org_id}/members`: List all members and their roles.
   - `POST /organizations/{org_id}/invites`: Send an invite (generates a token, sends email via `fastapi-mail`, inserts `OrganizationMember` with `status='invited'`).
   - `POST /organizations/invites/{token}/accept`: Mark membership as `active`.
   - `GET /organizations/{org_id}/audit-logs`: Get audit logs for the organization (restricted to Admin/PM roles).

4. **Create API Keys Router (`backend/app/routers/keys.py` [NEW]):**
   - `GET /users/api-keys`: List keys.
   - `POST /users/api-keys`: Generate a new API key, return the raw key once, and store the hash.
   - `DELETE /users/api-keys/{key_id}`: Revoke key.

5. **Update Security Dependencies (`backend/app/dependencies.py`):**
   - Implement `require_org_role(required_roles: list[str])`:
     - Reads `org_id` from request or path params.
     - Verifies membership and role. If unauthorized, raises `404 Not Found` (to prevent exposing resource existence).
   - Implement `verify_project_ownership(project_id: int)`:
     - Joins `Project` and `OrganizationMember` to check if `current_user` belongs to the project's organization.
   - Implement `verify_section_ownership(section_id: int)`:
     - Joins `Section` -> `Document` -> `Project` -> `OrganizationMember` to verify access.

6. **Database Migration:**
   - Run `alembic revision --autogenerate -m "add multi tenancy"`
   - Create a data migration script to map existing projects to auto-generated personal orgs for existing users.
   - Run `alembic upgrade head`.

---

## Part 2: Frontend Tasks

1. **Create Organization API client (`frontend/src/api/organizations.ts` [NEW]):**
   - Define Axios functions for organization endpoints (CRUD, members, invites, audit logs, API keys).
   - Configure global Axios interceptor in `frontend/src/api/client.ts` to add the `X-Organization-ID` header if `orgStore.currentOrg` is set.

2. **Create Organization Store (`frontend/src/store/orgStore.ts` [NEW]):**
   - A Zustand store tracking `currentOrg` (Organization), `currentRole` (Role), and `orgs` (Organization[]).
   - Automatically update `currentOrg` and reload active project context when the user switches organizations.

3. **Build Organization Switcher Component (`frontend/src/components/shared/OrgSwitcher.tsx` [NEW]):**
   - Dropdown select in the main navigation bar.
   - Lists user's organizations, with "+ Create Organization" and "+ Join Organization" buttons.

4. **Build Account Activity & Settings Views (GitLab-style Left Sidebar):**
   - Implement a collapsible left sidebar layout similar to GitLab:
     - **Top Section:** Displays the active Organization details and the `OrgSwitcher` dropdown.
     - **Navigation Items (Dashboard Context):** "Projects", "Members", "Activity Log", "API Keys", "Settings".
     - **Navigation Items (Project Context):** When a user enters a project, transition the sidebar to show: "Editor", "NLP Dashboard", "Releases", "Export Settings", "Back to Dashboard".
   - Modify Dashboard to load projects scoped to `orgStore.currentOrg.id` (e.g. `/organizations/{org_id}/projects`).
   - Conditionally render navigation items and pages based on `currentRole`:
     - "Members" and "Settings" are visible only to Admin.
     - "Activity Log" (Audit Logs) is visible only to Admin and PM.
     - Projects are read-only if the user role is `viewer`.
   - Build settings sub-views:
     - **Members Tab:** Render a table listing name, email, role dropdown (Admin, PM, Developer, Technical Writer, Viewer), and invite status. Allow Admins to update roles or revoke membership.
     - **Audit Logs Tab:** Render a paginated log of user actions (timestamp, user, action, target resource).
     - **API Keys Tab:** Manage credentials.

5. **Build Email Verification Screen:**
   - Add verification check to `/login` flow (redirects to `/verify-email-pending`).
   - Create `frontend/src/pages/auth/VerifyEmailPage.tsx` to handle the incoming email token, calling the verify-email API and showing a success/error message.

---

## Testing & Validation Checklist
- [ ] User registration without organization name auto-creates a personal workspace.
- [ ] User cannot log in before verifying email.
- [ ] Swapping organizations correctly updates the projects list on the dashboard.
- [ ] An IDOR attempt (e.g. trying to fetch a project ID belonging to another org) returns a `404 Not Found`.
