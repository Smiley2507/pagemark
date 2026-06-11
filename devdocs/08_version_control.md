# Version Control and Change Tracking

## Overview

Pagemark implements a snapshot-based versioning system for section content. Every time section content is modified (by user or AI), a full-content snapshot is stored. This enables version history browsing, diff viewing between versions, and content rollback.

## Version Storage

### `section_versions` Table

Each version record stores:
- **`section_id`** — The section this version belongs to
- **`content_md`** — Complete markdown content of the section at this version
- **`author_type`** — `USER` or `AI` (who created this version)
- **`summary`** — Human-readable description of the change
- **`added`** — Count of added lines
- **`removed`** — Count of removed lines
- **`modified`** — Count of modified lines
- **`created_at`** — Timestamp of version creation

Versions are full snapshots, not diffs. This means rollback is a simple content swap.

## When Versions Are Created

Versions are created in the following scenarios:

1. **Section content update** (`PATCH /sections/{id}`): When the user manually edits and saves section content, a new version snapshot is created with `author_type = USER`.

2. **Status update** (`PATCH /sections/{id}/status`): When section status changes, the current content is snapshotted.

3. **AI generation** (`POST /sections/{id}/ai/generate`): When AI generates content, a version is created with `author_type = AI`.

4. **AI refinement** (`POST /sections/{id}/ai/refine` + `POST /sections/{id}/ai/accept`): When user accepts refined content, a version is created.

5. **Autosave** (`PATCH /sections/{id}/autosave`): When autosave detects changes, a version snapshot is created.

6. **Terminology resolution** (`POST /terminology/projects/{id}/resolve`): When bulk terminology replacement happens, version snapshots are created for affected sections.

7. **Version restore** (`POST /versions/{id}/restore`): Restoring a version also creates a new version snapshot (so the restore itself is recorded in history).

## Version Service

### `backend/app/services/version_service.py`

**`compute_diff(version: SectionVersion) -> str`**

Computes a unified diff between the given version and its immediate predecessor:
1. Finds the version immediately before this one (by `created_at` on the same `section_id`)
2. Uses Python's `difflib.unified_diff` on the two `content_md` strings
3. Returns the diff as a string
4. If no predecessor exists, returns the full content as a diff from empty

**`restore_version(db: AsyncSession, version_id: int, user_id: int) -> Section`**

Restores a section to a previous version:
1. Loads the version and its section
2. Updates the section's `content_md` with the version's content
3. Creates a new version snapshot (marking the restore in history):
   - Sets `author_type = USER`
   - Sets `summary = "Restored from version {id}"`
4. Returns the updated section

## Diff Computation

### Backend: `difflib.SequenceMatcher`

Used in two places:

1. **`version_service.compute_diff()`**: Compares two full-version snapshots using `difflib.unified_diff`. Returns a standard unified diff string.

2. **AI refinement diff**: When AI refines content (`ai_doc_service.refine_section()`), the system computes:
   - `added` lines
   - `removed` lines
   - `modified` lines
   Using Python's `difflib.SequenceMatcher` for line-level comparison.

### API Endpoints

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| GET | `/sections/{section_id}/versions` | `get_current_user` | List all versions for a section (ordered by created_at desc) |
| GET | `/versions/{version_id}/diff` | `get_current_user` | Get unified diff between version and its predecessor |
| POST | `/versions/{version_id}/restore` | `get_current_user` | Restore section to version's content |

### Response Schemas

**SectionVersionResponse**:
```json
{
  "id": 42,
  "section_id": 7,
  "author_type": "ai",
  "summary": "AI generated content for Installation section",
  "added": 45,
  "removed": 0,
  "modified": 0,
  "created_at": "2025-01-15T10:30:00Z"
}
```

**VersionDiffResponse**:
```json
{
  "version_id": 42,
  "section_id": 7,
  "old_content": "...",
  "new_content": "...",
  "diff": "@@ -1,5 +1,8 @@\n..."
}
```

## Frontend Diff Viewer

### `components/editor/DiffViewer.tsx` (275 lines)

Uses `react-diff-viewer-continued` to render visual diffs. Features:
- **Unified view**: Inline diff showing additions (green) and deletions (red)
- **Split view**: Side-by-side comparison (old on left, new on right)
- **Word-level highlighting**: Within changed lines, individual changed words are highlighted (uses LCS-based word diffing)
- **Line numbers**: Both old and new line numbers displayed
- **Collapse unchanged sections**: Long files show collapsed middle sections

### `components/editor/VersionHistory.tsx` (143 lines)

Version history modal:
- **Timeline list**: Each version entry shows timestamp, author type icon (user/ai), summary, and change stats
- **Click to preview**: Selecting a version loads its diff against the previous version
- **Restore button**: Confirms and restores the section to the selected version
- **Close modal**: Returns to the editor

## Distinguishing AI Changes from User Edits

- The `author_type` field on `SectionVersion` records `USER` or `AI`
- AI-generated versions are created during `POST /sections/{id}/ai/generate` and `POST /sections/{id}/ai/accept`
- User-edited versions are created during `PATCH /sections/{id}` and autosave
- The frontend displays an icon next to each version indicating its author type
- There is **no mechanism to distinguish AI-generated content from user-written content at the content_lifecycle level** — both AI-generated and user-written content that hasn't been reviewed share the `GENERATED_DRAFT` lifecycle state

## Rollback Implementation

The rollback (restore) flow:

1. User opens Version History modal
2. Selects a version to preview (sees diff)
3. Clicks "Restore" button
4. Frontend calls `POST /versions/{version_id}/restore`
5. Backend:
   - Reads the version's `content_md`
   - Updates the section's `content_md` to this content
   - Creates a NEW version snapshot with the restored content (ensuring no history is lost)
   - New version has `author_type = USER` and `summary = "Restored from version {id}"`
6. Section's `content_lifecycle` is reset to `GENERATED_DRAFT` (review state is cleared)
7. Frontend refreshes the section display

## Freshness / Staleness Tracking

While not a traditional version control feature, the freshness system tracks how source code changes affect reviewed documentation:

### `services/freshness_service.py`

**`detect_stale_sections(db, project_id, old_analysis_id, new_analysis_id)`**:
1. Loads old and new Analysis snapshots
2. Compares: `source_commit`, `file_tree_json`, `endpoints_json`, `languages_json`
3. For each changed analysis fact, checks which sections have `EvidenceReference` pointing to that analysis
4. Returns list of affected section IDs with descriptions of what changed

**`generate_update_proposal(db, section_id, new_analysis)`**:
1. Gets the stale section's current content
2. Gets the new analysis context
3. Calls AI to generate a proposed update (a diff/proposal)
4. Returns the proposal for user review

**`apply_freshness_update(db, section_id)`**:
1. Applies the accepted freshness proposal to the section content
2. Creates a version snapshot
3. Clears `is_potentially_stale` flag

### Frontend Stale Section Handling

In the editor:
- Stale sections display a yellow banner: "This section may be outdated — source code has changed"
- "View changes" button: Shows AI-generated update proposal as a diff
- "Accept update" button: Applies the proposed changes
- "Dismiss" button: Clears the stale flag without changes

## Version History Display

The version history is displayed in a modal accessible from the editor toolbar:

- **Header**: "Version History" title, section name
- **Version list**: Chronological (newest first), each showing:
  - Timestamp (relative: "2 hours ago", "Yesterday", date)
  - Author type badge (🤖 AI / 👤 User)
  - Change summary text
  - Stats line: "+45 -0 ~0" (added, removed, modified)
- **Diff preview panel**: Opens when a version is selected
  - Shows unified or split diff
  - Navigation: "Previous" / "Next" to step through versions
- **Restore button**: Appears for each version, triggers confirmation dialog

## Versioning Limitations

1. **No semantic versioning**: Versions are simple sequential snapshots with no major/minor/patch concept.
2. **No version labels**: Users cannot tag versions with meaningful names (e.g., "v1.0", "pre-review").
3. **No branch/merge**: There is no branching or merge capability.
4. **No automatic cleanup**: Old versions are never pruned. For frequently edited sections, this could lead to storage accumulation.
5. **No cross-section versioning**: There is no mechanism to create a "document-level" snapshot of all sections at a point in time.
6. **Diff is line-based only**: There is no structural diff (e.g., showing that a heading changed vs. body content changed).

## Evidence References

Evidence references link section content to the analysis snapshot it was based on. While not a versioning feature per se, they serve a similar provenance function:

- Stored in `evidence_references` table
- Record: `section_id`, `analysis_id`, `artifact_type` (endpoint/class/function/file), `path`, `symbol`, `line_range_hint`
- Created during AI generation, when the AI outputs evidence items
- Used for freshness tracking: when analysis changes, evidence-linked sections are flagged as potentially stale
- Displayed in the frontend as source citations (expandable/clickable)
