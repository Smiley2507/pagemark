# Code Analysis Engine

## Overview

The code analysis engine is a 9-step pipeline that ingests source code from ZIP uploads or Git repositories and extracts structured repository facts. It lives in `backend/app/services/analysis_service.py` (1285 lines) and is executed asynchronously via Celery workers in `backend/app/workers/analysis_worker.py`.

The engine produces an `Analysis` snapshot containing: file tree, language breakdown, detected API endpoints, cyclomatic complexity metrics, dependencies, and raw file contents (capped). This data feeds into template recommendations, outline generation, section generation, and freshness/staleness detection.

## Pipeline Steps (9 Steps)

| Step | Name | Description |
|------|------|-------------|
| 1 | Connecting to source | Validating upload or connecting to Git repository |
| 2 | Extracting source | Extracting ZIP archive or cloning Git repo |
| 3 | Detecting languages | Language breakdown by file extension |
| 4 | Parsing source files | Tree-sitter AST parsing for primary languages |
| 5 | Detecting endpoints | Regex-based API endpoint detection |
| 6 | Computing complexity | Cyclomatic complexity heuristic |
| 7 | Finalizing results | Saving all artifacts to Analysis snapshot |
| 8 | Generating documentation outline | AI-powered AdaptTemplate (optional, requires credential) |
| 9 | Analyzing readability & style | NLP analysis of generated documentation |

## Entry Points

### ZIP Analysis
`workers/analysis_worker.py:analyze_project_task()`

1. Updates analysis step 1: validates the uploaded file
2. Updates analysis step 2: extracts ZIP archive using `extract_zip_archive()`
3. Calls `_run_pipeline()` for steps 3-7
4. Calls `_run_nlp_analysis()` for step 9

### Git Analysis
`workers/analysis_worker.py:clone_and_analyze_task()`

1. Updates analysis step 1: validates repository URL
2. Updates analysis step 2: clones repo via `git_service.clone_repo()` (shallow clone, depth=1)
3. Captures HEAD commit SHA via `git_service.get_head_commit()`
4. Calls `_run_pipeline()` for steps 3-7
5. Cleans up cloned repo in `finally` block
6. Calls `_run_nlp_analysis()` for step 9

### `_run_pipeline()` (Steps 3-7)

This is the core pipeline function:

1. **Step 3 — Detect languages**: Calls `run_static_analysis()` which internally calls `collect_repo_files()` then `detect_languages()`
2. **Step 4 — Parse source files**: Tree-sitter parsing via `parse_source_files()`
3. **Step 5 — Detect endpoints**: Regex-based endpoint extraction via `extract_endpoints()`
4. **Step 6 — Compute complexity**: Cyclomatic complexity via `compute_complexity()`
5. **Step 7 — Finalize**: Calls `complete_analysis_snapshot_sync()` to persist all artifacts

After `_run_pipeline()`, `run_outline_step_sync()` handles step 8 (AI outline generation) if a credential is available.

## Component Functions

### File Collection

**`collect_repo_files(root_path: str) -> list[RepoFile]`**

Walks the directory tree starting at `root_path`. For each file:
- Skips ignored directories (`.git`, `node_modules`, `__pycache__`, `.venv`, `dist`, `build`, `target`, `.next`, etc.)
- Skips ignored files (`.DS_Store`, `Thumbs.db`)
- Skips files > 2MB
- Detects language by file extension using `EXTENSION_TO_LANGUAGE` dict (30+ languages mapped)
- Counts lines
- Computes cyclomatic complexity via `calculate_complexity()`
- Limits to 8000 files
- Returns list of `RepoFile` dataclass instances

### Language Detection

**`detect_languages(files: list[RepoFile]) -> dict`**

Groups files by detected language, counts files and lines per language. Returns:

```json
{
  "primary": ["python", "typescript"],
  "breakdown": [
    {"language": "python", "files": 42, "lines": 3500, "percent": 60.0, "depth": "primary"},
    {"language": "javascript", "files": 28, "lines": 2100, "percent": 40.0, "depth": "shallow"}
  ],
  "shallow": ["javascript", "html", "css"]
}
```

Primary languages (python, typescript, javascript, java) get tree-sitter parsing; all others are "shallow" (counted only).

### Tree-Sitter Parsing

**`_load_tree_sitter_parsers() -> dict[str, Parser]`**

Loads tree-sitter parsers for Python, JavaScript/TypeScript, and Java using:
- `tree_sitter_python` library
- `tree_sitter_javascript` library (used for both JS and TS)
- `tree_sitter_java` library

Gracefully degrades if libraries are not installed (returns empty dict).

**`parse_source_files(files, on_progress) -> dict`**

For each file with a primary language:
- If a parser is available, attempts to parse the file bytes into a CST (Concrete Syntax Tree)
- Counts successful parses and parse errors
- Returns `{"parsed_files": N, "parse_errors": N, "by_language": {...}}`

**Important**: The tree-sitter parse results are used for statistics only. The parsed AST is **not stored or used for further analysis** (the actual content extraction is done on raw text). This means tree-sitter parsing contributes to the parse statistics (`parsed_files`, `parse_errors`) but the results are not directly fed into endpoint detection, dependency extraction, or content analysis.

### Endpoint Detection

**`extract_endpoints(files: list[RepoFile]) -> dict`**

Uses regex patterns to detect API routes in source files:

| Framework | Pattern | Example Match |
|-----------|---------|---------------|
| FastAPI | `@app|router.get/post/put/patch/delete("...")` | `@app.get("/users/{id}")` |
| Flask | `@app|bp|blueprint.route|get|post|put("...")` | `@app.route("/api/data")` |
| Express | `app|router.get|post|put|patch|delete("...")` | `app.get("/users", ...)` |
| Spring | `@GetMapping|PostMapping|PutMapping|DeleteMapping|RequestMapping("...")` | `@GetMapping("/users")` |

Endpoint deduplication by (method, path) pair. Capped at 200 unique endpoints. Returns:

```json
{
  "count": 15,
  "items": [
    {"method": "GET", "path": "/api/users", "file": "routes/users.js", "line": 12, "framework": "express"},
    {"method": "POST", "path": "/api/users", "file": "routes/users.js", "line": 25, "framework": "express"}
  ],
  "frameworks": ["express", "fastapi"]
}
```

### Complexity Computation

**`compute_complexity(files: list[RepoFile]) -> dict`**

Tabulates:
- `total_files` — total number of files
- `total_lines` — sum of all line counts
- `largest_files` — top 10 by line count
- `by_language` — file and line counts per language
- `complexity_metrics` — per-file array of `{file_path, loc, complexity}`
- `parse_stats` — results from `parse_source_files()`

### Cyclomatic Complexity Heuristic

**`calculate_complexity(text: str) -> int`**

A simple keyword-count heuristic:
- Base complexity = 1
- Adds 1 for each occurrence of: `if`, `for`, `while`, `case`, `catch`, `except`, `&&`, `||`, ternary `? :`
- Returns total

This is documented as "a very rough approximation" in the code.

### Dependency Extraction

**`extract_dependencies(files: list[RepoFile]) -> list[dict]`**

Uses regex patterns to extract import/require statements:

| Language | Pattern |
|----------|---------|
| Python | `import X` / `from X import Y` |
| JavaScript/TypeScript | `import ... from "X"` / `require("X")` |
| Java | `import X.Y.Z;` |

Returns list of `{source: rel_path, target: module_name}` edges.

### File Tree Construction

**`build_file_tree(files: list[RepoFile]) -> dict`**

Builds a recursive directory tree from file paths:

```json
{
  "name": "/",
  "type": "dir",
  "children": [
    {"name": "src", "type": "dir", "children": [
      {"name": "main.py", "type": "file"}
    ]},
    {"name": "README.md", "type": "file"}
  ]
}
```

### File Contents Extraction

**`build_file_contents_json(files: list[RepoFile]) -> dict[str, str]`**

Builds a `{rel_path: content}` dictionary capped at:
- Maximum 50 files
- Maximum 100KB per file
- Primary language files sorted first, then by line count (largest first)

This feeds into AI prompts for section generation and outline adaptation.

### ZIP Extraction

**`extract_zip_archive(zip_path, project_id, ignore_patterns) -> str`**

1. Creates extraction directory at `uploads/{project_id}/extracted/`
2. Iterates ZIP entries, applying ignore patterns (fnmatch)
3. Skips directory entries, counts files and total size
4. Limits: 8000 files, 150MB uncompressed
5. If single top-level directory exists, uses it as root

### Exclusion Patterns

**`get_effective_exclusions(project_id, db)`** — Fetches enabled `ProjectSourceExclusion` rules from DB
**`exclusion_patterns(exclusions)`** — Extracts pattern strings from rules
**`normalize_exclusion_rules(rules)`** — Converts ORM objects to dicts

Exclusions are `.gitignore`-style glob patterns stored per project. They are applied during file collection (ZIP extraction and Git clone).

## Supporting Data Structures

```python
@dataclass
class RepoFile:
    rel_path: str
    abs_path: str
    language: Optional[str]
    lines: int = 0
    complexity: int = 0
    content: str = ""

@dataclass
class AnalysisArtifacts:
    file_tree_json: dict
    languages_json: dict
    endpoints_json: dict
    complexity_json: dict
    dependencies_json: list[dict] = field(default_factory=list)
    files: list[RepoFile] = field(default_factory=list)
```

## Supported Languages

The `EXTENSION_TO_LANGUAGE` mapping covers 30+ extensions:

**Primary (tree-sitter parsed)**: Python (`.py`, `.pyi`), JavaScript (`.js`, `.jsx`, `.mjs`, `.cjs`), TypeScript (`.ts`, `.tsx`), Java (`.java`)

**Shallow (counted only)**: Go, Rust, Ruby, PHP, C#, C++, C, Swift, Kotlin, Scala, SQL, Markdown, JSON, YAML, TOML, XML, HTML, CSS, SCSS

**Ignored**: All other file types, files > 2MB, binary files (detected by OSError on read)

## How Analysis Feeds Into Documentation

1. **Template Recommendations**: Analysis facts (languages, endpoints, file count) are matched against template `compatible_repository_traits` to score and rank templates (`create_rule_based_recommendations()`)

2. **Outline Generation**: Analysis artifacts (file tree, languages, endpoints, complexity, file contents) are injected into the AI outline prompt (`generate_outline_with_ai()`)

3. **Section Generation**: Analysis `file_contents_json` is included in section generation prompts as codebase context (`build_section_prompt()`)

4. **Freshness Detection**: Comparison of old vs. new analysis `source_commit`, `file_tree_json`, `endpoints_json`, `languages_json` to detect changes (`detect_stale_sections()`)

5. **Evidence References**: Generated sections reference analysis artifacts (file paths, symbols, line ranges) stored in `EvidenceReference` records

## Edge Cases and Limitations

1. **Tree-sitter parse results not used structurally**: The AST is parsed but not queried for classes, methods, or functions. The `parse_source_files()` function only counts successes/errors. All structural analysis (endpoints, dependencies) is regex-based.

2. **No class/method extraction**: Despite having tree-sitter, the system does not extract class hierarchies, method signatures, function parameters, or type information. This limits the depth of code understanding.

3. **Regex-based endpoint detection is fragile**: Custom decorators, dynamic route registration, or unusual patterns will be missed.

4. **Cyclomatic complexity is a keyword count**: Not a true cyclomatic complexity measure. A simple `if` keyword count does not account for nesting depth, short-circuit evaluation, or control flow structure.

5. **Dependency extraction is simplistic**: Python's `from X import Y` is parsed but the dependency is recorded as `X` (missing `Y`). Relative imports are not resolved. JavaScript dynamic imports (`import()`), re-exports, and path aliases are not handled.

6. **No build system or package manager analysis**: The system does not parse `package.json`, `requirements.txt`, `Cargo.toml`, or similar dependency files.

7. **No test detection**: Test files are not identified or excluded by default.

8. **100KB per file / 50 file limit**: Large codebases may have critical files excluded from AI context.

9. **Single top-level directory heuristic**: ZIP extraction assumes the project root is either the extraction root or a single subdirectory. Multi-directory archives without a common parent may misbehave.

10. **NLP analysis is minimal**: Step 9 (`_run_nlp_analysis`) only runs after documents exist (not during initial analysis) and uses simple heuristics (Flesch Reading Ease, regex entity extraction).

11. **No incremental analysis**: Every analysis re-scans the entire codebase. There is no support for differential analysis of changed files only.

12. **Tree-sitter dependency**: If tree-sitter and language-specific grammars are not installed, the parser step silently degrades (returns 0 parsed files, 0 errors).

## Async vs Sync

The analysis pipeline has two parallel implementations:
- **Async functions** (prefixed with `async def`): Used by API routes, operate within the FastAPI async request cycle
- **Sync functions** (suffixed with `_sync`): Used by Celery workers which use synchronous SQLAlchemy sessions

Both implementations perform the same logic but use different database access patterns.

## Analysis Status Tracking

Analysis progress is tracked via the `analyses` table fields:
- `status`: PENDING → RUNNING → COMPLETED / FAILED
- `step_number`: Current step (1-9)
- `current_step`: Step name
- `step_detail`: Human-readable progress message
- `total_steps`: Always 9

The frontend polls `GET /projects/{project_id}/analysis/status` and displays a step-by-step progress indicator.

## Outline Generation (Step 8)

After static analysis completes, the system optionally generates a documentation outline using AI:

1. Checks if the user has an active AI credential
2. If no credential: marks step 8 as skipped with message "Add an API key in Settings to generate documentation outline"
3. If credential exists: calls `generate_outline_with_ai()` which:
   - Builds analysis summary (languages, endpoints, file counts)
   - Gets template sections from the document's template
   - Calls AI with outline prompt
   - Parses JSON response into section list
4. If existing sections are untouched (all PENDING, all empty), auto-applies the AI outline to the document
5. If sections have been modified, the outline is available via `GET /analysis/outline-diff` for manual review

## Output Storage

Analysis artifacts are stored in the `analyses` table:
- `file_tree_json` — Complete file tree
- `languages_json` — Language breakdown with percentages
- `endpoints_json` — Detected API endpoints with framework info
- `complexity_json` — File count, line count, per-file complexity
- `file_contents_json` — Content of up to 50 key files
- `analysis_data` — Dependencies, available/unavailable facts, partial failures
- `effective_exclusions_json` — Exclusion rules applied

One analysis per project is marked `is_current = True`. When a new analysis completes, the previous current analysis is marked `is_current = False`.
