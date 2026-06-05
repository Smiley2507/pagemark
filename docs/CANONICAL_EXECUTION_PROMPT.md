# Canonical Execution Prompt

Use this prompt for implementation runs that need to stay aligned with the current product direction.

```text
Read CONTEXT.md, frontend/VISUAL_SPEC.md, and docs/adr/0001-projects-contain-multiple-documents.md.

Treat only those three files as normative sources of product truth.

Do not use other markdown documents, roadmap files, or earlier implementation plans as decision sources unless this prompt explicitly names them for a narrow, mechanical task.
If another document conflicts with the canonical sources, call out the conflict and follow the canonical sources.

Implement the requested work only within the scope that is currently being asked for.
Do not widen scope by pulling requirements from older plans, partial redesign notes, or deprecated docs.

When planning or implementing, prefer:
- the domain language in CONTEXT.md
- the visual and interaction direction in frontend/VISUAL_SPEC.md
- the multi-Document Project model in docs/adr/0001-projects-contain-multiple-documents.md

If the task is ambiguous, resolve it from those sources first.
If it still cannot be resolved, ask for clarification instead of borrowing from unrelated docs.
```

