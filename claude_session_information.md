# Claude Code Insights

> note: all of these were thought and were not implemented in the project so far. I just them to be considered when we plan ahead.

## The Three Layers Where Isolation Must Be Enforced

Data isolation is not one thing you add in one place. It has to be enforced at three separate layers independently. If any one layer fails, the others may not catch it.

```
Layer 1: Database schema    — every row knows who owns it
Layer 2: API query layer    — every query filters by current user
Layer 3: API route layer    — every endpoint verifies ownership before acting
```

All three must work. Relying on any single layer is a mistake.

---

## Layer 1 — Database Schema (Mostly Fine, One Gap)

Looking at the schema we designed, most tables are correctly anchored:

```
users                    ← root, no foreign key needed
user_roles(user_id)      ← correct
user_settings(user_id)   ← correct
projects(owner_id)       ← correct, this is the ownership anchor
templates(owner_id)      ← correct (null for built-ins)
documents(project_id)    ← inherits from projects
sections(document_id)    ← inherits from documents
section_versions(section_id) ← inherits from sections
analyses(project_id)     ← inherits from projects
quality_reports(project_id) ← inherits from projects
chat_threads(project_id) ← inherits from projects
chat_messages(thread_id) ← inherits from threads
shares(project_id)       ← inherits from projects
comments(project_id)     ← inherits from projects
oauth_tokens(user_id)    ← correct
audit_logs(user_id)      ← correct
kb_articles(created_by)  ← correct
```

**The gap:** For tables that inherit ownership transitively (sections → documents → projects → owner), a direct lookup by section ID without verifying the ownership chain is dangerous. You need a way to verify "does this section belong to a project owned by this user" in one query.

Add this as a reusable utility in `api/app/dependencies.py`:

```python
async def verify_project_ownership(
    project_id: int,
    current_user: User,
    db: AsyncSession
) -> Project:
    result = await db.execute(
        select(Project).where(
            Project.id == project_id,
            Project.owner_id == current_user.id,
            Project.deleted_at.is_(None)
        )
    )
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project

async def verify_section_ownership(
    section_id: int,
    current_user: User,
    db: AsyncSession
) -> Section:
    # Join through the full chain to verify ownership
    result = await db.execute(
        select(Section)
        .join(Document, Section.document_id == Document.id)
        .join(Project, Document.project_id == Project.id)
        .where(
            Section.id == section_id,
            Project.owner_id == current_user.id,
            Project.deleted_at.is_(None)
        )
    )
    section = result.scalar_one_or_none()
    if not section:
        raise HTTPException(status_code=404, detail="Section not found")
    return section
```

Use these as FastAPI dependencies on every route that touches sections or projects. Never look up a section by ID alone.

---

## Layer 2 — Query Layer (Was Missing From the Plan)

Every database query that returns a list must filter by the current user. This was implied but never stated explicitly. Here are the rules:

**Rule: Never query without a user filter on user-owned data.**

```python
# WRONG — returns all projects in the database
result = await db.execute(select(Project))

# CORRECT — returns only this user's projects
result = await db.execute(
    select(Project).where(
        Project.owner_id == current_user.id,
        Project.deleted_at.is_(None)
    )
)
```

**Rule: Never look up a child resource by ID without verifying the parent.**

```python
# WRONG — any authenticated user can fetch any section by guessing the ID
@router.get("/sections/{section_id}")
async def get_section(section_id: int, db=Depends(get_db)):
    section = await db.get(Section, section_id)
    return section

# CORRECT — ownership verified through the full chain
@router.get("/sections/{section_id}")
async def get_section(
    section_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    section = await verify_section_ownership(section_id, current_user, db)
    return section
```

This pattern — called an **Insecure Direct Object Reference (IDOR)** vulnerability when missing — is one of the most common security bugs in web apps. An attacker who knows or guesses a section ID (IDs are sequential integers, easy to enumerate) can read another user's documentation without this check.

---

## Layer 3 — Route Layer (Needs Explicit Verification Pattern)

Every route in every router must follow this exact pattern. Add it to your PAGEMARK.md as a hard rule:

```python
# Template for every protected route that acts on user data:

@router.get("/projects/{project_id}")
async def get_project(
    project_id: int,
    current_user: User = Depends(get_current_user),  # 1. authenticate
    db: AsyncSession = Depends(get_db)
):
    project = await verify_project_ownership(         # 2. authorise
        project_id, current_user, db
    )
    return project                                    # 3. return
```

Steps 1 and 2 are not the same thing:
- **Authentication** = proving who you are (the JWT cookie check)
- **Authorisation** = proving you are allowed to access this specific resource

Most tutorials only teach authentication. Both are required.

---

## What This Means for Each Feature Area

**Projects:**
All project queries filter by `owner_id = current_user.id`. Done in `verify_project_ownership`.

**Templates:**
Built-in templates (`owner_id IS NULL`) are readable by everyone. Custom templates filter by `owner_id = current_user.id OR owner_id IS NULL`.

```python
result = await db.execute(
    select(Template).where(
        or_(
            Template.owner_id == current_user.id,
            Template.owner_id.is_(None)  # built-ins
        )
    )
)
```

**Documents and Sections:**
Always accessed through `verify_section_ownership` which joins through the project. Never by ID alone.

**Code Analysis:**
Accessed through the project. `GET /projects/{id}/analysis` uses `verify_project_ownership` first.

**AI Endpoints:**
`POST /sections/{id}/ai/generate` uses `verify_section_ownership`. The AI service receives the section object already verified — it never touches the database directly for ownership.

**Celery Background Workers:**
This is the trickiest case. When a Celery task runs (analysis, quality scoring, export), there is no HTTP request and no `current_user`. The task was dispatched by an authenticated user but runs asynchronously.

The rule for Celery tasks: **pass the user_id explicitly when dispatching, and re-verify inside the task.**

```python
# In the router (authenticated context):
@router.post("/projects/{project_id}/upload")
async def upload_source(
    project_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    project = await verify_project_ownership(project_id, current_user, db)
    # Pass user_id to the task — never trust just the project_id
    analyze_project_task.delay(
        project_id=project_id,
        user_id=current_user.id,  # ← explicit
        file_path=saved_path
    )

# In the Celery task (no HTTP context):
@celery.task
def analyze_project_task(project_id: int, user_id: int, file_path: str):
    with get_sync_db() as db:
        # Re-verify even in the background task
        project = db.query(Project).filter(
            Project.id == project_id,
            Project.owner_id == user_id  # ← verify again
        ).first()
        if not project:
            raise ValueError(f"Project {project_id} not found for user {user_id}")
```

**Shared Documents (public access via token):**
`GET /shared/{token}` is the one exception — it is public. But it still has isolation: the share token grants access to exactly one project, not all projects. The query must be:

```python
share = await db.execute(
    select(Share).where(
        Share.token == token,
        or_(Share.expires_at.is_(None), Share.expires_at > datetime.utcnow())
    )
)
# Then fetch that specific project — no user filter needed here
# because the token IS the authorisation
```

**OAuth Tokens:**
```python
# Always filter by user_id — never by provider alone
result = await db.execute(
    select(OAuthToken).where(
        OAuthToken.user_id == current_user.id,
        OAuthToken.provider == "github"
    )
)
```

**Audit Logs:**
Write: always include `user_id = current_user.id`.
Read: admin-only route, can read all logs. Regular users can only read their own:
```python
if not is_admin(current_user):
    query = query.where(AuditLog.user_id == current_user.id)
```

---

## User Settings Isolation

User settings are per-user by definition (`user_id` is the primary key). But the theme and language preferences need to be loaded at app startup and stored client-side. The flow is:

```
Login → GET /auth/me → returns user + settings → frontend stores in Zustand
→ applies theme immediately → subsequent API calls include user context
```

Do not store settings in `localStorage` as the source of truth. Store them in the database, load them on login, keep them in Zustand during the session. On theme toggle, call `PATCH /users/settings` to persist.

---

## The One Thing We Were Missing — A Checklist

Add this to `PAGEMARK.md` under a new section called **Data Isolation Rules**:

```markdown
## Data Isolation Rules

Every route that returns or modifies user data MUST:

1. Call get_current_user — authentication check
2. Call verify_project_ownership OR verify_section_ownership — authorisation
3. All list queries filter by owner_id/user_id — no unfiltered selects
4. Celery tasks receive user_id explicitly and re-verify inside the task
5. Templates: filter by (owner_id = user OR owner_id IS NULL)
6. Shared documents: authorised by token, not by user session
7. Admin routes: guard with has_role('admin') check
8. OAuth tokens: always filter by user_id AND provider
9. Never return 403 Forbidden for ownership failures — return 404
   (Do not reveal that the resource exists to unauthorised users)
10. Auto-increment integer IDs are guessable — NEVER trust them alone
```

Rule 9 is worth explaining. If you return 403 when a user tries to access someone else's project, you are confirming that a project with that ID exists. Return 404 instead — from the requesting user's perspective, a project they do not own does not exist. This is standard security practice and is why `verify_project_ownership` raises 404, not 403.

---

## Summary

The schema was mostly right. What was missing was the explicit enforcement pattern at the query and route layers, the Celery task isolation, and the ownership verification utilities. Those gaps are now filled. Add the isolation rules to `PAGEMARK.md` and Claude Code will apply them consistently across every router it generates.

## The Core Question — What Changes the Project Direction?

Three things determine whether a missing item is critical, important, or ignorable:

**Direction-changing:** Without it, the project does not do what it claims to do. A documentation system that cannot verify your email or cannot actually guide you through questions is broken at its core.

**Quality-improving:** Without it, the project works but is visibly incomplete to an evaluator. These are the items that make the difference between a pass and a distinction.

**Nice-to-have:** Without it, no one would notice unless they were looking for it specifically. These are the items you can honestly say "planned for future release" and move on.

---

## Group 1 — Do These Before You Submit Anything ⛔

These are not optional. Without them the project either does not meet its own stated purpose or breaks fundamental trust with users.

**1. Email verification on registration**
Without this, anyone can register with someone else's email. It is the first item in Module 1. It is also a trust signal — evaluators will register an account and if no verification email comes, it looks unfinished.
*Can it wait?* No. Add it when you build auth.

**2. The guided questionnaire as a distinct flow (Module 4)**
This is the core differentiator of Pagemark. The requirements describe it as its own module with progress tracking, skip/revisit, gap analysis, and answer validation. Right now we absorbed it loosely into the AI chat panel. The problem is that the chat panel is free-form — it does not enforce completion, does not track gaps, does not validate answers. If an evaluator reads the requirements and tests this, they will notice it is missing.
*Can it wait?* No. This changes what Pagemark fundamentally is.

**3. File inclusion/exclusion before analysis (Module 2)**
Without this, uploading a large repository with a node_modules folder or a vendor directory will make the analysis slow, noisy, and inaccurate. Users will get documentation generated about their dependencies rather than their own code. This is a practical necessity, not a nice-to-have.
*Can it wait?* No — it should be part of the upload step.

**4. Organization field on registration**
The requirements specifically list name, email, organisation, and role on the registration form. We only designed name and email. This matters because role affects which dashboard the user sees. A developer gets one view, a technical writer gets another, an admin gets the admin panel.
*Can it wait?* Add it to the registration form before you implement auth.

---

## Group 2 — Do These Before Your Final Demo 🟡

These do not break the project but an evaluator will specifically check for them because they are listed explicitly in the requirements. Without them the project looks incomplete even if it works correctly.

**5. Account activity log viewer (Module 1)**
The audit log exists in the backend. This is just a frontend screen where the user sees their own actions. One page, one query.

**6. Role-based dashboards (Module 1)**
We have one dashboard. The requirements specify different views for developer, technical writer, project manager, and admin. At minimum, hide or show different features based on role. The admin should see a user management console. The technical writer should see a documentation-focused view.

**7. API key management (Module 1)**
This means letting users generate personal API keys to call the Pagemark backend programmatically. One table, one endpoint, one settings page section.

**8. Dependency graph visualiser (Module 2)**
We list dependencies as text. The requirements ask for a visual graph. This is one screen on the analysis page. Use a simple force-directed graph library (vis-network or react-flow) showing packages and their relationships. Not complex to add.

**9. AI confidence scores per section (Module 3)**
After generation, show a small confidence indicator next to each section. This can be derived from the AI response — ask Claude to also return a confidence score (0–100) alongside the content. One additional field, one small UI element.

**10. Approval workflow (Modules 6 and 12)**
The requirements describe a formal review and sign-off process separate from comments. Document goes Draft → In Review → Approved. Reviewer is assigned, reviews, approves or requests changes. This is a distinct feature, not the same as share links.

**11. Documentation search with filters (Module 6)**
Search across document content, not just project names. PostgreSQL full-text search is built in. One endpoint, one search bar in the documentation view.

**12. Tagging and categorisation (Module 6)**
Let users tag documents and projects. Filter by tag. Simple feature, high visibility.

**13. Notification preferences and email notifications (Module 12)**
When someone comments on your document or a review is requested, send an email. We have fastapi-mail already installed. This connects modules together and makes the collaboration features actually useful.

**14. NLP processing dashboard (Module 5)**
The requirements want a visible module. At minimum, show: readability score, entity extraction results (key technical terms identified), terminology suggestions. This can be powered by the same Claude call — just ask for this data alongside generation. One dashboard page.

**15. Quality threshold configuration (Module 11)**
Users should be able to set minimum quality scores that trigger warnings. Currently the quality system just shows scores. Adding thresholds makes it actionable.

---

## Group 3 — Mention in Your Report, Skip in Your Build 🟢

These are real requirements but they are either enterprise-scale features, infrastructure concerns, or genuinely out of scope for a student project. Document them as "planned future enhancements" in your report and move on.

**You can safely ignore all of these:**

- Multi-factor authentication — valid security feature, not expected in a student project
- IP whitelisting — enterprise security feature
- Data retention policy manager — compliance feature, not core to the product
- Privacy compliance checklist (GDPR etc.) — legal/compliance layer
- Data anonymisation controls — enterprise feature
- Anomaly detection alerts — requires ML infrastructure beyond the scope
- Real-time monitoring dashboard — DevOps concern
- System health monitoring — same
- Backup and restore UI — infrastructure concern
- Maintenance mode — DevOps
- Licence and subscription management — explicitly excluded in our scope
- XML export — no one will notice
- Scheduled exports — nice but not core
- Batch export — low priority
- Cross-reference and index generation — document publishing concern
- Community forum integration — third-party service, not your system
- AI training feedback interface — requires a feedback loop infrastructure
- User contribution analytics — analytics platform concern
- Onboarding tutorials — content, not engineering
- CI/CD pipeline connection (Module 10) — the full pipeline integration is genuinely complex. The Git sync button covers the spirit of it. State the rest as future work.
- Webhook-driven documentation updates — same as above
- Pull request documentation checker — same
- Branch-specific documentation — same
- Multi-language documentation support — i18n is a project in itself
- Team workspace view — enterprise collaboration feature
- Liveblocks real-time collaboration — as discussed, descope to future

---

## The Updated Task List

Ordered by necessity. Do them in this order after finishing the milestone prompts.

---

### Priority 1 — Must Do (Before Any Demo)

```
AUTH & REGISTRATION
□ Add organization and role fields to registration form
□ Implement email verification flow (send link, verify token, block login until verified)
□ Build account activity log viewer (user's own history)
□ Build role-based dashboard views (developer / technical writer / admin)
□ Add API key generation and management (settings page)

UPLOAD & ANALYSIS
□ Add file exclusion configuration to upload step
  (checkbox list: node_modules, vendor, .git, build, dist, test)
  Exclude selected folders before analysis runs

GUIDED QUESTIONNAIRE (Module 4 — distinct from AI chat)
□ Design the questionnaire as a structured flow separate from free chat
□ Build question progress tracker (Step 2 of 7 style)
□ Implement skip and revisit (questions saved, can return)
□ Add answer validation (required fields, format checking)
□ Build information gap analysis (which sections still lack info)
□ Show example answer previews per question
□ Enable save draft and resume (autosave answers, load on return)
□ Collect relevance feedback per question (thumbs up/down)
```

---

### Priority 2 — Do Before Final Submission

```
ANALYSIS PAGE
□ Build dependency graph visualiser (visual, not just text list)
□ Expand complexity metrics display (per-file breakdown, not just one score)

DOCUMENTATION GENERATION
□ Add AI confidence scores per section (ask Claude, display as small indicator)
□ Add alternative phrasing suggestions (show 2-3 alternatives, user picks one)
□ Add inline terminology consistency checker (highlight inconsistent terms)

DOCUMENTATION MANAGEMENT
□ Add tagging and categorisation to projects and documents
□ Implement full-text search across document content (PostgreSQL FTS)
□ Build approval workflow (Draft → In Review → Approved with assignee)
□ Add per-document access control (beyond project-level sharing)
□ Build collaboration notes section (team notes on a document, not inline comments)
□ Build documentation analytics (views, exports, time spent)

QUALITY MODULE
□ Add quality threshold configuration (user sets minimum scores, get warnings)
□ Add code example validation (check that code blocks are syntactically valid)
□ Build peer review assignment interface

EXPORT
□ Add branding and logo configuration to exports
□ Add batch export (select multiple projects, download as zip)

NOTIFICATIONS
□ Build notification preferences settings page
□ Implement email notifications for:
  - Comment on your document
  - Review assigned to you
  - Section approved or rejected
  - Quality score drops below threshold

NLP DASHBOARD (Module 5)
□ Build NLP processing page showing:
  - Readability score with breakdown
  - Key entity extraction (technical terms identified)
  - Language style analysis (formality score, sentence length)
  - Terminology suggestions
  - Grammar issues list
```

---

### Priority 3 — Mention in Report, Do Not Build

```
These go in your report under "Future Enhancements":

□ Multi-factor authentication
□ IP whitelisting and restriction
□ Data retention policy management
□ Privacy compliance (GDPR) checklist
□ Data anonymisation controls
□ Anomaly detection in audit logs
□ Real-time system monitoring dashboard
□ System health monitoring
□ Backup and restore UI
□ Maintenance mode
□ Licence and subscription management
□ XML export format
□ Scheduled and automated exports
□ Cross-reference and index generation
□ CI/CD pipeline webhooks and automated triggers
□ Pull request documentation checker
□ Branch-specific documentation versions
□ Multi-language documentation support
□ Real-time collaborative editing (Liveblocks / Yjs)
□ Team workspace view
□ Community forum integration
□ AI training feedback loop
□ Onboarding tutorials
□ User contribution analytics
```

---

## The Honest Situation

You have approximately 40 items in Priority 1 and 2. At 5 hours a day with Claude Code, Priority 1 is 1.5 to 2 weeks of work on top of what the milestone prompts already cover. Priority 2 is another 2 to 3 weeks.

The guided questionnaire in Priority 1 is the one that will take the most thought — not code, but design. Before you build it, sit down and sketch what the questions actually look like for a Python REST API project. What does Pagemark ask that a developer cannot answer in 30 seconds? That thinking determines whether Module 4 feels like a real feature or a form bolted on to satisfy a checklist.

Everything in Priority 3 is genuinely fine to leave out. No evaluator at this level expects a final year project to include data anonymisation controls or a CI/CD webhook pipeline. What they do expect is that you know what you left out and why.


Great question, and the good news first: **you do not need to start again.** The changes are additive, not destructive. Let me explain the whole picture clearly before we talk about implementation.

---

## How Multi-Tenant Team Tools Actually Work

The mental model you need is this:

```
Platform (Pagemark)
└── Organizations        ← a company, a team, a university department
    ├── Members          ← users who belong to this org
    ├── Roles            ← what each member can do
    └── Projects         ← documentation projects owned by the org
        ├── Documents
        └── Sections
```

Right now your system is:

```
Platform (Pagemark)
└── Users
    └── Projects (owned by user)
```

The shift is that **projects move from being owned by a user to being owned by an organization**. Users belong to organizations. Everything else flows from that.

This is how every team tool works. GitHub repositories belong to organizations or users. Notion pages belong to workspaces. Linear issues belong to teams. The pattern is always the same.

---

## The Four Concepts You Need to Understand

### 1. Organizations (the top-level container)

An organization is a shared space. When a company signs up for Pagemark, they create one organization. All their projects live inside it. All their team members are invited into it.

```
Organization: "Kigali Best Solutions"
  Members: Alice (admin), Bob (developer), Carol (technical writer)
  Projects: E-Commerce API, Internal Tools, Client Portal
```

A user can belong to multiple organizations. A developer might work for two companies, each with their own Pagemark organization.

### 2. Roles (what each member can do within an org)

Roles are not global — they are per-organization. Alice might be an admin in "Kigali Best Solutions" but just a member in another organization.

For Pagemark, the roles from the requirements map like this:

```
Admin          → manages the org: invite/remove members, billing, settings
Project Manager→ creates projects, assigns reviewers, sees all projects
Developer      → creates and edits documentation, runs code analysis
Technical Writer→ refines and publishes documentation, manages reviews
Viewer         → read-only access to published documentation
```

### 3. Membership (the link between users and organizations)

A membership record connects a user to an organization and gives them a role:

```
User Alice → Organization "Kigali Best Solutions" → Role: Admin
User Bob   → Organization "Kigali Best Solutions" → Role: Developer
User Bob   → Organization "Freelance Clients"    → Role: Admin
```

Bob belongs to two organizations. In one he is a regular developer. In the other he is the admin because it is his personal freelance workspace.

### 4. The Personal Organization

Here is how you avoid breaking what you already built: **every user gets a personal organization automatically when they register**. It has the same name as them. They are the only admin. They can use Pagemark exactly as it works today — purely personally.

When they want to collaborate, they either create a new organization or get invited to an existing one. They switch between organizations using a context switcher in the header.

This is exactly how GitHub works: every user has a personal account (their personal org) and can also belong to team organizations. How Linear works: personal workspace by default, join a team workspace to collaborate. How Notion works: personal space by default, join a team workspace.

This design means your existing users do not lose anything. Their current projects just live in their personal organization.

---

## The Updated Data Model

Here is what changes in your database. This is the minimum addition to support everything the requirements describe.

```
EXISTING (keep as-is):
  users (id, email, password_hash, name, avatar_url, created_at)

NEW:
  organizations
    id, name, slug (unique URL-safe name), avatar_url,
    created_by → users, created_at, personal (boolean)
    -- personal=true means it is a user's personal org

  organization_members  ← the join table
    id, org_id → organizations, user_id → users,
    role (enum: admin, project_manager, developer, technical_writer, viewer),
    invited_by → users, joined_at, status (enum: active, invited, suspended)

CHANGED:
  projects
    -- Remove: owner_id → users
    -- Add:    org_id → organizations
    -- Add:    created_by → users (who created it, for attribution)
    -- Keep everything else unchanged
```

That is the entire schema change. Three new fields, two new tables.

---

## How the Role System Works in Practice

Every action in the backend checks two things in order:

**Step 1:** Is the user a member of the organization that owns this project?
**Step 2:** Does their role allow this specific action?

```python
# In app/dependencies.py

async def require_org_role(
    required_roles: list[str],
    org_id: int,
    current_user: User,
    db: AsyncSession
) -> OrganizationMember:
    membership = await db.execute(
        select(OrganizationMember).where(
            OrganizationMember.org_id == org_id,
            OrganizationMember.user_id == current_user.id,
            OrganizationMember.status == "active"
        )
    )
    member = membership.scalar_one_or_none()
    if not member:
        raise HTTPException(404, "Not found")  # Never reveal the org exists
    if member.role not in required_roles:
        raise HTTPException(403, "Insufficient permissions")
    return member
```

Then in each router:

```python
# Only admins and project managers can create projects
@router.post("/organizations/{org_id}/projects")
async def create_project(
    org_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    await require_org_role(
        ["admin", "project_manager"],
        org_id, current_user, db
    )
    # ... create project

# All active members can view projects
@router.get("/organizations/{org_id}/projects")
async def list_projects(
    org_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    await require_org_role(
        ["admin", "project_manager", "developer", "technical_writer", "viewer"],
        org_id, current_user, db
    )
    # ... list projects
```

### Role Permission Matrix

```
Action                      Admin  PM    Dev   TW    Viewer
─────────────────────────────────────────────────────────
Invite/remove members         ✓
Change member roles           ✓
Delete organization           ✓
Create projects               ✓     ✓
Delete projects               ✓     ✓
View all projects             ✓     ✓     ✓     ✓     ✓
Upload code / run analysis    ✓     ✓     ✓
Edit documentation            ✓     ✓     ✓     ✓
AI generate / prefill         ✓     ✓     ✓     ✓
Submit for review             ✓     ✓     ✓     ✓
Review and approve docs       ✓     ✓           ✓
Export documentation          ✓     ✓     ✓     ✓     ✓
View quality reports          ✓     ✓     ✓     ✓     ✓
Configure quality thresholds  ✓     ✓
Manage templates              ✓           
View audit logs               ✓     ✓
Manage org settings           ✓
```

---

## The Multiple Dashboards

The requirements say different roles get different dashboards. This does not mean completely different pages — it means the same dashboard shows different things depending on role. Think of how GitHub shows different things to a repo admin vs a contributor.

Here is what changes per role on the dashboard:

```
ADMIN sees:
  - All projects in the org
  - Member management tab (invite, remove, change roles)
  - Organization settings
  - Audit logs
  - Usage statistics (how many AI tokens used, storage, exports)

PROJECT MANAGER sees:
  - All projects in the org
  - Review assignment dashboard (who is reviewing what)
  - Project status overview
  - Quality scores across all projects
  - No member management

DEVELOPER sees:
  - Projects they are assigned to (or all if org settings allow)
  - Code analysis results
  - Their documentation tasks
  - AI generation tools

TECHNICAL WRITER sees:
  - Projects assigned for documentation review
  - Review queue (what needs their attention)
  - Quality dashboard
  - Terminology and style guide management

VIEWER sees:
  - Read-only view of published documentation
  - No editor access
  - Export allowed
```

The implementation is straightforward. The dashboard fetches the user's role in the current organization and conditionally renders tabs and features:

```typescript
// In DashboardPage.tsx
const { role } = useCurrentOrgMembership()

const tabs = [
  { label: "Projects", show: true },
  { label: "Reviews", show: ["admin","project_manager","technical_writer"].includes(role) },
  { label: "Members", show: role === "admin" },
  { label: "Analytics", show: ["admin","project_manager"].includes(role) },
  { label: "Settings", show: role === "admin" },
]
```

---

## The Onboarding Flow

This is where the user experience comes together. Here is the full flow from registration to using the team features:

### New User Registration

```
1. Fill registration form:
   Name, Email, Password, Organization (optional)

   If they fill in Organization:
     → Check if an org with that name exists
     → If yes: "An organization with this name exists.
                Request to join or create a new one?"
     → If no: create the org, make them admin

   If they leave Organization blank:
     → Create their personal org automatically
     → Name it "{their name}'s workspace"

2. Email verification sent
   → Click link in email
   → Account activated

3. Onboarding wizard (first login only, 3 steps):

   Step 1: "What best describes you?"
     [ ] Developer        [ ] Technical Writer
     [ ] Project Manager  [ ] Team Lead / Admin
     → Sets their default role preference, customizes their dashboard

   Step 2: "How will you use Pagemark?"
     [ ] Personal projects (just me)
     [ ] Team collaboration
     [ ] Both
     → If Team: prompt to invite teammates or create/join an org

   Step 3: "Create your first project"
     → Skip or create (jumps to project creation wizard)

4. Land on dashboard in their personal org (or the org they created)
```

### Joining an Organization

Two paths:

**Path A — Invited by admin:**
```
Admin sends invite to email address
→ User receives email: "Alice invited you to Kigali Best Solutions on Pagemark"
→ Click "Accept invitation"
→ If already registered: land on that org's dashboard
→ If not registered: registration form pre-filled with email,
  after register → land on that org's dashboard
```

**Path B — Request to join:**
```
User goes to /join or enters org name during registration
→ Sees org profile: name, member count, public projects (if any)
→ Clicks "Request to join"
→ Admin receives notification: "Bob requested to join your organization"
→ Admin approves or denies in Members tab
```

### Switching Between Organizations

The header has an organization switcher — a dropdown showing all orgs the user belongs to:

```
┌─────────────────────────────┐
│ pagemark              [↕]   │  ← current org name + switcher button
└─────────────────────────────┘
  Dropdown opens:
  ● Kigali Best Solutions  (current)
  ○ My Personal Workspace
  ○ Client Project X
  ─────────────────────────────
  + Create new organization
  + Join an organization
```

Selecting a different org reloads the dashboard in that org's context. All projects, members, and settings are scoped to the selected org.

---

## Will You Have to Start Again?

No. Here is exactly what changes and what stays the same.

### Things That Stay Exactly the Same

- The entire editor (middle panel, TOC, AI panel, composer)
- All section and document logic
- Code analysis engine
- AI generation and prefill
- Quality scoring
- Export system
- Version history and diff
- The visual design system

### Things That Change (additive, not replacements)

**Database:** Add two tables, change one field on projects.

```sql
-- Add these two tables
CREATE TABLE organizations (...);
CREATE TABLE organization_members (...);

-- Change this one field on projects
ALTER TABLE projects DROP COLUMN owner_id;
ALTER TABLE projects ADD COLUMN org_id INTEGER REFERENCES organizations(id);
ALTER TABLE projects ADD COLUMN created_by INTEGER REFERENCES users(id);
```

**Auth flow:** Add the organization creation step to registration. Add email verification. Neither replaces what exists — they extend it.

**Ownership checks:** Replace `project.owner_id == current_user.id` with `require_org_role(...)`. A find-and-replace across your routers with a slightly different dependency. The logic is the same — just one level higher.

**Dashboard:** Add the org switcher to the header. Add conditional rendering of tabs based on role. The project cards and everything inside them stay the same.

**API routes:** Add `/organizations/` prefix to project routes. Your projects are now at `/organizations/{org_id}/projects` instead of `/projects`. The frontend just needs to include the org_id in requests, which it gets from the org switcher state in Zustand.

---

## The Zustand Store Change

Add one store:

```typescript
// src/store/orgStore.ts
interface OrgStore {
  currentOrg: Organization | null
  currentRole: Role | null
  orgs: Organization[]
  setCurrentOrg: (org: Organization, role: Role) => void
  setOrgs: (orgs: Organization[]) => void
}
```

Every API call that currently goes to `/projects/...` now goes to `/organizations/${orgStore.currentOrg.id}/projects/...`. The switch is mechanical — one variable added to every API function.

---

## The Practical Sequence

Since you have already started, here is the exact order to make the transition without breaking what you have:

**Week 1:**
Run the database migration. Add the two tables. Update the projects table. Write the `require_org_role` dependency. Update every router to use it. At the end of this week, everything works exactly as before but the permission system is now org-aware.

**Week 2:**
Build the registration → personal org creation flow. Build the org switcher in the header. Update the Zustand store. Update all API calls to include org_id. At the end of this week, the system correctly scopes data to organizations.

**Week 3:**
Build the invite flow (send email, accept invite, join org). Build the Members tab in the admin dashboard. Add the onboarding wizard for new users. Add role-based conditional rendering on the dashboard.

After these three weeks, you have a proper multi-tenant team tool and nothing you built before is wasted.