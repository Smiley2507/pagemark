# Pagemark Frontend

The frontend is a React + TypeScript + Vite application for the Pagemark collaborative documentation workspace.

## Stack

- React 19
- TypeScript with `erasableSyntaxOnly`
- Vite
- Tailwind CSS
- Zustand
- TanStack Query
- Axios
- TipTap/ProseMirror with `@tiptap/markdown`
- Liveblocks + Yjs for section-scoped collaboration

## Editor Architecture

- Canonical editor route: `/projects/{projectId}/documents/{documentId}`
- The editor renders a continuous Document workspace made of persisted Sections.
- Each Section mounts its own TipTap editor.
- Collaboration is section-scoped through Liveblocks rooms:
  - `project:{projectId}:document:{documentId}:section:{sectionId}`
- Liveblocks/Yjs owns live collaborative state.
- The frontend snapshots Markdown to the backend collaboration snapshot endpoint so AI, export, review, search, and freshness can continue to read `Section.content_md`.
- Set `VITE_COLLABORATION_ENABLED=true` to enable the Liveblocks editor path after backend Liveblocks credentials are configured.

## Header And Panels

- Editor header includes Document title, save state, Quality, Share, Export, and user avatar theme menu.
- The right panel contains AI and Notes.
- The left panel contains the Outline/TOC and progress stats.

## Commands

```bash
npm install
npm run dev
npm run build
npm run lint
```

## Implementation Rules

- Read `frontend/VISUAL_SPEC.md` before changing UI.
- Use semantic tokens and shared UI primitives.
- Do not add inert menu actions. Implement, remove, or clearly disable unavailable controls.
- Do not make REST autosave the source of truth for collaborative editing.
- Do not switch to whole-Document collaboration rooms without a new ADR.
