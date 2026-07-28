# Live Collaboration Demo Smoke Checklist

## Required Configuration

- Frontend: `VITE_COLLABORATION_ENABLED=true`
- Backend: `LIVEBLOCKS_SECRET_KEY` configured
- Backend and frontend running
- Postgres reachable
- Liveblocks network reachable from backend and browsers

## Smoke Steps

1. Open two browser sessions as two users.
2. Navigate both users to the same project, document, and section.
3. Confirm both sessions enter the same section room: `project:{project_id}:document:{document_id}:section:{section_id}`.
4. Confirm presence/cursors appear in both sessions.
5. Edit text in one session and confirm it syncs to the other.
6. Open the comment/thread UI and confirm it appears for the section.
7. Wait for the collaboration snapshot and confirm the backend persists `Section.content_md`.
8. Reload both sessions and confirm persisted content appears.
9. Approve or otherwise make a section read-only, then confirm edit snapshots are denied.

## Failure Layer Triage

- Frontend flag: collaboration UI never activates.
- Liveblocks auth: backend returns auth/configuration errors.
- Room permission: token is issued but wrong access is granted.
- Realtime sync: room opens but presence or edits do not propagate.
- Backend snapshot: realtime sync works but reload loses content.
