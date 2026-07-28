# AI Pipeline Documentation

## Overview

Pagemark uses a Bring-Your-Own-Key (BYOK) model for AI capabilities. Users configure their own provider credentials (Anthropic Claude, Google Gemini, or OpenCode Go) in Settings. The system never provides its own AI capacity. Every AI operation authenticates using the user's stored credential.

## Provider Catalog

Defined in `backend/app/ai_providers.py`:

```python
PROVIDERS = {
    "anthropic": {
        "name": "Anthropic",
        "models": ["claude-sonnet-4-20250514", "claude-haiku-3-5-sonnet-20241022"],
        "default_model": "claude-sonnet-4-20250514",
    },
    "google": {
        "name": "Google AI Studio",
        "models": ["gemini-2.5-flash-001", "gemini-2.5-pro-001"],
        "default_model": "gemini-2.5-flash-001",
    },
    "opencode_go": {
        "name": "OpenCode Go",
        "models": ["deepseek-chat", "deepseek-reasoner", "kimi-latest", "glm-4-plus", "miMo"],
        "default_model": "deepseek-chat",
    },
}
```

The function `is_valid_model(provider, model_id)` validates that a given model string exists within the provider's model list.

## AI Service Layer

### `services/ai_service.py` — Low-Level Provider Adapters

Three implementations of the same contract, selected by the `provider` string:

**Anthropic** (`_complete_anthropic`):
- Uses `anthropic.Anthropic(api_key=api_key)` SDK
- Calls `client.messages.create(model=model, system=system_prompt, messages=[{"role": "user", "content": user_prompt}], max_tokens=16384)`
- Returns `response.content[0].text`

**Google** (`_complete_google`):
- Uses `google.genai.Client(api_key=api_key)` SDK
- Calls `client.models.generate_content(model=model, contents=[system_prompt + "\n\n" + user_prompt])`
- Returns `response.text`

**OpenCode Go** (`_complete_opencode_go`):
- Makes HTTP POST to a configured endpoint with JSON body: `{"model": model, "system": system_prompt, "messages": [{"role": "user", "content": user_prompt}], "max_tokens": 16384}`
- Parses JSON response at `response["choices"][0]["message"]["content"]`

Public interface:
- `complete_text(system_prompt, user_prompt, provider, api_key, model_id) -> str` — Routes to correct provider implementation
- `validate_credential(provider, api_key, model_id) -> bool` — Tests connectivity by making a minimal API call
- `list_models(provider, api_key) -> list[str]` — Only Google supports dynamic listing; others return static catalog

### `services/ai_doc_service.py` — High-Level AI Operations

Singleton `AIService` class (global instance: `ai_service`).

#### `generate_section(section, document, project, provider, api_key, model, resource, evidence)`

The core section generation method. Steps:

1. **Fetch active analysis**: Gets the latest `is_current=True` Analysis snapshot for the project
2. **Build context**: Calls `context_assembly.assemble()` with project resources, truncated to 8000 token budget
3. **Build prompt**: Calls `prompts/section.py:build_section_prompt()` with:
   - Project context (`project.context_md`)
   - Codebase analysis (file tree, languages, endpoints, complexity, file contents)
   - Template instructions (purpose, audience, guidance, system_prompt)
   - Section details (heading, description, parent hierarchy)
   - Assembled context blocks
4. **Call AI**: `ai_service.complete_text(system_prompt, user_prompt, provider, api_key, model)`
5. **Parse response**: Expects JSON output with format:
   ```json
   {
     "content": "# Section content in markdown...",
     "confidence": 85,
     "evidence": [
       {"path": "src/main.py", "symbol": "MyClass", "line_range": [10, 25], "artifact_type": "class"}
     ]
   }
   ```
   Or action format:
   ```json
   {
     "action": "ask_user",
     "question": "What database does this project use?",
     "affected_sections": ["Installation", "Configuration"],
     "confidence_tradeoff": "Database-specific instructions will be generic"
   }
   ```
6. **Handle clarification requests**: If `action: "ask_user"`, raises `NeedsClarificationException` which is caught by the caller to create a `ClarificationRequest` and pause generation
7. **On success**:
   - Creates `EvidenceReference` records for each evidence item
   - Updates section `content_md`
   - Sets `content_lifecycle = GENERATED_DRAFT`
   - Creates a `SectionVersion` snapshot with `author_type = AI`
   - Returns the updated section

#### `refine_section(section, user_instruction, provider, api_key, model)`

1. Builds refine prompt via `prompts/refine.py:build_refine_prompt()` with current content + user instruction
2. Calls AI
3. Computes diff using `difflib.SequenceMatcher` — returns line-level added/removed/modified counts
4. Returns `{"content": "new markdown", "diff": "unified diff string", "diff_lines": {"added": N, "removed": N, "modified": N}}`

#### `stream_chat(thread, messages, provider, api_key, model, resource)`

Async generator that yields SSE-formatted strings:

1. Builds chat prompt via `prompts/chat.py:build_chat_prompt()` with:
   - Project info
   - Thread title
   - Message history (last 20 messages)
   - Attached resources (via context assembly)
2. **Anthropic path**: Uses native SDK streaming:
   ```python
   with client.messages.stream(...) as stream:
       for text in stream.text_stream:
           yield f"data: {json.dumps({'type': 'text', 'content': text})}\n\n"
   ```
   - Also yields `citation` events if evidence references are present
3. **Fallback path** (all other providers): Calls `complete_text()`, then yields the full response as one chunk
4. Saves complete AI message to DB after streaming completes

#### `phrasing_suggestions(text, provider, api_key, model)`

Builds a prompt asking for 3 alternative phrasings of the provided text. Returns list of 3 strings.

#### `suggest_structure(sections_json, document, provider, api_key, model)`

Builds a prompt with the current document outline and asks AI to suggest structural changes (reorder, rename, add, remove, merge sections). Returns structured suggestions.

### `services/context_assembly.py` — Context Assembly Service

`ContextAssemblyService` singleton:

- **`assemble(resources, max_tokens=8000)`**: Takes a list of `Resource` objects and builds a structured context string. Resources are prioritized (analysis fragments first, file contents next, symbols last) and the total is truncated to fit within `max_tokens` (approximated as 4 chars per token).
  
  Output format:
  ```
  <context type="section">
  [Content of section "Installation" from document "User Manual"]
  </context>
  
  <context type="analysis_fragment">
  ### File Tree
  /src/
    main.py
    utils/
      helpers.py
  
  ### Languages
  Python (80%), JavaScript (20%)
  </context>
  ```

- **`get_vision_content_blocks(resources)`**: Extracts image/gif resources and formats them for Anthropic's vision API.

## Prompt Templates

### `prompts/section.py` — Section Generation Prompt

`build_section_prompt(document, section, analysis, project_context, template, context_blocks)`:

Assembles a comprehensive prompt with these sections:

1. **System Prompt**: Instructions to act as a technical documentation writer. Rules: write in clear English, use markdown, include code examples, use evidence from provided source code, output JSON only.

2. **User Prompt** containing:
   - **Project Context**: `project.context_md` (maintainer-provided context)
   - **Template Purpose/Audience**: From the Document's template (e.g., "This document is an API Reference intended for developers integrating with the system")
   - **Codebase Analysis Summary**:
     ```
     ## Codebase Analysis
     ### File Tree
     [file_tree_json rendered as tree]
     
     ### Languages
     [language breakdown]
     
     ### Endpoints
     [API endpoints detected]
     
     ### Complexity
     [file count, line count, largest files]
     
     ### Key Files
     [file_contents_json for up to 50 files, 100KB each]
     ```
   - **Section to Generate**: heading, description, parent context
   - **Supplementary Context**: From assembled resource blocks (notes, uploads, chat history, etc.)

3. **Response format** instructions: JSON with `content`, `confidence` (0-100), and `evidence` array.

### `prompts/outline.py` — AdaptTemplate/Outline Prompt

`OUTLINE_SYSTEM` constant:
```
You are a technical documentation architect. Your task is to create or adapt a documentation outline for a software project based on its codebase analysis. You will receive a template structure and codebase analysis results. Adapt the template sections to match the actual project structure and content. Output valid JSON only — a list of section objects with "heading" and "description" fields. Aim for 5-12 sections.
```

`build_outline_user_message(template_sections, languages_summary, endpoint_count, frameworks, file_count, complexity_notes)` — Builds a prompt that includes:
- The template sections (headings + descriptions)
- Language detection results
- Endpoint count and frameworks detected
- File count, largest file info
- Instructions to adapt the template to the actual project

`generate_outline_with_ai()` calls `ai_service.complete_text()` with these prompts, then parses the JSON response (stripping markdown code fences if present). Returns a sorted list of `{heading, description, order_index}` dicts.

### `prompts/chat.py` — Conversational Chat Prompt

`build_chat_prompt(thread, messages, project_info, context_blocks)`:

Builds a system prompt from project info and context, then adds the message history (last 20 messages) as user/assistant turns. The system prompt instructs the AI to answer questions about the project's codebase and documentation, using the provided context blocks for grounding.

### `prompts/refine.py` — Section Refinement Prompt

`build_refine_prompt(current_content, user_instruction)`:

```
Current section content:
[current markdown]

User instruction:
[user_instruction]

Please rewrite the section according to the instruction above. Output valid markdown only.
```

## Token Estimation & Cost Tracking

In `services/generation_service.py`, before executing a generation run, the system estimates token usage:

- **Prompt estimation**: Rough estimate based on character count of combined prompts (approx 4 chars per token)
- **Completion estimation**: Heuristic based on average section length from the template
- **Cost calculation**: Uses pricing tables defined in the service:
  ```python
  MODEL_PRICING = {
      "claude-sonnet-4-20250514": {"input": 3.0, "output": 15.0},  # per 1M tokens
      "claude-haiku-3-5-sonnet-20241022": {"input": 0.80, "output": 4.0},
      "gemini-2.5-flash-001": {"input": 0.10, "output": 0.40},
      "gemini-2.5-pro-001": {"input": 1.25, "output": 5.0},
      "deepseek-chat": {"input": 0.27, "output": 1.10},
      ...
  }
  ```
- Actual tokens and cost are recorded after each section task completes (via provider SDK response metadata where available)

## Generation Run Orchestration

### `services/generation_service.py`

**`execute_generation_run(run_id, db)`**:

1. Loads the `GenerationRun` with its `GenerationSectionTask` children
2. For `COMPLETE_DOCUMENT` mode:
   - Resolves section dependencies (tasks with `dependency_section_ids` wait for those sections to finish)
   - Uses an `asyncio.Semaphore` for provider-aware parallelism (Anthropic=2, Google=5, others=3)
   - Processes tasks in dependency order using a topological sort-like approach
   - For each task, calls `_execute_task()` which:
     a. Sets status to GENERATING
     b. Calls `ai_service.generate_section()`
     c. On success: marks task READY
     d. On `NeedsClarificationException`: pauses task, creates ClarificationRequest
     e. On provider error (quota, rate limit, timeout): pauses the run, sets `failover_state = NEEDS_CONFIRMATION`
3. For `SECTION_ON_DEMAND` mode:
   - Creates a single task for the requested section
   - Executes it immediately
4. On completion: sets run status to COMPLETED, updates actual token counts and costs
5. **Provider failover**: If the run is paused with `NEEDS_CONFIRMATION`, the user can call `confirm_failover()` to switch providers and resume remaining tasks

## Streaming Chat

The chat streaming endpoint (`POST /chat/threads/{thread_id}/messages/stream`) uses Server-Sent Events (SSE):

1. Frontend sends a message via POST
2. Backend saves the user message to DB
3. Backend creates a streaming response with `StreamingResponse(media_type="text/event-stream")`
4. The AI service yields SSE events:
   - `data: {"type": "text", "content": "chunk of text"}\n\n`
   - `data: {"type": "citation", "content": {"source": "file.py", "line": 42}}\n\n`
   - `data: {"type": "done"}\n\n`
5. After streaming completes, the complete AI message is saved to the database
6. Frontend uses `EventSource` or fetch with `ReadableStream` to consume the SSE stream

## Clarification Request Flow

When AI generation encounters low confidence about a specific aspect:

1. `generate_section()` returns `{"action": "ask_user", "question": "...", ...}`
2. The service raises `NeedsClarificationException`
3. The caller (generation service or section router) catches the exception
4. A `ClarificationRequest` record is created with:
   - `question`: The AI's question
   - `section_id`: The affected section
   - `affected_sections_json`: Other sections that would benefit from the answer
   - `confidence_tradeoff`: What quality is lost if skipped
5. The section's `needs_input` flag is set to true
6. User answers via the frontend
7. Answer is posted to `POST /clarifications/{section_id}/clarify`
8. The generation task is resumed with the answer as additional context

## Caching

- **No AI response caching** is currently implemented. Every AI request results in an API call to the provider.
- **No prompt caching** is implemented.

## Retry Logic

- **Provider-level retries**: None in the Python SDK calls themselves
- **Celery task retries**: Analysis tasks have `max_retries=3` with a 10-second countdown for infrastructure failures
- **Generation tasks**: No automatic retry — they pause on failure and require user intervention (retry or failover or skip)

## Streaming

- **Chat**: Native streaming for Anthropic (SDK-level `stream=True`); simulated streaming (single chunk) for other providers
- **Section generation**: No streaming — the entire response is awaited before returning
- **Analysis progress**: Progress is communicated via the `analyses` table — status, step_number, step_detail are updated synchronously by Celery workers and polled by the frontend

## Full Flow: User Triggers Section Generation

1. User clicks "Generate" on a section in the frontend editor
2. Frontend calls `POST /sections/{section_id}/ai/generate`
3. Backend router `sections_router.generate_section_content()`:
   - Gets the section, document, and project from DB
   - Gets the user's active AI credential (decrypted)
   - Calls `ai_service.generate_section()`
4. `ai_service.generate_section()`:
   - Fetches active analysis snapshot
   - Builds context via `context_assembly.assemble()`
   - Builds prompt via `build_section_prompt()`
   - Calls provider via `ai_service.complete_text()`
   - Parses response JSON
   - If clarification needed: raises `NeedsClarificationException`
   - On success: creates evidence references, updates section content, creates version snapshot
5. Router returns the updated section as JSON
6. Frontend updates the section display with the generated content
7. User reviews and clicks "Accept Review"
8. Frontend calls `POST /sections/{section_id}/accept-review`
9. Backend marks section as `content_lifecycle = REVIEWED`, records reviewer and analysis snapshot

## Full Flow: Complete Document Generation

1. User selects "Generate Complete Document" in the setup wizard
2. Frontend calls `POST /documents/{document_id}/generation-runs` with `mode: "complete_document"`
3. Backend creates `GenerationRun` with `GenerationSectionTask` children for all sections
4. User is redirected to editor — frontend polls `GET /generation-runs/{run_id}` for status
5. Backend `execute_generation_run()` processes tasks:
   - Resolves dependencies (if section A references section B's content, B generates first)
   - Parallelizes within provider limits (2 concurrent for Claude, 5 for Gemini)
   - Each task calls `ai_service.generate_section()`
   - Progress is tracked per task (QUEUED → GENERATING → READY)
6. Frontend shows progress bar with per-task status
7. On completion: all sections have GENERATED_DRAFT content
8. User reviews and accepts each section individually

## Missing or Incomplete Features

- **No streaming for section generation**: Only chat uses streaming. Section generation waits for the full response.
- **No semantic caching**: Identical prompts will re-invoke the AI API.
- **No prompt template versioning**: Prompt templates are hardcoded in Python strings.
- **Provider failover is manual**: The system pauses and asks the user to confirm before failing over to another provider.
- **OpenCode Go provider**: The endpoint URL for OpenCode Go is hardcoded and may not be configurable.
