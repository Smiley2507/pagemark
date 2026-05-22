# VISUAL_SPEC.md — Pagemark Frontend Design System
## Source of Truth for All UI Generation

> Read this file before generating any component, page, or style.
> The Lovable prototype at https://github.com/Smiley2507/mark-documentation-studio
> is the visual reference. This document extracts every design decision from it
> so the rebuilt frontend matches it exactly without depending on mock data.

---

## 1. Design Philosophy

Pagemark follows Apple Human Interface Guidelines adapted for a web application.
The three core principles are:

**Clarity** — every element earns its place. No decoration for decoration's sake.
**Deference** — the UI steps back so the documentation content is the focus.
**Depth** — subtle layering (surfaces, shadows, borders) creates hierarchy without colour noise.

The aesthetic target is: "Cursor meets Google Docs meets Linear" — a minimal,
modern, code-editor sensibility applied to a document editor. Not a generic SaaS dashboard.

---

## 2. Typography

### Font Stack
```css
font-family: "Inter", -apple-system, BlinkMacSystemFont, sans-serif;
font-family-mono: "JetBrains Mono", monospace;
```
Both fonts are loaded via @fontsource (already in package.json):
```
@fontsource/inter
@fontsource/jetbrains-mono
```

Import in main.tsx:
```typescript
import "@fontsource/inter/400.css"
import "@fontsource/inter/500.css"
import "@fontsource/inter/600.css"
import "@fontsource/inter/700.css"
import "@fontsource/jetbrains-mono/400.css"
```

### Type Scale (from tailwind.config.ts — use these classes exactly)
```
text-hero   → 40px, line-height 1.15, weight 700  — page hero titles only
text-title  → 28px, line-height 1.2,  weight 600  — section/modal titles
text-section→ 21px, line-height 1.3,  weight 600  — card headings, tab labels
text-body-lg→ 17px, line-height 1.6,  weight 400  — primary body text
text-body   → 15px, line-height 1.6,  weight 400  — default body (most UI text)
text-meta   → 13px, line-height 1.4,  weight 400  — timestamps, secondary labels
text-meta-sm→ 11px, line-height 1.3,  weight 500  — badges, micro labels
```

### Typography Rules
- Never use font-size values outside this scale
- Headings: weight 600 or 700 only
- Body text: weight 400 always
- Monospace font only for: code blocks, file paths, version labels, API endpoints
- Letter-spacing: default everywhere (never add tracking to body text)
- Never center body paragraphs — left-align only

---

## 3. Colour System

All colours are CSS custom properties consumed via Tailwind semantic tokens.
The palette supports light and dark mode. Never hardcode hex values in components
— always use the semantic token classes.

### Semantic Token Classes (use these)
```
bg-background          — page background
bg-card                — card/panel background
bg-surface             — elevated surface (panels within panels)
bg-surface-elevated    — modals, dropdowns, floating elements
bg-surface-hover       — hover state for interactive surfaces
bg-muted               — subtle background (empty states, disabled)
bg-primary             — primary action background (buttons)
bg-accent              — accent/highlight background

text-foreground        — primary text
text-muted-foreground  — secondary/placeholder text
text-primary-foreground— text on primary bg (buttons)
text-accent-foreground — text on accent bg

border-border          — default border colour
border-input           — form field borders
ring-ring              — focus rings
```

### Light Mode Values (for reference — do not hardcode)
```
--background: 0 0% 100%           (pure white)
--foreground: 222 47% 11%         (near black)
--card: 0 0% 100%
--muted: 210 40% 96%              (very light grey)
--muted-foreground: 215 16% 47%   (medium grey)
--primary: 222 47% 11%            (dark navy — primary buttons are dark)
--border: 214 32% 91%             (subtle grey border)
--surface: 210 40% 98%
--surface-elevated: 0 0% 100%
```

### Dark Mode Values (for reference — do not hardcode)
```
--background: 222 47% 4%          (near black, slightly blue)
--foreground: 210 40% 98%         (near white)
--card: 222 47% 6%
--muted: 217 33% 17%
--muted-foreground: 215 20% 65%
--primary: 210 40% 98%            (near white — primary buttons are light in dark mode)
--border: 217 33% 17%
--surface: 222 47% 8%
--surface-elevated: 222 47% 11%
```

### Status / Semantic Colours
```
Pending:   text-muted-foreground + bg-muted
Draft:     text-amber-600 + bg-amber-50 (light) / text-amber-400 + bg-amber-950/30 (dark)
Finalized: text-emerald-600 + bg-emerald-50 (light) / text-emerald-400 + bg-emerald-950/30 (dark)
Error:     text-destructive + bg-destructive/10
```

---

## 4. Spacing & Layout

### Spacing Scale
Use Tailwind's default scale. Key values used throughout:
```
p-1  = 4px    — tight internal padding (badge)
p-2  = 8px    — small padding (icon buttons)
p-3  = 12px   — compact padding (table cells, small cards)
p-4  = 16px   — standard padding (card body)
p-5  = 20px   — medium padding
p-6  = 24px   — large padding (page sections)
p-8  = 32px   — section padding
p-12 = 48px   — page-level padding
```

### Border Radius
```
rounded-sm  — 4px  — badges, chips, small elements
rounded-md  — 6px  — buttons, inputs, small cards
rounded-lg  — 8px  — cards, panels
rounded-xl  — 12px — modals, large cards
rounded-2xl — 16px — full-page panels (editor)
rounded-full       — avatars, circular buttons
```

### Editor Three-Panel Layout
```css
/* CSS Grid for the editor — match exactly */
grid-template-columns: 240px 1fr 320px;
height: calc(100vh - 48px);  /* 48px = toolbar height */
```
Panels collapse/expand with framer-motion animate on width:
- Left panel collapsed: 0px (hidden) or 48px (icon-only rail)
- Right panel collapsed: 0px (hidden)
- Use `overflow-hidden` on panels, animate with `motion.div`

### Dashboard Grid
```css
/* Project cards grid */
grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
gap: 16px;
```

### Page Max Widths
```
Auth pages:          max-w-sm (384px) — centred
Dashboard content:   max-w-7xl (1280px) — full width with padding
Editor:              100vw — no max width
Quality/Analysis:    max-w-5xl (1024px) — centred
```

---

## 5. Component Patterns

### Cards
```
bg-card border border-border rounded-lg
hover: shadow-sm transition-shadow duration-200
```
Never use drop-shadow filters — use box-shadow via Tailwind shadow utilities only.
Project cards specifically: `p-5 space-y-3`

### Buttons
Primary:
```
bg-primary text-primary-foreground
hover:bg-primary/90
h-9 px-4 rounded-md text-body font-medium
```
Secondary:
```
bg-secondary text-secondary-foreground
hover:bg-secondary/80
```
Ghost:
```
hover:bg-accent hover:text-accent-foreground
```
Destructive:
```
bg-destructive/10 text-destructive
hover:bg-destructive/20
border border-destructive/20
```
Icon buttons: `h-8 w-8 p-0 rounded-md` with ghost variant

### Badges / Status Pills
```
inline-flex items-center gap-1
px-2 py-0.5 rounded-full
text-meta-sm font-medium
```
With status dot: `w-1.5 h-1.5 rounded-full` in matching colour

### Inputs
```
bg-background border border-input
h-9 px-3 rounded-md
text-body placeholder:text-muted-foreground
focus-visible:ring-1 focus-visible:ring-ring
```

### Tabs (shadcn Tabs)
```
TabsList: bg-muted rounded-lg p-1
TabsTrigger: rounded-md text-muted-foreground
TabsTrigger[data-state=active]: bg-background text-foreground shadow-sm
```

### Separator / Divider
```
<Separator className="my-4" />   — use shadcn Separator, never custom hr
```

### Skeleton Loading
```
bg-muted animate-shimmer rounded-md
```
Shimmer animation defined in tailwind.config.ts keyframes.
Use for: project cards, section list, chat messages.
Never use a spinner as the primary loading state for content — use skeletons.
Spinners only for: button loading states, inline actions.

### Tooltips
Wrap interactive icon buttons that have no text label with shadcn Tooltip.
Delay: 300ms. Position: top by default.

---

## 6. Animation Rules

All animations from tailwind.config.ts keyframes:
```
animate-fade-in   — page entry, panel open (0.4s ease-out)
animate-slide-up  — modal/drawer entry (0.5s ease-out)
animate-shimmer   — skeleton loading (2s linear infinite)
```

Framer Motion usage:
- Panel collapse/expand: `animate={{ width }}` with `transition={{ duration: 0.2, ease: "easeInOut" }}`
- Page transitions: `initial={{ opacity:0, y:8 }} animate={{ opacity:1, y:0 }} transition={{ duration: 0.3 }}`
- List item stagger: `transition={{ delay: index * 0.05 }}`
- Modal: `AnimatePresence` with scale from 0.96 to 1

Motion import: `import { motion, AnimatePresence } from "motion/react"` (not framer-motion)
The package is `motion` not `framer-motion` — this is already in package.json.

Never animate colour. Never animate borders. Only animate: opacity, transform, width, height.
Keep all animations under 400ms. No bouncing or spring physics in the main UI.

---

## 7. Page-Specific Patterns

### Auth Pages (Login, Register, Forgot Password, Reset Password)
```
Layout: full viewport, flex items-center justify-center, bg-background
Card: max-w-sm w-full bg-card border border-border rounded-xl p-8 shadow-sm
Header: Pagemark wordmark (text-title font-bold) centered above card
Form spacing: space-y-4
Submit button: w-full h-10
Links: text-primary text-sm hover:underline
```
No illustration, no split layout, no gradient backgrounds.
The auth pages are intentionally minimal — just the card, centred on the page.

### Dashboard
```
Header: h-12 border-b border-border bg-background/80 backdrop-blur-sm
        sticky top-0 z-40
        Contains: logo (left), nav links (center, optional), user menu (right)
Content: pt-6 px-6 max-w-7xl mx-auto
Tabs: full-width TabsList at top of content area
```

### Project Card (DashboardPage → Projects tab)
```
Structure (top to bottom):
1. Card header: project name (text-section) + actions dropdown (right)
2. Description: text-meta text-muted-foreground line-clamp-2
3. Progress bar: h-1.5 bg-muted rounded-full with fill in primary colour
4. Footer row: status badge (left) + "X sections" + last edited (right)
5. Star button: absolute top-3 right-10

Hover: shadow-sm, cursor-pointer
Click on card body → navigate to /editor/:id
```

### Editor — Left Panel (TOC)
```
Width: 240px, border-r border-border, bg-background
Header: "Contents" label (text-meta-sm uppercase tracking-wide text-muted-foreground)
        + collapse button (right)
Section item: h-8 flex items-center gap-2 px-3 rounded-md mx-1
  - Status dot: w-2 h-2 rounded-full
  - Text: text-body (active: text-foreground, inactive: text-muted-foreground)
  - Active state: bg-accent text-accent-foreground
  - Left accent bar on active: w-0.5 bg-primary absolute left-0
Progress bar: at bottom of panel, h-0.5 bg-muted with fill
"Context File" link: at very bottom, text-meta text-muted-foreground
```

### Editor — Middle Panel (Document)
```
Padding: px-12 py-8 max-w-3xl mx-auto (centred column, not full width)
Section heading: text-title font-semibold mb-4
Content area: text-body leading-relaxed
Mode toolbar: sticky top-0 bg-background/95 backdrop-blur-sm border-b border-border
  Contains: View|Edit|AI Refine mode buttons + status select + autosave indicator
```

### Editor — Right Panel (AI Assistant)
```
Width: 320px, border-l border-border, bg-background
Tabs: Chat, Context, History — full width TabsList
Chat: message bubbles
  User: right-aligned, bg-primary text-primary-foreground rounded-2xl rounded-tr-sm
  AI: left-aligned, bg-muted text-foreground rounded-2xl rounded-tl-sm
  Both: max-w-[80%] px-3 py-2 text-body
Input bar: fixed at bottom of panel, border-t border-border p-3
  Input: flex-1 bg-muted rounded-full px-4 py-2 text-body
  Send: icon button, bg-primary text-primary-foreground rounded-full
Quick chips: above input, horizontal scroll, gap-2
  Each chip: px-3 py-1 rounded-full border border-border text-meta bg-background
```

### Analysis Page
```
Layout: max-w-5xl mx-auto px-6 py-8 space-y-8
File tree: bg-card border border-border rounded-lg p-4
  Folders: chevron icon + folder icon + name (bold) + file count badge
  Files: language colour dot + name + LOC badge (right-aligned)
Language chart: horizontal bars, each bar is a coloured div
  Colour per language: Python=blue-500, JS=yellow-500, TS=blue-400,
  JSON=gray-400, MD=green-500, Java=orange-500, CSS=pink-500, Other=gray-300
Endpoint table: standard table, METHOD badges (GET=green, POST=blue,
  PUT=amber, PATCH=amber, DELETE=red)
Stats: 4-up card grid, each card: number (text-title) + label (text-meta)
```

### Quality Page
```
Score circle: custom SVG or conic-gradient div
  Size: w-32 h-32, stroke-width 8
  Colour: <60 = text-destructive, 60-79 = text-amber-500, >=80 = text-emerald-500
4 sub-scores: horizontal cards with score + progress bar each
Issue list: grouped by severity, each issue has:
  Severity icon: ⊗ error (destructive), ⚠ warning (amber), ℹ info (blue)
  Section ref: monospace, clickable
  Message + suggestion collapsible
```

---

## 8. Icon System

Use `lucide-react` exclusively. No other icon library.
The package is already installed at version ^0.462.0.

Standard sizes:
```
h-3 w-3  — inside badges/chips
h-4 w-4  — inline with text, most UI icons
h-5 w-5  — toolbar buttons, panel headers
h-6 w-6  — feature icons, empty states
h-8 w-8  — hero/illustration icons
```

Key icons used (import from lucide-react):
```
FileText      — document/project
FolderOpen    — file tree folders
Code2         — code analysis
Sparkles      — AI features
ChevronRight  — collapsed panel, tree nodes
ChevronDown   — expanded tree nodes
Check         — finalized status
Clock         — pending status, timestamps
AlertCircle   — draft status, warnings
Star          — star/favourite
MoreHorizontal— actions dropdown trigger
Upload        — file upload
Github        — GitHub integration
GitBranch     — branch selector
Download      — export
Share2        — share
History       — version history
MessageSquare — chat
Settings      — settings
LogOut        — logout
Moon / Sun    — theme toggle
Search        — search inputs
X             — close/dismiss
Plus          — create new
```

---

## 9. Package Inventory

These packages are in package.json. Use them — do not install alternatives.

```
UI primitives:    All @radix-ui/* packages (full set — use shadcn components)
State/Query:      @tanstack/react-query ^5.83.0
Animation:        motion ^12.34.1 (import from "motion/react")
Routing:          react-router-dom ^6.30.1
Forms:            react-hook-form + @hookform/resolvers + zod
Charts:           recharts ^2.15.4 (for quality scores, language breakdown)
Markdown:         react-markdown ^10.1.0
Resizable panels: react-resizable-panels ^2.1.9
Toasts:           sonner ^1.7.4
Theme:            next-themes ^0.3.0
Date formatting:  date-fns ^3.6.0
Typography CSS:   @tailwindcss/typography (for rendered markdown content)
```

Do NOT install:
- framer-motion (use motion instead)
- axios (use native fetch with credentials)
- lodash
- moment
- Any icon library other than lucide-react
- @monaco-editor/react (install this separately when building the editor)
- zustand (install this separately for state management)

---

## 10. Accessibility Rules

- All interactive elements must have visible focus rings (focus-visible:ring-2)
- Icon-only buttons must have aria-label
- All form inputs must have associated Label
- Status dots must have aria-label or sr-only text describing the status
- Colour alone must never be the only indicator (always pair colour with icon or text)
- Tab order must follow visual reading order

---

## 11. Dark Mode Implementation

The prototype uses `next-themes` with class-based dark mode.
In tailwind.config.ts: `darkMode: ["class"]`

Setup in main.tsx:
```tsx
import { ThemeProvider } from "next-themes"

<ThemeProvider attribute="class" defaultTheme="system" enableSystem>
  <App />
</ThemeProvider>
```

Theme toggle:
```tsx
import { useTheme } from "next-themes"
const { theme, setTheme } = useTheme()
// Toggle: setTheme(theme === "dark" ? "light" : "dark")
```

Every custom colour used in components MUST work in both modes.
Test by toggling before considering a component done.

---

## 12. What the Prototype Does NOT Have (Do Not Add)

- No gradients on backgrounds (the prototype is flat)
- No glassmorphism (the backdrop-blur is only on the sticky header — nowhere else)
- No colourful hero sections or marketing-style layouts
- No custom scrollbar styling
- No animated background patterns
- No emoji in UI (icons only)
- No serif fonts
- No card hover animations (only shadow change — no translate/scale on hover)
- No parallax effects
- No loading bars at top of page (use skeleton components instead)