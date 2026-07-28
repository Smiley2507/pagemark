# Database Documentation

## Overview

Pagemark uses **PostgreSQL 16** as its primary database, accessed through **SQLAlchemy 2.x** (async via `asyncpg` for the FastAPI application, synchronous via `psycopg2` for Celery workers). Schema migrations are managed by **Alembic** (26 versioned migration files in `backend/alembic/versions/`).

Connection strings:
- **Async** (FastAPI): `postgresql+asyncpg://user:pass@localhost:5432/pagemark`
- **Sync** (Celery): `postgresql+psycopg2://user:pass@localhost:5432/pagemark` (converted from async URL at runtime)

## Enums

The database uses PostgreSQL `ENUM` types defined in SQLAlchemy. There are 24 enums:

| Enum Name | Values | Used By |
|-----------|--------|---------|
| `projectstatus` | `pending`, `draft`, `finalized` | `projects.status` |
| `sourcetype` | `zip`, `git`, `scratch` | `projects.source_type` |
| `roleenum` | `user`, `admin` | `user_roles.role` |
| `orgmemberrole` | `admin`, `project_manager`, `developer`, `technical_writer`, `viewer` | `organization_members.role` |
| `orgmemberstatus` | `active`, `invited`, `suspended` | `organization_members.status` |
| `analysisstatus` | `pending`, `running`, `completed`, `failed` | `analyses.status` |
| `sectionstatus` | `pending`, `draft`, `finalized`, `needs_input` | `sections.status` |
| `sectioncontentlifecycle` | `empty`, `generated_draft`, `reviewed` | `sections.content_lifecycle` |
| `lifecyclestatus` | `active`, `deleted`, `archived` | `sections.lifecycle_status` |
| `documentstatus` | `DRAFT`, `IN_REVIEW`, `APPROVED` | `documents.status` |
| `documentsetupstage` | `purpose`, `template_selection`, `outline_review`, `generation_mode`, `editor_ready` | `documents.setup_stage` |
| `outlineproposalstatus` | `draft`, `approved`, `superseded` | `outline_proposals.status` |
| `outlineproposalbasis` | `template`, `custom_outline`, `analysis_adapted` | `outline_proposals.basis` |
| `templaterecommendationbasis` | `rule_based`, `ai_personalized`, `custom_outline_seeded` | `template_recommendations.basis` |
| `generationmode` | `complete_document`, `section_on_demand` | `generation_runs.mode` |
| `generationrunstatus` | `pending`, `running`, `paused`, `completed`, `failed`, `canceled` | `generation_runs.status` |
| `generationtaskstatus` | `queued`, `generating`, `ready`, `paused`, `failed`, `skipped` | `generation_section_tasks.status` |
| `failoverstate` | `not_required`, `needs_confirmation`, `confirmed`, `declined` | `generation_runs.failover_state` |
| `authortype` | `user`, `ai` | `section_versions.author_type` |
| `messagerole` | `user`, `ai` | `chat_messages.role` |
| `clarificationstatus` | `pending`, `resolved`, `skipped` | `clarification_requests.status` |
| `issueseverity` | `error`, `warning`, `info` | `quality_issues.severity` |
| `resourcetype` | `upload`, `note`, `document`, `section`, `repo_file`, `symbol`, `analysis`, `transient` | `resources.type` |
| `documentsharepermission` | `view`, `comment`, `edit` | `document_shares.permission` |

## Table: `users`

Stores user accounts for authentication and identity.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | `Integer` | PK, Indexed | Auto-incrementing user ID |
| `email` | `String` | NOT NULL, UNIQUE | User email address (used for login) |
| `password_hash` | `String` | NOT NULL | bcrypt hash of user password |
| `name` | `String` | Nullable | Display name |
| `avatar_url` | `String` | Nullable | Profile avatar URL |
| `is_verified` | `Boolean` | NOT NULL, default false | Whether email has been verified |
| `login_count` | `Integer` | NOT NULL, default 0 | Number of times user has logged in |
| `created_at` | `DateTime` | default utcnow | Account creation timestamp |
| `updated_at` | `DateTime` | onupdate utcnow | Last update timestamp |

**Indexes**: `ix_users_id` (PK), `ix_users_email` (unique)

**Relationships**: `roles` (UserRole), `settings` (UserSettings, 1:1), `oauth_tokens` (OAuthToken), `ai_credentials` (UserAiCredential), `resources` (Resource), `notes` (CollaborationNote), `org_memberships` (OrganizationMember), `created_projects` (Project)

## Table: `user_roles`

Associates roles with users (currently simple user/admin model).

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | `Integer` | PK, Indexed | Auto-incrementing ID |
| `user_id` | `Integer` | NOT NULL, FK→users.id | User this role belongs to |
| `role` | `Enum(RoleEnum)` | NOT NULL, default user | Role name (user/admin) |
| `created_at` | `DateTime` | default utcnow | When role was assigned |

## Table: `user_settings`

One-to-one user settings with password reset and email verification tokens.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `user_id` | `Integer` | PK, FK→users.id | User ID (1:1 with users) |
| `notifications_json` | `Text` | Nullable | JSON string of notification preferences |
| `language` | `String` | default "en" | Preferred language |
| `theme` | `String` | default "system" | UI theme preference (light/dark/system) |
| `reset_token` | `String` | Nullable, Indexed | Password reset token |
| `reset_token_expires` | `DateTime` | Nullable | Password reset token expiry |
| `verification_token` | `String` | Nullable, Indexed | Email verification token |
| `verification_token_expires` | `DateTime` | Nullable | Email verification token expiry |

**Indexes**: `ix_user_settings_reset_token`, `ix_user_settings_verification_token`

## Table: `organizations`

Multi-tenant organizations that own projects and manage members.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | `Integer` | PK, Indexed | Auto-incrementing organization ID |
| `name` | `String` | NOT NULL | Organization display name |
| `slug` | `String` | NOT NULL, UNIQUE | URL-friendly slug |
| `avatar_url` | `String` | Nullable | Organization logo URL |
| `created_by` | `Integer` | NOT NULL, FK→users.id | User who created the org |
| `created_at` | `DateTime` | default utcnow | Creation timestamp |
| `personal` | `Boolean` | NOT NULL, default false | Whether this is a personal (auto-created) org |
| `quality_threshold` | `Integer` | NOT NULL, default 70 | Minimum quality score for docs |
| `ai_provider` | `String` | Nullable | Org-level AI provider override |
| `ai_key_encrypted` | `String` | Nullable | Org-level encrypted AI API key |

**Relationships**: `members` (OrganizationMember, cascade delete), `projects` (Project)

## Table: `organization_members`

Membership and role assignments within organizations.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | `Integer` | PK, Indexed | Auto-incrementing ID |
| `org_id` | `Integer` | NOT NULL, FK→organizations.id | Organization |
| `user_id` | `Integer` | NOT NULL, FK→users.id | Member user |
| `role` | `Enum(OrgMemberRole)` | NOT NULL, default DEVELOPER | Member role (admin/pm/developer/technical_writer/viewer) |
| `invited_by` | `Integer` | Nullable, FK→users.id | Who invited this member |
| `joined_at` | `DateTime` | default utcnow | When membership was activated |
| `status` | `Enum(OrgMemberStatus)` | NOT NULL, default ACTIVE | Membership status (active/invited/suspended) |
| `invite_token` | `String` | Nullable, Indexed | Token used for invite acceptance |
| `invite_token_expires` | `DateTime` | Nullable | Invite token expiry |

## Table: `organization_join_links`

Pre-generated join links for self-service organization membership.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | `Integer` | PK, Indexed | Auto-incrementing ID |
| `org_id` | `Integer` | NOT NULL, FK→organizations.id, Indexed | Organization |
| `code` | `String` | NOT NULL, UNIQUE | Unique join code |
| `role` | `Enum(OrgMemberRole)` | NOT NULL, default DEVELOPER | Role to assign |
| `max_uses` | `Integer` | Nullable | Maximum number of uses |
| `use_count` | `Integer` | NOT NULL, default 0 | Current use count |
| `expires_at` | `DateTime` | Nullable | Expiration timestamp |
| `revoked_at` | `DateTime` | Nullable | When link was revoked |
| `created_by` | `Integer` | NOT NULL, FK→users.id | Link creator |
| `created_at` | `DateTime` | default now() | Creation timestamp |

## Table: `projects`

The core unit of organization — a source-connected workspace for documents.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | `Integer` | PK, Indexed | Auto-incrementing project ID |
| `org_id` | `Integer` | NOT NULL, FK→organizations.id | Organization this project belongs to |
| `created_by` | `Integer` | NOT NULL, FK→users.id | User who created the project |
| `name` | `String` | NOT NULL | Project name |
| `description` | `Text` | Nullable | Project description |
| `status` | `Enum(ProjectStatus)` | NOT NULL, default PENDING | Project lifecycle status |
| `source_type` | `Enum(SourceType)` | NOT NULL, default SCRATCH | How source was provided (ZIP/GIT/SCRATCH) |
| `source_provider` | `String` | Nullable | Git provider (github/gitlab) |
| `source_owner` | `String` | Nullable | Repository owner |
| `source_repository` | `String` | Nullable | Repository name |
| `selected_branch` | `String` | Nullable | User-selected branch |
| `default_branch` | `String` | Nullable | Repository default branch |
| `source_visibility` | `String` | Nullable | Repository visibility (public/private) |
| `last_synced_commit` | `String` | Nullable | SHA of last synced commit |
| `source_metadata` | `JSON` | Nullable | Additional source metadata |
| `tags` | `ARRAY(String)` | default [] | Project tags for filtering |
| `starred` | `Boolean` | default false | Whether project is starred |
| `context_md` | `Text` | Nullable | Project context markdown (knowledge base) |
| `export_settings` | `JSON` | Nullable | Default export configuration |
| `deleted_at` | `DateTime` | Nullable | Soft-delete timestamp |
| `created_at` | `DateTime` | default utcnow | Creation timestamp |
| `updated_at` | `DateTime` | onupdate utcnow | Last update timestamp |

**Relationships**: `documents` (cascade delete), `analyses` (cascade delete), `source_exclusions` (cascade delete), `chat_threads`, `resources`, `activity_events`

## Table: `project_source_exclusions`

Glob patterns for excluding files from analysis.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | `Integer` | PK, Indexed | Auto-incrementing ID |
| `project_id` | `Integer` | NOT NULL, FK→projects.id | Project |
| `pattern` | `String` | NOT NULL | Glob pattern (e.g., "*.test.js") |
| `reason` | `Text` | Nullable | Why this exclusion exists |
| `enabled` | `Boolean` | NOT NULL, default true | Whether exclusion is active |
| `created_by` | `Integer` | Nullable, FK→users.id | Who added the exclusion |
| `created_at` | `DateTime` | default utcnow | Creation timestamp |
| `updated_at` | `DateTime` | onupdate utcnow | Last update timestamp |

## Table: `templates`

Reusable documentation intent and outline patterns.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | `Integer` | PK, Indexed | Auto-incrementing template ID |
| `name` | `String` | NOT NULL | Template display name |
| `description` | `Text` | Nullable | Description of what the template is for |
| `category` | `String` | Nullable | Category grouping |
| `purpose` | `Text` | Nullable | Document purpose guidance |
| `intended_audience` | `Text` | Nullable | Who the document is for |
| `expected_outcome` | `Text` | Nullable | What the document should achieve |
| `compatible_repository_traits` | `JSON` | Nullable | Traits that make a repo compatible |
| `estimated_generation_scope` | `JSON` | Nullable | Estimated AI usage for generation |
| `outline_preview` | `JSON` | Nullable | Preview of the outline |
| `sections_json` | `JSON` | Nullable | Array of section definitions |
| `guidance` | `Text` | Nullable | Writing guidance for the template |
| `system_prompt` | `Text` | Nullable | Custom system prompt for AI generation |
| `owner_id` | `Integer` | Nullable, FK→users.id | User who created custom template |
| `is_builtin` | `Boolean` | default false | Whether this is a built-in template |
| `created_at` | `DateTime` | default utcnow | Creation timestamp |

8 built-in templates are seeded at application startup: API Reference, SDK Guide, User Manual, Architecture Doc, Migration Guide, CLI Reference, Contribution Guide, Configuration Guide.

## Table: `documents`

A documentation artifact within a project, managed through its own lifecycle.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | `Integer` | PK, Indexed | Auto-incrementing document ID |
| `project_id` | `Integer` | NOT NULL, FK→projects.id | Parent project |
| `template_id` | `Integer` | Nullable, FK→templates.id | Optional template used |
| `title` | `String` | NOT NULL, default "Documentation" | Document title |
| `status` | `Enum(DocumentStatus)` | NOT NULL, default DRAFT | Workflow status |
| `setup_stage` | `Enum(DocumentSetupStage)` | NOT NULL, default PURPOSE | Current setup wizard stage |
| `purpose` | `Text` | Nullable | Document purpose (defined by user during setup) |
| `audience` | `Text` | Nullable | Target audience |
| `context` | `Text` | Nullable | Document-level context for AI |
| `custom_outline_metadata` | `JSON` | Nullable | Data for custom outline creation |
| `tags` | `JSON` | Nullable | Document tags |
| `export_settings` | `JSON` | Nullable | Per-document export settings |
| `freshness_state` | `String` | Nullable | Current freshness state |
| `sharing_settings` | `JSON` | Nullable | Sharing configuration |
| `reviewer_id` | `Integer` | Nullable, FK→users.id | Assigned reviewer |
| `approved_at` | `DateTime` | Nullable | When document was approved |
| `created_at` | `DateTime` | default utcnow | Creation timestamp |
| `updated_at` | `DateTime` | onupdate utcnow | Last update timestamp |

**Relationships**: `sections` (cascade delete), `outline_proposals` (cascade delete), `template_recommendations` (cascade delete), `generation_runs` (cascade delete), `quality_reports` (cascade delete), `notes`, `shares`

## Table: `sections`

Individual sections within a document — the fundamental unit of content.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | `Integer` | PK, Indexed | Auto-incrementing section ID |
| `document_id` | `Integer` | NOT NULL, FK→documents.id | Parent document |
| `parent_id` | `Integer` | Nullable, FK→sections.id | Parent section (for nesting) |
| `order_index` | `Integer` | NOT NULL, default 0 | Display order within document/parent |
| `heading` | `String` | NOT NULL | Section heading text |
| `title` | `String` | Nullable | Alternative title |
| `is_custom` | `Boolean` | default false | Whether user created this manually |
| `lifecycle_status` | `Enum(LifecycleStatus)` | NOT NULL, default ACTIVE | Soft-delete/archive status |
| `confidence_score` | `Integer` | Nullable | AI confidence in generated content (0-100) |
| `content_md` | `Text` | default "" | Durable Markdown content. In collaborative mode this is the latest backend snapshot of the Liveblocks/Tiptap editor state. |
| `content_lifecycle` | `Enum(SectionContentLifecycle)` | NOT NULL, default EMPTY | Content state (empty/generated_draft/reviewed) |
| `status` | `Enum(SectionStatus)` | NOT NULL, default PENDING | Workflow status |
| `needs_input` | `Boolean` | NOT NULL, default false | Whether AI requires user clarification |
| `is_generating` | `Boolean` | NOT NULL, default false | Whether AI is currently generating |
| `has_failed` | `Boolean` | NOT NULL, default false | Whether generation failed |
| `is_potentially_stale` | `Boolean` | NOT NULL, default false | Whether source changes may have made this stale |
| `workflow_metadata` | `JSON` | Nullable | Additional workflow state |
| `reviewed_by` | `Integer` | Nullable, FK→users.id | Who reviewed this section |
| `reviewed_at` | `DateTime` | Nullable | When it was reviewed |
| `reviewed_against_analysis_id` | `Integer` | Nullable, FK→analyses.id | Analysis snapshot at review time |
| `created_at` | `DateTime` | default utcnow | Creation timestamp |
| `updated_at` | `DateTime` | onupdate utcnow | Last update timestamp |

**Relationships**: `evidence_references` (cascade delete), `versions` (cascade delete), `clarification_requests` (cascade delete), `notes`, self-referential `parent`/`children`

## Table: `section_versions`

Immutable version history for section content.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | `Integer` | PK, Indexed | Auto-incrementing version ID |
| `section_id` | `Integer` | NOT NULL, FK→sections.id | Parent section |
| `content_md` | `Text` | NOT NULL | Full markdown content at this version |
| `author_type` | `Enum(AuthorType)` | NOT NULL, default USER | Whether USER or AI made this change |
| `summary` | `String` | Nullable | Human-readable change summary |
| `added` | `Integer` | NOT NULL, default 0 | Lines added |
| `removed` | `Integer` | NOT NULL, default 0 | Lines removed |
| `modified` | `Integer` | NOT NULL, default 0 | Lines modified |
| `created_at` | `DateTime` | default utcnow | Version creation timestamp |

## Table: `analyses`

Immutable snapshots of code analysis results for a project.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | `Integer` | PK, Indexed | Auto-incrementing analysis ID |
| `project_id` | `Integer` | NOT NULL, FK→projects.id | Parent project |
| `status` | `Enum(AnalysisStatus)` | NOT NULL, default PENDING | Analysis status |
| `current_step` | `String` | Nullable | Current pipeline step name |
| `step_number` | `Integer` | default 0 | Current pipeline step index |
| `step_detail` | `String` | Nullable | Human-readable step detail |
| `total_steps` | `Integer` | default 8 | Total pipeline steps |
| `source_type` | `String` | NOT NULL | Type of source (zip/git) |
| `source_path` | `String` | Nullable | Local path to extracted source |
| `source_commit` | `String` | Nullable | Source commit SHA (for git sources) |
| `is_current` | `Boolean` | NOT NULL, default false | Whether this is the active/latest snapshot |
| `effective_exclusions_json` | `JSON` | Nullable | Exclusion rules used for this analysis |
| `source_metadata` | `JSON` | Nullable | Metadata about the source |
| `file_tree_json` | `JSON` | Nullable | File tree structure |
| `languages_json` | `JSON` | Nullable | Language breakdown |
| `endpoints_json` | `JSON` | Nullable | Detected API endpoints |
| `complexity_json` | `JSON` | Nullable | Complexity metrics |
| `analysis_data` | `JSON` | Nullable | Additional analysis data (dependencies, available/unavailable facts) |
| `file_contents_json` | `JSON` | Nullable | File contents (capped at 50 files, 100KB each) |
| `error_message` | `Text` | Nullable | Error information if failed |
| `started_at` | `DateTime` | Nullable | When analysis started |
| `completed_at` | `DateTime` | Nullable | When analysis completed |
| `created_at` | `DateTime` | default utcnow | Creation timestamp |
| `updated_at` | `DateTime` | onupdate utcnow | Last update timestamp |

Each analysis also has transient runtime attributes (not persisted in DB): `outline_json`, `outline_applied`, `outline_skipped`, `outline_skip_reason`.

## Table: `outline_proposals`

Versioned outline proposals for a document. Once approved, they become immutable.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | `Integer` | PK, Indexed | Auto-incrementing ID |
| `document_id` | `Integer` | NOT NULL, FK→documents.id | Parent document |
| `analysis_id` | `Integer` | Nullable, FK→analyses.id | Analysis snapshot used |
| `basis` | `Enum(OutlineProposalBasis)` | NOT NULL | How outline was created |
| `status` | `Enum(OutlineProposalStatus)` | NOT NULL, default DRAFT | Approval status |
| `version` | `Integer` | NOT NULL, default 1 | Sequential version number |
| `outline_json` | `JSON` | NOT NULL | The outline sections array |
| `explanation_json` | `JSON` | Nullable | Explanation of the proposal |
| `approved_by` | `Integer` | Nullable, FK→users.id | Who approved |
| `approved_at` | `DateTime` | Nullable | When approved |
| `approval_metadata` | `JSON` | Nullable | Additional approval data |
| `superseded_at` | `DateTime` | Nullable | When superseded by newer version |
| `created_at` | `DateTime` | default utcnow | Creation timestamp |

**Immutability**: An SQLAlchemy `before_update` event listener prevents modification of approved outlines.

## Table: `template_recommendations`

Persisted template recommendations for a document's setup flow.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | `Integer` | PK, Indexed | Auto-incrementing ID |
| `document_id` | `Integer` | NOT NULL, FK→documents.id | Parent document |
| `analysis_id` | `Integer` | Nullable, FK→analyses.id | Analysis snapshot used |
| `template_id` | `Integer` | Nullable, FK→templates.id | Recommended template |
| `basis` | `Enum(TemplateRecommendationBasis)` | NOT NULL | How this recommendation was generated |
| `score` | `Float` | Nullable | Recommendation score (0-1) |
| `explanation` | `Text` | Nullable | Why this template was recommended |
| `supporting_facts_json` | `JSON` | Nullable | Analysis facts supporting this recommendation |
| `provider_usage_ref` | `JSON` | Nullable | AI provider usage for AI-personalized recommendations |
| `created_at` | `DateTime` | default utcnow | Creation timestamp |

## Table: `generation_runs`

Records of document-level AI generation attempts.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | `Integer` | PK, Indexed | Auto-incrementing ID |
| `document_id` | `Integer` | NOT NULL, FK→documents.id | Parent document |
| `mode` | `Enum(GenerationMode)` | NOT NULL | Complete document or section on demand |
| `intended_provider` | `String` | Nullable | Intended AI provider |
| `intended_model` | `String` | Nullable | Intended AI model |
| `status` | `Enum(GenerationRunStatus)` | NOT NULL, default PENDING | Run status |
| `failover_state` | `Enum(FailoverState)` | NOT NULL, default NOT_REQUIRED | Provider failover state |
| `estimated_prompt_tokens` | `Integer` | Nullable | Estimated prompt tokens |
| `estimated_completion_tokens` | `Integer` | Nullable | Estimated completion tokens |
| `estimated_cost` | `Float` | Nullable | Estimated cost (USD) |
| `actual_prompt_tokens` | `Integer` | Nullable | Actual prompt tokens used |
| `actual_completion_tokens` | `Integer` | Nullable | Actual completion tokens used |
| `actual_cost` | `Float` | Nullable | Actual cost (USD) |
| `error_message` | `Text` | Nullable | Error description if failed |
| `run_metadata` | `JSON` | Nullable | Additional run data |
| `started_at` | `DateTime` | Nullable | When generation started |
| `completed_at` | `DateTime` | Nullable | When generation completed |
| `created_at` | `DateTime` | default utcnow | Creation timestamp |
| `updated_at` | `DateTime` | onupdate utcnow | Last update timestamp |

## Table: `generation_section_tasks`

Individual section tasks within a generation run.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | `Integer` | PK, Indexed | Auto-incrementing ID |
| `generation_run_id` | `Integer` | NOT NULL, FK→generation_runs.id | Parent generation run |
| `section_id` | `Integer` | NOT NULL, FK→sections.id | Section to generate |
| `status` | `Enum(GenerationTaskStatus)` | NOT NULL, default QUEUED | Task status |
| `dependency_section_ids` | `JSON` | Nullable | Section IDs this task depends on |
| `actual_provider` | `String` | Nullable | Provider actually used |
| `actual_model` | `String` | Nullable | Model actually used |
| `prompt_tokens` | `Integer` | Nullable | Prompt tokens consumed |
| `completion_tokens` | `Integer` | Nullable | Completion tokens consumed |
| `cost` | `Float` | Nullable | Cost incurred (USD) |
| `error_message` | `Text` | Nullable | Error description |
| `task_metadata` | `JSON` | Nullable | Additional task data |
| `started_at` | `DateTime` | Nullable | When task started |
| `completed_at` | `DateTime` | Nullable | When task completed |
| `created_at` | `DateTime` | default utcnow | Creation timestamp |
| `updated_at` | `DateTime` | onupdate utcnow | Last update timestamp |

## Table: `evidence_references`

Links from section content to analysis artifacts (source files, symbols, etc.).

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | `Integer` | PK, Indexed | Auto-incrementing ID |
| `section_id` | `Integer` | NOT NULL, FK→sections.id | Parent section |
| `claim_anchor` | `String` | Nullable | Text anchor in the section content |
| `analysis_id` | `Integer` | NOT NULL, FK→analyses.id | Analysis snapshot |
| `artifact_type` | `String` | NOT NULL | Type of artifact (endpoint, class, function, etc.) |
| `path` | `String` | Nullable | Source file path |
| `symbol` | `String` | Nullable | Symbol name |
| `line_range_hint` | `JSON` | Nullable | Line range [start, end] |
| `reference_metadata` | `JSON` | Nullable | Additional reference data |
| `created_at` | `DateTime` | default utcnow | Creation timestamp |

## Table: `activity_events`

Tracks meaningful workflow events for timeline and heatmap display.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | `Integer` | PK, Indexed | Auto-incrementing ID |
| `project_id` | `Integer` | NOT NULL, FK→projects.id | Parent project |
| `event_type` | `String` | NOT NULL | Type of event (e.g., "section.reviewed", "analysis.completed") |
| `weight` | `Float` | NOT NULL, default 1.0 | Weight for heatmap intensity |
| `analysis_id` | `Integer` | Nullable, FK→analyses.id | Related analysis |
| `document_id` | `Integer` | Nullable, FK→documents.id | Related document |
| `section_id` | `Integer` | Nullable, FK→sections.id | Related section |
| `generation_run_id` | `Integer` | Nullable, FK→generation_runs.id | Related generation run |
| `payload` | `JSON` | Nullable | Event-specific data |
| `created_at` | `DateTime` | default utcnow | Event timestamp |

## Table: `evidence_references`

(See above — listed twice in original schema, skipping duplicate)

## Table: `workspace_preferences`

User-specific view preferences for different surfaces.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | `Integer` | PK, Indexed | Auto-incrementing ID |
| `user_id` | `Integer` | NOT NULL, FK→users.id | User |
| `surface` | `String` | NOT NULL | Surface identifier (e.g., "project_library", "document_list") |
| `context_id` | `String` | Nullable | Optional context (e.g., project ID) |
| `preferences_json` | `JSON` | NOT NULL | Preference values |
| `created_at` | `DateTime` | default utcnow | Creation timestamp |
| `updated_at` | `DateTime` | onupdate utcnow | Last update timestamp |

**Unique Constraint**: (`user_id`, `surface`, `context_id`)

## Table: `oauth_tokens`

Encrypted OAuth tokens for GitHub/GitLab integration.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | `Integer` | PK, Indexed | Auto-incrementing ID |
| `user_id` | `Integer` | NOT NULL, FK→users.id | User |
| `provider` | `String` | NOT NULL | Provider name (github/gitlab) |
| `access_token_encrypted` | `String` | NOT NULL | Fernet-encrypted access token |
| `token_scope` | `String` | Nullable | OAuth scope |
| `created_at` | `DateTime` | default utcnow | Creation timestamp |
| `updated_at` | `DateTime` | onupdate utcnow | Last update timestamp |

## Table: `user_ai_credentials`

BYOK AI provider credentials. One active credential per user per provider.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | `Integer` | PK, Indexed | Auto-incrementing ID |
| `user_id` | `Integer` | NOT NULL, FK→users.id, Indexed | User |
| `provider` | `String` | NOT NULL | Provider name (anthropic/google) |
| `api_key_encrypted` | `String` | NOT NULL | Fernet-encrypted API key |
| `model_id` | `String` | NOT NULL | Model identifier |
| `is_active` | `Boolean` | NOT NULL, default false | Whether this is the active credential |
| `key_hint` | `String` | NOT NULL | Last 4 characters of API key |
| `validated_at` | `DateTime` | Nullable | Last successful validation |
| `created_at` | `DateTime` | default utcnow | Creation timestamp |
| `updated_at` | `DateTime` | onupdate utcnow | Last update timestamp |

**Unique Constraint**: (`user_id`, `provider`)

## Table: `chat_threads`

AI chat conversation threads scoped to a project.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | `Integer` | PK, Indexed | Auto-incrementing ID |
| `project_id` | `Integer` | NOT NULL, FK→projects.id | Parent project |
| `title` | `String` | NOT NULL, default "New Chat" | Thread title |
| `created_at` | `DateTime` | default utcnow | Creation timestamp |
| `updated_at` | `DateTime` | onupdate utcnow | Last update timestamp |

## Table: `chat_messages`

Individual messages within a chat thread.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | `Integer` | PK, Indexed | Auto-incrementing ID |
| `thread_id` | `Integer` | NOT NULL, FK→chat_threads.id | Parent thread |
| `role` | `Enum(MessageRole)` | NOT NULL | Message role (user/ai) |
| `content` | `Text` | NOT NULL | Message content |
| `created_at` | `DateTime` | default utcnow | Message timestamp |

## Table: `chat_message_resources`

Associates resources (files, analysis data) with chat messages.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | `Integer` | PK, Indexed | Auto-incrementing ID |
| `message_id` | `Integer` | NOT NULL, FK→chat_messages.id | Parent message |
| `resource_id` | `Integer` | NOT NULL, FK→resources.id | Attached resource |
| `order_index` | `Integer` | NOT NULL, default 0 | Display order |

## Table: `resources`

Generic resource storage for uploaded files, extracted text, analysis data, etc.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | `Integer` | PK, Indexed | Auto-incrementing ID |
| `project_id` | `Integer` | NOT NULL, FK→projects.id | Parent project |
| `type` | `Enum(ResourceType)` | NOT NULL | Resource type |
| `original_name` | `String` | NOT NULL | Original filename |
| `mime_type` | `String` | Nullable | MIME type |
| `size_bytes` | `Integer` | Nullable | File size |
| `data` | `LargeBinary` | Nullable | Raw binary data |
| `extracted_text` | `Text` | Nullable | Extracted text content |
| `thumbnail` | `LargeBinary` | Nullable | Thumbnail image data |
| `reference_type` | `String` | Nullable | Reference type (section/file/symbol) |
| `reference_id` | `Integer` | Nullable | Reference entity ID |
| `file_path` | `String` | Nullable | Source file path |
| `symbol_name` | `String` | Nullable | Source symbol name |
| `created_by` | `Integer` | NOT NULL, FK→users.id | Uploader |
| `created_at` | `DateTime` | default utcnow | Creation timestamp |
| `updated_at` | `DateTime` | onupdate utcnow | Last update timestamp |

## Table: `quality_reports`

Document quality scoring results. One report per document (unique constraint on `document_id`).

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | `Integer` | PK, Indexed | Auto-incrementing ID |
| `document_id` | `Integer` | NOT NULL, FK→documents.id | Parent document |
| `overall_score` | `Float` | NOT NULL, default 0.0 | Overall quality score (0-100) |
| `completeness` | `Float` | NOT NULL, default 0.0 | Completeness sub-score |
| `consistency` | `Float` | NOT NULL, default 0.0 | Consistency sub-score |
| `readability` | `Float` | NOT NULL, default 0.0 | Readability sub-score |
| `accuracy` | `Float` | NOT NULL, default 0.0 | Accuracy sub-score |
| `generated_at` | `DateTime` | default utcnow | Report generation timestamp |

## Table: `quality_issues`

Legacy per-report quality issues found in a quality report. Durable user-visible lifecycle lives in `quality_findings`.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | `Integer` | PK, Indexed | Auto-incrementing ID |
| `report_id` | `Integer` | NOT NULL, FK→quality_reports.id | Parent report |
| `severity` | `Enum(IssueSeverity)` | NOT NULL, default INFO | Issue severity |
| `section_ref` | `String` | Nullable | Reference to affected section |
| `message` | `Text` | NOT NULL | Issue description |
| `suggestion` | `Text` | Nullable | Fix suggestion |

## Table: `quality_findings`

Durable actionable Document/Section-level quality findings. Findings can come from quality scoring, grammar/spelling, terminology consistency, broken links, readability, or acceptance coverage.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | `Integer` | PK, Indexed | Auto-incrementing ID |
| `document_id` | `Integer` | NOT NULL, FK→documents.id | Parent document |
| `report_id` | `Integer` | Nullable, FK→quality_reports.id | Latest related report, if any |
| `category` | `Enum(QualityFindingCategory)` | NOT NULL | completeness, acceptance, terminology, links, readability, grammar, accuracy |
| `status` | `Enum(QualityFindingStatus)` | NOT NULL, default OPEN | open, proposed, resolved, dismissed |
| `severity` | `Enum(IssueSeverity)` | NOT NULL, default INFO | Finding severity |
| `section_id` | `Integer` | Nullable, FK→sections.id | Affected Section |
| `section_ref` | `String` | Nullable | Human-readable Section reference |
| `message` | `Text` | NOT NULL | Finding description |
| `suggestion` | `Text` | Nullable | Suggested correction or next action |
| `quote` | `Text` | Nullable | Offending text quote for grammar/range fallback |
| `offset` | `Integer` | Nullable | Advisory text offset |
| `length` | `Integer` | Nullable | Advisory text length |
| `replacements` | `JSON` | Nullable | Provider replacement strings |
| `rule_id` | `String` | Nullable | Provider rule id |
| `content_fingerprint` | `String` | NOT NULL | Stable fingerprint used to preserve lifecycle across reruns |
| `provider` | `String` | Nullable | Source provider, such as LanguageTool |
| `provider_metadata` | `JSON` | Nullable | Provider-specific metadata |
| `stale_location` | `Boolean` | NOT NULL, default false | Offset may no longer match current content |
| `first_seen_at` | `DateTime` | default utcnow | First observation timestamp |
| `last_seen_at` | `DateTime` | onupdate utcnow | Last observation timestamp |

## Table: `broken_links`

Broken URL references found in quality checks.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | `Integer` | PK, Indexed | Auto-incrementing ID |
| `report_id` | `Integer` | NOT NULL, FK→quality_reports.id | Parent report |
| `url` | `String` | NOT NULL | The broken URL |
| `status_code` | `Integer` | Nullable | HTTP status code (null = connection error) |
| `section_ref` | `String` | Nullable | Reference to affected section |

## Table: `audit_logs`

Administrative audit trail for organization-level actions.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | `Integer` | PK, Indexed | Auto-incrementing ID |
| `user_id` | `Integer` | NOT NULL, FK→users.id | User who performed action |
| `org_id` | `Integer` | Nullable, FK→organizations.id | Organization |
| `action` | `String` | NOT NULL | Action performed |
| `resource` | `String` | Nullable | Resource acted upon |
| `created_at` | `DateTime` | default utcnow, Indexed | Action timestamp |

## Table: `user_api_keys`

Programmatic API keys for external access.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | `Integer` | PK, Indexed | Auto-incrementing ID |
| `user_id` | `Integer` | NOT NULL, FK→users.id | Key owner |
| `name` | `String` | NOT NULL | Key identifier name |
| `key_hash` | `String` | NOT NULL, UNIQUE | Hashed API key value |
| `created_at` | `DateTime` | default utcnow | Creation timestamp |
| `expires_at` | `DateTime` | Nullable | Expiration timestamp |

## Table: `clarification_requests`

Targeted questions from the AI to the maintainer during outline/generation.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | `Integer` | PK, Indexed | Auto-incrementing ID |
| `section_id` | `Integer` | Nullable, FK→sections.id | Related section |
| `document_id` | `Integer` | Nullable, FK→documents.id | Related document |
| `outline_proposal_id` | `Integer` | Nullable, FK→outline_proposals.id | Related outline proposal |
| `question` | `Text` | NOT NULL | The AI's question |
| `user_answer` | `Text` | Nullable | Maintainer's answer |
| `affected_sections_json` | `JSON` | Nullable | Sections this question affects |
| `confidence_tradeoff` | `Text` | Nullable | What confidence is lost if skipped |
| `status` | `Enum(ClarificationStatus)` | NOT NULL, default PENDING | Pending/resolved/skipped |
| `created_at` | `DateTime` | default utcnow | Creation timestamp |
| `resolved_at` | `DateTime` | Nullable | Resolution timestamp |
| `skipped_at` | `DateTime` | Nullable | Skip timestamp |

## Table: `collaboration_notes`

User-authored notes on documents and sections for collaboration.

These are backend-owned, append-only notes. They are separate from Liveblocks comment threads, which are stored in Liveblocks rooms and rendered inside the collaborative editor UI.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | `Integer` | PK, Indexed | Auto-incrementing ID |
| `document_id` | `Integer` | NOT NULL, FK→documents.id | Parent document |
| `section_id` | `Integer` | Nullable, FK→sections.id | Optional section scope |
| `user_id` | `Integer` | NOT NULL, FK→users.id | Note author |
| `content` | `Text` | NOT NULL | Note content |
| `created_at` | `DateTime` | default utcnow | Creation timestamp |

## Table: `nlp_reports`

NLP analysis results for project documentation.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | `Integer` | PK, Indexed | Auto-incrementing ID |
| `project_id` | `Integer` | NOT NULL, FK→projects.id | Parent project |
| `readability_score` | `Float` | default 0.0 | Readability score |
| `entities` | `JSON` | default [] | Extracted named entities |
| `style_analysis` | `JSON` | default {} | Writing style metrics |
| `suggestions` | `JSON` | default [] | Improvement suggestions |
| `created_at` | `DateTime` | default utcnow | Creation timestamp |

## Table: `document_shares`

Document-level sharing permissions for users outside the project's organization.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | `Integer` | PK, Indexed | Auto-incrementing ID |
| `document_id` | `Integer` | NOT NULL, FK→documents.id, Indexed | Shared document |
| `user_id` | `Integer` | NOT NULL, FK→users.id | User shared with |
| `permission` | `Enum(DocumentSharePermission)` | NOT NULL, default VIEW | Permission level |
| `created_by` | `Integer` | NOT NULL, FK→users.id | Who created the share |
| `created_at` | `DateTime` | default utcnow | Share creation timestamp |
| `revoked_at` | `DateTime` | Nullable | When share was revoked |

## Real-Time Collaboration Persistence

Real-time editor state is not stored as a Pagemark database table. Liveblocks stores the active collaborative room state, presence, and thread data. Pagemark stores only durable section content snapshots in `sections.content_md`.

Snapshot writes happen through:

```
PATCH /projects/{project_id}/documents/{document_id}/sections/{section_id}/collaboration/snapshot
```

The snapshot endpoint updates the section and document timestamps and clears section review state when content changes. This keeps exports, AI generation, version/review workflows, and non-collaborative reads aligned with the latest persisted Markdown.

## Entity-Relationship Diagram

```
Organization ──┬── OrganizationMember ── User
               ├── OrganizationJoinLink
               └── Project ──┬── Document ──┬── Section ──┬── SectionVersion
                             │              │             ├── EvidenceReference
                             │              │             ├── ClarificationRequest
                             │              │             └── CollaborationNote
                             │              ├── OutlineProposal
                             │              ├── TemplateRecommendation
                             │              ├── GenerationRun ── GenerationSectionTask
                             │              ├── QualityReport ──┬── QualityIssue
                             │              │                   └── BrokenLink
                             │              └── DocumentShare
                             ├── Analysis
                             ├── ProjectSourceExclusion
                             ├── ChatThread ── ChatMessage ── ChatMessageResource
                             ├── Resource
                             ├── ActivityEvent
                             └── NLPReport

User ──┬── UserRole
       ├── UserSettings (1:1)
       ├── OAuthToken
       ├── UserAiCredential
       ├── UserAPIKey
       ├── AuditLog
       └── WorkspacePreference

Template ── Document
```

## Design Rationale

1. **Immutable snapshots**: Analysis snapshots and approved outline proposals are immutable. This ensures that reviewed content can always be traced back to the exact analysis state it was based on.

2. **Content lifecycle separation**: Sections separate `content_lifecycle` (empty/generated_draft/reviewed) from workflow flags (`needs_input`, `is_generating`, `has_failed`, `is_potentially_stale`). This allows flexible state management without conflating content state with processing state.

3. **BYOK credential isolation**: AI credentials are stored per-user, encrypted with Fernet. The `is_active` flag per provider ensures users can have multiple keys on file but only one is active at a time.

4. **Version history as full snapshots**: Section versions store complete content, not diffs. This simplifies rollback and diff computation at the cost of storage — acceptable for documentation content which is typically small.

5. **Live collaboration state outside PostgreSQL**: Pagemark delegates CRDT state, presence, and threaded collaborative comments to Liveblocks. PostgreSQL remains the durable application store for section Markdown snapshots, document permissions, review state, and exports.

6. **Activity event weight system**: Events have a `weight` field (e.g., 3.0 for review, 1.0 for generation, 0.3 for minor events) enabling a GitHub-style activity heatmap.

7. **Soft deletes**: Sections and projects use soft deletes (`deleted_at`, `lifecycle_status`) to prevent accidental data loss and enable undo.
