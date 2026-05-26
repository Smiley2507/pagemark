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
- Cool-grey palette with subtle blue undertones
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

## 2. Current Frontend Implementation

Pagemark has successfully evolved into a stable, high-fidelity, three-panel interface. The document is the central visual element, supported by the context map on the left and the AI assistant on the right.

### The Three-Panel Layout

- **LEFT PANEL (The Map):** Displays the project structure, section navigation, and a table of contents. Features collapse/expand animations and section statuses.
- **MIDDLE PANEL (The Work):** The core document surface. Supports three modes: Write (Live Preview Markdown), Preview (ReactMarkdown rendering), and Diff (Side-by-side comparison).
- **RIGHT PANEL (The Tool):** The AI Agent surface. Features contextual actions (Generate, Refine, Expand), a chat interface for custom instructions, and a version history timeline.

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

- **Accent Color:** Apple Blue (`#007AFF` light / `#0A84FF` dark).
- **Typography:** **Geist Sans** for UI and body text, **Geist Mono** for code blocks, paths, and metadata.
- **Backgrounds:** Minimal use of layered background surfaces (`bg-background`, `bg-muted`, `bg-card`) to create depth without borders.

---

## 3. What We Need to Add (Roadmap)

While the editor core is robust and highly polished, the following features remain to be implemented to achieve full feature parity and complete the application lifecycle.

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

---
*Last updated: 2026-05-26*
