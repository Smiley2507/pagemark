# Prompt 101 (Future): Real-Time Multiplayer Editing

## Objective
Implement real-time collaborative editing (multiplayer) so multiple users can edit the same document simultaneously without conflicts, seeing each other's cursors.

## Context
As a team tool, Pagemark needs Google Docs/Notion style collaboration. Self-hosting WebSocket CRDT (Conflict-free Replicated Data Type) servers is highly complex, so we are leveraging Liveblocks to handle the real-time infrastructure.

## Requirements
- Integrate `@liveblocks/client` and `@liveblocks/react` into the React frontend.
- Build a backend authentication endpoint that issues Liveblocks tokens.
- Show active user avatars in the editor header (Presence).
- Show colored carets/cursors for remote users in the CodeMirror editor.

## Architecture Notes
- We map a Pagemark `Project.id` directly to a Liveblocks `Room ID`.
- The source of truth for the document remains in our PostgreSQL database (Liveblocks handles the transient real-time state, and we configure Liveblocks Webhooks to sync the final document state back to our DB when the room empties).

## Backend Tasks
- Add `liveblocks` python SDK.
- Build `POST /auth/liveblocks` endpoint. It verifies the user's `org_id` and project access, then returns a signed Liveblocks JWT.
- Build `POST /webhooks/liveblocks` to catch `ydocUpdated` events and save the final Markdown back to our `sections` table.

## Frontend Tasks
- Wrap the Editor UI in `<RoomProvider>`.
- Build the "Active Users" avatar stack in the header.
- Use `yjs` and `y-codemirror.next` to bind the CodeMirror state to the Liveblocks Yjs provider.

## Security Considerations
- The `POST /auth/liveblocks` endpoint MUST verify that the user actually has access to the requested `room_id` (Project ID) before issuing the token.

## Testing Instructions
- Open the same project in two different browser windows (logged in as two different users in the same Org).
- Type in Window A, verify changes appear instantly in Window B.
- Verify User B's cursor is visible to User A.
