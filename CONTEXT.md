# Pagemark

Pagemark is an AI-assisted system for turning source code into structured technical documentation that developers refine section by section.

## Language

**Analysis**:
A background job that ingests a codebase (ZIP or Git) and produces structured facts about the repository (file tree, languages, endpoints, complexity) for one ingest event.
_Avoid_: Scan, indexing (unless referring to search).

**Template**:
A reusable documentation outline pattern — section headings and optional descriptions — stored independently of any project. Not section prose.
_Avoid_: Theme, layout, preset (when meaning outline).

**Outline**:
The concrete section headings (and hierarchy) belonging to a project's Document — the rows the editor displays.
_Avoid_: Table of contents (external site), skeleton (too vague).

**AdaptTemplate**:
The process of starting from a chosen Template's headings and adjusting them (rename, reorder, add, drop) based on Analysis facts, usually via AI.
_Avoid_: Merge (ambiguous), transform (too generic).

**Provider credential**:
A user's encrypted API key for an external AI vendor (e.g. Claude, Google AI Studio), stored per account — not platform-owned capacity.
_Avoid_: API key (too generic), subscriber (billing term).

**Active provider**:
The single vendor + curated model the account uses for all AI features until the user switches in Settings.
_Avoid_: Default provider (ambiguous with system default).

## Relationships

- A **Project** may reference one **Template** at creation; **Analysis** informs how that **Template** becomes the project **Outline**.
- An **Analysis** run produces artifacts; when successful it may also propose an **Outline** (`outline_json`) before sections are updated.
- **Outline** is realized as **Section** entities under a **Document**.
- A **User** may store multiple **Provider credentials** but has at most one **Active provider** at a time.
- **AdaptTemplate** and other AI features consume the project owner's **Active provider** credential.

## Example dialogue

> **Dev:** "After re-sync, should we overwrite the **Outline**?"
> **Domain expert:** "Only if sections are still untouched, or the user explicitly applies the proposed **Outline** from the latest **Analysis**."

## Example dialogue (BYOK)

> **Dev:** "Can analysis run without a **Provider credential**?"
> **Domain expert:** "Static **Analysis** (steps 1–7) yes; **AdaptTemplate** (outline) is skipped with a clear reason until the owner configures an **Active provider**."

## Flagged ambiguities

- "Analysis page" refers to UI for viewing **Analysis** status and artifacts, not the **Analysis** job itself.
- "Free AI" means no platform-funded inference (StrictBYOK), not that vendors charge nothing.
