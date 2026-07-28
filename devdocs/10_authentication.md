# Authentication and Authorization

## Overview

Pagemark uses a **JWT-based cookie authentication** system. Tokens are stored in httponly cookies (not localStorage) for security. The system supports email/password registration and OAuth 2.0 for GitHub (and partially for GitLab). Authorization is managed through organization membership with role-based access control, project ownership verification, and document-level sharing.

## User Registration

### `POST /auth/register`

**Flow**:
1. User submits email, password, name, and optional org_name
2. Password is hashed with bcrypt via `auth_service.hash_password()`
3. User record is created in `users` table with `is_verified = false`
4. A personal organization is created automatically (org name = user's name or "Personal")
5. User is added to the personal org as ADMIN
6. A verification token is generated and stored in `user_settings`
7. A verification email is sent via `notifications_service.send_verification_email()`
8. Response returns user data (but no session cookie — user must verify email first, then log in)

**Validation**:
- Email must not already exist
- Password must be at least 8 characters (enforced in schema)

### Email Verification

**Flow**:
1. User clicks verification link in email (contains token as query parameter)
2. `GET /auth/verify-email?token=...` endpoint validates the token
3. Sets `is_verified = true` on the user record
4. Clears the verification token
5. Returns success message

**Resend**: User can request a new verification email.

## Login / Session Management

### `POST /auth/login`

**Flow**:
1. User submits email and password
2. `auth_service.verify_password()` validates against stored bcrypt hash
3. Checks `is_verified` — rejects unverified accounts (except in development)
4. Increments `login_count`
5. Creates two JWT tokens:
   - **Access token** (30 min TTL): Stored in `access_token` cookie, path=/
   - **Refresh token** (7 day TTL): Stored in `refresh_token` cookie, path=/auth/refresh
6. Both cookies: `httponly=True`, `samesite="lax"`, `secure` in production

### `POST /auth/logout`

Clears both cookies by setting `max_age=0`.

### `POST /auth/refresh`

1. Reads `refresh_token` cookie
2. Decodes and validates JWT
3. Issues new `access_token` cookie
4. Does NOT issue a new refresh token (refresh token rotation is not implemented)

**Cross-tab sync**: The frontend uses `BroadcastChannel` API to detect when a user logs out in one tab and sync the logout state across all open tabs.

### Token Structure

```json
// Access Token Payload
{
  "sub": "42",          // user ID
  "type": "access",     // token type
  "exp": 1700000000     // expiry timestamp
}

// Refresh Token Payload
{
  "sub": "42",
  "type": "refresh",
  "exp": 1700600000
}
```

Both are signed with `settings.SECRET_KEY` using HS256 algorithm via `python-jose`.

## Password Management

### `POST /auth/forgot-password`

1. Validates email exists (but does not reveal if account exists — returns generic message)
2. Generates reset token, stores in `user_settings` with expiry
3. Sends password reset email with token link

### `POST /auth/reset-password`

1. Validates reset token (checks expiry, matches stored token)
2. Hashes new password
3. Updates user's `password_hash`
4. Clears reset token

## Role-Based Access Control

### User-Level Roles (`user_roles` table)

| Role | Description |
|------|-------------|
| `USER` | Default role for all authenticated users |
| `ADMIN` | System administrator (not used extensively) |

The `roleenum` type has `user` and `admin` values, but this system-level role is **not heavily used** — permissions are primarily managed through organization roles.

### Organization Roles (`organization_members` table)

| Role | Description | Backend Enforcement |
|------|-------------|-------------------|
| `ADMIN` | Full org control | `require_org_role([ADMIN])` for org settings, member management, join links |
| `PROJECT_MANAGER` | Project oversight | `require_org_role([ADMIN, PROJECT_MANAGER])` for audit logs |
| `DEVELOPER` | Default | Most endpoints use `verify_project_ownership` (any role) |
| `TECHNICAL_WRITER` | Documentation focus | Same as DEVELOPER for most endpoints |
| `VIEWER` | Read-only | Enforced via `require_document_permission("edit")` blocking write operations |

### Backend Enforcement Mechanisms

**`get_current_user`** — Reads access_token cookie, decodes JWT, fetches User from DB. Applied to ~90% of endpoints via `Depends(get_current_user)`.

**`verify_project_ownership(project_id, user, db)`** — Verifies user is an active member of the project's organization. This is the primary access control for project-scoped endpoints. Any active membership role passes this check.

**`require_org_role(roles: list[OrgMemberRole])`** — Factory dependency that creates a check requiring the user to have one of the specified roles in the project's organization. Used for sensitive operations (org admin, audit log viewing).

**`verify_document_access(project_id, document_id, user, db)`** — Multi-level check:
1. User must be an active org member
2. OR user must be document creator
3. OR user must have an active DocumentShare
Raises 403 if none match.

**`require_document_permission(perm: str)`** — Like `verify_document_access` but additionally validates that the share permission level (VIEW/COMMENT/EDIT) is sufficient for the requested operation.

### Permission Hierarchy

```
EDIT > COMMENT > VIEW
```

- VIEW: Can read document content
- COMMENT: Can view + add notes
- EDIT: Can view + add notes + modify content

## Liveblocks Collaboration Authorization

Real-time collaboration does not bypass Pagemark authorization. The frontend asks the backend to authorize each section room, and the backend exchanges the current Pagemark session for a Liveblocks token.

**Endpoint**:

```
POST /projects/{project_id}/documents/{document_id}/sections/{section_id}/collaboration/auth
```

**Flow**:

1. `get_current_user` validates the JWT access cookie.
2. `verify_project_ownership` confirms active organization membership for the project.
3. The documents router confirms the document belongs to the project and the section belongs to the document.
4. The backend resolves the user's effective document permission from organization membership, creator status, or `DocumentShare`.
5. The backend maps the permission to Liveblocks room capabilities:
   - `VIEW`: read room, write presence, read comments
   - `COMMENT`: view capabilities plus write comments
   - `EDIT`: comment capabilities plus write room content, unless the document is `APPROVED`
6. The backend calls Liveblocks `/v2/authorize-user` with `LIVEBLOCKS_SECRET_KEY` and returns the Liveblocks token response.

Durable collaborative snapshots use:

```
PATCH /projects/{project_id}/documents/{document_id}/sections/{section_id}/collaboration/snapshot
```

The snapshot endpoint requires effective `EDIT` permission and rejects edits to `APPROVED` documents.

## Documentation Authorization

### Document Access Resolution

For any document access request, the system checks in this order:

1. **Organization membership** + required role — If user is an org member with sufficient role, access is granted
2. **Document creator** — If user created the document, full access (EDIT implied)
3. **Document share** — If user has an active `DocumentShare`, access at the share's permission level
4. **Deny** — 403 Forbidden

### API Keys

Users can create programmatic API keys for automated access:

- **`POST /users/api-keys`** — Creates a new key (returns raw key once)
- **`GET /users/api-keys`** — Lists key metadata (not the raw key)
- **`DELETE /users/api-keys/{id}`** — Revokes a key

Keys are hashed with SHA-256 before storage (`key_hash`). Only the raw key is returned at creation time. Expiration is optional.

**Note**: API key authentication middleware (checking `Authorization: Bearer` header against stored hashes) **may not be fully implemented** — the codebase has the model and CRUD endpoints but the actual middleware to authenticate requests with API keys was not observed.

## Cookie Security

| Cookie | httponly | samesite | path | max-age |
|--------|----------|----------|------|---------|
| `access_token` | true | lax | `/` | 1800s (30 min) |
| `refresh_token` | true | lax | `/auth/refresh` | 604800s (7 days) |

In production, `secure=true` is set (requires HTTPS).

## 401 Interceptor (Frontend)

The Axios client in `frontend/src/api/client.ts` implements a 401 interceptor:

1. When any API call returns 401, the request is queued
2. The interceptor calls `POST /auth/refresh` with the refresh token cookie
3. If successful: the access token cookie is refreshed, and all queued requests are retried
4. If refresh also fails (e.g., refresh token expired): redirects to `/login`, clears auth state

## OAuth Authentication

### GitHub OAuth (`GET /auth/github/authorize`)

1. Redirects user to GitHub's authorize URL with scopes: `repo`, `user`, `read:org`
2. User authorizes the application on GitHub
3. GitHub redirects to `GET /auth/github/callback?code=...&state=...`
4. Backend exchanges code for access token via `github_service.exchange_code_for_token()`
5. Token is encrypted with Fernet (`crypto_service.encrypt_token()`) and stored in `oauth_tokens`
6. User is redirected back to the frontend

### GitLab OAuth

The GitLab OAuth endpoint (`GET /auth/gitlab/authorize`) exists but **the callback handler was not found** in the routers. This integration may be incomplete.

### OAuth Token Management

- **`GET /auth/github/status`** — Returns whether GitHub is connected (checks for non-expired token)
- **`DELETE /auth/github/disconnect`** — Deletes OAuth token record

## Security Considerations

1. **Password hashing**: bcrypt via passlib (industry standard)
2. **Token encryption**: Fernet (symmetric AES) for stored OAuth tokens and AI API keys
3. **Cookie security**: httponly prevents XSS access; samesite=lax prevents CSRF for most operations
4. **No CSRF token**: The system relies on samesite cookies for CSRF protection
5. **No rate limiting**: The backend does not implement rate limiting on auth endpoints
6. **Account enumeration**: Password reset returns the same message whether the email exists or not
7. **No MFA/2FA**: Not supported
8. **No session invalidation on password change**: Changing password does not invalidate existing sessions
9. **Refresh token rotation**: Not implemented — same refresh token is used until it expires
