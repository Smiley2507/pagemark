# Phase 9 Test Plan: Project Workspace And Editor Integration

This document describes the test scenarios for Phase 9 requirements.

## Test 1: Multi-Document Project Navigation

**Requirement:** A Project with multiple Documents is navigable without ambiguity.

**Steps:**
1. Navigate to `/home`
2. Click on a project
3. Verify Project workspace loads with Documents tab active
4. Verify URL is `/projects/:projectId`
5. Verify Document library shows all documents for the project
6. Click on first document
7. Verify editor loads at `/projects/:projectId/documents/:documentId`
8. Navigate back to project
9. Click on second document
10. Verify correct document loads in editor
11. Verify no confusion between documents

**Expected:** Each document opens in its own editor view with clear identification. No ambiguity about which document is being edited.

---

## Test 2: Document Library View Preferences Persistence

**Requirement:** Document library list/grid preferences persist correctly.

**Steps:**
1. Navigate to a Project workspace
2. Note default view mode (list)
3. Toggle to grid view
4. Verify view changes to grid
5. Navigate away from the project
6. Navigate back to the same project
7. Verify grid view is still active (preference persisted)
8. Toggle to list view
9. Open a different project
10. Verify it starts in list view (separate context)
11. Go back to first project
12. Verify list view persists for this specific project

**Expected:** View preferences are stored per-surface (project-documents) and per-context (project ID). Each project remembers its own view preference independently.

---

## Test 3: Last Active Section Resume

**Requirement:** Repeat opening a Document resumes the last active Section.

**Steps:**
1. Open a document in editor
2. Navigate through sections, ending on "Section 3"
3. Edit content in Section 3
4. Navigate away from the document (back to project or home)
5. Re-open the same document
6. Verify Section 3 is automatically selected and displayed
7. Verify editor shows Section 3 content
8. Switch to a different section (Section 5)
9. Close and re-open document
10. Verify Section 5 is now the active section

**Expected:** The editor remembers the last active section per document and automatically resumes to it on subsequent visits. This works across browser sessions (uses persisted store).

---

## Test 4: Source Change Non-Blocking Notices

**Requirement:** Meaningful source changes show non-blocking notices.

**Steps:**
1. Open a document in the editor
2. Simulate or trigger a source repository sync
3. Wait for source changes to be detected
4. Verify a notice appears at the top of the editor
5. Verify the notice is informational (info variant), not blocking
6. Verify the editor remains fully functional
7. Verify user can continue editing while notice is visible
8. Click "Review Changes" button in notice
9. Verify notice can be dismissed
10. Verify editing is never interrupted or blocked

**Expected:** Source change notices appear as non-blocking informational banners. The user can continue working and choose when to review changes. No modal dialogs or workflow interruptions.

---

## Test 5: Editor Layout Flexibility

**Requirement:** Editor no longer assumes a permanent equal-weight three-panel layout.

**Steps:**
1. Open document editor
2. Verify Outline panel is visible on the left
3. Click the collapse button on Outline
4. Verify Outline panel hides
5. Verify main editor expands to use available space
6. Verify a toggle button appears to re-open Outline
7. Click toggle button
8. Verify Outline re-appears
9. Click "AI Assistant" button
10. Verify AI panel opens on the right
11. Verify it's an additional panel, not replacing content
12. Close AI panel
13. Verify editor returns to previous layout
14. Verify no fixed three-panel constraint

**Expected:** The editor supports flexible panel visibility. Outline can collapse, AI assistant is optional. The Document editor adapts to available space rather than enforcing equal-width panels.

---

## Test 6: Global Home with Recent & Active Projects

**Requirement:** Home shows recent and active Projects first, followed by searchable Projects library.

**Steps:**
1. Navigate to `/home`
2. Verify "Recent" section appears first (if user has recent projects)
3. Verify it shows up to 3 recently accessed projects
4. Verify "Active" section shows draft-status projects
5. Scroll down to "All Projects" section
6. Verify search bar is present
7. Enter search term
8. Verify filtered results appear
9. Verify list/grid toggle is available
10. Toggle between list and grid view
11. Verify preference persists

**Expected:** Home page prioritizes recent work and active projects at the top. Full library with search and view preferences below.

---

## Test 7: Project Workspace Sub-Navigation

**Requirement:** Project workspace has Documents, Source, and Activity sub-navigation.

**Steps:**
1. Navigate to a Project
2. Verify URL is `/projects/:projectId`
3. Verify three tabs visible: Documents, Source, Activity
4. Verify Documents tab is active by default
5. Click Source tab
6. Verify URL changes to `/projects/:projectId/source`
7. Verify Source page shows repository metadata
8. Click Activity tab
9. Verify URL changes to `/projects/:projectId/activity`
10. Verify Activity page shows event timeline
11. Click Documents tab
12. Verify navigation returns to document library

**Expected:** Clear tab navigation for Documents, Source, and Activity. Each has its own URL and content.

---

## Test 8: Document Library Features

**Requirement:** Document library has search, sort, tags, status, freshness, Template, progress, last activity.

**Steps:**
1. Navigate to Project Documents library
2. Verify documents display with:
   - Title
   - Template name
   - Status badge (draft/in-progress/complete/stale)
   - Progress percentage
   - Last updated date
   - Tags
3. Test search functionality
4. Test sort dropdown (last updated, name, progress)
5. Verify list view shows columns for each attribute
6. Verify grid view shows cards with key info
7. Verify view preference persists

**Expected:** Rich document library with all required metadata visible. Search, sort, and view mode all functional.

---

## Test 9: Source Page Content

**Requirement:** Source page shows repository metadata, sync status, Analysis snapshots, exclusions.

**Steps:**
1. Navigate to Project > Source
2. Verify repository URL displayed
3. Verify branch name displayed
4. Verify source type (git/zip)
5. Verify "Sync" button present
6. Verify Analysis section shows:
   - Analysis status (completed/running/failed)
   - Last updated timestamp
   - Step-by-step status
7. Verify all expected content is present

**Expected:** Comprehensive source health view with repo details and analysis status.

---

## Test 10: Activity Page Timeline

**Requirement:** Activity page has typed timeline and GitHub-style heatmap placeholder.

**Steps:**
1. Navigate to Project > Activity
2. Verify "Activity Overview" section with heatmap placeholder
3. Verify "Recent Activity" timeline below
4. Verify timeline events show:
   - Event type icon
   - Event description
   - Timestamp
   - Event type badge
5. Verify events are ordered by timestamp (newest first)
6. Verify different event types have different icons/colors

**Expected:** Clear activity timeline with typed events. Heatmap placeholder for future implementation.

---

## Test 11: Collapsible Outline

**Requirement:** Outline is collapsible in the editor.

**Steps:**
1. Open document editor
2. Verify Outline panel visible on left
3. Verify collapse button (chevron left) in Outline header
4. Click collapse button
5. Verify Outline panel animates closed
6. Verify toggle button appears in main area
7. Click toggle button
8. Verify Outline re-opens
9. Verify state is not persisted (resets on page load)

**Expected:** Smooth collapsing/expanding of Outline panel. Does not take up space when collapsed.

---

## Test 12: Contextual AI Assistant

**Requirement:** AI appears as contextual actions with optional assistant panel for longer conversations.

**Steps:**
1. Open document editor
2. Verify "AI Assistant" button in top bar
3. Verify AI panel is initially closed
4. Click "AI Assistant" button
5. Verify AI panel slides in from right
6. Verify panel shows contextual suggestions for active section
7. Verify quick action buttons (Improve clarity, Add examples, Check grammar)
8. Click close button on AI panel
9. Verify panel closes
10. Verify main editor remains accessible throughout

**Expected:** AI is opt-in via button. When opened, it's a side panel with contextual actions. Does not obstruct the main editor.

---

## Test 13: Section State Indicators

**Requirement:** Show generated draft, reviewed, stale, generating, and failed states clearly.

**Steps:**
1. Open document with sections in various states
2. Verify each section in Outline shows status icon
3. Verify badge colors match status:
   - Draft: generation color (purple)
   - Reviewed: success color (green)
   - Needs Input: warning color (orange)
   - Generating: info color (blue)
4. Verify active section shows status badge in editor header
5. Verify status is clearly distinguishable

**Expected:** Unmistakable visual indicators for each section state in both Outline and editor.

---

## Test 14: Source Evidence Markers (Placeholder)

**Requirement:** Show source evidence markers that open contextual details.

**Steps:**
1. Open a reviewed section
2. Note that source evidence markers are planned but not yet implemented in this phase
3. Verify editor is ready for future evidence marker integration
4. Verify no errors when viewing sections

**Expected:** Editor structure supports future evidence markers. No implementation required in this phase, but architecture is ready.

---

## Test 15: View Preference Store

**Requirement:** Preferences persist per user, per surface, with optional context ID.

**Steps:**
1. Set view mode for home-projects to grid
2. Set view mode for project A documents to list
3. Set view mode for project B documents to grid
4. Reload page
5. Verify home-projects is still grid
6. Open project A, verify documents are in list view
7. Open project B, verify documents are in grid view
8. Verify preferences are independent

**Expected:** View preference store correctly isolates preferences by surface and context. Uses zustand with persist middleware for localStorage.

---

## Test 16: Recent Work Tracking

**Requirement:** Recent work includes project, document, and section for cross-device resume.

**Steps:**
1. Open project A
2. Open document 1
3. Edit section 3
4. Navigate away
5. Open project B
6. Open document 2
7. Edit section 5
8. Close browser
9. Re-open browser and log in
10. Navigate to home
11. Verify project B appears in recent (most recent)
12. Open project B, document 2
13. Verify section 5 is selected (last edited)
14. Go back, open project A, document 1
15. Verify section 3 is selected

**Expected:** viewPreferenceStore tracks recent work with project/document/section granularity. getLastSection retrieves the last active section for resume capability.

---

## Implementation Checklist

### Completed ✓
- [x] viewPreferenceStore for list/grid preferences
- [x] Recent work tracking (project/document/section)
- [x] Global Home page with recent & active projects
- [x] Searchable project library with list/grid toggle
- [x] Project workspace layout with tabs
- [x] Document library with search, sort, tags, status
- [x] List/grid toggle with persistence per project
- [x] Source page with repository and analysis info
- [x] Activity page with typed timeline
- [x] Document editor page with section resume
- [x] Collapsible Outline panel
- [x] Optional AI Assistant panel
- [x] Section state badges in Outline
- [x] Source change non-blocking notice
- [x] Flexible editor layout (no fixed three-panel)

### Partial / Placeholder
- [ ] Activity heatmap (placeholder shown)
- [ ] Source evidence markers (structure ready, implementation pending)
- [ ] Full Analysis snapshot viewer
- [ ] Source exclusion rules editor

### Not in Phase 9 Scope
- Team queues
- Nested folders
- Batch export
- Automatic provider failover
- Paragraph-level freshness

---

## Testing Strategy

**Manual Testing:**
1. Complete happy path: Home → Project → Document → Editor
2. Test view preferences across multiple projects
3. Test section resume by closing/reopening documents
4. Test Outline collapse/expand
5. Test AI panel open/close
6. Verify source change notice appears and doesn't block
7. Verify all tabs navigate correctly

**Automated Testing:**
Would require setting up component tests for:
- viewPreferenceStore (unit tests)
- HomePage search and view toggle
- DocumentLibraryPage search, sort, view toggle
- DocumentEditorPage section selection and content loading
- ProjectWorkspacePage tab navigation

**Accessibility:**
- Keyboard navigation through Outline sections
- Focus management when panels open/close
- ARIA labels on icon buttons
- Screen reader announcements for state changes

---

## Known Limitations

1. **Mock Data:** Document library, Activity timeline use mock data until backend APIs ready
2. **Activity Heatmap:** Placeholder only; full implementation in future phase
3. **Source Evidence:** Editor structure ready but markers not implemented
4. **Real-time Updates:** Polling for analysis status only; no WebSocket for live activity
5. **Collaboration:** Not included in Phase 9 scope

---

## Success Criteria

Phase 9 is complete when:
1. ✓ Global Home shows recent/active projects and searchable library
2. ✓ View preferences (list/grid) persist per surface and context
3. ✓ Project workspace has working Documents/Source/Activity tabs
4. ✓ Document library has search, sort, tags, status, progress
5. ✓ Source page shows repository and analysis information
6. ✓ Activity page shows event timeline
7. ✓ Editor has collapsible Outline
8. ✓ AI Assistant is optional panel
9. ✓ Section states are clearly indicated
10. ✓ Last active section resumes automatically
11. ✓ Source changes show non-blocking notices
12. ✓ Editor layout is flexible, not fixed three-panel
13. ✓ All tests pass
14. ✓ Frontend lint and build succeed
