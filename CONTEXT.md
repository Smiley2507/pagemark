# Pagemark

Pagemark is an AI-assisted system for turning source code into structured technical documentation that developers refine section by section.

## Language

**Analysis**:
An immutable Project-level snapshot produced by one source ingest event, containing structured repository facts such as file tree, languages, endpoints, and complexity. One Analysis snapshot is current for the Project.
_Avoid_: Scan, indexing (unless referring to search).

**Template**:
A reusable documentation intent and outline pattern that determines what kind of Document a Project generates. It contains section headings and optional descriptions, not section prose.
_Avoid_: Theme, layout, preset (when meaning outline).

**Project**:
A source-connected workspace that organizes related Documents for one software project.
_Avoid_: Document (a single documentation purpose), folder (describes only its organizational role).

**Document**:
A documentation artifact within a Project, created for one purpose and managed through its own Template or Custom Outline, generation state, review state, and freshness.
_Avoid_: Project (the broader source-connected workspace), Section (a part of a Document).

**Document setup stage**:
The persisted stage of guided Document creation, such as purpose, template selection, Outline review, Generation mode choice, or editor ready.
_Avoid_: Wizard step (UI-specific), nullable progress (implementation detail).

**Outline**:
The concrete section headings and hierarchy belonging to one Document — the rows the editor displays.
_Avoid_: Table of contents (external site), skeleton (too vague).

**Outline Proposal**:
A versioned proposed Outline belonging to one Document. It may be a draft, approved, or superseded, and becomes the Document's active Outline only after maintainer approval.
_Avoid_: Analysis Outline (Analysis informs it but does not own it), pending Outline (describes only one state).

**Custom Outline**:
A project-specific Outline created when no existing Template fits the maintainer's documentation purpose. It may later be deliberately saved as a reusable Template.
_Avoid_: Custom Template (until it is saved for reuse), ad hoc Template.

**Generation mode**:
The maintainer's choice between generating prose for the complete approved Outline in the background or generating individual Sections on demand.
_Avoid_: AI mode (too broad), generation strategy (implementation-oriented).

**Generation Run**:
A persisted Document-level attempt to generate prose using one Generation mode and provider context. It records estimated and actual usage, overall status, errors, and child Section tasks.
_Avoid_: Job (too implementation-oriented), full prefill (legacy term).

**Generated Draft**:
AI-generated Section prose awaiting maintainer review. It may include source-evidence indicators and remains distinct from reviewed documentation.
_Avoid_: Final content, completed Section.

**Reviewed Section**:
A Section whose current content has been reviewed and accepted by the Project maintainer. It records the supporting Analysis snapshot and relevant source evidence, remains editable, and may later become stale when that evidence changes.
_Avoid_: Finalized Section (implies no further editing), approved Document (a broader workflow state).

**Quality Finding**:
A durable, actionable Document- or Section-level issue from quality analysis, grammar/spelling, terminology, broken links, readability, or acceptance coverage. It has lifecycle state (`open`, `proposed`, `resolved`, `dismissed`) and can provide scoped context to AI repair actions without rewriting content automatically.
_Avoid_: Transient grammar result (not durable), Quality Issue (legacy report row), AI edit (a proposed change may address a finding but is not the finding).

**Potentially Stale Section**:
A Reviewed Section whose relevant source code has changed since review. The source changes are evidence that review may be needed, not proof that the Section is incorrect.
_Avoid_: Outdated Section (states an unverified conclusion), invalid Section.

**Clarification Request**:
A targeted question asking the Project maintainer for business or technical context that Analysis could not confidently infer. It identifies the Sections that the answer can improve.
_Avoid_: Questionnaire (implies a broad mandatory form), prompt (too implementation-oriented).

**Evidence Reference**:
A structured link from a Section or generated claim to an Analysis artifact, source path, symbol, and optional line-range hint. It supports explanation and freshness checks without treating line numbers as stable identity.
_Avoid_: Citation (may imply an external publication), source note (unstructured).

**Activity Event**:
A typed record of a meaningful workflow event in a Project, optionally linked to source sync, Analysis, Document, Section, Generation Run, or review state.
_Avoid_: Audit log (administrative and exhaustive), edit history (too granular), notification (delivery mechanism).

**Collaborative Session**:
A real-time shared editing or discussion session for one Section. It is scoped to the Section so collaboration follows the same boundaries as content lifecycle, review, and freshness.
_Avoid_: Document session (unless the whole Document is truly the collaboration unit), Project chat.

**Section Comment Thread**:
An anchored discussion attached to Section content, with replies and resolution state.
_Avoid_: Project Activity, Collaboration Note (when the discussion is anchored to content), audit entry.

**Collaboration Snapshot**:
The persisted Markdown projection of a Collaborative Session used by Pagemark workflows outside real-time editing.
_Avoid_: Canonical editor state, edit history, autosave event.

**Template Recommendation**:
A persisted recommendation for a Document setup flow, including its explicit basis, score, explanation, supporting Analysis facts, and whether provider usage occurred.
_Avoid_: Template ranking (may imply every Template is shown), suggestion (too vague).

**AdaptTemplate**:
The process of starting from a chosen Template's headings and adjusting them (rename, reorder, add, drop) based on Analysis facts, usually via AI.
_Avoid_: Merge (ambiguous), transform (too generic).

**Provider credential**:
A user's encrypted API key for an external AI vendor (e.g. Claude, Google AI Studio), stored per account — not platform-owned capacity.
_Avoid_: API key (too generic), subscriber (billing term).

**Active provider**:
The vendor and curated model an account intends to use for new AI work until the user switches in Settings. A confirmed failover may cause an in-progress Generation Run to use another configured provider for remaining Section tasks.
_Avoid_: Default provider (ambiguous with system default).

**Project maintainer**:
A developer accountable for both a Project's source code and its documentation, who uses Pagemark to reduce the effort required to create and maintain that documentation.
_Avoid_: Documentation owner (overemphasizes documentation operations), Technical writer (a different role), Project owner (ambiguous with access ownership).

## Relationships

- A **Project** contains one or more **Documents** related to the same software project and source connection.
- Each **Document** uses one **Template** or begins with a **Custom Outline**; **Analysis** informs how that structure becomes the Document's **Outline**.
- A Document may have multiple versioned **Outline Proposals**, but only an approved proposal becomes its active **Outline**.
- Approving an **Outline Proposal** materializes it into editable Sections while preserving the approved proposal as an immutable record.
- A **Custom Outline** becomes a **Template** only when the maintainer explicitly saves it for reuse.
- Reusable **Templates** are normally created by duplicating an existing Template or explicitly promoting a proven **Custom Outline**, then refining its purpose, audience, guidance, and Sections.
- Each immutable **Analysis** snapshot produces Project-level repository facts reused by every Document; each Document selects the facts relevant to its purpose and may receive its own proposed Outline.
- **Evidence References** connect Sections and generated claims to the relevant facts in an Analysis snapshot.
- Each **Outline** is realized as **Section** entities under its **Document**.
- A **User** may store multiple **Provider credentials** but has at most one **Active provider** at a time.
- **AdaptTemplate** and other AI features consume the project owner's **Active provider** credential.
- A **Project maintainer** connects a Project's source code so that **Analysis** and AI-assisted writing can help create and maintain its Documents.
- Document access is authorized through the parent Project's organization membership for nested Document routes.
- External sharing is Document-scoped by default so sharing one Document does not expose unrelated Documents in the same Project.
- During Project creation, source code is connected and **Analysis** runs before Template selection so repository facts can inform Template recommendations.
- While **Analysis** runs, completed repository facts are progressively revealed so the Project maintainer can understand and trust later Template recommendations.
- **Template Recommendations** are persisted per Document setup so static and AI-personalized recommendations remain explainable, resumable, and auditable.
- A **Template Recommendation** basis is one of rule-based, AI-personalized, or custom-outline-seeded.
- After Template selection or creation of a **Custom Outline**, the Project maintainer reviews and confirms the Analysis-informed **Outline** before Pagemark generates section prose.
- After approving the **Outline**, the Project maintainer chooses a **Generation mode** with an estimate of expected provider usage.
- Each generation attempt is recorded as a **Generation Run** with child Section tasks so progress, usage, errors, and retries remain durable.
- Provider usage is recorded as estimated and actual tokens plus approximate cost for each **Generation Run** and child Section task; approximate cost is not authoritative provider billing.
- A **Generation Run** records the intended **Active provider**, while each child Section task records the provider/model actually used.
- If the intended provider cannot continue, the **Generation Run** pauses and requires explicit maintainer confirmation before remaining Section tasks fail over to another configured provider.
- Provider failover is offered only for provider exhaustion or availability failures such as quota exhaustion, sustained rate limiting, or outage; deterministic request, validation, and policy failures remain task errors.
- Complete-Document **Generation Runs** execute Section tasks with limited, provider-aware parallelism that respects rate limits and supports pause, retry, and failover.
- Section tasks may declare lightweight dependencies so foundational Sections generate first and provide context to dependent Sections.
- If a foundational Section task fails, only its dependent tasks pause; independent tasks continue, and the maintainer may retry, skip the dependency, or proceed with reduced context.
- **Generate Sections on demand** is the recommended Generation mode; complete-Document generation is an explicit faster, higher-usage choice.
- AI-generated Section prose begins as a **Generated Draft** until the Project maintainer reviews it.
- Accepting a **Generated Draft** makes it a **Reviewed Section** without locking it against further editing.
- Editing a **Generated Draft** does not automatically make it reviewed; the Project maintainer must explicitly accept the current content.
- A manually written Section may also be explicitly marked reviewed; when source evidence exists, review records the current Analysis snapshot.
- Section state separates content lifecycle from workflow flags. Content lifecycle includes states such as empty, generated draft, and reviewed; workflow flags include states such as needs-input, potentially stale, generating, and failed.
- Document status is derived from its Sections by default, so generated drafts, failed tasks, and potentially stale Sections remain visible at the Document level.
- Export settings belong to a Document by default, with optional organization defaults for reuse across Documents.
- Exports produce one Document at a time by default; Project-level batch export may be added later from the Document library.
- Quality reports belong to a Document because quality depends on that Document's purpose, Template, Sections, and review state.
- **Quality Findings** persist beyond any one report run so dismissed/resolved findings remain meaningful when the same content fingerprint is seen again.
- Grammar and spelling checks create **Quality Findings** with Section location metadata, quote/range hints, replacements, rule id, provider metadata, and a content fingerprint.
- AI repair actions consume unresolved **Quality Findings** as scoped quality context and create reviewable proposed changes; they never silently rewrite accepted content.
- Collaboration notes belong to Documents or Sections by default; Project Activity remains workflow history rather than discussion.
- Project Activity is built from persisted **Activity Events** and may include visual summaries such as a GitHub-style heatmap of meaningful workflow over time.
- Activity heatmap intensity is based on weighted meaningful events so review, generation completion, source sync, stale updates, and Analysis completion count more than minor workflow events.
- A **Collaborative Session** belongs to one Section by default; a **Collaboration Snapshot** keeps backend workflows aligned with the latest shared content.
- A **Section Comment Thread** belongs to Section content and is separate from **Project Activity**.
- Project tags and Document tags are separate because they organize different levels of work.
- Search spans accessible Projects and Documents globally, with filters for Project, Document, tag, status, and freshness.
- Source exclusion rules are stored on the Project for future Analysis, while each Analysis snapshot records the effective exclusions used for that ingest event.
- Repository connection metadata is normalized on the Project for provider, owner, repository, branch, visibility, default branch, and last synced commit, with provider-specific extras stored separately when needed.
- ZIP source Projects create Analysis snapshots and can compare freshness when a newer ZIP is uploaded, but they do not support automatic source synchronization.
- Relevant source-code changes make a **Reviewed Section** a **Potentially Stale Section**; Pagemark explains the changes and never overwrites reviewed content without maintainer action.
- Pagemark updates a **Potentially Stale Section** by proposing a source-grounded diff that the Project maintainer explicitly accepts or rejects.
- Onboarding recommends configuring a **Provider credential** but allows the Project maintainer to skip it.
- Without an **Active provider**, a Project maintainer may complete static **Analysis** and receive rule-based Template recommendations, but must configure one before AI-personalized recommendations, **AdaptTemplate**, or prose generation.
- Low-confidence Analysis findings become targeted **Clarification Requests** during Outline review and do not block unrelated Sections.
- A Project maintainer may skip a **Clarification Request**, but Pagemark identifies the affected Sections and the resulting confidence tradeoff.
- A Project may start without source code as a secondary path, but Analysis-grounded recommendations, source evidence, and source-change maintenance remain unavailable until source is connected.
- A partially successful **Analysis** preserves available repository facts and identifies unavailable results; downstream recommendations disclose when they rely on incomplete Analysis.
- After a new Project completes Analysis, the workflow continues directly into guided creation of its first Document before presenting the broader Project workspace.
- Creating a Project creates the source-connected container only; Documents are created separately through the guided Document creation flow.
- The guided Document creation flow creates a draft Document early, then attaches Template choice, Custom Outline details, Outline Proposals, and materialized Sections as the maintainer progresses.
- Incomplete guided Document creation is represented by a persisted **Document setup stage** so the workflow can be resumed and validated.
- After creation, the Project maintainer's home experience prioritizes resuming recent work, active generation, Sections needing input, and source-code changes.
- Recent work is persisted per user, including last opened Project, Document, Section, and relevant view preferences for cross-device resume.
- View preferences are stored per user and per surface, with optional context id, so surfaces such as the global Project library and each Project's Document library can remember different list/grid choices.
- Repeat visits to a Project resume the maintainer's last active Section. Meaningful source-code changes are surfaced non-blockingly and require explicit review before affecting the Document.
- In the editor, the **Document** is the dominant workspace; the **Outline** and AI assistance remain available as visually secondary, contextual tools.
- AI assistance normally appears as contextual actions for the active Section or selected text; a collapsible assistant panel supports longer conversations when requested.

## Example dialogue

> **Dev:** "After re-sync, should we overwrite the **Outline**?"
> **Domain expert:** "Only if sections are still untouched, or the user explicitly applies the proposed **Outline** from the latest **Analysis**."

## Example dialogue (BYOK)

> **Dev:** "Can analysis run without a **Provider credential**?"
> **Domain expert:** "Static **Analysis** (steps 1–7) yes; **AdaptTemplate** (outline) is skipped with a clear reason until the owner configures an **Active provider**."

## Flagged ambiguities

- "Analysis page" refers to UI for viewing **Analysis** status and artifacts, not the **Analysis** job itself.
- "Free AI" means no platform-funded inference (StrictBYOK), not that vendors charge nothing.
