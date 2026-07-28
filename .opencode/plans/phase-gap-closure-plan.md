# Phase Gap Closure Implementation Plan

**Status**: Ready to Execute  
**Approach**: Backend-First (Revised to 3 weeks based on inspection)  
**Created**: 2026-06-05

---

## Executive Summary

### Current State Assessment

After inspecting the codebase, I discovered that **much more is already implemented than expected**:

#### ✅ Phase 1: COMPLETE
- All models exist with proper relationships
- Project has structured source metadata fields
- Analysis has `is_current` flag and `effective_exclusions_json`
- Section has review metadata and split state
- All Phase 4/5 models complete (OutlineProposal, TemplateRecommendation, GenerationRun, etc.)
- Recent migration: `2026_06_05_0900_b13f0a7d9c2e_domain_schema_foundation.py`

#### ✅ Phase 2: MOSTLY COMPLETE
- Nested document APIs already exist:
  - `GET /projects/{project_id}/documents`
  - `POST /projects/{project_id}/documents`
  - `GET /projects/{project_id}/documents/{document_id}`  
  - `PATCH /projects/{project_id}/documents/{document_id}`
  - `GET /projects/{project_id}/documents/{document_id}/sections`
- Just need verification and testing

#### ⚠️ Phase 3: PARTIALLY COMPLETE
- Analysis service exists (40KB implementation)
- Need to verify `is_current` flag usage
- Need to test multiple snapshot handling

#### ⚠️ Phase 4: PARTIALLY COMPLETE
- `template_recommendation_service.py` exists (19KB)
- Services exist, need testing and frontend integration

#### ⚠️ Phase 5: PARTIALLY COMPLETE
- `generation_service.py` exists (20KB)  
- Need testing and frontend integration

#### ❌ Phase 6: NOT COMPLETE
- Need freshness_service.py
- Need activity recording integration
- Need frontend connections

#### ❌ Landing/Login: NOT COMPLETE
- Need copy rewrite
- Need design system compliance

### Revised Timeline: 3 Weeks

**Week 1**: Test & integrate Phases 2-5 (existing code)  
**Week 2**: Implement Phase 6 (freshness & activity)  
**Week 3**: Polish (landing page, testing, docs)

---

## Detailed Week-by-Week Breakdown

### Week 1: Verification, Testing & Integration

**Day 1: Phase 2-3 Verification**
- Verify project creation doesn't auto-create document
- Test nested document APIs (authorization, multiple docs)
- Test analysis snapshot management (`is_current` flag)
- Test progressive analysis facts
- Write comprehensive API tests

**Days 2-3: Phase 4 Integration**
- Test template_recommendation_service.py
- Verify rule-based works without provider
- Verify AI-personalized requires provider
- Remove mock data from `DocumentSetupPage.tsx:283-298`
- Connect frontend to real recommendations API
- Test outline approval creates sections
- Implement clarification service

**Days 4-5: Phase 5 Integration**  
- Test generation_service.py
- Test estimation, run orchestration, dependencies
- Remove mock data from `DocumentSetupPage.tsx:313-326`
- Connect frontend to generation APIs
- Test provider failover
- Test review state management
- Complete end-to-end generation flow

### Week 2: Phase 6 Implementation

**Days 1-2: Freshness Detection**
- Create `freshness_service.py` (~300 lines)
- Implement stale section detection
- Implement update proposal generation
- Add freshness endpoints to documents router
- Remove mock timer from `DocumentEditorPage.tsx:32`
- Connect frontend source change notices
- Test complete freshness cycle

**Days 3-4: Activity Events**
- Create `activity_service.py` (~200 lines)
- Define event types and weights
- Wire activity recording throughout backend
- Add activity endpoints to projects router
- Remove mock data from `ProjectActivityPage.tsx:25-43`
- Implement heatmap visualization
- Test activity timeline

**Day 5: Evidence & Quality**
- Test evidence references
- Add basic evidence markers to editor
- Verify quality is document-scoped
- Verify export is document-scoped

### Week 3: Polish & Completion

**Days 1-2: Landing Page Redesign**
- Day 1: Copy rewrite (hero, value props, how it works)
- Day 2: Design system compliance (remove animations, semantic tokens)

**Day 3: Login/Register Redesign**
- Add brand personality
- Apply design system tokens
- Test accessibility

**Day 4: End-to-End Testing**
- Complete setup flow
- Multi-document navigation
- Generation & review
- Freshness detection
- Bug fixes

**Day 5: Documentation**
- API documentation
- Architecture docs
- User guide
- Deployment checklist
- Final verification

---

## Key Files to Modify

### Frontend Mock Data Removals

1. **`frontend/src/pages/DocumentSetupPage.tsx`**
   - Lines 283-298: `mockRecommendations` → API call
   - Lines 301-309: `mockProposal` → API call  
   - Lines 313-326: `mockEstimate` → API call

2. **`frontend/src/pages/DocumentLibraryPage.tsx`**
   - Lines 32-44: Mock documents → API call

3. **`frontend/src/pages/ProjectActivityPage.tsx`**
   - Lines 25-43: Mock activities → API call

4. **`frontend/src/pages/DocumentEditorPage.tsx`**
   - Line 32: Mock timer → Real freshness API

### Backend Services to Create

1. **`backend/app/services/freshness_service.py`** (NEW)
   - `detect_stale_sections()`
   - `generate_update_proposal()`
   - `apply_freshness_update()`

2. **`backend/app/services/activity_service.py`** (NEW)
   - `record_event()`
   - `get_timeline()`
   - `get_heatmap_data()`

### Backend Services to Test

1. **`backend/app/services/template_recommendation_service.py`** (EXISTS - 19KB)
2. **`backend/app/services/generation_service.py`** (EXISTS - 20KB)
3. **`backend/app/services/analysis_service.py`** (EXISTS - 40KB)

---

## Testing Priorities

### Critical Path Tests (Must Have)

1. **Phase 2**: Nested document APIs
   - `backend/tests/test_documents_api.py`
   - Project creation, multiple documents, authorization

2. **Phase 3**: Analysis snapshots
   - `backend/tests/test_analysis_snapshots.py`
   - Multiple snapshots, `is_current` flag

3. **Phase 4**: Template recommendations
   - `backend/tests/test_template_recommendations.py`
   - Rule-based vs AI, provider checks

4. **Phase 5**: Generation runs
   - `backend/tests/test_generation_runs.py`
   - Estimation, dependencies, failover, review

5. **Phase 6**: Freshness & Activity
   - `backend/tests/test_freshness_detection.py`
   - `backend/tests/test_activity_events.py`

### Integration Tests (Should Have)

- End-to-end document setup flow
- Multi-document project navigation  
- Complete generation cycle
- Freshness update cycle

### Frontend Tests (Nice to Have)

- Component tests for document library
- Component tests for activity page
- Accessibility tests

---

## Daily Workflow

Each day:
1. ✅ Morning: Review plan, identify tasks
2. ✅ Work: Execute tasks (4-8 hours)
3. ✅ Test: Verify acceptance criteria
4. ✅ Commit: Save progress
5. ✅ Document: Note blockers/learnings

---

## Risk Mitigation

### Risk 1: Services More Complex Than Expected
**Mitigation**: Services already exist. We're testing and integrating, not building from scratch.

### Risk 2: Frontend Integration Issues  
**Mitigation**: Mock data locations are clearly documented. Integration points are well-defined.

### Risk 3: Freshness Logic Is Complex
**Mitigation**: Start with simple stale detection. Enhance diff generation incrementally.

### Risk 4: Timeline Slips
**Mitigation**: Phase 6 can be partially deferred. Freshness is higher priority than activity heatmap.

---

## Success Criteria

After 3 weeks:

1. ✅ Create project with multiple documents
2. ✅ Get rule-based recommendations (no AI)
3. ✅ Get AI recommendations (with provider)
4. ✅ Review and approve outlines
5. ✅ Generate sections with estimates
6. ✅ Review and accept sections
7. ✅ Detect stale sections
8. ✅ See activity timeline
9. ✅ Navigate documents without confusion
10. ✅ Landing page reflects new architecture
11. ✅ Login has brand personality
12. ✅ All critical tests pass

---

## Next Steps

**Option 1: Review & Approve Plan**
- Review this plan
- Ask clarifying questions
- Confirm approach

**Option 2: Start Executing**
- Begin Day 1: Phase 2-3 Verification
- I'll guide you step-by-step
- We'll commit progress daily

**Which would you like to do?**
