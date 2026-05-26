# VISUAL_SPEC_V2.md — Pagemark Design System
## Version 2 — Written from Design Intent, Not from Prototype

> This file is the single source of truth for all visual decisions in Pagemark.
> It supersedes VISUAL_SPEC.md entirely. Do not reference the old file.
> Read this fully before generating any component, page, or style.
> When in doubt, choose the simpler option.

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

### What This Produces

A three-panel interface where:
- The LEFT panel is the AI (the active tool)
- The CENTER panel is the document (the work)
- The RIGHT panel is the table of contents (the map)

The document is always the dominant visual element. Both side panels
serve it. Neither side panel competes with it for attention.

### The Single Most Important Rule

**When two design choices feel equal, choose the one with less.**
Less colour. Less border. Less padding. Less animation.
The best interface decision in this project is usually removal.

---

## 2. Colour System

### Accent Colour — Apple Blue

The single accent colour across the entire application.

```
Light mode accent:  #007AFF   (Apple iOS blue, exact)
Dark mode accent:   #0A84FF   (Apple dark mode blue, exact)

Tailwind custom token: --accent-blue
Use as: text-[#007AFF] / dark:text-[#0A84FF]
        bg-[#007AFF] / dark:bg-[#0A84FF]
        border-[#007AFF] / dark:border-[#0A84FF]
```

The accent appears on:
- Active states (active TOC item underline, active tab indicator)
- Primary action buttons
- Focus rings
- Links
- AI avatar gradient (violet-500 → #007AFF)
- Progress fills
- Selected text background (at 15% opacity)

The accent does NOT appear on:
- Backgrounds of panels or cards
- Borders in resting state
- Text except links and active labels
- Decorative elements

### Light Mode Palette

```css
:root {
  /* Backgrounds — layered from bottom to top */
  --bg-app:         #F5F5F7;   /* page chrome, outermost shell */
  --bg-panel:       #FFFFFF;   /* panels, editor surface */
  --bg-elevated:    #FFFFFF;   /* modals, dropdowns */
  --bg-subtle:      #F5F5F7;   /* muted areas, input backgrounds */
  --bg-hover:       #F0F0F2;   /* hover states on interactive surfaces */
  --bg-active:      #E8E8EC;   /* pressed/active states */

  /* Text */
  --text-primary:   #1A1A1A;   /* headings, strong labels */
  --text-secondary: #6E6E80;   /* body, descriptions */
  --text-tertiary:  #9898A8;   /* timestamps, placeholders, hints */
  --text-disabled:  #C4C4CC;   /* disabled states */

  /* Borders */
  --border-default: #E4E4E8;   /* panel separators, card borders */
  --border-strong:  #D0D0D8;   /* focused inputs, active elements */
  --border-subtle:  #F0F0F2;   /* very light separators */

  /* Semantic */
  --color-success:  #34C759;   /* finalized, saved, confirmed */
  --color-warning:  #FF9500;   /* draft, in progress */
  --color-error:    #FF3B30;   /* errors, destructive */
  --color-info:     #007AFF;   /* same as accent */

  /* Status (section states) */
  --status-pending-text: #9898A8;
  --status-pending-bg:   #F5F5F7;
  --status-draft-text:   #CC7A00;
  --status-draft-bg:     #FFF8EC;
  --status-done-text:    #248A3D;
  --status-done-bg:      #F0FFF4;
}
```

### Dark Mode Palette

```css
.dark {
  --bg-app:         #0D0D0F;   /* deepest background */
  --bg-panel:       #141416;   /* panels */
  --bg-elevated:    #1C1C1F;   /* modals, dropdowns, input bg */
  --bg-subtle:      #1C1C1F;   /* muted areas */
  --bg-hover:       #222226;   /* hover */
  --bg-active:      #2A2A2E;   /* pressed */

  --text-primary:   #F2F2F7;
  --text-secondary: #8E8E9E;
  --text-tertiary:  #636373;
  --text-disabled:  #3E3E4A;

  --border-default: #232328;
  --border-strong:  #3A3A40;
  --border-subtle:  #1A1A1E;

  --color-success:  #30D158;
  --color-warning:  #FF9F0A;
  --color-error:    #FF453A;

  --status-pending-text: #636373;
  --status-pending-bg:   #1C1C1F;
  --status-draft-text:   #FF9F0A;
  --status-draft-bg:     #2A2000;
  --status-done-text:    #30D158;
  --status-done-bg:      #002A10;
}
```

### Tailwind Config Integration

```typescript
// tailwind.config.ts
export default {
  darkMode: ["class"],
  theme: {
    extend: {
      colors: {
        app: "var(--bg-app)",
        panel: "var(--bg-panel)",
        elevated: "var(--bg-elevated)",
        subtle: "var(--bg-subtle)",
        "surface-hover": "var(--bg-hover)",
        "surface-active": "var(--bg-active)",

        "text-1": "var(--text-primary)",
        "text-2": "var(--text-secondary)",
        "text-3": "var(--text-tertiary)",

        "border-1": "var(--border-default)",
        "border-2": "var(--border-strong)",
        "border-3": "var(--border-subtle)",

        accent: "#007AFF",
        "accent-dark": "#0A84FF",
        success: "var(--color-success)",
        warning: "var(--color-warning)",
        danger: "var(--color-error)",
      },
    },
  },
}
```

---

## 3. Typography

### Font — Geist

```
npm install geist
```

```typescript
// src/main.tsx
import { GeistSans } from "geist/font/sans"
import { GeistMono } from "geist/font/mono"
```

```css
:root {
  --font-sans: "Geist", -apple-system, BlinkMacSystemFont, sans-serif;
  --font-mono: "Geist Mono", "JetBrains Mono", monospace;
}
```

Apply in tailwind.config.ts:
```typescript
fontFamily: {
  sans: ["Geist", ...defaultTheme.fontFamily.sans],
  mono: ["Geist Mono", ...defaultTheme.fontFamily.mono],
}
```

### Type Scale

These are the only font sizes used in the application.
Do not use any size outside this scale.

```
/* App shell, panels, navigation */
--text-xs:   11px / 1.3 / weight 500   → labels, badges, shortcuts
--text-sm:   13px / 1.4 / weight 400   → secondary body, metadata
--text-base: 15px / 1.5 / weight 400   → primary body, panel text

/* Document editor (larger — writing experience) */
--text-doc-body: 16px / 1.75 / weight 400   → document body text
--text-doc-h3:   18px / 1.4  / weight 600   → H3 in document
--text-doc-h2:   22px / 1.3  / weight 600   → H2 in document
--text-doc-h1:   28px / 1.2  / weight 700   → H1 in document

/* Page level */
--text-title:  20px / 1.3 / weight 600    → modal titles, page headings
--text-hero:   32px / 1.15 / weight 700   → auth pages only
```

### Typography Rules

- Geist Sans for all UI text
- Geist Mono for: code blocks, file paths, keyboard shortcuts,
  version labels, API endpoint paths, timestamps in history
- Document content uses the larger doc scale; all panels use the app scale
- Weight 400 for body, 500 for labels, 600 for headings, 700 for hero only
- Never add letter-spacing to any text
- Never use text-transform: uppercase on anything longer than 3 words
- Line height in the document editor must be 1.75 — generous, readable
- Never centre-align body paragraphs

---

## 4. Spacing and Layout

### Spacing Scale

Use Tailwind's default spacing scale.
These values appear most frequently:

```
2  =  8px   icon button padding, tight gaps
3  = 12px   chip padding, list item internal padding
4  = 16px   panel padding, card padding
5  = 20px   section gaps within panels
6  = 24px   between major sections
8  = 32px   page-level section gaps
12 = 48px   document horizontal padding
16 = 64px   document max-width side margins
```

### The Three-Panel Layout

```
┌──────────────┬─────────────────────────────┬───────────────┐
│              │                             │               │
│  TOC         │     DOCUMENT EDITOR         │  AI PANEL     │
│  (left)      │     (center, flexible)      │     (right)   │
│              │                             │               │
│  220px       │     flex-1                  │   300px       │
│  collapsible │     min-width: 480px        │   resizable   │
│              │                             │               │
└──────────────┴─────────────────────────────┴───────────────┘
```

Implementation:
```tsx
// Use react-resizable-panels (already in dependencies)
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels"

<PanelGroup direction="horizontal" className="h-screen">
  <Panel
    defaultSize={22}
    minSize={16}
    maxSize={35}
    collapsible
    id="ai-panel"
  />
  <PanelResizeHandle className="w-px bg-border-1 hover:bg-accent
    transition-colors cursor-col-resize" />
  <Panel minSize={40} id="editor" />
  <PanelResizeHandle className="w-px bg-border-1 hover:bg-accent
    transition-colors cursor-col-resize" />
  <Panel
    defaultSize={16}
    minSize={12}
    maxSize={25}
    collapsible
    id="toc-panel"
  />
</PanelGroup>
```

The resize handle is a 1px line that turns accent-blue on hover.
No visible drag handle icon. The cursor changes to col-resize.
This is how Linear handles resizable panels.

### Document Content Column

```
Within the center panel:
max-width: 680px
margin: 0 auto
padding: 48px 64px   (top/bottom 48, left/right 64)
```

This creates the Notion-like wide-margin reading experience.
The editor fills the column — no visible border or card around it.

### Panel Headers

Every panel has a header:
```
height: 36px
border-bottom: 1px solid var(--border-default)
padding: 0 12px
display: flex
align-items: center
background: var(--bg-panel)
```

These headers are narrow and quiet. They contain a title and
an action or collapse button. Nothing else.

### App Shell Header

```
height: 44px (not 48px — slightly shorter than typical)
border-bottom: 1px solid var(--border-default)
background: var(--bg-panel)
backdrop-filter: blur(8px)
position: sticky top-0 z-50
padding: 0 16px
```

---

## 5. Component Library

### Buttons

**Primary**
```
background: #007AFF (light) / #0A84FF (dark)
color: #FFFFFF
height: 32px
padding: 0 14px
border-radius: 8px
font-size: 13px
font-weight: 500
hover: brightness(1.1)
active: brightness(0.95)
```

**Secondary**
```
background: var(--bg-subtle)
color: var(--text-primary)
border: 1px solid var(--border-default)
height: 32px
padding: 0 14px
border-radius: 8px
font-size: 13px
font-weight: 500
hover: background var(--bg-hover)
```

**Ghost**
```
background: transparent
color: var(--text-secondary)
height: 28px
padding: 0 8px
border-radius: 6px
font-size: 13px
hover: background var(--bg-hover), color var(--text-primary)
```

**Icon button**
```
width: 28px
height: 28px
border-radius: 6px
background: transparent
color: var(--text-tertiary)
display: flex items-center justify-center
hover: background var(--bg-hover), color var(--text-primary)
```

**Destructive**
```
background: transparent
color: var(--color-error)
border: 1px solid var(--color-error) at 30% opacity
height: 32px
padding: 0 14px
border-radius: 8px
hover: background var(--color-error) at 8% opacity
```

### Inputs

```
background: var(--bg-subtle)
border: 1px solid transparent
border-radius: 8px
height: 32px
padding: 0 12px
font-size: 13px
color: var(--text-primary)
placeholder: var(--text-tertiary)

focus:
  border-color: #007AFF
  outline: none
  background: var(--bg-panel)
  box-shadow: 0 0 0 3px rgba(0, 122, 255, 0.12)
```

Inputs do not have visible borders at rest.
The border appears only on focus (Apple's approach).

### The Composer (AI Panel Input — Most Important Component)

```
Container:
  background: var(--bg-elevated)
  border: 1px solid var(--border-default)
  border-radius: 12px
  padding: 10px 12px
  margin: 12px

  focus-within:
    border-color: #007AFF
    box-shadow: 0 0 0 3px rgba(0, 122, 255, 0.10)

Textarea inside composer:
  background: transparent
  border: none
  outline: none
  font-size: 13px
  line-height: 1.5
  color: var(--text-primary)
  placeholder: var(--text-tertiary)
  resize: none
  min-height: 20px
  max-height: 120px
  overflow-y: auto
  width: 100%

Bottom row (below textarea):
  display: flex
  justify-content: space-between
  align-items: center
  margin-top: 8px

  Left: context pill
    background: var(--bg-subtle)
    border-radius: 6px
    padding: 2px 8px
    font-size: 11px
    color: var(--text-tertiary)
    font-family: mono

  Right: send button
    width: 26px
    height: 26px
    border-radius: 7px
    background: #007AFF
    color: white
    display: flex items-center justify-center
    ArrowUp icon h-3.5 w-3.5
    disabled: opacity 0.35, cursor not-allowed
```

### Quick-Action Chips

Shown above the composer in the AI panel.

```
Container: flex gap-1.5 flex-wrap px-3 pb-2

Each chip:
  background: var(--bg-subtle)
  border: 1px solid var(--border-default)
  border-radius: 100px (pill)
  padding: 3px 10px
  font-size: 11px
  font-weight: 500
  color: var(--text-secondary)
  cursor: pointer

  hover:
    background: var(--bg-hover)
    color: var(--text-primary)
    border-color: var(--border-strong)

  active:
    background: var(--bg-active)
```

Chips: "Generate" · "Refine" · "Expand" · "Summarise" · "Fix"
Clicking a chip fills the composer textarea with a preset instruction
and focuses the composer. It does not submit automatically.

### Badges and Status Pills

```
Base:
  display: inline-flex
  align-items: center
  gap: 4px
  border-radius: 100px
  padding: 2px 8px
  font-size: 11px
  font-weight: 500

Pending:
  color: var(--status-pending-text)
  background: var(--status-pending-bg)

Draft:
  color: var(--status-draft-text)
  background: var(--status-draft-bg)

Finalized:
  color: var(--status-done-text)
  background: var(--status-done-bg)
```

Status dot (optional, used in TOC):
```
width: 6px
height: 6px
border-radius: 50%
Pending: var(--text-tertiary)
Draft: var(--color-warning)
Finalized: var(--color-success)
```

### Cards (Dashboard only — not used in editor)

```
background: var(--bg-panel)
border: 1px solid var(--border-default)
border-radius: 10px
padding: 16px

hover:
  border-color: var(--border-strong)
  box-shadow: 0 1px 4px rgba(0,0,0,0.06)
  transition: all 150ms ease

No scale transform on hover.
No shadow on resting state.
```

### Dividers / Separators

```
height: 1px
background: var(--border-default)
margin: 0    (let parent control vertical spacing)
```

Never use the border property to create dividers.
Use a dedicated 1px div or the shadcn Separator component.

---

## 6. The Editor — Detailed Specification

### CodeMirror 6 Configuration

The editor is CodeMirror 6 configured to feel like writing in Notion.

```typescript
// Exact theme override for CodeMirror
const pagemarkTheme = EditorView.theme({
  "&": {
    fontSize: "16px",
    fontFamily: "Geist, sans-serif",
    background: "transparent",
    height: "100%",
  },
  ".cm-content": {
    padding: "0",
    fontFamily: "Geist, sans-serif",
    lineHeight: "1.75",
    caretColor: "var(--text-primary)",
    maxWidth: "680px",
    margin: "0 auto",
  },
  ".cm-scroller": {
    padding: "48px 64px",
    overflowX: "auto",
  },
  ".cm-line": {
    padding: "0",
  },
  ".cm-focused": {
    outline: "none",
  },
  ".cm-activeLine": {
    background: "transparent",
  },
  ".cm-activeLineGutter": {
    background: "transparent",
  },
  ".cm-gutters": {
    display: "none",
  },
  ".cm-cursor": {
    borderLeftColor: "var(--text-primary)",
    borderLeftWidth: "2px",
  },
  // Markdown heading styles
  ".cm-header-1": {
    fontSize: "28px",
    fontWeight: "700",
    lineHeight: "1.2",
    color: "var(--text-primary)",
    marginTop: "24px",
    marginBottom: "8px",
  },
  ".cm-header-2": {
    fontSize: "22px",
    fontWeight: "600",
    lineHeight: "1.3",
    color: "var(--text-primary)",
  },
  ".cm-header-3": {
    fontSize: "18px",
    fontWeight: "600",
    color: "var(--text-primary)",
  },
  // Markdown syntax markers — visible but quiet
  ".cm-formatting": {
    color: "var(--text-tertiary)",
    fontSize: "0.85em",
  },
  ".cm-strong": {
    fontWeight: "700",
  },
  ".cm-em": {
    fontStyle: "italic",
  },
  ".cm-link": {
    color: "#007AFF",
    textDecoration: "underline",
    textDecorationColor: "rgba(0, 122, 255, 0.3)",
  },
  ".cm-url": {
    color: "var(--text-tertiary)",
    fontSize: "0.9em",
  },
  ".cm-code": {
    fontFamily: "Geist Mono, monospace",
    fontSize: "14px",
    background: "var(--bg-subtle)",
    borderRadius: "4px",
    padding: "1px 4px",
  },
  // Selection
  ".cm-selectionBackground": {
    background: "rgba(0, 122, 255, 0.15) !important",
  },
  "::selection": {
    background: "rgba(0, 122, 255, 0.15)",
  },
})
```

### Three Modes: Write / Preview / Diff

Accessible via a segmented control in the top bar of the center panel.

**Write mode:**
CodeMirror editor. Full height. No border. No background.

**Preview mode:**
`react-markdown` with `@tailwindcss/typography`.
Exact prose styles:
```
className="prose prose-neutral dark:prose-invert
           prose-headings:font-semibold
           prose-h1:text-[28px] prose-h1:leading-tight
           prose-h2:text-[22px]
           prose-p:text-[16px] prose-p:leading-[1.75]
           prose-code:font-mono prose-code:text-[14px]
           prose-code:bg-subtle prose-code:px-1 prose-code:py-0.5
           prose-code:rounded prose-code:before:content-none
           prose-code:after:content-none
           max-w-[680px] mx-auto px-16 py-12"
```

**Diff mode:**
Side-by-side. Previous version left, current right.
```
Layout: two columns, gap-4, each col w-[calc(50%-8px)]
Each col header: text-xs font-mono text-text-3 mb-3
  Left: "Previous"
  Right: "Revised"
Line styling:
  Added:   bg-[#0D3D1F] border-l-2 border-[#30D158] pl-3 (dark)
           bg-[#F0FFF4] border-l-2 border-[#34C759] pl-3 (light)
  Removed: bg-[#3D0D0D] border-l-2 border-[#FF453A] pl-3 (dark)
           bg-[#FFF5F5] border-l-2 border-[#FF3B30] pl-3 (light)
  Same:    no background, pl-3
Font: Geist Mono, 13px, line-height 1.6

Accept/Reject row above diff:
  float right
  Accept: primary button ("Accept changes")
  Reject: ghost button ("Discard")
  gap: 8px
```

### Center Panel Top Bar

The minimal toolbar above the editor:

```
height: 36px
border-bottom: 1px solid var(--border-default)
padding: 0 16px
display: flex
align-items: center
justify-content: space-between
background: var(--bg-panel)

Left: segmented control for Write / Preview / Diff
  Container: bg-subtle rounded-lg p-0.5 inline-flex gap-0.5
  Active pill: bg-panel shadow-sm rounded-md px-3 h-6
    text-xs font-medium text-text-1
  Inactive: px-3 h-6 text-xs text-text-3 cursor-pointer
    hover: text-text-2

Right: autosave indicator
  Idle: nothing (no text)
  Saving: Loader2 icon h-3 w-3 animate-spin text-text-3
          + "Saving" text-xs text-text-3
  Saved: Check icon h-3 w-3 text-success
         + "Saved" text-xs text-text-3
         → fades out after 3 seconds
```

---

## 7. The AI Panel — Detailed Specification

Position: RIGHT. Width: ~300px default, resizable via drag handle.

### Panel Structure (top to bottom)

```
┌─────────────────────────────────┐
│ [header: 36px]                  │
├─────────────────────────────────┤
│                                 │
│ [tab content: flex-1, scroll]   │
│                                 │
├─────────────────────────────────┤
│ [quick chips: ~32px]            │
├─────────────────────────────────┤
│ [composer: auto-height]         │
└─────────────────────────────────┘
```

### Panel Header

```
height: 36px
padding: 0 12px
border-bottom: 1px solid var(--border-default)
display: flex items-center justify-between

Left:
  Three tab labels: "Agent" · "Chat" · "History"
  Rendered as simple text buttons, not a tab component
  Active: text-text-1 font-medium text-sm
          with a 2px bottom border in #007AFF
          extending 2px below the header border (overlaps it)
  Inactive: text-text-3 text-sm cursor-pointer
            hover: text-text-2
  Gap between tabs: 16px

Right:
  Icon button — collapse panel (ChevronLeft icon)
  When collapsed, button appears at left edge of editor
  as a small ChevronRight to re-open
```

### Agent Tab

Content area (scrollable, px-3 py-4):

**Context strip (top of agent tab):**
```
A row showing what the AI is currently looking at.
bg-subtle rounded-lg px-3 py-2 mb-3 flex items-center gap-2

Left icon: FileText h-3.5 w-3.5 text-text-3
Text: current section heading, truncated to 1 line
      text-sm text-text-1 font-medium flex-1
Right: status badge (pending/draft/finalized)

If no section is active:
  text-sm text-text-3 "Select a section to start"
```

**No large action cards.** The actions are accessible via chips above
the composer. The Agent tab shows only context information and the
conversation thread from agent actions (what the AI generated, what
was accepted, what was rejected).

**Agent action thread** (the history of what the AI has done):
```
Each action entry:
  py-3 border-b border-border-3 last:border-0

  Row 1: icon + action label + timestamp (right)
    ✦ Sparkles icon h-3 w-3 text-[#007AFF]
    "Generated Introduction" text-sm font-medium text-text-1
    "2m ago" text-xs text-text-3 font-mono ml-auto

  Row 2: result summary
    "+240 words added" text-xs text-text-3

  Row 3 (if refinement): diff stat
    "+12 −3 words" text-xs
      +12 in text-success, −3 in text-danger

  No separate "View diff" button here — clicking the entry
  opens the diff in the center panel
```

**Empty state:**
```
Centered in the content area, py-16
Sparkles icon h-8 w-8 text-text-3 opacity-40 mx-auto
"No actions yet" text-sm text-text-3 text-center mt-3
"Use the composer below to get started"
text-xs text-text-3 opacity-60 text-center mt-1
```

### Chat Tab

Content area (scrollable, px-3 py-4 flex flex-col gap-3):

**User message:**
```
align-self: flex-end
max-width: 85%
background: #007AFF (light) / #0A84FF (dark)
color: #FFFFFF
border-radius: 14px 14px 4px 14px
padding: 8px 12px
font-size: 13px
line-height: 1.5
```

**AI message:**
```
align-self: flex-start
max-width: 90%
display: flex gap-2

Left: AI avatar
  width: 22px height: 22px
  border-radius: 6px
  background: linear-gradient(135deg, #7B5EA7, #007AFF)
  flex-shrink: 0
  display: flex items-center justify-center
  Sparkles icon h-3 w-3 text-white

Right: message content
  NO bubble background — just text on the panel background
  font-size: 13px
  line-height: 1.6
  color: var(--text-primary)
  Renders basic inline markdown (bold, italic, code spans, links)
```

**Streaming indicator (while AI is typing):**
```
Same as AI message structure but instead of text:
Three dots with staggered bounce animation
Each dot: w-1.5 h-1.5 rounded-full bg-text-3
Animation: translateY(-4px) at 0.15s intervals
```

**Empty state:**
```
MessageSquare icon h-7 w-7 text-text-3 opacity-30 mx-auto
"No messages" text-sm text-text-3 text-center mt-3
```

### History Tab

Content area (scrollable, px-3 py-4):

```
Each version entry:
  px-3 py-3 rounded-lg bg-subtle mb-2 cursor-pointer
  hover: bg-surface-hover

  Row 1: author + timestamp
    flex items-center gap-1.5
    Author icon (Sparkles for AI, User2 for human)
      h-3.5 w-3.5
      AI: text-[#007AFF]
      Human: text-text-2
    "AI" or "You" text-xs font-medium text-text-2
    "·" text-text-3
    timestamp text-xs text-text-3 font-mono

  Row 2: summary
    text-sm text-text-1 font-medium mt-1 line-clamp-1
    e.g. "Generated Installation section"

  Row 3: stats + action
    flex items-center justify-between mt-1.5
    Stats: "+180" text-xs text-success · "−3" text-xs text-danger
    "View diff" text-xs text-[#007AFF] hover:underline

Clicking entry → center panel switches to Diff mode
showing that version's changes
```

### Composer (fixed at bottom of AI panel, always visible)

```
Outer container:
  px-3 pb-3 pt-2
  border-top: 1px solid var(--border-default)
  background: var(--bg-panel)

Inner composer box:
  bg-elevated
  border: 1px solid var(--border-default)
  border-radius: 12px
  padding: 10px 12px
  focus-within: border-color #007AFF,
                box-shadow 0 0 0 3px rgba(0,122,255,0.10)

Textarea:
  width: 100%
  background: transparent
  border: none
  outline: none
  font-size: 13px
  font-family: Geist, sans-serif
  line-height: 1.5
  color: var(--text-primary)
  placeholder: "Ask or instruct..."
  placeholder-color: var(--text-tertiary)
  resize: none
  min-rows: 1
  max-height: 120px
  overflow-y: auto (once max-height reached)

Bottom row (inside composer box, below textarea):
  margin-top: 8px
  display: flex items-center justify-between

  Left: context pill
    display: flex items-center gap-1
    background: var(--bg-subtle)
    border-radius: 6px
    px-2 py-1
    font-size: 11px
    font-family: mono
    color: var(--text-tertiary)
    "@" + current section name (max 18 chars, truncated)
    Clicking: opens a small popover to change context scope:
      "Current section" (default)
      "Entire document"
      "Code analysis"
    Each option: text-xs py-1.5 px-3 hover:bg-surface-hover

  Right: send button
    width: 26px height: 26px
    border-radius: 7px
    background: #007AFF
    ArrowUp h-3.5 w-3.5 text-white
    Disabled (empty textarea): opacity 30%, cursor not-allowed
    Hover: brightness(1.1)
    Keyboard: Cmd/Ctrl + Enter
```

### Quick-Action Chips (between composer and tab content)

```
px-3 pb-2 pt-1
display: flex gap-1.5 flex-wrap

Chips: "Generate" · "Refine" · "Expand" · "Summarise" · "Fix"

Each chip:
  background: var(--bg-subtle)
  border: 1px solid var(--border-default)
  border-radius: 100px
  padding: 3px 10px
  font-size: 11px
  font-weight: 500
  color: var(--text-secondary)
  cursor: pointer
  white-space: nowrap

  hover: bg-surface-hover, border-border-2, color text-text-1
  active: bg-surface-active

Preset instructions per chip:
  Generate  → "Generate content for the current section using
               the code analysis as context."
  Refine    → "Refine the current section for clarity,
               completeness and professional tone."
  Expand    → "Expand the current section with more detail,
               examples and explanations."
  Summarise → "Summarise the current section into a concise
               overview paragraph."
  Fix       → "Fix any inconsistencies, errors or unclear
               phrasing in the current section."
```

---

## 8. The TOC Panel — Detailed Specification

Position: LEFT. Width: ~220px default. Collapsible.

### What the TOC Shows

The TOC is derived at runtime by parsing H1 and H2 headings from the
markdown content of all sections. It is not a list of section names.
It updates in real time as the user types.

```typescript
function extractHeadings(sections: Section[]): Heading[] {
  const headings: Heading[] = []
  sections.forEach(section => {
    const matches = [...section.content_md.matchAll(/^(#{1,2})\s+(.+)$/gm)]
    matches.forEach((match, idx) => {
      headings.push({
        level: match[1].length as 1 | 2,
        text: match[2].trim(),
        sectionId: section.id,
        index: idx
      })
    })
  })
  return headings
}
```

### Panel Layout

```
Panel header: 36px
  Left: nothing (or tiny document icon)
  Right: collapse button (ChevronRight)

Progress bar: 2px height, full width, immediately below header
  Background: var(--border-default)
  Fill: #007AFF at (finalized_sections / total_sections * 100)%
  No label. No percentage text. Just the line.
  transition: width 500ms ease

TOC list: scrollable, py-4
  No padding on sides — items have their own mx-2 for hover state

Collapse button (when panel is open):
  Appears at far right of panel header
  ChevronRight h-3.5 w-3.5 text-text-3
  Pressing collapses panel to 0 width

Expand trigger (when panel is collapsed):
  A small 28px wide strip appears at right edge of editor
  Contains ChevronLeft icon, background var(--bg-panel)
  border-left: 1px solid var(--border-default)
  Pressing re-opens panel
```

### TOC Items

```
H1 item:
  mx-2 px-3 py-1.5 rounded-md
  font-size: 13px
  font-weight: 500
  color: var(--text-primary)
  cursor: pointer
  white-space: nowrap
  overflow: hidden
  text-overflow: ellipsis
  hover: background var(--bg-hover)
  active (in viewport): background rgba(0,122,255,0.08)
                         color: #007AFF

H2 item:
  mx-2 pl-6 pr-3 py-1 rounded-md
  font-size: 13px
  font-weight: 400
  color: var(--text-secondary)
  cursor: pointer
  white-space: nowrap
  overflow: hidden
  text-overflow: ellipsis
  hover: background var(--bg-hover), color var(--text-primary)
  active: background rgba(0,122,255,0.06), color #007AFF

Transition on all items: colors 100ms ease

Active state detection: IntersectionObserver on heading elements
in the document with threshold 0.5. The TOC item matching the
most recently entered heading is marked active.
```

### Empty State

```
When no H1 or H2 headings exist in the document:
py-8 px-4 text-center
"Your outline will appear here as you write" text-xs text-text-3
```

---

## 9. Page Specifications

### Auth Pages (Login, Register, Forgot, Reset)

```
Layout:
  Full viewport height
  Background: var(--bg-app)
  display: flex items-center justify-center

Card:
  background: var(--bg-panel)
  border: 1px solid var(--border-default)
  border-radius: 14px
  padding: 32px
  width: 360px
  box-shadow: 0 4px 24px rgba(0,0,0,0.06)

Header (inside card):
  "pagemark" wordmark — lowercase, font-weight 700, font-size 20px,
  color var(--text-primary), text-align center, margin-bottom 24px

Form:
  space-y-4
  Labels: text-xs font-medium text-text-2 mb-1.5
  Inputs: full spec from section 5

Submit button: w-full, primary variant, height 36px

Links below button: text-xs text-text-3, text-align center
  Accent link: color #007AFF, hover underline

Theme toggle: top-right corner of the page (not in the card)
  Icon button, Sun/Moon icon
```

### Dashboard

```
Header (44px, sticky):
  Left: "pagemark" wordmark (same as auth)
  Center: nothing
  Right: Theme toggle + user avatar (28px circle, Geist Mono
         initials if no avatar) + dropdown menu

Content area:
  max-width: 900px
  margin: 0 auto
  padding: 32px 24px

Tab row:
  Three tabs: Projects · Templates · Settings
  Same tab style as AI panel header tabs
  border-bottom: 1px solid var(--border-default)
  margin-bottom: 24px

Projects tab:
  Toolbar row (flex justify-between mb-4):
    Left: Search input (width 240px, height 30px, text-sm)
    Right: "+ New Project" primary button

  Card grid:
    display: grid
    grid-template-columns: repeat(auto-fill, minmax(260px, 1fr))
    gap: 12px

  Project card (spec in section 5 — Cards):
    Project name: text-sm font-semibold text-text-1
    Description: text-xs text-text-3 line-clamp-2 mt-1
    Progress bar: h-0.5 bg-border-default rounded-full mt-3
      Fill: #007AFF, width = completion_pct%
    Footer (flex justify-between mt-3):
      Left: status badge
      Right: "X sections · edited 3h ago" text-xs text-text-3 font-mono
    Actions: MoreHorizontal icon button top-right of card
      Dropdown: Open · Duplicate · Delete (destructive)

Templates tab:
  Same grid layout
  Template card: name + description + category badge + "Use" button

Settings tab:
  max-width: 480px
  Section groups with labels and dividers
  Profile, Appearance (theme toggle), Security (change password link)
```

### Editor

See sections 6 (center), 7 (AI left), 8 (TOC right).

App header in editor (44px):
```
Left:
  ChevronLeft icon button → back to dashboard
  "/" separator (text-text-3)
  Project name — text-sm font-medium text-text-1

Center: nothing

Right:
  Completion pill: "X% complete"
    font-mono text-xs text-text-3
    bg-subtle px-2 py-1 rounded-full
  Export button: ghost, Download icon + "Export" text-sm
  Share button: ghost, Share2 icon only
  Avatar: same as dashboard
  Theme toggle
```

---

## 10. Animation and Motion

### Principles

- Animations exist to provide feedback, not delight
- Nothing should animate that the user did not trigger
- Duration: 100–200ms for micro-interactions, 200–300ms for panels
- Easing: ease-out for entry, ease-in for exit
- No spring physics, no bounce

### Specific Animations

**Panel collapse/expand:**
```
motion.div animate={{ width: isOpen ? panelWidth : 0 }}
transition={{ duration: 0.2, ease: "easeInOut" }}
overflow: hidden
```

**Mode switch (Write/Preview/Diff):**
```
AnimatePresence mode="wait"
Each mode: initial={{ opacity: 0 }} animate={{ opacity: 1 }}
           exit={{ opacity: 0 }} transition={{ duration: 0.1 }}
```

**Page entry (auth and dashboard):**
```
initial={{ opacity: 0, y: 8 }}
animate={{ opacity: 1, y: 0 }}
transition={{ duration: 0.25, ease: "easeOut" }}
```

**List stagger (project cards, TOC items):**
```
transition={{ delay: index * 0.04 }}
Each item: opacity 0 → 1, y 4 → 0
```

**Autosave indicator fade:**
```
AnimatePresence
"Saved" text: animate in (opacity 0→1), hold 2s, animate out (opacity 1→0)
Loader: same in/out pattern
```

**Composer focus:**
```
CSS transition only (no framer-motion)
border-color and box-shadow transition: 150ms ease
```

### What Never Animates

- Colours (use CSS transitions only, no motion/react)
- Text content changes
- Scroll position (use behavior: "smooth" on scrollIntoView)
- Icon swap (Sun→Moon for theme toggle — instant swap)
- Dropdown open/close (instant — no slide animation)

---

## 11. Dark Mode

Theme provider: next-themes with attribute="class"
Dark class on `<html>` element.

```typescript
// src/main.tsx
import { ThemeProvider } from "next-themes"
<ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
```

`defaultTheme="light"` — the app is light-first.
`enableSystem={false}` — do not inherit OS preference automatically.
The user sets it manually via the toggle. This is intentional.

Every colour in sections 2 through 9 has a dark equivalent.
Test dark mode on every component before marking it done.

The theme toggle:
```
Icon button, ghost variant, 28×28px
Light mode shows: Moon icon h-4 w-4
Dark mode shows: Sun icon h-4 w-4
Clicking calls: setTheme(theme === "dark" ? "light" : "dark")
No animation on the icon swap — instant replacement
```

---

## 12. Package Decisions

**Use these. Do not install alternatives.**

```
react-resizable-panels  — three-panel layout with drag handles
codemirror              — the editor (not @monaco-editor/react)
@codemirror/view        — CodeMirror core
@codemirror/state       — CodeMirror state management
@codemirror/lang-markdown — markdown support
@codemirror/commands    — keyboard commands
motion                  — animations (import from "motion/react")
next-themes             — theme management
geist                   — typography
react-markdown          — preview mode rendering
remark-gfm              — markdown extensions (tables, strikethrough)
@tailwindcss/typography — prose styles for preview mode
react-hook-form         — all forms
zod                     — form validation schemas
date-fns                — date formatting (formatDistanceToNow)
lucide-react            — icons (only icon library used)
sonner                  — toast notifications
@tanstack/react-query   — all API data fetching
```

**Do NOT install:**
```
framer-motion           (use motion instead — same library, new package name)
@monaco-editor/react    (replaced by codemirror)
axios                   (use native fetch with credentials: "include")
moment or dayjs         (use date-fns)
react-icons             (use lucide-react only)
lodash                  (use native JS)
```

---

## 13. Icons Reference

Lucide-react only. These are the icons used:

```
Navigation:    ChevronLeft, ChevronRight, ChevronDown
AI / Actions:  Sparkles, Wand2, ArrowsUpFromLine, MessageSquare
Editor modes:  Eye, Pencil, GitCompare
Files:         FileText, FolderOpen, File
Status:        Check, Clock, AlertCircle, Circle
Actions:       Download, Share2, MoreHorizontal, Plus, X, Search
Auth:          LogOut, User2, Settings
Theme:         Sun, Moon
Send:          ArrowUp
Compose:       AtSign
History:       History, RotateCcw
Code:          Code2, Terminal
```

Sizes:
```
h-3 w-3    — inside badges, composer bottom row
h-3.5 w-3.5 — AI avatar, chip icons, TOC dots
h-4 w-4    — most panel icons, inline with text
h-5 w-5    — toolbar buttons, tab icons
h-7 w-7    — empty state icons (smaller, quieter than before)
```

---

## 14. What This Design Explicitly Avoids

Read this before asking the AI to add anything.

- No gradient backgrounds anywhere in the app shell
- No card shadows in resting state (shadow only on hover, and only subtle)
- No border-radius larger than 14px on any element
- No glassmorphism (backdrop-blur only on sticky headers — nowhere else)
- No coloured panel backgrounds (all panels are var(--bg-panel))
- No emoji in the UI — icons only
- No uppercase text on body copy or descriptions
- No animated backgrounds, patterns, or decorative motion
- No full-page loading spinners — use skeletons for content, spinners only
  for button states
- No toast notifications for routine autosave — only for errors and
  explicit user actions (export complete, link copied, version restored)
- No confirmation modals for autosave — it is silent and automatic
- No visible scrollbars in panels (use scrollbar-hide utility class)
- No horizontal scrollbars anywhere in the app
- No colour-only status indicators — always pair colour with text or icon
