# Comprehensive Feature Testing Checklist

This checklist is organized by feature area. Each item includes a description of what to test, the expected behavior, and any pre-conditions required. A person with no knowledge of the codebase can use this to verify that every major feature works as intended.

---

## 1. User Registration and Authentication

### 1.1 User Registration
- [ ] **Register with valid data**: Navigate to `/register`. Fill in email, password (8+ chars), name, and submit.
  - **Expected**: 201 response. A verification email is sent. User is NOT automatically logged in.
  - **Pre-conditions**: Email is not already registered.
- [ ] **Register with existing email**: Attempt to register with an already-used email.
  - **Expected**: 400 error — "Email already registered".
- [ ] **Register with short password**: Attempt to register with password < 8 characters.
  - **Expected**: 422 validation error.
- [ ] **Verify email**: Click the verification link from the email (or use the token from the user_settings table).
  - **Expected**: "Email verified successfully" message. User can now log in.
- [ ] **Verify with invalid token**: Click verification link with a random/bad token.
  - **Expected**: Error message — invalid or expired token.

### 1.2 Login / Logout
- [ ] **Login with valid credentials**: Navigate to `/login`. Enter verified email and password.
  - **Expected**: Redirected to `/home`. Access and refresh cookies are set.
  - **Pre-conditions**: User is registered and email is verified.
- [ ] **Login with unverified email**: Attempt to log in before email verification.
  - **Expected**: Error — "Email not verified. Please check your inbox."
- [ ] **Login with wrong password**: Enter incorrect password.
  - **Expected**: 401 error.
- [ ] **Login with non-existent email**: Enter email that doesn't exist.
  - **Expected**: 401 error (generic — does not reveal which field is wrong).
- [ ] **Logout**: Click logout button/user menu → Logout.
  - **Expected**: Cookies cleared, redirected to `/login`.
- [ ] **Cross-tab logout**: Log in on two browser tabs. Log out on one.
  - **Expected**: Second tab detects logout and redirects to login.
- [ ] **Token refresh**: Wait 30+ minutes (or use short TTL). Make an API call.
  - **Expected**: Access token is automatically refreshed using the refresh token.

### 1.3 Password Reset
- [ ] **Forgot password**: Navigate to `/forgot-password`. Enter registered email and submit.
  - **Expected**: "If an account exists, a reset link has been sent" message. Email is sent.
- [ ] **Forgot password with unregistered email**: Enter unregistered email.
  - **Expected**: Same generic message (no account enumeration).
- [ ] **Reset password**: Click reset link from email. Enter new password and submit.
  - **Expected**: Password is changed. User is redirected to login.
- [ ] **Reset with expired token**: Wait for token to expire (or use a bad token).
  - **Expected**: Error — invalid or expired token.

---

## 2. Organization Management

### 2.1 Organization CRUD
- [ ] **Personal org is auto-created**: Register a new user.
  - **Expected**: A personal organization exists with the user as ADMIN.
- [ ] **Create organization**: Navigate to Settings → Organization. Click "Create Organization". Fill in name.
  - **Expected**: Organization created. User is ADMIN. Slug auto-generated.
- [ ] **Edit organization**: Update name, avatar URL.
  - **Expected**: Changes saved and displayed.
  - **Pre-conditions**: User is org ADMIN.
- [ ] **Cannot edit org as non-admin**: Non-admin user visits org settings.
  - **Expected**: Edit controls are disabled or hidden.

### 2.2 Member Management
- [ ] **Invite member**: As ADMIN, invite a user by email.
  - **Expected**: Invite email is sent. Member appears as INVITED status.
  - **Pre-conditions**: Target user is registered.
- [ ] **Accept invite**: Target user clicks invite link.
  - **Expected**: User becomes ACTIVE member with specified role.
- [ ] **Accept expired invite**: Click invite link after expiry.
  - **Expected**: Error — invite expired.
- [ ] **Change member role**: As ADMIN, change a member's role from DEVELOPER to VIEWER.
  - **Expected**: Role updated immediately.
- [ ] **Remove member**: As ADMIN, remove a member.
  - **Expected**: Member removed from org. Can no longer access org projects.
- [ ] **View audit log**: As ADMIN or PM, navigate to audit log.
  - **Expected**: Paginated list of actions (member changes, credential changes, etc.).

### 2.3 Join Links
- [ ] **Create join link**: As ADMIN, create a join link with DEVELOPER role.
  - **Expected**: Link code generated. Copy button available.
- [ ] **Join via link**: As another logged-in user, navigate to `/org/invite/{code}`.
  - **Expected**: User joins org. Redirected to org home.
- [ ] **Join link limit enforcement**: Set max_uses=1. Use it once. Try again.
  - **Expected**: Second attempt fails — link exhausted.
- [ ] **Revoke join link**: Revoke an active join link.
  - **Expected**: Link no longer works.
- [ ] **Expired join link**: Create link with expiry in the past.
  - **Expected**: Link does not work.

---

## 3. Project Management

### 3.1 Project CRUD
- [ ] **Create project**: Navigate to Projects page. Click "New Project". Enter name and optionally description.
  - **Expected**: Project created with PENDING status.
- [ ] **List projects**: Navigate to home/projects page.
  - **Expected**: All projects visible, sorted by recent activity.
- [ ] **Filter projects**: Use search bar, status filter, tag filter.
  - **Expected**: Results filtered accordingly.
- [ ] **Star/unstar project**: Click star icon on project card.
  - **Expected**: Toggles starred state. Starred projects show in "Starred" filter.
- [ ] **Edit project**: Click project → Settings. Update name, description, tags.
  - **Expected**: Changes saved.
- [ ] **Delete project**: Click project → Settings → Delete.
  - **Expected**: Project soft-deleted (disappears from list).
  - **Pre-conditions**: No active analysis or generation running.
- [ ] **Duplicate project**: Click project → More → Duplicate.
  - **Expected**: New project created with same name + " (Copy)". Documents and sections are duplicated.

### 3.2 Source Exclusions
- [ ] **Add exclusion pattern**: Go to project Source → Exclusions. Add pattern `*.test.js`.
  - **Expected**: Pattern saved with enabled=true.
- [ ] **Disable exclusion**: Toggle exclusion off.
  - **Expected**: Pattern still exists but is not applied during next analysis.
- [ ] **Delete exclusion**: Remove an exclusion pattern.
  - **Expected**: Pattern deleted for next analysis.

---

## 4. Source Code Connection

### 4.1 ZIP Upload
- [ ] **Upload ZIP**: Create project. Go to Source. Upload a ZIP file containing source code.
  - **Expected**: Analysis begins immediately. Analysis status shows step-by-step progress.
  - **Pre-conditions**: ZIP is valid, < 150MB uncompressed, contains < 8000 files.
- [ ] **Upload ZIP with exclusions**: Upload ZIP with exclusion patterns active.
  - **Expected**: Excluded files are not analyzed.
- [ ] **Upload invalid ZIP**: Upload a non-ZIP file.
  - **Expected**: Error — invalid file format.
- [ ] **Upload oversized ZIP**: Upload a ZIP > 150MB uncompressed.
  - **Expected**: Error — file too large.

### 4.2 Git Connection (GitHub OAuth)
- [ ] **Connect GitHub**: Go to project Source → "Connect GitHub". Click authorize.
  - **Expected**: Redirected to GitHub. After authorization, redirected back. GitHub shows as connected.
  - **Pre-conditions**: GitHub OAuth app is configured.
- [ ] **Browse repos**: After connecting, browse repositories.
  - **Expected**: List of user's repos (public and private) displayed.
- [ ] **Select repo + branch**: Pick a repository and branch.
  - **Expected**: Repo selection confirmed, branch selected.
- [ ] **Connect repo**: Click "Connect" to connect the repo to the project.
  - **Expected**: Analysis begins. Repository is cloned and analyzed.
- [ ] **Disconnect GitHub**: Click disconnect.
  - **Expected**: OAuth token deleted. GitHub status shows disconnected.
- [ ] **Re-sync source**: After source changes, click "Sync" in project source page.
  - **Expected**: New analysis triggered. After completion, stale sections are flagged.

### 4.3 Git Connection (Public URL)
- [ ] **Connect via URL**: Enter a public Git repository URL and branch.
  - **Expected**: URL validated. Analysis begins. Repo is cloned and analyzed.
- [ ] **Connect invalid URL**: Enter a malformed URL.
  - **Expected**: Validation error.
- [ ] **Connect non-existent URL**: Enter URL of a repository that doesn't exist.
  - **Expected**: Error — repository not accessible.

---

## 5. Code Analysis

### 5.1 Analysis Pipeline
- [ ] **Analysis completes successfully**: Connect source code and wait for analysis to finish.
  - **Expected**: All 9 steps complete. Analysis status shows COMPLETED. File tree, languages, endpoints, complexity are populated.
- [ ] **View analysis progress**: Watch the analysis step indicator during processing.
  - **Expected**: Steps transition from pending → running → done. Step details update with meaningful messages.
- [ ] **View analysis results**: After completion, view analysis results.
  - **Expected**: File tree is visible (expandable directories). Language breakdown with percentages. Endpoints listed with method/path/file. Complexity metrics (total files, lines, largest files).
- [ ] **Analysis without AI credential**: Run analysis when no AI provider is configured.
  - **Expected**: Steps 1-7 complete. Step 8 shows "skipped" with message to add API key. Step 9 runs NLP.

### 5.2 Analysis Features (Language Detection)
- [ ] **Detect Python code**: Upload a project with Python files.
  - **Expected**: Python appears as primary language with file count and percentage.
- [ ] **Detect mixed languages**: Upload a project with Python, JavaScript, and CSS.
  - **Expected**: All languages detected with correct percentages.
- [ ] **Detect unknown extension**: Upload a file with `.xyz` extension.
  - **Expected**: File counted in total but language is "unknown" (not included in breakdown).

### 5.3 Analysis Features (Endpoint Detection)
- [ ] **Detect FastAPI endpoints**: Upload a FastAPI project.
  - **Expected**: Endpoints listed with correct method, path, file, line number.
- [ ] **Detect Express endpoints**: Upload an Express.js project.
  - **Expected**: Endpoints detected with correct HTTP methods and routes.
- [ ] **Detect Spring endpoints**: Upload a Spring Boot project.
  - **Expected**: Endpoints detected from @GetMapping, @PostMapping, etc.
- [ ] **No endpoints found**: Upload a project with no API routes.
  - **Expected**: Endpoints count is 0. "No endpoints found" message.

### 5.4 Analysis Features (Complexity)
- [ ] **Complexity metrics**: View complexity results.
  - **Expected**: Total files, total lines, largest files listed. Per-file complexity scores.
- [ ] **Empty project**: Upload a project with a single empty file.
  - **Expected**: 1 file, 0 lines, complexity 1 (base).

---

## 6. Templates

### 6.1 View Templates
- [ ] **List templates**: Navigate to Templates page.
  - **Expected**: 8 built-in templates displayed: API Reference, SDK Guide, User Manual, Architecture Doc, Migration Guide, CLI Reference, Contribution Guide, Configuration Guide. Each shows name, description, category.

### 6.2 Create Custom Template
- [ ] **Create template**: Click "Create Template". Fill in name, description, sections.
  - **Expected**: Custom template saved and appears in template list.
- [ ] **Edit custom template**: Update name or description of a custom template.
  - **Expected**: Changes saved.
- [ ] **Edit built-in template**: Attempt to edit a built-in template.
  - **Expected**: Edit is not allowed (disabled or error).
- [ ] **Delete custom template**: Delete a custom template.
  - **Expected**: Template removed from list.
- [ ] **Delete built-in template**: Attempt to delete a built-in template.
  - **Expected**: Not allowed.

---

## 7. Document Creation Wizard

### 7.1 Full Setup Flow
- [ ] **Start document setup**: From a project, click "New Document".
  - **Expected**: Setup wizard opens at Step 1 (Source).
- [ ] **Skip source**: In Source step, choose "Start without source".
  - **Expected**: Proceed to analysis step (which shows analysis facts if source was already connected, or skips).
- [ ] **View analysis facts**: If source is connected, view analysis results during setup.
  - **Expected**: File structure, languages, endpoints, and complexity cards shown. Each card has available/unavailable/loading state.
- [ ] **Select template**: Browse template recommendations. Click a template to select it.
  - **Expected**: Template highlighted as selected.
- [ ] **View AI-personalized recommendation**: If AI credentials are configured, view the AI-personalized recommendation.
  - **Expected**: An AI-personalized recommendation appears, with explanation.
- [ ] **Choose custom outline**: Select "Custom Outline" option.
  - **Expected**: Empty outline editor opens. Can add sections manually.
- [ ] **Review and edit outline**: In outline review step, rename sections, add new sections, delete sections, reorder via drag-and-drop.
  - **Expected**: Outline reflects all changes.
- [ ] **View clarification requests**: If AI generated clarification questions, they appear in the review step.
  - **Expected**: Each request shows question, affected sections, and answer/skip buttons.
- [ ] **Answer clarification request**: Type an answer to a clarification request.
  - **Expected**: Request resolved. AI will use answer for generation.
- [ ] **Skip clarification request**: Click skip on a clarification request.
  - **Expected**: Request skipped. Confidence tradeoff noted.
- [ ] **Approve outline**: Click "Approve Outline".
  - **Expected**: Outline proposal approved. Sections are materialized in the document (visible in editor).
- [ ] **Choose generation mode**: Select "I'll write it myself", "Generate sections on demand", or "Generate complete document".
  - **Expected**: Mode selected. For AI modes, estimate of tokens/cost shown.
- [ ] **Enter editor**: Click "Go to Editor" or equivalent.
  - **Expected**: Redirected to the document editor with sections populated.
- [ ] **Resume incomplete setup**: Close the wizard mid-way. Open the document again.
  - **Expected**: Wizard resumes at the correct step (setup_stage is persisted).

---

## 8. Document Editor

### 8.1 Three-Panel Layout
- [ ] **Left panel (Outline)**: Left panel shows document outline as a collapsible tree.
  - **Expected**: All sections listed. Click a section to navigate to it. Drag to reorder.
- [ ] **Toggle left panel**: Click the left panel toggle button.
  - **Expected**: Left panel hides/shows.
- [ ] **Right panel (AI Assistant)**: Right panel shows AI chat interface.
  - **Expected**: Chat area, input box, model selector visible.
- [ ] **Toggle right panel**: Click the right panel toggle button.
  - **Expected**: Right panel hides/shows.
- [ ] **Resize panels**: Drag the divider between panels.
  - **Expected**: Panels resize smoothly.

### 8.2 Section Editing
- [ ] **Edit section content**: Click into a section. Type markdown content.
  - **Expected**: Text appears in Tiptap editor with formatting.
- [ ] **Preview section**: Switch to preview mode.
  - **Expected**: Markdown rendered as HTML with proper styling.
- [ ] **Add new section**: Click "+" or "Add Section" button.
  - **Expected**: New empty section appears at cursor position (or end of document).
- [ ] **Delete section**: Click delete on a section.
  - **Expected**: Section removed (soft-delete).
- [ ] **Reorder sections**: Drag a section by its handle to a new position.
  - **Expected**: Section reordered. Others shift accordingly.
- [ ] **Autosave**: Edit section content. Pause for 3+ seconds.
  - **Expected**: "Saving..." indicator appears, then "Saved". Content is persisted.
- [ ] **Offline/content loss protection**: Edit content and navigate away without saving.
  - **Expected**: Autosave captures content before navigation (3-second debounce).

### 8.3 Markdown Editor (Tiptap)
- [ ] **Bold/Italic**: Select text. Click Bold or Ctrl+B.
  - **Expected**: Text becomes bold. Source shows `**bold**`.
- [ ] **Headings**: Type heading text, select heading level from dropdown.
  - **Expected**: Text becomes h1-h6. Preview renders correctly.
- [ ] **Code block**: Insert code block. Select language (e.g., python).
  - **Expected**: Code appears in formatted block. Syntax highlighting in preview.
- [ ] **Table**: Insert table. Add/remove rows.
  - **Expected**: Table renders in editor and preview.
- [ ] **Link**: Select text. Click link icon. Enter URL.
  - **Expected**: Text becomes clickable link.
- [ ] **Image**: Click image icon. Upload or paste URL.
  - **Expected**: Image displays in editor and preview.
- [ ] **List**: Create ordered and unordered lists.
  - **Expected**: Lists render with correct nesting.
- [ ] **Undo/Redo**: Make edits. Undo (Ctrl+Z) and Redo (Ctrl+Shift+Z).
  - **Expected**: Changes revert and re-apply.

### 8.4 Section States and Status
- [ ] **Empty section state**: Create a new section with no content.
  - **Expected**: Shows "Generate with AI" placeholder or empty editor.
- [ ] **Generated draft state**: Generate section content via AI.
  - **Expected**: Content appears. Status badge shows "Generated Draft".
- [ ] **Reviewed state**: Click "Accept Review" on a generated section.
  - **Expected**: Status changes to "Reviewed". Green checkmark appears.
- [ ] **Edit after review**: Edit a reviewed section.
  - **Expected**: Status reverts to "Generated Draft". Review info cleared.
- [ ] **Needs input state**: When AI requires clarification, section shows "Needs Input" badge.
  - **Expected**: Clarification request appears in the right panel.
- [ ] **Generating state**: While AI is generating content, section shows "Generating" spinner.
  - **Expected**: Content area is locked during generation.
- [ ] **Failed state**: If AI generation fails, section shows "Failed" badge with error info.
  - **Expected**: Retry button available.

---

## 9. AI Generation

### 9.1 AI Provider Setup
- [ ] **View available providers**: Go to Settings → AI Providers.
  - **Expected**: Available providers listed (Anthropic, Google, OpenCode Go) with their models.
- [ ] **Add AI credential**: Select provider (e.g., Anthropic). Paste API key. Select model. Click Save.
  - **Expected**: Credential saved. Test connection runs automatically (or manual test button).
- [ ] **Test credential**: Click "Test Connection".
  - **Expected**: Success message if key works, error if invalid.
- [ ] **Switch active provider**: Add credentials for multiple providers. Toggle active credential.
  - **Expected**: Active provider switches. New AI operations use the active provider.
- [ ] **Delete credential**: Delete an AI credential.
  - **Expected**: Credential removed. If it was active, no active credential remains.

### 9.2 Section Generation
- [ ] **Generate single section**: Open an empty section. Click "Generate" or "Generate with AI".
  - **Expected**: AI generates content. Content appears in section. Status becomes "Generated Draft". Progress indicator shows.
  - **Pre-conditions**: Active AI credential configured.
- [ ] **Generate with code context**: Generate a section for a project with connected source code.
  - **Expected**: Generated content references actual source code elements (file names, function names, endpoints).
- [ ] **Regenerate content**: Click "Generate" on a section that already has content.
  - **Expected**: AI generates new content, replacing existing content. Previous content is preserved in version history.
- [ ] **Generate without AI credential**: Attempt to generate without configuring a provider.
  - **Expected**: Error message — "No active AI provider configured. Go to Settings to add one."

### 9.3 Section Refinement
- [ ] **Refine section**: Select text or enter refinement instruction ("Make it more technical", "Add examples").
  - **Expected**: AI refines the content. Diff view shows what changed. Accept/reject buttons appear.
- [ ] **Accept refinement**: Click "Accept".
  - **Expected**: Refined content replaces original. Version snapshot created.
- [ ] **Reject refinement**: Click "Reject".
  - **Expected**: Original content restored. No new version.

### 9.4 Phrasing Suggestions
- [ ] **Get phrasing suggestions**: Select text in a section. Click "Suggest phrasings" or equivalent.
  - **Expected**: Modal appears with 3 alternative phrasings. Each shows the rewritten text.
- [ ] **Apply phrasing**: Click one of the alternatives.
  - **Expected**: Selected text replaced with chosen alternative.

### 9.5 Structure Suggestions
- [ ] **Suggest structural changes**: Click "Suggest Structure" in AI panel.
  - **Expected**: AI analyzes document outline and returns suggestions: reorder, rename, add, remove, merge sections.
- [ ] **Accept structural suggestion**: Click "Accept" on a suggestion (e.g., rename a section).
  - **Expected**: Change applied immediately. Sections updated.
- [ ] **Reject structural suggestion**: Click "Reject".
  - **Expected**: No change made.

### 9.6 Complete Document Generation
- [ ] **Generate complete document**: In generation mode choice, select "Generate complete document".
  - **Expected**: Generation run created. All sections generate in sequence. Progress bar shows per-section status.
  - **Pre-conditions**: Document has approved outline with multiple sections.
- [ ] **View generation progress**: During complete generation, view the progress.
  - **Expected**: Each section shows QUEUED → GENERATING → READY. Overall progress percentage updates.
- [ ] **Generate on demand**: Set mode to "Generate sections on demand".
  - **Expected**: Sections generate only when user clicks "Generate" on each one individually.
- [ ] **Provider failover**: If a generation task fails due to provider exhaustion, the run pauses.
  - **Expected**: "Provider failed. Switch to backup?" prompt. Confirm to failover to another configured provider.
- [ ] **View generation run details**: After generation, view run details.
  - **Expected**: Token counts, cost, per-section status visible.

### 9.7 AI Chat
- [ ] **Start chat thread**: In the AI panel, type a question and send.
  - **Expected**: Thread created. AI responds via streaming. Response appears progressively.
- [ ] **Multi-turn conversation**: Ask follow-up questions.
  - **Expected**: Conversation context is maintained. AI remembers earlier messages.
- [ ] **@mention resources**: Type @ in chat to open resource palette. Select a file or section.
  - **Expected**: Resource attached to chat. AI can reference it in responses.
- [ ] **Chat history**: Close and reopen AI panel.
  - **Expected**: Previous chat thread is restored. Messages visible.
- [ ] **Multiple threads**: Create a new thread from the panel.
  - **Expected**: New thread created. Old thread available in thread list.

---

## 10. Version Control

### 10.1 Version History
- [ ] **View versions**: Open a section. Click "Version History".
  - **Expected**: Modal opens showing all versions. Each entry shows timestamp, author type (AI/User), change stats (+/-/~ counts).
- [ ] **Preview version diff**: Click a version to preview.
  - **Expected**: Diff view opens showing what changed between this version and the previous one. Added lines in green, removed in red.
- [ ] **Toggle diff view**: Switch between unified and split diff views.
  - **Expected**: Diff layout changes accordingly.
- [ ] **Restore version**: Click "Restore" on a historical version.
  - **Expected**: Section content restored to that version. New version created recording the restore action.
- [ ] **Version created on AI generation**: Generate a section. Check version history.
  - **Expected**: New version with author_type = "AI" appears.
- [ ] **Version created on user edit**: Edit section content. Save.
  - **Expected**: New version with author_type = "User" appears.

### 10.2 Diff Viewing
- [ ] **View refinement diff**: After AI refinement, view the diff.
  - **Expected**: Added/modified/removed content highlighted. Line-level precision.

---

## 11. Freshness / Staleness

### 11.1 Stale Section Detection
- [ ] **Re-sync source**: After initial analysis and generation, change the source code (add a new endpoint, rename a file). Re-sync the project.
  - **Expected**: New analysis runs. After completion, sections referencing changed code are flagged as "potentially stale".
  - **Pre-conditions**: At least one section was reviewed.
- [ ] **View stale section banner**: A flagged section shows a yellow banner.
  - **Expected**: Banner reads "This section may be outdated — source code has changed". "View changes" and "Dismiss" buttons.
- [ ] **Accept freshness update**: Click "View changes" on a stale section. Review the proposed update. Click "Accept update".
  - **Expected**: Section content updated. Stale flag cleared. New version created.
- [ ] **Reject freshness update**: Click "Dismiss" on the stale banner.
  - **Expected**: Stale flag cleared. No content change.
- [ ] **Freshness document status**: View document freshness summary.
  - **Expected**: Shows number of current, stale, and unknown sections.

---

## 12. Export

### 12.1 Export Formats
- [ ] **Export as Markdown**: Open a document. Click Export → Select Markdown → Export.
  - **Expected**: `.md` file downloaded. Contains all sections concatenated with proper heading levels.
- [ ] **Export as HTML**: Export as HTML.
  - **Expected**: `.html` file downloaded. Styled with CSS. Proper heading hierarchy.
- [ ] **Export as PDF**: Export as PDF.
  - **Expected**: `.pdf` file downloaded. Properly paginated. Styled.
- [ ] **Preview export**: Click "Preview" before exporting.
  - **Expected**: HTML preview displayed in an iframe.

### 12.2 Export Customization
- [ ] **Change paper size**: Set paper size to Letter. Export PDF.
  - **Expected**: PDF uses Letter dimensions.
- [ ] **Custom margins**: Set custom margins. Export PDF.
  - **Expected**: Margins applied to PDF pages.
- [ ] **Custom colors**: Change primary, secondary, text, background colors. Export HTML.
  - **Expected**: HTML uses custom color scheme.
- [ ] **Header/Footer**: Enable header with text "My Doc" and footer with page numbers.
  - **Expected**: Header appears on each page. Footer shows "Page 1 of X".
- [ ] **Logo**: Set a logo URL. Export PDF.
  - **Expected**: Logo appears at specified position.
- [ ] **Watermark**: Set watermark text "DRAFT" at 0.3 opacity.
  - **Expected**: Watermark appears diagonally across each page.
- [ ] **Table of Contents**: Enable TOC with depth 3. Export HTML.
  - **Expected**: TOC rendered at beginning with links to sections.
- [ ] **Cover page**: Enable cover page. Export PDF.
  - **Expected**: First page is a cover with title and (if configured) logo.

### 12.3 Batch Export
- [ ] **Batch export multiple projects**: Select multiple projects. Click "Batch Export".
  - **Expected**: ZIP file downloaded containing individual PDFs named by project.
  - **Pre-conditions**: At least 2 projects with documents.

---

## 13. Quality Reports

### 13.1 Quality Analysis
- [ ] **Run quality check**: Open a document. Click "Quality" → "Run Check".
  - **Expected**: Quality analysis dispatched. Results appear after completion.
  - **Pre-conditions**: Document has sections with content.
- [ ] **View quality scores**: After check completes, view the quality modal.
  - **Expected**: Overall score shown with sub-scores: Completeness, Consistency, Readability, Accuracy. Circular visualization.
- [ ] **View quality issues**: Issues tab shows specific problems.
  - **Expected**: Each issue has severity (error/warning/info), message, section reference, and suggestion.
- [ ] **View broken links**: Links tab shows broken URLs.
  - **Expected**: Each broken link shows URL, status code, and section reference.
- [ ] **Run quality on empty document**: Run quality check on a document with no content.
  - **Expected**: Low completeness score. Issues about missing content.

---

## 14. Collaboration

### 14.1 Notes
- [ ] **Create document note**: Open Notes panel. Type a note. Submit.
  - **Expected**: Note appears in the list with user name, avatar, timestamp.
- [ ] **Section-scoped note**: While viewing a specific section, create a note.
  - **Expected**: Note is associated with that section.
- [ ] **View notes**: Switch between sections. Notes panel shows relevant notes.
  - **Expected**: Notes filter by section if scoped, or show all document notes.

### 14.2 Document Sharing
- [ ] **Share document**: Open a document. Click Share. Search for a user. Select permission (VIEW). Share.
  - **Expected**: Share created. User appears in share list.
  - **Pre-conditions**: Target user is registered.
- [ ] **Access shared document**: As the target user, navigate to the shared document.
  - **Expected**: Document is accessible. Permission level restricts actions (VIEW only = no edit).
- [ ] **Revoke share**: As document owner, revoke a share.
  - **Expected**: Share removed. User can no longer access document.
- [ ] **Share with org member**: Share a document with an org member.
  - **Expected**: Works. (Org members already have access, so this is redundant but valid.)

---

## 15. Search

### 15.1 Global Search
- [ ] **Search projects**: Use the global search bar. Type a project name.
  - **Expected**: Matching projects appear in results.
- [ ] **Search documents**: Search a document title.
  - **Expected**: Matching documents appear with their parent project.
- [ ] **Search sections**: Search for text within a section's content.
  - **Expected**: Matching sections appear with content snippet.
- [ ] **Filter by type**: Use type filter (project/document/section).
  - **Expected**: Results filtered to selected type only.
- [ ] **Filter by tag**: Add a tag filter.
  - **Expected**: Results limited to items with that tag.
- [ ] **Sort results**: Change sort order (relevance/updated/created/name).
  - **Expected**: Results reordered accordingly.
- [ ] **No results**: Search for a non-existent term.
  - **Expected**: "No results found" message.

---

## 16. Activity and Timeline

### 16.1 Activity Feed
- [ ] **View activity**: Open a project → Activity tab.
  - **Expected**: Chronological feed of events (document created, section generated, section reviewed, analysis completed, etc.).
- [ ] **Filter activity**: Filter by event type or time range.
  - **Expected**: Feed filtered accordingly.
- [ ] **View heatmap**: Activity tab shows GitHub-style heatmap.
  - **Expected**: Colored squares showing activity intensity per day over the past year.
- [ ] **Recent activity on home**: Home page shows recent activity.
  - **Expected**: Recent events from user's organizations displayed.

---

## 17. NLP Reports

### 17.1 Readability Analysis
- [ ] **View NLP report**: Open a project with documents. Navigate to NLP dashboard.
  - **Expected**: Readability score displayed. Named entities listed. Style analysis shown. Suggestions for improvement.
  - **Pre-conditions**: Documents exist with content.

---

## 18. Grammar Check

### 18.1 Grammar Checking
- [ ] **Check grammar**: Open a section with text. Click "Spelling" or "Grammar Check".
  - **Expected**: Grammar issues returned with suggestions.
  - **Pre-conditions**: LanguageTool instance is accessible.
- [ ] **No issues**: Write clean text. Run grammar check.
  - **Expected**: "No issues found" message.

---

## 19. Terminology

### 19.1 Terminology Check
- [ ] **Check terminology**: Open a document with multiple sections. Click terminology check.
  - **Expected**: Conflicting terminology usages identified (e.g., "user" vs. "end-user").
- [ ] **Resolve terminology**: Select a conflict. Choose replacement term. Apply.
  - **Expected**: Term replaced across all sections. Version snapshots created for changed sections.

---

## 20. API Keys

### 20.1 API Key Management
- [ ] **Create API key**: Go to Settings → API Keys. Click Create. Enter name.
  - **Expected**: Key generated. Raw key displayed once. "Copy" button available.
- [ ] **List API keys**: View API keys list.
  - **Expected**: Shows key name, created date, expiration (partial key only — full key is not stored).
- [ ] **Revoke API key**: Click delete on a key.
  - **Expected**: Key revoked and removed from list.

---

## 21. Resources

### 21.1 File Upload
- [ ] **Upload resource**: Go to project resources. Upload a PDF file.
  - **Expected**: Resource listed with name, type, size. Text extracted from PDF.
- [ ] **Upload image**: Upload a PNG image.
  - **Expected**: Image stored. Thumbnail generated (if applicable).
- [ ] **Download resource**: Click download on a resource.
  - **Expected**: Original file downloaded.
- [ ] **Delete resource**: Delete a resource.
  - **Expected**: Resource removed.
- [ ] **Upload oversize file**: Upload a file > 20MB.
  - **Expected**: Error — file too large.
- [ ] **Upload invalid type**: Upload a `.exe` file.
  - **Expected**: Error — file type not supported.

---

## 22. UI Responsiveness and Accessibility

### 22.1 Responsive Design
- [ ] **Resize browser**: Resize the browser window to different widths.
  - **Expected**: Layout adjusts. On narrow screens, panels stack or collapse. No horizontal overflow.
- [ ] **Mobile viewport**: Use browser dev tools to simulate a mobile device.
  - **Expected**: Basic functionality works. Some panels may be hidden behind toggles.

### 22.2 Keyboard Navigation
- [ ] **Tab through elements**: Use Tab key to navigate interactive elements.
  - **Expected**: Focus moves logically. Focus indicators visible.
- [ ] **Escape to close**: Open a modal/dialog. Press Escape.
  - **Expected**: Modal closes.

---

## 23. Error Handling

### 23.1 General Errors
- [ ] **API returns 500**: Simulate a server error (e.g., stop the backend). Make any request.
  - **Expected**: Error toast/message: "An unexpected error occurred. Please try again."
- [ ] **Network error**: Disconnect from network. Try to load data.
  - **Expected**: Error state with retry button (if using React Query).
- [ ] **404 route**: Navigate to a non-existent URL.
  - **Expected**: 404 page or redirect to home.
- [ ] **Session expired**: Wait for access token to expire. Make an API call.
  - **Expected**: Token refresh happens automatically (or redirect to login if refresh fails).

---

## 24. Data Integrity

### 24.1 Concurrent Operations
- [ ] **Open same document in two tabs**: Make edits in one tab.
  - **Expected**: Autosave persists changes. Refreshing the other tab shows updated content.
- [ ] **Delete while viewing**: Delete a section in one tab, interact with it in another.
  - **Expected**: Graceful handling — soft-delete prevents errors.

### 24.2 Persistence
- [ ] **Refresh during edit**: Edit a section. Refresh the page.
  - **Expected**: Autosave has persisted the content (3-second debounce). Content is preserved.
- [ ] **Logout and login**: Edit, save, log out, log back in.
  - **Expected**: All data preserved. User returns to home page.
- [ ] **Browser back/forward**: Navigate through the app. Use browser back/forward.
  - **Expected**: Navigation works correctly. No stale state.

---

## Test Environment Setup

### Pre-conditions for Testing

| Test Area | Required Setup |
|-----------|----------------|
| Auth | SMTP server configured for email sending (or mock SMTP) |
| AI features | At least one AI provider credential configured in Settings |
| GitHub integration | GitHub OAuth app registered and configured in environment variables |
| Code analysis | Source code ZIP file or Git repository URL |
| Export | At least one document with content |
| Collaboration | At least two user accounts in the same organization |
| Grammar | LanguageTool instance accessible (default public API or self-hosted) |

### Configuration to Verify

- [ ] Database is running and migrated
- [ ] Redis is running for Celery
- [ ] Celery workers are running (`celery -A app.workers.celery_app worker`)
- [ ] Backend environment variables are set (`.env` file)
- [ ] Frontend API base URL is configured (`VITE_API_BASE_URL`)
- [ ] AI provider API keys are tested and valid
- [ ] GitHub OAuth app credentials are set
- [ ] SMTP credentials are configured for transactional emails
