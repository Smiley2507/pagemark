# Use Liveblocks for section-scoped collaboration

Pagemark will use Liveblocks for real-time collaboration in v1, with one collaboration room per Section rather than one room per Document. This keeps collaboration aligned with the existing Section-owned lifecycle for content, review, generation, freshness, evidence, and versions, while avoiding the operating cost of a self-hosted Yjs service.

Considered alternatives were a whole-Document collaborative editor and self-hosted Yjs/Hocuspocus. Whole-Document rooms would require a larger editor and data-model refactor, while self-hosted Yjs would keep vendor control lower but add WebSocket operations and persistence work before the product has validated the workflow.
