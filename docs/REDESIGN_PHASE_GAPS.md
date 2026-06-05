# Pagemark Redesign Phase Gaps Analysis

This document identifies the gaps between the planned redesign phases and what has been implemented, providing a roadmap for completing the multi-Document Project architecture.

## Implementation Status Summary

### ✅ Completed Phases

- **Phase 1**: Domain Schema Foundation (partial - see gaps below)
- **Phase 7**: Design System Foundation (complete)
- **Phase 8**: First-Document Journey Frontend (complete, uses mock data)
- **Phase 9**: Project Workspace And Editor Integration (complete, uses mock data)

### ⚠️ Partially Implemented

- **Phase 1**: Domain Schema Foundation (models exist but some relationships incomplete)
- **Phase 4**: Template Recommendations And Document Setup (backend partial, frontend complete)

### ❌ Not Implemented

- **Phase 2**: Project And Nested Document APIs
- **Phase 3**: Shared Analysis And Source Health
- **Phase 4**: Template Recommendations And Document Setup (backend services)
- **Phase 5**: Generation Runs, Usage, And Review States
- **Phase 6**: Freshness, Evidence, Activity, Quality, Export

---

## Phase 1: Domain Schema Foundation — GAPS

### ✅ Completed

Models exist for:
- `Document` with `setup_stage`, `template_id`, `status`
- `OutlineProposal` with `basis`, `status`, `outline_json`
- `TemplateRecommendation` with `basis`, `score`, `explanation`
- `Generation` with run tracking
- `Evidence` references
- `Activity` events
- `WorkspacePreference` for user preferences

### ❌ Missing/Incomplete

1. **Project Source Metadata Normalization**
   - Current: `git_repo_url`, `git_branch`, `git_provider` are basic strings
   - Needed: Structured source metadata with `owner`, `repository`, `default_branch`, `visibility`, `last_synced_commit`, provider-specific JSON
   - File: `backend/app/models/project.py`

2. **Project-Level Source Exclusion Rules**
   - Current: No exclusion rules stored on Project
   - Needed: `exclusion_patterns` JSON field on Project
   - File: `backend/app/models/project.py`

3. **Analysis Snapshot Management**
   - Current: Analysis is tracked but no explicit `is_current` flag
   - Needed: `is_current` boolean on Analysis model
   - Needed: Effective exclusions per snapshot
   - File: `backend/app/models/analysis.py`

4. **Section State Split**
   - Current: `SectionContentLifecycle` and `SectionStatus` enums exist
   - Needed: Verify Section model uses both correctly (content lifecycle + workflow flags)
   - File: `backend/app/models/document.py` (Section class)

5. **Section Review Metadata**
   - Current: Section has `status` but unclear if review metadata exists
   - Needed: `reviewed_by`, `reviewed_at`, `reviewed_against_analysis_id`
   - File: `backend/app/models/document.py` (Section class)

6. **Generation Run Section Tasks**
   - Current: Generation model exists but child task structure unclear
   - Needed: Verify Section tasks with dependencies, provider/model used, errors
   - File: `backend/app/models/generation.py`

### Action Items

1. Add structured source metadata to Project model
2. Add exclusion rules to Project model
3. Add `is_current` flag to Analysis model
4. Add effective exclusions to Analysis model
5. Verify Section model has review metadata fields
6. Verify Generation model has complete task tracking

---

## Phase 2: Project And Nested Document APIs — GAPS

### ❌ Status: NOT IMPLEMENTED

The current API structure still uses legacy singular document patterns:
- `/projects/{id}/document` returns sections
- No explicit `/projects/{project_id}/documents/{document_id}/sections` routes
- Project creation likely still auto-creates a default document

### Required Implementation

1. **Project API Changes**
   - `POST /projects` should create ONLY the Project (no auto-document)
   - `GET /projects` should return recent/active signals
   - `GET /projects/{project_id}` should return workspace summary

2. **New Document API Routes**
   - `GET /projects/{project_id}/documents` - list all documents
   - `POST /projects/{project_id}/documents` - create new document
   - `GET /projects/{project_id}/documents/{document_id}` - get document details
   - `PATCH /projects/{project_id}/documents/{document_id}` - update document
   - `GET /projects/{project_id}/documents/{document_id}/sections` - get section tree

3. **Authorization**
   - Every nested document route must verify project org membership
   - Implement in `backend/app/dependencies.py`

4. **Remove Legacy Routes**
   - Deprecate or remove `/projects/{id}/document` singular endpoint
   - Update all API clients to use nested routes

### Files to Modify

- `backend/app/routers/projects.py`
- `backend/app/routers/documents.py` (new or expand)
- `backend/app/routers/sections.py`
- `backend/app/dependencies.py`
- `backend/app/schemas/document.py` (new)
- `frontend/src/api/documents.ts`
- `frontend/src/api/sections.ts`

### Frontend Impact

Phase 8 & 9 frontend implementations currently use:
- Mock document data in `DocumentLibraryPage`
- Legacy `useDocument(projectId)` hook
- Need to update to use new nested APIs

---

## Phase 3: Shared Analysis And Source Health — GAPS

### ❌ Status: NOT IMPLEMENTED

While basic analysis exists, the Project-scoped reusable analysis architecture is incomplete.

### Required Implementation

1. **GitHub-First Source Connection**
   - Enhance repository selection with normalized metadata
   - Store `owner`, `repo`, `visibility`, `language`, `default_branch`
   - Current: Basic URL/branch storage

2. **Analysis Snapshot Architecture**
   - Multiple snapshots per Project with `is_current` flag
   - Each snapshot stores effective exclusions used
   - Immutable after creation
   - Current: Single analysis per project, unclear immutability

3. **Progressive Analysis Facts**
   - Expose partial completion states
   - Return available facts even if some steps fail
   - Disclose unavailable results clearly
   - Current: Basic step tracking exists

4. **ZIP Upload Snapshots**
   - Create Analysis snapshot from ZIP
   - Mark as non-syncable
   - Allow freshness comparison when new ZIP uploaded
   - Current: ZIP upload exists but snapshot behavior unclear

### Files to Modify

- `backend/app/services/analysis_service.py`
- `backend/app/workers/analysis_worker.py`
- `backend/app/services/github_service.py`
- `backend/app/routers/git.py`
- `backend/app/schemas/analysis.py`

### Frontend Impact

- Phase 8 `AnalysisFactsStep` is complete and ready
- Phase 9 `ProjectSourcePage` is complete and ready
- Need backend to provide multiple snapshots with `is_current`

---

## Phase 4: Template Recommendations And Document Setup — GAPS

### ⚠️ Status: PARTIALLY IMPLEMENTED

Models exist, but backend services and logic are incomplete.

### ✅ Completed

- Template model has basic structure
- TemplateRecommendation model exists
- OutlineProposal model exists
- Frontend components complete (Phase 8)

### ❌ Missing

1. **Enhanced Template Data**
   - Current: Templates have `name`, `description`, `sections_json`
   - Needed: `purpose`, `intended_audience`, `expected_outcome`, `compatible_repository_traits`, `estimated_generation_scope`, `guidance/system_prompt`
   - File: `backend/app/models/template.py`

2. **Rule-Based Recommendation Service**
   - Logic to analyze project facts and match templates
   - Must work WITHOUT provider credential
   - Persist recommendations with `basis: rule_based`
   - File: `backend/app/services/template_recommendation_service.py` (new)

3. **AI-Personalized Recommendation Service**
   - AI-powered recommendation when provider available
   - Record provider usage
   - Persist with `basis: ai_personalized`
   - File: `backend/app/services/template_recommendation_service.py` (new)

4. **Outline Proposal Materialization**
   - Approve proposal → create Sections
   - Preserve approved proposal as immutable
   - File: `backend/app/services/document_setup_service.py` (new)

5. **Clarification Request Logic**
   - Generate clarification questions from low-confidence analysis
   - Allow skipping with affected sections noted
   - File: `backend/app/services/clarification_service.py` (new)

### Files to Create/Modify

- `backend/app/services/template_recommendation_service.py` (NEW)
- `backend/app/services/document_setup_service.py` (NEW)
- `backend/app/services/clarification_service.py` (NEW)
- `backend/app/routers/templates.py`
- `backend/app/routers/documents.py`
- `backend/app/prompts/outline.py` (for AI recommendations)

### Frontend Impact

Phase 8 components are complete and waiting for these APIs:
- `TemplateRecommendationStep` uses mock recommendations
- `OutlineReviewStep` uses mock proposal
- Ready to integrate once backend available

---

## Phase 5: Generation Runs, Usage, And Review States — GAPS

### ❌ Status: NOT IMPLEMENTED

While Generation model exists, the complete run orchestration is missing.

### Required Implementation

1. **Provider Usage Estimation**
   - Estimate tokens and cost before generation
   - Section-level breakdown
   - Uncertainty messaging
   - File: `backend/app/services/generation_estimation_service.py` (NEW)

2. **Generation Run Orchestration**
   - Persist run with mode (complete | on-demand)
   - Track intended provider/model
   - Create child section tasks with dependencies
   - Limited parallelism for complete mode
   - File: `backend/app/services/generation_run_service.py` (NEW)

3. **Section Task Dependencies**
   - Foundational sections generate first
   - Failed foundational tasks pause only dependents
   - File: `backend/app/workers/generation_worker.py`

4. **Provider Failover Logic**
   - Detect quota/rate-limit/outage
   - Pause and request confirmation
   - Switch to alternate provider
   - File: `backend/app/services/ai_service.py`

5. **Review State Management**
   - Generated prose enters as `GENERATED_DRAFT`
   - Manual edits don't auto-mark reviewed
   - Explicit acceptance records review metadata
   - File: `backend/app/routers/sections.py`

### Files to Create/Modify

- `backend/app/services/generation_estimation_service.py` (NEW)
- `backend/app/services/generation_run_service.py` (NEW)
- `backend/app/workers/generation_worker.py`
- `backend/app/routers/ai.py`
- `backend/app/routers/sections.py`
- `backend/app/ai_providers.py`

### Frontend Impact

Phase 8 `GenerationChoiceStep` shows mock estimates and needs real API:
- Estimates endpoint: `GET /projects/{id}/documents/{doc_id}/generation/estimate`
- Start generation: `POST /projects/{id}/documents/{doc_id}/generation`

Phase 9 editor needs:
- Section review endpoint: `POST /projects/{id}/documents/{doc_id}/sections/{section_id}/review`
- Regenerate endpoint: `POST /projects/{id}/documents/{doc_id}/sections/{section_id}/regenerate`

---

## Phase 6: Freshness, Evidence, Activity, Quality, Export — GAPS

### ❌ Status: NOT IMPLEMENTED

Most of ongoing maintenance features are missing.

### Required Implementation

1. **Evidence References**
   - Connect sections to analysis artifacts
   - Store source paths, symbols, line ranges
   - File: `backend/app/services/evidence_service.py` (NEW)

2. **Freshness Detection**
   - Compare reviewed sections against new analysis
   - Mark potentially stale sections
   - File: `backend/app/services/freshness_service.py` (NEW)

3. **Stale Update Proposals**
   - Generate source-grounded diffs
   - Require explicit accept/reject
   - File: `backend/app/services/freshness_service.py` (NEW)

4. **Document-Scoped Quality/Export**
   - Move from project-scoped to document-scoped
   - File: `backend/app/routers/quality.py`
   - File: `backend/app/routers/export.py`

5. **Activity Event Recording**
   - Persist typed events with weights
   - Generate heatmap data
   - Exclude routine edits/autosaves
   - File: `backend/app/services/activity_service.py` (NEW)

6. **Global Search**
   - Search across projects and documents
   - Filter by project, document, tag, status, freshness
   - File: `backend/app/routers/search.py`

### Files to Create/Modify

- `backend/app/services/evidence_service.py` (NEW)
- `backend/app/services/freshness_service.py` (NEW)
- `backend/app/services/activity_service.py` (NEW)
- `backend/app/routers/quality.py`
- `backend/app/routers/export.py`
- `backend/app/routers/search.py`
- `backend/app/routers/notes.py`

### Frontend Impact

Phase 9 components ready but using mocks:
- `ProjectActivityPage` uses mock activity events
- `DocumentEditorPage` shows mock source change notice
- Need real APIs for:
  - Activity timeline: `GET /projects/{id}/activity`
  - Activity heatmap: `GET /projects/{id}/activity/heatmap`
  - Source changes: `GET /projects/{id}/documents/{doc_id}/freshness`

---

## Landing Page & Login Design Gaps

### Current State Analysis

**LandingPage.tsx:**
- ✅ Has modern design with framer-motion animations
- ✅ Uses floating orbs and smooth scrolling effects
- ✅ Has feature showcase and steps
- ⚠️ **Copy is outdated** - describes old single-document model
- ⚠️ **Design tokens not aligned** - uses custom colors, not semantic tokens
- ⚠️ **Decorative animations** - conflicts with calm developer workspace philosophy

**LoginPage.tsx:**
- ✅ Simple, functional design
- ⚠️ **Generic AuthLayout** - doesn't reflect Pagemark brand
- ⚠️ **No design system compliance** - uses legacy component styling
- ⚠️ **Missing personality** - could be any SaaS login page

### Required Updates

#### 1. Landing Page Copy Rewrite

**Current Problems:**
- Describes "AI-Generated Outlines" but doesn't mention Projects or multiple Documents
- Says "Import any codebase" but doesn't explain the Project → Documents architecture
- Features list is generic SaaS features, not Pagemark-specific value props

**New Copy Direction:**
Transform source code into structured technical documentation that developers refine section by section.

**Hero Section (Updated):**
```
Headline: Turn Your Codebase Into Living Documentation
Subhead: Pagemark analyzes your repository and generates purpose-specific documentation that your team actually maintains. Built for developers who care about quality.
CTA: Start Free Project
```

**Value Props (Updated):**
1. **Multi-Document Projects**
   - One source-connected workspace, multiple documentation purposes
   - API Reference, User Guide, Architecture Docs—all from the same repo
   - Shared analysis, separate content lifecycles

2. **Analysis-Grounded Recommendations**
   - GitHub-first source connection with automatic sync
   - Progressive repository analysis (languages, endpoints, complexity)
   - Rule-based template matching without AI credits

3. **Section-by-Section Refinement**
   - Edit, review, and approve each section independently
   - Source evidence markers show what informed each section
   - Freshness detection when source code changes

4. **Bring Your Own AI (BYOK)**
   - Use your own Claude or OpenAI API key
   - Transparent cost estimates before generation
   - On-demand or complete-document generation modes

5. **Quality Built In**
   - Document-level quality reports
   - Review workflows with explicit acceptance
   - Export to Markdown, PDF, or DOCX

6. **Team-Friendly**
   - Organization workspaces with role-based access
   - Activity timeline shows meaningful events
   - Non-blocking source change notices

**How It Works (Updated Steps):**
```
01. Connect Source
    - GitHub OAuth, repository URL, or ZIP upload
    - Pagemark analyzes languages, structure, and complexity
    - Infer project name and optionally add human context

02. Create Documents
    - Choose template based on purpose (API, Tutorial, Architecture)
    - Review AI-adapted outline with repository evidence
    - Approve sections before generation

03. Generate & Refine
    - Generate on-demand or all sections at once
    - Review drafts with source evidence markers
    - Edit in Obsidian-parity live preview editor

04. Keep Fresh
    - Automatic source change detection
    - Proposed updates show what changed
    - Accept or skip each update
```

**Social Proof (Add):**
- "Finally, documentation that doesn't go stale 3 days after we write it."
- "The BYOK model means we control costs. No surprise bills."
- "Multiple documents from one repo is exactly what we needed."

#### 2. Landing Page Design System Compliance

**Changes Needed:**

1. **Remove Decorative Animations**
   - Remove `FloatingOrbs` component (conflicts with calm workspace philosophy)
   - Keep functional transitions only (scroll reveals, CTA hover states)
   - Use `motion.div` sparingly for content reveal, not decoration

2. **Apply Semantic Tokens**
   - Replace hardcoded colors: `bg-primary/5`, `#1e3a5f`, `#2d1b69`
   - Use: `bg-canvas`, `bg-workspace`, `bg-panel`, `text-interaction`
   - Use status colors only for meaningful states

3. **Typography Hierarchy**
   - Hero: `text-hero` (40px, 700)
   - Section headings: `text-title` (28px, 600)
   - Body: `text-body` or `text-body-lg`
   - Captions: `text-meta`

4. **Spacing & Layout**
   - Wide content column with generous whitespace (Notion-inspired)
   - Tight spacing in navigation (Linear-inspired)
   - `max-w-7xl` containers, not custom breakpoints

5. **Components**
   - Use governed Button variants (`default`, `outline`, `ghost`)
   - Use Badge for status indicators
   - Use Surface for feature cards instead of custom divs

#### 3. Login Page Redesign

**New LoginPage.tsx Requirements:**

1. **Brand Presence**
   - Pagemark wordmark/logo at top
   - Tagline: "Turn code into documentation"
   - Calm, developer-focused aesthetic

2. **Design System Compliance**
   - Use semantic tokens throughout
   - `bg-workspace` for page background
   - `bg-panel` for form container
   - Governed Input and Button variants

3. **Layout**
   - Centered form with `max-w-sm`
   - Generous padding and whitespace
   - Subtle border-radius (8px)
   - No shadows except for elevated overlay

4. **Structure**
   ```tsx
   <div className="min-h-screen bg-workspace flex items-center justify-center px-6">
     <div className="w-full max-w-sm space-y-8">
       {/* Logo */}
       <div className="text-center">
         <PagemarkWordmark className="h-8 mx-auto" />
         <p className="text-meta text-text-muted mt-2">Sign in to your account</p>
       </div>
       
       {/* Form */}
       <div className="bg-panel rounded-lg border border-separator p-8">
         {/* Form fields using governed components */}
       </div>
       
       {/* Footer */}
       <p className="text-center text-meta text-text-muted">
         Don't have an account? <Link className="text-interaction">Sign up</Link>
       </p>
     </div>
   </div>
   ```

5. **Accessibility**
   - Proper form labels
   - Visible focus states
   - Error messaging using Notice component
   - Keyboard navigation

#### 4. RegisterPage.tsx Redesign

Same principles as LoginPage:
- Brand presence
- Design system compliance
- Calm, focused aesthetic
- No decorative animation
- Use governed components

---

## Priority Roadmap

### Critical Path (Blocks Frontend Features)

**Priority 1: Phase 2 (API Routes)**
- Without nested document APIs, Phase 8 & 9 frontends can't work
- Estimated: 1-2 days
- Impact: Unblocks all document operations

**Priority 2: Phase 3 (Shared Analysis)**
- Needed for template recommendations
- Needed for source page display
- Estimated: 2-3 days
- Impact: Unblocks analysis-grounded features

**Priority 3: Phase 4 (Template Recommendations)**
- Frontend complete, waiting for backend
- Core to first-document journey
- Estimated: 2-3 days
- Impact: Completes document setup flow

**Priority 4: Phase 5 (Generation Runs)**
- Frontend shows mock estimates
- Core to content creation
- Estimated: 3-4 days
- Impact: Enables actual content generation

### Secondary (Enhances Experience)

**Priority 5: Landing & Login Redesign**
- Copy rewrite: 1 day
- Design system compliance: 1 day
- Impact: Better first impression, brand consistency

**Priority 6: Phase 6 (Freshness & Activity)**
- Frontend has activity page ready
- Source change notices ready
- Estimated: 3-4 days
- Impact: Completes maintenance lifecycle

### Polish (Future)

- Activity heatmap visualization
- Source evidence marker implementation
- Advanced search filters
- Batch operations
- Team collaboration features

---

## Mock Data Locations (Frontend)

These frontend components use mock data and need API integration:

1. **DocumentLibraryPage.tsx**
   - Line 32-44: Mock documents array
   - Needs: `GET /projects/{projectId}/documents`

2. **ProjectActivityPage.tsx**
   - Line 25-43: Mock activity events
   - Needs: `GET /projects/{projectId}/activity`

3. **DocumentSetupPage.tsx**
   - Line 282-298: Mock template recommendations
   - Line 300-309: Mock outline proposal
   - Line 311-318: Mock generation estimates
   - Needs: Multiple Phase 4 & 5 APIs

4. **DocumentEditorPage.tsx**
   - Line 32: Mock source change detection (timer)
   - Needs: `GET /projects/{projectId}/documents/{documentId}/freshness`

---

## Testing Gap Analysis

### Backend Tests Missing

1. **Phase 2 Tests**
   - Project creation without auto-document
   - Nested document authorization
   - Multiple documents in one project

2. **Phase 3 Tests**
   - Multiple analysis snapshots
   - `is_current` flag behavior
   - Effective exclusions per snapshot
   - Partial analysis completion

3. **Phase 4 Tests**
   - Rule-based recommendations without provider
   - AI recommendations with provider
   - Outline proposal materialization
   - Resume from setup stage

4. **Phase 5 Tests**
   - Generation run persistence
   - Section task dependencies
   - Provider failover confirmation
   - Review state persistence

5. **Phase 6 Tests**
   - Freshness detection
   - Stale update proposals
   - Activity event recording
   - Heatmap data generation

### Frontend Tests Missing

1. **Integration Tests**
   - Complete document setup flow
   - Multi-document navigation
   - View preference persistence
   - Section resume behavior

2. **Component Tests**
   - Document library search/sort
   - Outline editing (add/remove/reorder)
   - Generation mode selection
   - AI panel interactions

3. **Accessibility Tests**
   - Keyboard navigation
   - Screen reader support
   - Focus management
   - Color contrast verification

---

## Database Migration Gaps

### Missing Migrations

1. **Project Source Metadata**
   - Add structured columns for source metadata
   - Add exclusion patterns JSON

2. **Analysis `is_current` Flag**
   - Add boolean column with default False
   - Create index on (project_id, is_current)

3. **Section Review Metadata**
   - Add reviewed_by, reviewed_at, reviewed_against_analysis_id

4. **Template Enhanced Fields**
   - Add purpose, intended_audience, expected_outcome, etc.

5. **Generation Task Dependencies**
   - Verify task dependency structure in Generation model

---

## Documentation Gaps

### Missing Documentation

1. **API Documentation**
   - OpenAPI/Swagger specs for new nested routes
   - Authentication/authorization guide
   - Rate limiting and quota documentation

2. **Architecture Documentation**
   - Multi-document data model diagram
   - Analysis snapshot lifecycle
   - Generation run orchestration flow
   - Freshness detection algorithm

3. **Developer Guide**
   - How to add new templates
   - How to extend analysis steps
   - How to customize generation prompts
   - How to add activity event types

4. **User Documentation**
   - Project setup guide
   - Template selection guide
   - Review workflow guide
   - Source synchronization guide

---

## Summary: Top 5 Critical Gaps

1. **Phase 2 APIs** - Nested document routes block all multi-document operations
2. **Phase 3 Analysis** - Shared analysis architecture needed for recommendations
3. **Phase 4 Backend** - Template recommendation and outline services needed
4. **Phase 5 Generation** - Generation run orchestration needed for content creation
5. **Landing Page Copy** - Outdated messaging doesn't reflect new architecture

## Recommended Next Steps

1. ✅ **Read this document** and prioritize gaps
2. 🔨 **Implement Phase 2** (Project And Nested Document APIs)
3. 🔨 **Implement Phase 3** (Shared Analysis And Source Health)
4. 🔨 **Implement Phase 4 Backend** (Template Recommendations services)
5. 🔨 **Integrate Phase 4 Frontend** (connect Phase 8 components to real APIs)
6. 📝 **Rewrite Landing Page Copy** (reflect multi-document architecture)
7. 🎨 **Redesign Landing & Login** (design system compliance)
8. 🔨 **Implement Phase 5** (Generation Runs)
9. 🔨 **Integrate Phase 5 Frontend** (connect generation components)
10. 🔨 **Implement Phase 6** (Freshness, Activity, Evidence)

Each phase should be implemented and tested before moving to the next. The frontend is ready and waiting for backend APIs to be completed.
