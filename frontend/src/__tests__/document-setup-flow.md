# First-Document Journey Test Plan (Phase 8)

This document describes the test scenarios that should be implemented for the first-document journey.

## Integration Tests

### Complete Happy Path
**Test:** Maintainer can create a Project, run Analysis, choose Template, approve Outline, choose on-demand generation, and reach editor

**Steps:**
1. Navigate to /document-setup
2. Select GitHub repository from searchable list
3. Choose branch
4. Click "Connect Repository"
5. Wait for Analysis to complete progressively
6. Verify repository facts are displayed (languages, file tree, endpoints, complexity)
7. Select recommended template (marked as "Rule-Based" or "AI-Personalized")
8. Review proposed outline
9. Verify sections show purpose and repository evidence
10. Make edits: rename a section, reorder sections, add a section, remove a section
11. Click "Approve Outline"
12. Choose "Generate On Demand" (pre-selected/recommended)
13. Review usage estimate with provider, tokens, and cost
14. Click "Continue to Editor"
15. Verify navigation to `/editor/:projectId`

**Expected:** All steps complete without errors, state persists correctly, and editor loads.

---

### Resume After Reload
**Test:** Same flow can be resumed after reload from persisted Document setup stage

**Steps:**
1. Start document setup
2. Complete source connection
3. Wait for analysis to start
4. Note project ID from URL or state
5. Reload page with `?projectId=X` query parameter
6. Verify setup stage is restored (e.g., "analysis" or "template-selection")
7. Verify project name and source metadata are displayed in summary rail
8. Continue from current stage
9. Complete remaining stages
10. Reach editor

**Expected:** State restoration is seamless, no data loss, user can continue where they left off.

---

### Source-less Path
**Test:** Source-less path clearly disables Analysis-grounded features

**Steps:**
1. Navigate to /document-setup
2. Click "Start Without Source" button
3. Verify analysis step is skipped entirely
4. Reach template selection
5. Verify only rule-based recommendations are shown
6. Verify no "Configure AI Provider" upsell for AI-personalized recommendations
7. Select a template
8. Review outline
9. Verify no repository evidence is shown in sections
10. Verify clarification requests (if any) are generic, not source-specific
11. Approve outline
12. Choose generation mode
13. Complete flow

**Expected:** Clear messaging that Analysis-grounded features are unavailable. No broken UI expecting source data.

---

### Inline Provider Setup
**Test:** Provider credential setup does not redirect away from the flow

**Steps:**
1. Start document setup without active provider
2. Connect source and complete analysis
3. Reach template selection
4. Notice rule-based recommendations only
5. Click "Configure AI Provider" button or inline notice
6. Verify inline form appears (no navigation away from page)
7. Select provider (e.g., Claude)
8. Select model
9. Enter API key
10. Click "Configure & Continue"
11. Verify form closes
12. Verify AI-personalized recommendations now appear
13. Continue flow normally

**Expected:** Provider setup is seamlessly integrated. No redirect. AI features become available immediately.

---

## Source Connection Methods

### GitHub OAuth
- Select from searchable repository list
- Shows owner, visibility, language, last updated
- Select branch from dropdown
- Connect and trigger analysis

### Git URL
- Enter public repository URL
- Enter branch name (defaults to "main")
- Connect and trigger analysis
- Note: Private repos require OAuth

### ZIP Upload
- Select .zip file from file picker
- Upload and trigger analysis
- Note: No automatic sync, snapshot only

### No Source
- Click "Start Without Source"
- Skip analysis
- Proceed to rule-based template selection

---

## Progressive Analysis Facts

**Test:** Shows progressive Analysis facts as they complete

**Steps:**
1. Connect source
2. Monitor analysis step
3. Verify each fact category shows status:
   - Repository Structure: pending → running → done
   - Languages & Stack: pending → running → done
   - API Endpoints: pending → running → done (or skipped if none)
   - Complexity Metrics: pending → running → done
4. Verify partial completion is handled:
   - If one step fails, others continue
   - Warning notice explains which steps failed
   - "Continue" button remains enabled
5. Verify complete failure:
   - Error notice shown
   - "Retry" button available
   - "Continue Without Analysis" fallback available

**Expected:** Real-time feedback on analysis progress. Graceful handling of partial/complete failure.

---

## Template Recommendations

### Rule-Based vs AI-Personalized
**Test:** Distinguishes rule-based from AI-personalized recommendations

**Without Provider:**
- Only rule-based recommendations shown
- Badge: "Rule-Based"
- Explanation cites repository facts (languages, structure, endpoints)
- Inline notice offers to configure provider for AI-personalized recommendations

**With Provider:**
- AI-personalized recommendations shown first
- Badge: "AI-Personalized" with sparkle icon
- Explanation cites specific codebase insights
- Usage note: "Analysis used X tokens"

---

## Outline Review

### Edit Capabilities
**Test:** Allows editing outline sections: rename, reorder, add, remove

**Rename:**
1. Expand section
2. Edit "Heading" field
3. Edit "Purpose" field
4. Edit "Description" field
5. Collapse section
6. Verify heading updated in list

**Reorder:**
1. Use up/down arrows on section
2. Verify order changes immediately
3. Verify first section cannot move up
4. Verify last section cannot move down

**Add:**
1. Click "Add Section" at top to append
2. Verify new section appears at end
3. Expand any section
4. Click "Add Section After"
5. Verify new section inserted after current

**Remove:**
1. Click trash icon on section
2. Verify section removed
3. Verify remaining sections re-indexed

**Expected:** All edit operations work smoothly. Changes persist when approving outline.

---

### Clarification Requests
**Test:** Shows Clarification Requests with skip option

**Steps:**
1. Reach outline review with clarification requests
2. Verify banner shows count: "2 Clarifications Needed"
3. Click to expand
4. Verify each request shows:
   - Question
   - Context explanation
   - Affected sections list
   - Text area for answer
   - "Submit Answer" button
   - "Skip" button (if skippable)
5. Answer one clarification
6. Verify it's marked as answered
7. Skip another
8. Verify affected sections are noted
9. Approve outline
10. Verify skipped clarifications don't block progress

**Expected:** Clear presentation of clarification requests. Skipping is allowed with explicit tradeoff messaging.

---

## Generation Mode

### Usage Estimates
**Test:** Displays provider usage estimates with breakdown

**Steps:**
1. Reach generation mode step
2. Select "Generate On Demand"
3. Verify estimate shows:
   - Provider name and model
   - Estimated tokens (~5,000)
   - Approximate cost ($0.15)
   - Currency
4. Verify uncertainty disclaimer present
5. Click "Show Details"
6. Verify section-level breakdown appears:
   - Section heading
   - Estimated tokens per section
   - Approximate cost per section
7. Switch to "Complete Document"
8. Verify estimate updates (higher tokens/cost)
9. Click "Hide Details"
10. Verify breakdown collapses

**Expected:** Transparent cost estimation. Clear disclaimer that estimates may vary. Section-level detail available on demand.

---

### Recommended Mode
**Test:** Recommends on-demand generation over complete

**Steps:**
1. Reach generation mode step
2. Verify "Generate On Demand" card has "Recommended" badge
3. Verify "Generate On Demand" is pre-selected
4. Verify "Complete Document" card has no badge
5. Click "Complete Document"
6. Verify selection switches
7. Verify estimate updates
8. Switch back to "On Demand"
9. Click "Continue to Editor"

**Expected:** On-demand is clearly recommended. User can still choose complete if desired.

---

## Setup Summary Rail

### Responsive Behavior
**Test:** Displays setup progress in responsive rail/drawer

**Desktop (≥1024px):**
- Fixed rail visible on right side
- Width: 320px (w-80)
- Scrollable content
- Always visible

**Mobile (<1024px):**
- Rail hidden by default
- "View Progress" button in top-left
- Click button to open drawer
- Drawer slides in from right
- Overlay backdrop dims main content
- Close button (X) in drawer header
- Tap backdrop to close

**Content:**
- Progress: List of stages with icons
- Completed stages: Green checkmark
- Current stage: Indigo highlight, right arrow
- Future stages: Gray icon
- Accumulated context:
  - Source: Repository name, branch, visibility, language
  - Project: Project name
  - Analysis: Complete/Partial badge
  - Template: "Selected" note
  - Generation: Mode choice

**Expected:** Responsive layout adapts to screen size. Summary rail provides persistent progress context.

---

## Error Handling

### Analysis Partial Failure
- Warning notice: "Partial Analysis"
- Message: "Some steps could not be completed, but we have enough to continue. Template recommendations may have reduced confidence."
- Continue button enabled
- Failed/skipped steps marked in progress list

### Analysis Complete Failure
- Error notice: "Analysis Failed"
- Error message displayed
- Retry button available
- "Continue Without Analysis" fallback available

### Provider Configuration Error
- Inline error message
- Validation feedback (e.g., invalid API key)
- Retry without leaving form

---

## Accessibility

- Keyboard navigation supported for all interactive elements
- Focus visible on all controls
- ARIA labels on icon buttons
- Status changes announced (e.g., analysis complete)
- Color not sole indicator of status (icons + text)
- Form fields properly labeled
- Error messages associated with fields

---

## Implementation Notes

**State Management:**
- DocumentSetupState tracks current stage and accumulated context
- Stage enum: source | analysis | template-selection | outline-review | generation-mode | editor-ready
- State persists via URL query params for resume capability

**API Integration:**
- Polling for analysis status (refetch every 2s while running)
- Real backend endpoints for source connection, analysis, templates
- Mock data for recommendations, proposals, estimates (until Phase 4-5 backend ready)

**Design System Compliance:**
- Uses semantic tokens (interaction, status-*, text-*, panel, workspace)
- Governed component variants (Button, Badge, Notice, Input, Label)
- No hardcoded colors
- Responsive layout with Tailwind breakpoints

---

## Test Coverage Goals

- [ ] Complete happy path (GitHub OAuth → Editor)
- [ ] Resume from each stage
- [ ] All source connection methods
- [ ] Source-less path
- [ ] Inline provider setup
- [ ] Progressive analysis display
- [ ] Partial analysis failure
- [ ] Complete analysis failure
- [ ] Rule-based vs AI-personalized recommendations
- [ ] Outline edit operations
- [ ] Clarification requests
- [ ] Generation mode selection
- [ ] Usage estimate display
- [ ] Responsive rail/drawer behavior
- [ ] Keyboard navigation
- [ ] Error handling for all API failures

---

## Manual Smoke Test Checklist

Before considering Phase 8 complete, manually verify:

1. ✓ GitHub OAuth connection works
2. ✓ Analysis runs and shows progressive facts
3. ✓ Template recommendations appear
4. ✓ Outline can be edited and approved
5. ✓ Generation mode can be chosen
6. ✓ Editor loads after completion
7. ✓ Flow can be resumed after reload
8. ✓ Source-less path works
9. ✓ Provider setup works inline
10. ✓ Summary rail collapses to drawer on mobile
11. ✓ All error states show appropriate messaging
12. ✓ Design system compliance (no hardcoded colors, semantic tokens used)
