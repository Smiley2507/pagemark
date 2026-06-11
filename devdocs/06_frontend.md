# Frontend Documentation

## Overview

The Pagemark frontend is a **React 19** single-page application built with **TypeScript 6** and **Vite 8**. It lives in the `frontend/` directory and communicates with the FastAPI backend via REST (JSON) and SSE (Server-Sent Events for streaming chat).

## Application Entry

### `src/main.tsx`
Mounts the React application to `#root`. Imports Geist fonts, renders `<App />`.

### `src/App.tsx`
Sets up the application shell:
- `QueryClientProvider` (TanStack React Query)
- `BrowserRouter` (React Router v7)
- `Toaster` (sonner toast notifications)
- Route definitions with `ProtectedRoute` wrapper

**Routes**:

| Path | Component | Auth | Notes |
|------|-----------|------|-------|
| `/login` | LoginPage | Public | |
| `/register` | RegisterPage | Public | |
| `/forgot-password` | ForgotPasswordPage | Public | |
| `/reset-password` | ResetPasswordPage | Public | |
| `/verify-email` | VerifyEmailPage | Public | |
| `/verify-email-pending` | VerifyEmailPendingPage | Public | "Check your email" |
| `/org/invite/:token` | OrgInvitePage | Protected | Accept org invitation |
| `/home` | HomePage | Protected | Dashboard |
| `/projects` | ProjectsPage | Protected | Project library |
| `/projects/:projectId` | ProjectWorkspacePage | Protected | Nested: source, activity, settings, document library |
| `/projects/:projectId/documents/:documentId` | DocumentEditorPage | Protected | Three-panel editor |
| `/templates` | TemplatesView | Protected | Template library |
| `/settings` | SettingsPage | Protected | User settings |
| `/document-setup` | DocumentSetupPage | Protected | Guided document creation |
| `/export/:projectId` | ExportPage | Protected | Export configuration |
| `/members` | MembersPage | Protected | Org member management |
| `/analysis/:id` | AnalysisPage | Protected | Analysis results viewer |
| `/nlp/:projectId` | NLPDashboard | Protected | NLP readability dashboard |
| `/git-connect` | GitConnectPage | Protected | Git repository connection |

## API Layer

### `src/api/client.ts`

Axios instance configured with:
- Base URL from `import.meta.env.VITE_API_BASE_URL`
- `X-Organization-ID` header from active org state
- `withCredentials: true` for cookie-based auth
- 401 response interceptor: queues failed requests, refreshes token via `POST /auth/refresh`, retries original requests
- If refresh fails (e.g., refresh token expired), redirects to `/login`

### API Modules

| Module | File | Key Functions |
|--------|------|---------------|
| Auth | `api/auth.ts` | `login`, `register`, `logout`, `refreshSession`, `getMe`, `forgotPassword`, `resetPassword`, `verifyEmail`, `resendVerification` |
| Documents | `api/documents.ts` | CRUD documents, setup state, template recommendations, outline proposals, generation runs, section CRUD, freshness, shares |
| Sections | `api/sections.ts` | Section CRUD, autosave, title update, reorder, AI generate/refine, accept review, version history/diff/restore |
| AI | `api/ai.ts` | Section generate/refine/accept, structure suggestions, chat threads/messages/streaming, phrasing suggestions |
| Analysis | `api/analysis.ts` | Git URL connect, OAuth connect, repo listing, branches, analysis status/results, outline diff/apply, ZIP upload, NLP reports |
| Projects | `api/projects.ts` | CRUD with filters, search, exclusions |
| AI Credentials | `api/aiCredentials.ts` | CRUD, validate, list providers/models |
| Organizations | `api/org.ts` | CRUD, members, join links, invites, audit logs |
| Quality | `api/quality.ts` | Reports, run quality check |
| Search | `api/search.ts` | Global search |
| Resources | `api/resources.ts` | Upload, list, delete |
| Grammar | `api/grammar.ts` | Grammar check |
| Context Search | `api/contextSearch.ts` | AI panel context search |
| Keys | `api/keys.ts` | API key management |
| Notifications | `api/notifications.ts` | Notification preferences |

## State Management

### Zustand Stores

| Store | File | State | Persisted |
|-------|------|-------|-----------|
| `authStore` | `store/authStore.ts` | `user`, `isLoading`, `showWelcome` | No |
| `orgStore` | `store/orgStore.ts` | `organizations`, `activeOrgId`, `currentRole` | Yes (localStorage) |
| `editorStore` | `store/editorStore.ts` | `activeSectionId`, `leftPanelOpen`, `rightPanelOpen`, `editorMode` | No |
| `themeStore` | `store/themeStore.ts` | `theme` (light/dark/system) | Yes |
| `viewPreferenceStore` | `store/viewPreferenceStore.ts` | list/grid preferences per surface, recent work | Yes |
| `aiStore` | `store/aiStore.ts` | chat model, mode, attachments | Yes (localStorage) |

### TanStack React Query

Server state (projects, documents, sections, templates, etc.) is managed via React Query with:
- `useQuery` for data fetching with automatic refetch on window focus
- `useMutation` for writes with optimistic updates where appropriate
- Query key conventions: `["user"]`, `["projects"]`, `["project", id]`, `["documents", projectId]`, `["sections", documentId]`, etc.

React Query handles caching, background refetching, and loading/error states for all server data, reducing boilerplate.

## Custom Hooks

### `src/hooks/useAuth.ts`
- **`useMe`** — Fetches current user (`GET /auth/me`), on 401 tries refresh, on refresh failure redirects to login
- **`useLogin`** — Login mutation, updates auth store on success
- **`useRegister`** — Register mutation
- **`useLogout`** — Logout mutation, clears auth state and org state, redirects to login
- **`useSessionSync`** — Uses `BroadcastChannel` to sync logout across browser tabs; runs periodic token refresh (every 15 minutes)

### `src/hooks/useSections.ts`
- **`useDocument`** — Fetches a single document with sections
- **`useSection`** — Fetches a single section
- **`useDocumentSections`** — Fetches all sections for a document
- **`useAutosave`** — Debounced autosave (3-second delay) via `PATCH /sections/{id}/autosave`
- **`useDocumentAutosave`** — Autosave for the entire document
- **`useUpdateSection`** / **`useUpdateDocumentSection`** — Update section content/status
- **`useAcceptSectionReview`** — Accept section as reviewed
- **`useVersions`** — List section versions
- **`useVersionDiff`** — Get diff between versions
- **`useRestoreVersion`** — Restore section from a version

### Other Hooks
- **`useProject.ts`**, **`useProjects.ts`** — Project queries/mutations
- **`useAI.ts`** — AI generate/refine/accept mutations
- **`useAiCredentials.ts`** — AI credential management
- **`useAnalysis.ts`** — Analysis status polling
- **`useExport.ts`** — Export requests
- **`useGit.ts`** — Git connection
- **`useQuality.ts`** — Quality reports
- **`useNotes.ts`** — Collaboration notes
- **`useResources.ts`** — File resource management
- **`useNotificationPreferences.ts`** — Notification settings
- **`useKeyboardShortcuts.ts`** — Global keyboard shortcuts (the editor panel)

## Page Components

### `HomePage.tsx`
The user dashboard after login. Displays:
- Typed greeting based on time of day ("Good morning/afternoon/evening, {name}")
- Overview tabs: "My projects", "Recent" (last 7 days), "Starred"
- Project library with search bar, filter chips (status, tags), list/grid toggle
- Each project card shows: name, description, status badge, document count, last updated
- Quick action buttons: new project, create document

### `ProjectsPage.tsx`
Full project library with:
- Search with autocomplete
- Filter by status (PENDING, DRAFT, FINALIZED), tags, starred
- Sort by name, created date, updated date
- List and grid view modes
- Project creation dialog

### `ProjectWorkspacePage.tsx`
Shell component for a single project with:
- Inline project name editing
- Description editing
- Tab-based navigation: Documents, Source, Activity, Settings
- Header with project status, document count, last synced info

### `ProjectSourcePage.tsx`
Source connection management:
- If ZIP source: shows upload date, file count, re-upload button
- If Git source: shows provider, owner, repository, branch, last synced commit, sync button
- If Scratch: offers to connect source
- Analysis section: step-by-step status indicator, start analysis button
- When analysis is complete: shows file tree, language breakdown, endpoint count, complexity metrics
- Analysis snapshot list with timestamps

### `GitConnectPage.tsx`
Git repository browser:
- GitHub OAuth connect/disconnect button
- Repository listing with search
- Branch selection per repo
- Connect button to create project from selected repo+branch

### `SettingsPage.tsx`
Tabbed user settings:
- **Profile**: Name, email, avatar, change password
- **Organization**: Org name, avatar, member list with role management, invite flow, join links, audit log
- **Notifications**: Event type toggles (email preferences)
- **AI Providers**: Add/manage API keys per provider, select active provider/model, test connection
- **API Keys**: Create/revoke programmatic API keys
- **Audit Log**: Paginated action log for admins

### `DocumentSetupPage.tsx`
Multi-step guided document creation wizard (730 lines):

1. **SourceStep**: Connect codebase (GitHub OAuth, git URL, ZIP upload, or skip/scratch)
2. **AnalysisFactsStep**: Shows progressive analysis results as each step completes (file tree card, languages card, endpoints card, complexity card). Each card has available/unavailable states. User proceeds when analysis is complete.
3. **TemplateRecommendationStep**: Shows rule-based recommendations (scored) and AI-personalized recommendation. Each card shows template name, description, score, explanation. Option to choose "Custom Outline" instead.
4. **OutlineReviewStep**: Editable outline display with drag-reorder, rename, add sections, delete sections. Shows clarification requests from AI as cards with accept/skip buttons.
5. **GenerationChoiceStep**: Choose generation mode: manual writing, generate sections on demand, or complete document generation. Shows estimated token usage and cost for each mode.
6. **Editor ready**: Summary rail shows confirmed choices, user enters the editor.

State is managed via a `setupState` concept that maps to the Document's `setup_stage` field (PURPOSE → TEMPLATE_SELECTION → OUTLINE_REVIEW → GENERATION_MODE → EDITOR_READY).

### `DocumentEditorPage.tsx`
The main document editing interface (972 lines). This is the most complex page. Features:

- **Three-panel layout** using `react-resizable-panels`
- **Left panel**: Toggle between Outline (TOC) and Notes
- **Middle panel**: Section editor with write/preview/diff modes
- **Right panel**: AI assistant chat panel
- **Autosave**: Every section has 3-second debounced autosave
- **Section management**: Expand/collapse, add section, reorder via drag-and-drop
- **Generate/Refine**: AI generate content, refine with custom instructions
- **Review workflow**: Accept section as reviewed, view diff
- **Version control**: Version history modal, restore, diff view
- **Quality**: Quality report modal with scores and issues
- **Export**: Export modal with format/styling options
- **Sharing**: Share dialog for document-level permissions
- **Freshness**: Stale section banners with accept/reject updates
- **Focus mode**: Collapse panels for distraction-free writing
- **Keyboard shortcuts**: Global shortcuts defined in `useKeyboardShortcuts()`

### `ExportPage.tsx`
Dedicated export configuration page (359 lines):
- Branding settings (logo upload, colors)
- Layout settings (paper size, margins, fonts)
- Header/footer customization
- Live iframe preview that updates as settings change
- Export buttons (Markdown, HTML, PDF)

## Three-Panel Editor (Detailed)

### Left Panel: `components/editor/LeftPanel.tsx`

Toggles between Outline Panel and Notes Panel.

**Outline Panel** (`components/editor/OutlinePanel.tsx`, 323 lines):
- Document outline as collapsible tree (headings extracted from sections)
- Each section shows: heading, status dot (empty/generated/reviewed/stale), confidence score
- Drag-and-drop reordering of sections
- Click to navigate to a section
- Toggle expand/collapse for nested sections
- Review progress: shows counts of empty/generated/reviewed sections
- Quality/grammar quick-link buttons

**Notes Panel** (`components/editor/NotesPanel.tsx`, 144 lines):
- List of collaboration notes for the current section or document
- Each note shows user avatar, name, content, timestamp
- Create new note via text input and submit button

### Middle Panel: `components/editor/MiddlePanel.tsx`

The main content area (970 lines). Renders:

**Section list**: All sections of the document rendered vertically with drag-and-drop handles.

**Each section renders**:
- **Section header**: Drag handle, heading text, status indicators (needs_input, generating, failed, stale), action buttons (generate, refine, accept, versions, delete)
- **Content area**: Three modes controlled by `editorMode`:
  - **Write mode**: The `MarkdownEditor` (Tiptap rich text editor) with full toolbar
  - **Preview mode**: Rendered Markdown (HTML) with diagrams
  - **Diff mode**: Shows AI-generated diff when refining
- **Empty state**: If section has no content, shows "Generate with AI" placeholder

**Phrasing Modal**: When user selects text and requests phrasing suggestions, a modal appears with 3 alternatives. User clicks one to replace the selected text.

**Drag-and-drop**: Sections can be reordered using `@dnd-kit` with sortable context.

**Autosave indicator**: "Saving..." / "Saved" indicator in the toolbar.

**Editor Top Bar** (`components/editor/EditorTopBar.tsx`, 446 lines):
- Document title (editable)
- Completion ring (shows percentage of reviewed sections)
- Status dropdown (Draft / In Review / Approved)
- AI button (opens right panel)
- Quality button (opens quality modal)
- Spelling button (grammar check)
- Overflow menu: Export, Version History, Share, Focus Mode, Keyboard Shortcuts help
- Panel toggle buttons (left panel, right panel)

### Right Panel: `components/editor/RightPanel.tsx`

AI Assistant panel (498 lines). Contains:

**Header**: "AI Assistant" title, model selector dropdown, mode toggle (Chat / Generate)

**Chat messages**: Scrollable message list with user/AI bubbles. AI messages support markdown rendering.

**Context bar**: Shows attached resources (files, sections, analysis data) with add/remove.

**Composer**: Text input for chat messages. Supports `@` to mention and attach resources (opens `ResourcePalette`). Send button.

**Quick action chips**: Contextual buttons:
- "Generate this section" — AI generates content for active section
- "Refine section" — Opens refine input
- "Suggest structure" — AI proposes outline changes
- "Explain this code" — Explains selected code

**Generate mode** (`components/editor/ai/` sub-components):
- Section selection
- Generation mode (on-demand or complete)
- Progress display during generation

**Clarification requests**: When AI needs input, clarification cards appear with the question, affected sections, and answer/skip buttons.

## Component Details

### `MarkdownEditor.tsx`

Re-exports `TipTapEditor` as `MarkdownEditor`. Wraps Tiptap with Markdown support:
- Headings (h1-h6)
- Bold, italic, strikethrough, underline
- Code blocks with language selection
- Tables with add/delete rows
- Images (upload or URL)
- Links
- Blockquotes
- Ordered/unordered lists
- Task lists

**Full Toolbar** (`components/editor/tiptap/FullToolbar.tsx`, 253 lines):
- Format buttons organized in groups
- Color picker
- Link button (opens URL input)
- Image button (upload dialog or URL)
- Table button (insert grid)
- Clear formatting
- Undo/redo
- Source code view toggle

### `DiffViewer.tsx` (275 lines)

Renders unified or side-by-side diffs using `react-diff-viewer-continued`:
- Highlights added lines (green)
- Highlights removed lines (red)
- Word-level diff within lines (finer granularity)
- Toggle between unified and split view
- Used in: version history, refine results, freshness updates

### `VersionHistory.tsx` (143 lines)

Modal displaying section version history:
- Timeline of versions with timestamp and author type (USER/AI icon)
- Summary of each version (added/removed/modified counts)
- Click to preview diff
- Restore button to revert to a version
- Diff preview inline using DiffViewer

### `QualityModal.tsx` (725 lines)

Full quality dashboard modal:
- **Overview tab**: Circular score visualization with sub-scores (Completeness, Consistency, Readability, Accuracy)
- **Issues tab**: Table of quality issues grouped by severity (error/warning/info), with section reference and suggestion
- **Links tab**: Broken links table with URL, status code, section reference
- **Terminology tab**: Terminology conflicts with replace suggestion
- "Run Quality Check" button to trigger Celery analysis

### `ExportModal.tsx` (623 lines)

Export configuration dialog:
- **Format**: Markdown, HTML, PDF radio buttons
- **Styling**: Color pickers (primary, secondary, background, text, heading, link), font family/size selectors, heading font
- **Page**: Paper size, margins (top/bottom/left/right), line height, max width
- **Header/Footer**: Show/hide toggles, text fields, page numbering options
- **Logo**: Upload or URL, position (left/center/right), max width
- **Code**: Code theme selector
- **Advanced**: Watermark text and opacity, table style, TOC depth, cover page, page breaks
- **Live preview**: Iframe showing real-time HTML preview
- Export button triggers download

### `ShareDialog.tsx` (225 lines)

Document sharing dialog:
- Current shares list with user name, permission level, revoke button
- Add share form: user search (within org), permission select (VIEW/COMMENT/EDIT)
- Validation: cannot share with self, cannot share with org members who already have access

### `StructuralSuggestions.tsx` (139 lines)

Displays AI-proposed structural changes:
- Each suggestion card: action (reorder/rename/add/remove/merge), section affected, explanation
- Accept/Reject buttons per suggestion
- Accept applies the change immediately

### `OutlineDiffBanner.tsx` (129 lines)

Banner displayed when a new analysis proposes an outline different from the current one:
- Shows number of added, kept, and removed sections
- "Review Changes" button opens diff view
- "Apply" button to accept the new outline

### `ResourcePalette.tsx` (222 lines)

Searchable resource browser for the AI panel:
- Search input with keyboard navigation
- Results grouped by type: sections, documents, files, symbols, notes, uploads
- Click to attach resource to AI chat context
- Keyboard shortcuts: arrow keys to navigate, Enter to select, Escape to close

### `EditorContextMenu.tsx` (85 lines)

Right-click context menu on section content:
- "Add to AI context" — attaches section to AI panel
- "Explain" — AI explains the section content
- "Polish" — AI refines the section for clarity

## Layout Components

### `MainLayout.tsx`
Shell: Sidebar + AppHeader + `<Outlet />`. Manages org loading on mount.

### `SidebarNavigation.tsx` (335 lines)
- Projects list with active project highlighting
- Tag cloud for filtering
- Org switcher (dropdown with create/join org dialogs)
- Navigation links: Projects, Templates, Settings
- Collapse/expand toggle

### `AppHeader.tsx` (438 lines)
- Global search bar with autocomplete dropdown (shows projects, documents, sections)
- Search filters: type (all/project/document/section), status, tags, sort
- Theme toggle (light/dark/system)
- Notification bell (number badge)
- User menu: profile, settings, logout

### `ProtectedRoute.tsx`
Wraps routes that require authentication. Redirects to `/login` if user is not authenticated.

### `PermissionGate.tsx`
Conditionally renders children based on user's organization role. Used to hide admin-only UI from non-admin users.

## Document Setup Components

### `SourceStep.tsx` (388 lines)
- GitHub OAuth connect button
- Git URL input with validation
- ZIP file upload area
- "Start without source" option
- Repo search and branch selection when using OAuth

### `AnalysisFactsStep.tsx` (240 lines)
- Polls analysis status every 3 seconds
- Shows 4 fact cards: File Structure, Languages, Endpoints, Complexity
- Each card has available/unavailable/loading states with explanations
- Progress bar showing analysis step completion

### `TemplateRecommendationStep.tsx` (267 lines)
- Skeleton loading state while recommendations generate
- Rule-based recommendations shown as scored cards
- AI-personalized recommendation (highlighted) if available
- Custom outline option card
- Brief explanation of recommendation basis

### `OutlineReviewStep.tsx` (277 lines)
- Editable section list: inline rename, drag-reorder, add, delete
- Clarification requests displayed as expandable cards
- "Approve Outline" button to finalize

### `GenerationChoiceStep.tsx` (238 lines)
- Three option cards: "I'll write it myself", "Generate sections on demand", "Generate complete document"
- Token usage estimate for each AI generation option
- Cost estimate based on active provider pricing

### `ProviderCredentialSetup.tsx` (157 lines)
- Provider selector dropdown
- Model selector (populated from provider API)
- API key input (masked)
- Test connection button
- Save credential button

### `SetupSummaryRail.tsx` (171 lines)
- Side rail showing: project name, source info, selected template/outline, generation choice, analysis summary
- Editable steps (click to go back)
- Progress dots

## Types

All TypeScript interfaces are defined in `src/types/index.ts` and `src/types/document-setup.ts`. Key types:

- **User**: `id`, `email`, `name`, `avatar_url`, `is_verified`, `login_count`
- **Project**: `id`, `org_id`, `name`, `description`, `status`, `source_type`, `tags`, `starred`, `context_md`, `export_settings`, timestamps
- **Document**: `id`, `project_id`, `template_id`, `title`, `status`, `setup_stage`, `purpose`, `audience`, `context`, tags, freshness_state
- **Section**: `id`, `document_id`, `parent_id`, `order_index`, `heading`, `content_md`, `content_lifecycle`, `status`, flags (`needs_input`, `is_generating`, `has_failed`, `is_potentially_stale`), review info, evidence refs
- **Template**: `id`, `name`, `description`, `category`, `purpose`, `audience`, `sections_json`, `system_prompt`, `is_builtin`
- **Analysis**: `id`, `project_id`, `status`, `step_number`, current_step, file_tree, languages, endpoints, complexity
- **AiCredential**: `id`, `provider`, `model_id`, `is_active`, `key_hint`, `validated_at`
- **GenerationRun**: `id`, `document_id`, `mode`, `status`, token counts, cost estimates
- **QualityReport**: `id`, `document_id`, sub-scores, issues, broken links
- **Organization**: `id`, `name`, `slug`, `avatar_url`, `personal`, `quality_threshold`
- **ChatMessage**: `id`, `thread_id`, `role`, `content`, `created_at`

## Key Frontend-Backend Interactions

| User Action | Frontend Call | Backend Endpoint |
|---|---|---|
| Login | `auth.login()` | `POST /auth/login` |
| Load dashboard | `getMe()` | `GET /auth/me` |
| List projects | `projects.list()` | `GET /projects` |
| Upload ZIP | `analysis.uploadZip()` | `POST /projects/{id}/upload` |
| Poll analysis | `analysis.getStatus()` | `GET /projects/{id}/analysis/status` |
| Create document | `documents.create()` | `POST /projects/{id}/documents` |
| Get sections | `documents.getSections()` | `GET /projects/{id}/documents/{id}/sections` |
| AI generate section | `ai.generateSection()` | `POST /sections/{id}/ai/generate` |
| Autosave section | `sections.autosave()` | `PATCH /sections/{id}/autosave` |
| Accept review | `sections.acceptReview()` | `POST /sections/{id}/accept-review` |
| Stream chat | `ai.sendChatMessage()` | `POST /chat/threads/{id}/messages/stream` (SSE) |
| Export document | `export.exportDocument()` | `GET /projects/{id}/documents/{id}/export` |
| Quality check | `quality.runQuality()` | `POST /projects/{id}/documents/{id}/quality/run` |
| Search | `search.search()` | `GET /projects/search` |

## Real-Time / Streaming Behavior

- **Chat streaming**: SSE-based streaming via fetch with `ReadableStream`. The frontend reads `data:` lines as they arrive and updates the chat UI progressively.
- **Analysis polling**: `useQuery` with `refetchInterval: 3000` polls analysis status every 3 seconds. The setup wizard displays progressive step updates.
- **Generation run polling**: `useQuery` polls generation run status periodically until completion.
- **Cross-tab logout sync**: Uses `BroadcastChannel` API to detect logout in one tab and sync state across all tabs.
- **No WebSocket** connections are used.

## Markdown Rendering

The frontend uses `react-markdown` + `remark-gfm` for preview mode and AI responses. The Tiptap editor supports Markdown serialization/deserialization. Mermaid diagrams are rendered using the `mermaid` library.

## Styling

- **TailwindCSS v3** with custom theme extensions (colors, fonts)
- **class-variance-authority** for component variants
- **Radix UI** primitives styled with Tailwind
- **Geist** font family (imported in main.tsx)
- CSS custom properties for theming (light/dark)
- `next-themes` is listed in root package.json but may be unused (theme is handled via Zustand `themeStore` and CSS classes)

## Testing

- **Vitest** is configured for unit testing
- No test files were found in the codebase (tests may not be implemented yet)
