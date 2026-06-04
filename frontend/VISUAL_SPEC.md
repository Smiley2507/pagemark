# VISUAL_SPEC_V2.md — Pagemark Design System
## Version 2 — Written from Design Intent, Not from Prototype

> This file is the single source of truth for all visual decisions in Pagemark.
> It documents the currently implemented frontend architecture and features, as well as the roadmap for future additions.
> Read this fully before generating any component, page, or style.

---

## 1. Design Philosophy

### The Three References and What We Take From Each

**Notion** — the document surface
- Wide content column with generous whitespace
- Typography-first: the writing experience is the product
- Clean, almost invisible editor chrome
- The page feels like paper, not like software

**Linear** — the application shell
- Tight, precise spacing in navigation and panels
- Information density in sidebars without feeling cluttered
- Transitions that feel instant, not animated for show

**Cursor (the composer and chat panel only)** — the AI interaction layer
- Composer fixed at the bottom, always present
- Conversation above the composer, scrollable
- Quick-action chips that pre-fill the composer
- The AI panel feels like a tool, not a chatbot

### The Single Most Important Rule

**When two design choices feel equal, choose the one with less.**
Less colour. Less border. Less padding. Less animation.
The best interface decision in this project is usually removal.

---

### Product Personality

Pagemark is a **calm developer workspace**. It should feel precise and capable without becoming cold, dense, or visually noisy.

- The Document uses a warm-neutral canvas that supports long reading and writing sessions.
- Primary navigation uses a compact, collapsible dark neutral sidebar to clearly frame the warm-light workspace.
- A restrained indigo accent identifies primary actions, focus, and selection.
- Depth comes from tonal surface changes first and separators second. Shadows are reserved for overlays and elevated interactive elements, not routine content grouping.
- The interface should not resemble a generic analytics dashboard or make AI visually dominate the Document.
- Application chrome, navigation, menus, and toolbars are compact; content surfaces for reading, writing, Analysis, and Template decisions are spacious.
- Controls and surfaces use restrained rounding, generally 6–10px. Pill shapes are reserved for statuses, compact filters, and other genuinely pill-shaped semantics.
- The light workspace is the reference theme for the redesign. Dark mode remains supported and must be deliberately tuned from the same semantic tokens after the light system is established, not created through automatic color inversion.
- Motion is functional and restrained: use quick transitions to explain panel changes, menus, progress, and state updates. Avoid decorative page animation in the authenticated workspace.
- Semantic colors are reserved for meaningful workflow states such as success, warning, error, generation, review, and needs-input. Do not use status colors as decoration; indigo remains the interaction and brand accent.

---

## 2. Workspace Hierarchy

The Document is the dominant workspace. Supporting tools should remain available without permanently competing for equal visual weight.

- **DOCUMENT (The Work):** The core surface and visual focus. It supports writing, preview, and diff workflows.
- **OUTLINE (The Map):** A collapsible navigation tool for Document structure and Section status.
- **AI ASSISTANCE (The Tool):** Contextual actions appear near the active Section or selected text. A collapsible assistant panel opens only for longer conversations.
- **PROJECT CONTEXT:** Source changes, generation progress, and other meaningful events appear as non-blocking notices with explicit review actions.

### Editor Core (Obsidian-Parity Live Preview)

The core writing experience is powered by **CodeMirror 6**, completely overhauled to provide an Obsidian-like "source-as-truth" live preview experience. 

Currently implemented features:
1. **Interactive Checkboxes:** Markdown task lists (`- [ ]`) render as clickable HTML checkboxes directly in the editor.
2. **Fenced Code Blocks:** 
   - Rendered with syntax highlighting via `react-syntax-highlighter`.
   - Feature an interactive "Copy" button that uses strict pointer events to avoid focus loss.
   - **Active State Dimming:** When the cursor is inside a code block, the fence markers (`` ``` ``) are dimmed and the block receives a subtle background highlight (`cm-lp-active-fenced`) to provide clear spatial awareness.
3. **Smart Tables:** Markdown tables are rendered visually. When the cursor enters a table, a **Table Assistant** (floating toolbar) appears, allowing non-destructive column/row additions and deletions.
4. **Live Headings & Formatting:** Headings dynamically scale in size (H1-H6). Bold, italic, and inline code are styled appropriately while maintaining markdown characters.
5. **Horizontal Rules:** `---` renders as a clean visual divider.
6. **Smart Typing:** Integrated `closeBrackets` for seamless pair typing and `indentWithTab` for standard code indentation.

### Interactive Menus

1. **Slash Command Menu:**
   - Triggered by typing `/` on an empty line (or viewing the "Type '/' for commands" placeholder).
   - Features dynamic filtering (e.g., typing `/co` narrows options to "Code Block").
   - Supports keyboard-first navigation (Arrow keys, Enter, Escape).
2. **Floating Bubble Menu:**
   - Appears when text is highlighted.
   - Provides quick formatting options (Bold, Italic, Inline Code, Link).

### Color and Typography System

- **Accent Family:** Restrained indigo. Final accessible values belong in semantic design tokens, not components.
- **Typography:** **Geist Sans** for UI and body text, **Geist Mono** for code blocks, paths, and metadata.
- **Backgrounds:** Warm-neutral Document surfaces framed by precise neutral application chrome.
- **Depth:** Minimal use of layered semantic surfaces to create hierarchy without excessive borders.

---

## 3. What We Need to Add (Roadmap)

While the editor core is robust and highly polished, the following features remain to be implemented to achieve full feature parity and complete the application lifecycle.

### Redesign Delivery Order

The first redesign implementation must cover the complete first-Document journey:

1. Connect source code.
2. Progressively reveal Analysis facts.
3. Recommend Templates by documentation purpose and repository facts.
4. Let the maintainer confirm a Template or create a project-specific Custom Outline.
5. Review and approve the adapted Outline.
6. Compare estimated provider usage and choose a Generation mode.
7. Enter the Document editor as soon as useful work is available.

This journey establishes the reusable application shell and core design-system patterns. Dashboard and broader editor redesign work follow it.

Backend implementation must begin with the domain schema, then Project and nested Document APIs, then shared Analysis and Template Recommendation flows, then Generation Runs and freshness workflows. The data-model shift is the central risk and should lead implementation.

The journey uses a focused full-page workflow with persistent progress and a live summary rail. The rail accumulates confirmed context such as the connected source, discovered repository facts, documentation purpose, selected structure, and estimated provider usage without becoming a second form.

On smaller screens, the active task remains primary and the live summary rail collapses into an accessible review drawer.

Source connection emphasizes GitHub as the primary path because it supports future synchronization and stale-document detection. Repository URL and ZIP upload remain visible fallback options, while starting without source is a clearly secondary path.

GitHub repository selection uses a searchable recent-repositories list showing ownership, visibility, primary language, last update, and connection status. Broader search remains available without making a full organization browser the default.

For connected repositories, Pagemark infers the initial Project name from repository metadata and requests optional human context after connection. Maintainers may refine the name and add purpose, audience, or business context that source code cannot reveal.

Repository Analysis applies smart exclusions by default and offers an optional review step for detected large, generated, secret-prone, or irrelevant paths. Exclusion reasons and the relevance, privacy, or processing impact of including a path must be clear.

After Analysis, Template selection presents one clearly explained recommendation, a small set of relevant alternatives, and the option to create a Custom Outline. Recommendations must cite the repository facts and documentation purpose that made them suitable.

Outline review uses an editable structured list. Each proposed Section shows its purpose and relevant repository evidence, and supports rename, reorder, add, and remove before approval.

Before generation, usage estimates show relative provider usage, approximate provider cost, explicit uncertainty, and a Section-level breakdown. Estimates must not be presented as guaranteed billing amounts.

Onboarding recommends Provider credential setup but allows the maintainer to skip it. Without an Active provider, project creation still shows useful rule-based Template recommendations after static Analysis. When the maintainer chooses an AI-powered recommendation, AdaptTemplate, or generation action, the journey presents an embedded, security-focused Provider credential step explaining credential storage, validation, provider usage, and expected cost without redirecting away from the workflow.

Template recommendations clearly identify their basis, distinguishing recommendations derived from repository facts from AI-personalized recommendations. The UI must make provider usage and credit-consuming actions explicit.

Complete-Document generation opens the editor immediately. Sections visibly progress through queued, generating, ready, or failed states; ready Sections become reviewable immediately, while in-progress Sections are clearly protected from accidental editing.

Generated prose enters as a visibly reviewable draft rather than verified documentation. Source-evidence cues and focused actions to accept, refine, or regenerate should support review without forcing a blocking approval step for every Section.

Source evidence appears as subtle inline markers that open contextual repository details on demand. Evidence must remain available at the relevant claim without permanently cluttering the Document.

The Project workspace emphasizes its Document library and shared source health. It shows each Document's generation, review, and freshness state; repository synchronization status; and a clear action to create another Document. Repository analytics remain supporting evidence rather than the workspace's dominant content.

The Document library supports both a compact structured list and a grid view, and remembers the maintainer's last choice. List is the default for scanning purpose, Template, status, freshness, progress, and recent activity; grid provides a more visual browsing mode without changing the underlying information.

Document organization uses search, sort, and lightweight tags. Nested folders are intentionally excluded because the Project already provides the primary organizational boundary.

The global home prioritizes recent and active Projects, followed by the complete searchable Project library. The library supports list and grid views while keeping resume-work signals such as active generation, Sections needing input, and source changes visible.

Global navigation contains Home, Projects, Templates, and Settings. Project-specific Documents and tools appear only after entering a Project so the compact sidebar remains stable and contextually relevant.

Inside a Project, sub-navigation contains Documents, Source, and Activity. Shared Analysis and synchronization details live under Source; Document-specific generation, quality, review, and export actions remain within each Document.

Project Activity contains meaningful workflow events such as source synchronization, Analysis outcomes, generation completion or failure, review acceptance, and freshness changes. It excludes routine edits, autosaves, and administrative audit-log noise.

Basic sharing and review states remain supported, but collaboration must not dominate the initial redesign. Assignments, comments, approvals, and team queues remain secondary to helping the Project maintainer create and maintain documentation efficiently.

The Template library is organized primarily by documentation purpose, with ownership filters for built-in, organization, and personal Templates. Technology-stack compatibility appears as supporting metadata and filtering rather than the main browsing structure.

Template previews show purpose, intended audience, expected outcome, Outline preview, compatible repository traits, and estimated generation scope. They must support an informed choice without implying that a generic example is the maintainer's expected output.

### Editor Enhancements (Obsidian-Parity)
- **Callouts (Blockquotes):** Expand the syntax tree parsing to support Obsidian-style callouts (e.g., `> [!info]`) rendering with custom background colors and icons.
- **Internal Wiki-links:** Implement parsing and autocompletion for `[[Page Name]]` syntax to link between different sections/projects.
- **Media Drag-and-Drop:** Add support for dragging images into the editor and rendering them inline.

### Backend Integration & AI Features
- **Realtime Agent Chat:** The chat in the Right Panel currently uses mocked timeouts. It needs to be connected to the FastAPI backend's streaming endpoint for real conversational AI.
- **Full History Diffing:** Clicking a version in the "History" tab of the Right Panel should seamlessly trigger the Diff Mode in the Middle Panel to compare the historical version with the current text.

### Git & Ingestion Workflow
- **Git Repository Management:** Implement the frontend UI for connecting Git repositories (OAuth/URL).
- **Settings Modal:** Add a dedicated settings view for managing connected Git accounts and repository sync statuses.
- **Analysis Page Sync:** Ensure the project analysis page can trigger and react to real-time Git sync events.

---

## 4. Technical Constraints & Rules for Future Code

1. **Erasable Syntax Only:** The project operates under strict `erasableSyntaxOnly` rules. Do NOT use TypeScript shorthand constructor properties in classes (e.g., `constructor(public doc: string)`). All properties must be explicitly declared and assigned.
2. **Editor State Integrity:** When building new CodeMirror widgets, ALWAYS use `StateField` to manage multi-line decorations (like Code Blocks or Tables). Do NOT use `ViewPlugin` for injecting line replacements or block widgets, as this will cause `RangeError` crashes during document mutations.
3. **Event Propagation:** Any interactive React components injected into the editor (like Copy buttons or Table tools) MUST handle `pointerdown` events and call `e.preventDefault()` / `e.stopPropagation()` to prevent CodeMirror from stealing focus or altering the cursor position unexpectedly.
4. **Tailwind Hygiene:** Avoid duplicate layout classes (e.g., applying both `bg-card` and `bg-card/80` on the same element).
5. **Semantic Tokens:** Components must use semantic tokens that describe visual purpose, not raw palette values. Raw colors, arbitrary radii, and one-off shadows are design-system violations.
6. **Governed Variants:** Shared UI components expose the approved visual variants for buttons, badges, notices, inputs, surfaces, and other recurring patterns. Feature code should compose those variants rather than restyle them.
7. **Computed-Value Exception:** Inline styles are allowed only for values that are genuinely computed at runtime, such as progress width, editor geometry, or user-selected export branding. They must not encode the product UI palette or routine component styling.
8. **Automated Enforcement:** Linting and review checks must reject raw product-UI colors, arbitrary visual values, and unapproved recurring style patterns. Any exception must be narrow, intentional, and explainable.
9. **Accessibility Baseline:** Product UI must meet WCAG 2.2 AA. Every workflow must support keyboard operation, visible focus, sufficient contrast, reduced motion, and status communication that does not rely on color alone.

---
*Last updated: 2026-06-05*
