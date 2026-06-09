"""
Codebase analysis: ingest, CoreFour artifacts, AdaptTemplate outline, apply outline.
"""

from __future__ import annotations

import json
import os
import re
import shutil
import zipfile
import fnmatch
from collections import defaultdict
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Any, Callable, Optional

from sqlalchemy import delete, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import async_session, SessionLocal
from app.models.ai_credential import UserAiCredential
from app.services import crypto_service
from app.models.analysis import Analysis, AnalysisStatus
from app.models.document import Document, Section, SectionStatus
from app.models.project import Project, ProjectSourceExclusion
from app.models.template import Template
from app.prompts.outline import OUTLINE_SYSTEM, build_outline_user_message
from app.services import ai_service
from app.services.ai_credential_service import get_active_credential

DEFAULT_SECTION_HEADINGS = [
    "Project Overview",
    "Installation",
    "Features",
    "Architecture",
    "API Reference",
    "Deployment",
]

# ── Utilities ───────────────────────────────────────────────────────

def calculate_complexity(text: str) -> int:
    """
    A simple heuristic for cyclomatic complexity:
    Counts control flow keywords (if, for, while, case, except, etc.)
    """
    if not text:
        return 1
    # Match keywords that typically start a new branch of execution
    # This is a very rough approximation but works for general metrics
    patterns = [
        r"\bif\b", r"\bfor\b", r"\bwhile\b", r"\bcase\b",
        r"\bcatch\b", r"\bexcept\b", r"\b&&\b", r"\b\|\|\b", r"\b\?\s*:"
    ]
    complexity = 1
    for pattern in patterns:
        complexity += len(re.findall(pattern, text))
    return complexity

def extract_dependencies(files: list[RepoFile]) -> list[dict]:
    """
    Extracts module dependencies by searching for import statements.
    Returns a list of {source, target} edges.
    """
    dependencies = []

    # Simplified patterns for the most common languages
    # Python: 'import x' or 'from x import y'
    py_import = re.compile(r"^(?:import\s+([a-zA-Z0-9._]+)|from\s+([a-zA-Z0-9._]+)\s+import)", re.MULTILINE)
    # JS/TS: 'import ... from "x"' or 'require("x")'
    js_import = re.compile(r"import\s+.*?\s+from\s+['\"](.+?)['\"]|require\(['\"](.+?)['\"]\)", re.MULTILINE)
    # Java: 'import x.y.z'
    java_import = re.compile(r"^import\s+([a-zA-Z0-9._]+);", re.MULTILINE)

    for f in files:
        try:
            text = Path(f.abs_path).read_text(encoding="utf-8", errors="ignore")
        except OSError:
            continue

        targets = set()
        if f.language == "python":
            for match in py_import.finditer(text):
                targets.add(match.group(1) or match.group(2))
        elif f.language in ("javascript", "typescript"):
            for match in js_import.finditer(text):
                targets.add(match.group(1) or match.group(2))
        elif f.language == "java":
            for match in java_import.finditer(text):
                targets.add(match.group(1))

        for target in targets:
            if target:
                dependencies.append({"source": f.rel_path, "target": target})

    return dependencies

# ── Pipeline metadata ───────────────────────────────────────────

TOTAL_STEPS = 9

STEP_NAMES = {
    1: "Connecting to source",
    2: "Extracting source",
    3: "Detecting languages",
    4: "Parsing source files",
    5: "Detecting endpoints",
    6: "Computing complexity",
    7: "Finalizing results",
    8: "Generating documentation outline",
    9: "Analyzing readability & style",
}

ANALYSIS_FACT_KEYS = {
    "file_tree_summary": "file_tree_json",
    "stack_languages": "languages_json",
    "endpoints": "endpoints_json",
    "dependency_complexity": "complexity_json",
    "dependencies": "dependencies_json",
}

IGNORE_DIR_NAMES = {
    ".git",
    ".svn",
    ".hg",
    "node_modules",
    "__pycache__",
    ".pytest_cache",
    ".mypy_cache",
    ".ruff_cache",
    "dist",
    "build",
    "out",
    "target",
    ".venv",
    "venv",
    "env",
    ".env",
    "vendor",
    "coverage",
    ".next",
    ".nuxt",
    ".turbo",
    "Pods",
}

IGNORE_FILE_NAMES = {".DS_Store", "Thumbs.db"}
MAX_FILES = 8000
MAX_UNCOMPRESSED_BYTES = 150 * 1024 * 1024

EXTENSION_TO_LANGUAGE = {
    ".py": "python",
    ".pyi": "python",
    ".js": "javascript",
    ".jsx": "javascript",
    ".mjs": "javascript",
    ".cjs": "javascript",
    ".ts": "typescript",
    ".tsx": "typescript",
    ".java": "java",
    ".go": "go",
    ".rs": "rust",
    ".rb": "ruby",
    ".php": "php",
    ".cs": "csharp",
    ".cpp": "cpp",
    ".c": "c",
    ".h": "c",
    ".hpp": "cpp",
    ".swift": "swift",
    ".kt": "kotlin",
    ".scala": "scala",
    ".sql": "sql",
    ".md": "markdown",
    ".json": "json",
    ".yaml": "yaml",
    ".yml": "yaml",
    ".toml": "toml",
    ".xml": "xml",
    ".html": "html",
    ".css": "css",
    ".scss": "scss",
}

PRIMARY_LANGUAGES = {"python", "typescript", "javascript", "java"}

MAX_FILE_CONTENTS_FILES = 50
MAX_FILE_CONTENT_BYTES = 100 * 1024  # 100KB

ENDPOINT_PATTERNS = [
    (
        "fastapi",
        re.compile(
            r"@(?:app|router)\.(get|post|put|patch|delete|head|options)\s*\(\s*[\"']([^\"']+)[\"']",
            re.IGNORECASE,
        ),
    ),
    (
        "flask",
        re.compile(
            r"@(?:app|bp|blueprint)\.(?:route|get|post|put|delete)\s*\(\s*[\"']([^\"']+)[\"']",
            re.IGNORECASE,
        ),
    ),
    (
        "express",
        re.compile(
            r"(?:app|router)\.(get|post|put|patch|delete)\s*\(\s*[\"']([^\"']+)[\"']",
            re.IGNORECASE,
        ),
    ),
    (
        "spring",
        re.compile(
            r"@(?:Get|Post|Put|Patch|Delete|Request)Mapping\s*\(\s*(?:value\s*=\s*)?[\"']([^\"']+)[\"']",
            re.IGNORECASE,
        ),
    ),
]


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


def normalize_exclusion_rules(rules: list[ProjectSourceExclusion]) -> list[dict]:
    return [
        {
            "pattern": rule.pattern,
            "reason": rule.reason,
            "enabled": bool(rule.enabled),
        }
        for rule in rules
        if rule.enabled
    ]


async def get_effective_exclusions(project_id: int, db: AsyncSession) -> list[dict]:
    result = await db.execute(
        select(ProjectSourceExclusion)
        .where(ProjectSourceExclusion.project_id == project_id)
        .order_by(ProjectSourceExclusion.created_at.asc(), ProjectSourceExclusion.id.asc())
    )
    return normalize_exclusion_rules(list(result.scalars().all()))


def get_effective_exclusions_sync(project_id: int) -> list[dict]:
    with SessionLocal() as db:
        rules = (
            db.query(ProjectSourceExclusion)
            .filter(ProjectSourceExclusion.project_id == project_id)
            .order_by(ProjectSourceExclusion.created_at.asc(), ProjectSourceExclusion.id.asc())
            .all()
        )
        return normalize_exclusion_rules(rules)


def exclusion_patterns(exclusions: list[dict] | None) -> list[str]:
    return [
        str(rule["pattern"])
        for rule in exclusions or []
        if rule.get("enabled", True) and rule.get("pattern")
    ]


def build_analysis_fact_status(analysis: Analysis) -> dict[str, dict]:
    data = analysis.analysis_data or {}
    unavailable = data.get("unavailable_facts") or []
    partial_failures = data.get("partial_failures") or []
    failed_by_fact = {
        item.get("fact"): item
        for item in partial_failures
        if isinstance(item, dict) and item.get("fact")
    }
    facts: dict[str, dict] = {}
    for fact, attr in ANALYSIS_FACT_KEYS.items():
        available = getattr(analysis, attr, None)
        if fact == "dependencies":
            available = data.get("dependencies")
        failure = failed_by_fact.get(fact)
        facts[fact] = {
            "available": available is not None and fact not in unavailable,
            "unavailable_reason": failure.get("reason") if failure else None,
        }
    return facts


def build_analysis_data(
    artifacts: AnalysisArtifacts,
    *,
    unavailable_facts: list[str] | None = None,
    partial_failures: list[dict] | None = None,
) -> dict:
    return {
        "complexity_metrics": artifacts.complexity_json.get("complexity_metrics", []),
        "dependencies": artifacts.dependencies_json,
        "available_facts": [
            fact
            for fact in ANALYSIS_FACT_KEYS
            if fact not in set(unavailable_facts or [])
        ],
        "unavailable_facts": unavailable_facts or [],
        "partial_failures": partial_failures or [],
        "partial_failure": bool(partial_failures or unavailable_facts),
    }


def _should_ignore_dir(name: str) -> bool:
    return name in IGNORE_DIR_NAMES or name.startswith(".")


def extract_zip_archive(zip_path: str, project_id: int, ignore_patterns: Optional[list[str]] = None) -> str:
    """Extract ZIP to uploads/{project_id}/extracted and return root path."""
    extract_root = Path(f"uploads/{project_id}/extracted")
    if extract_root.exists():
        shutil.rmtree(extract_root)
    extract_root.mkdir(parents=True, exist_ok=True)

    total_size = 0
    file_count = 0
    with zipfile.ZipFile(zip_path, "r") as zf:
        for info in zf.infolist():
            # Check if file should be ignored
            if ignore_patterns:
                rel_path = info.filename
                if any(fnmatch.fnmatch(rel_path, pat) for pat in ignore_patterns):
                    continue

            if info.is_dir():
                continue
            total_size += info.file_size
            file_count += 1
            if file_count > MAX_FILES:
                raise ValueError(f"ZIP contains more than {MAX_FILES} files")
            if total_size > MAX_UNCOMPRESSED_BYTES:
                raise ValueError("ZIP uncompressed size exceeds limit")
            zf.extract(info, extract_root)

    # If single top-level folder, use it as root
    children = [p for p in extract_root.iterdir() if p.name not in IGNORE_FILE_NAMES]
    if len(children) == 1 and children[0].is_dir():
        return str(children[0])
    return str(extract_root)


def collect_repo_files(root_path: str) -> list[RepoFile]:
    root = Path(root_path)
    files: list[RepoFile] = []
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = [d for d in dirnames if not _should_ignore_dir(d)]
        for fname in filenames:
            if fname in IGNORE_FILE_NAMES:
                continue
            abs_path = Path(dirpath) / fname
            try:
                if abs_path.stat().st_size > 2 * 1024 * 1024:
                    continue
            except OSError:
                continue
            rel = str(abs_path.relative_to(root)).replace("\\", "/")
            ext = abs_path.suffix.lower()
            lang = EXTENSION_TO_LANGUAGE.get(ext)
            lines = 0
            content = ""
            try:
                text = abs_path.read_text(encoding="utf-8", errors="ignore")
                content = text
                lines = text.count("\n") + (1 if text else 0)
                complexity = calculate_complexity(text)
            except OSError:
                pass
            files.append(
                RepoFile(rel_path=rel, abs_path=str(abs_path), language=lang, lines=lines, complexity=complexity, content=content)
            )
            if len(files) > MAX_FILES:
                raise ValueError(f"Repository exceeds {MAX_FILES} files")
    return files


def build_file_tree(files: list[RepoFile]) -> dict:
    tree: dict = {"name": "/", "type": "dir", "children": []}

    def insert(path_parts: list[str], nodes: list):
        if not path_parts:
            return
        name = path_parts[0]
        if len(path_parts) == 1:
            nodes.append({"name": name, "type": "file"})
            return
        for node in nodes:
            if node.get("name") == name and node.get("type") == "dir":
                insert(path_parts[1:], node["children"])
                return
        new_dir = {"name": name, "type": "dir", "children": []}
        nodes.append(new_dir)
        insert(path_parts[1:], new_dir["children"])

    for f in files:
        parts = f.rel_path.split("/")
        insert(parts, tree["children"])
    return tree


def detect_languages(files: list[RepoFile]) -> dict:
    counts: dict[str, int] = defaultdict(int)
    lines: dict[str, int] = defaultdict(int)
    for f in files:
        if not f.language:
            continue
        counts[f.language] += 1
        lines[f.language] += f.lines

    total_files = sum(counts.values()) or 1
    breakdown = []
    for lang, count in sorted(counts.items(), key=lambda x: -x[1]):
        breakdown.append(
            {
                "language": lang,
                "files": count,
                "lines": lines[lang],
                "percent": round(count / total_files * 100, 1),
                "depth": "primary" if lang in PRIMARY_LANGUAGES else "shallow",
            }
        )
    primary = [b["language"] for b in breakdown if b["depth"] == "primary"]
    shallow = [b["language"] for b in breakdown if b["depth"] == "shallow"]
    return {"primary": primary, "breakdown": breakdown, "shallow": shallow}


def _load_tree_sitter_parsers() -> dict[str, Any]:
    parsers: dict[str, Any] = {}
    try:
        from tree_sitter import Language, Parser
        import tree_sitter_python
        import tree_sitter_javascript
        import tree_sitter_java

        lang_py = Language(tree_sitter_python.language())
        lang_js = Language(tree_sitter_javascript.language())
        lang_java = Language(tree_sitter_java.language())

        for name, lang in [
            ("python", lang_py),
            ("javascript", lang_js),
            ("typescript", lang_js),
            ("java", lang_java),
        ]:
            p = Parser(lang)
            parsers[name] = p
    except Exception:
        pass
    return parsers


def parse_source_files(
    files: list[RepoFile], on_progress: Optional[Callable[[str], None]] = None
) -> dict:
    parsers = _load_tree_sitter_parsers()
    parsed = 0
    errors = 0
    by_lang: dict[str, int] = defaultdict(int)

    for f in files:
        if f.language not in PRIMARY_LANGUAGES:
            continue
        parser = parsers.get(f.language)
        if not parser:
            continue
        try:
            source = Path(f.abs_path).read_bytes()
            parser.parse(source)
            parsed += 1
            by_lang[f.language] += 1
        except Exception:
            errors += 1
        if on_progress and parsed % 50 == 0:
            on_progress(f"Parsed {parsed} files…")

    return {
        "parsed_files": parsed,
        "parse_errors": errors,
        "by_language": dict(by_lang),
    }


def extract_endpoints(files: list[RepoFile]) -> dict:
    items: list[dict] = []
    frameworks: set[str] = set()

    for f in files:
        if f.language not in ("python", "javascript", "typescript", "java"):
            continue
        try:
            content = Path(f.abs_path).read_text(encoding="utf-8", errors="ignore")
        except OSError:
            continue
        for framework, pattern in ENDPOINT_PATTERNS:
            for match in pattern.finditer(content):
                groups = match.groups()
                if framework == "spring":
                    method, path = "GET", groups[0]
                elif framework == "flask":
                    method, path = "GET", groups[0]
                elif len(groups) >= 2:
                    method, path = groups[0].upper(), groups[1]
                else:
                    continue
                line = content[: match.start()].count("\n") + 1
                items.append(
                    {
                        "method": method,
                        "path": path,
                        "file": f.rel_path,
                        "line": line,
                        "framework": framework,
                    }
                )
                frameworks.add(framework)

    # Deduplicate by method+path
    seen = set()
    unique = []
    for ep in items:
        key = (ep["method"], ep["path"])
        if key not in seen:
            seen.add(key)
            unique.append(ep)

    return {
        "count": len(unique),
        "items": unique[:200],
        "frameworks": sorted(frameworks),
    }


def compute_complexity(files: list[RepoFile]) -> dict:
    total_lines = sum(f.lines for f in files)
    by_lang: dict[str, dict] = defaultdict(lambda: {"files": 0, "lines": 0})
    for f in files:
        if f.language:
            by_lang[f.language]["files"] += 1
            by_lang[f.language]["lines"] += f.lines

    largest = sorted(files, key=lambda x: x.lines, reverse=True)[:10]

    metrics = [
        {"file_path": f.rel_path, "loc": f.lines, "complexity": f.complexity}
        for f in files
    ]

    return {
        "total_files": len(files),
        "total_lines": total_lines,
        "largest_files": [
            {"path": f.rel_path, "lines": f.lines, "language": f.language}
            for f in largest
            if f.lines > 0
        ],
        "by_language": dict(by_lang),
        "complexity_metrics": metrics,
    }


def build_file_contents_json(files: list[RepoFile]) -> dict[str, str]:
    """Build a {rel_path: content} dict from RepoFiles.

    Capped at MAX_FILE_CONTENTS_FILES, MAX_FILE_CONTENT_BYTES per file.
    Primary-language files sorted by line count (most first).
    """
    candidates = [
        f for f in files
        if f.language and f.content
        and len(f.content.encode("utf-8")) <= MAX_FILE_CONTENT_BYTES
    ]
    candidates.sort(key=lambda f: (0 if f.language in PRIMARY_LANGUAGES else 1, -f.lines))
    result: dict[str, str] = {}
    for f in candidates[:MAX_FILE_CONTENTS_FILES]:
        result[f.rel_path] = f.content
    return result


def run_static_analysis(
    root_path: str,
    on_step_detail: Optional[Callable[[str], None]] = None,
) -> AnalysisArtifacts:
    files = collect_repo_files(root_path)
    if on_step_detail:
        on_step_detail(f"Found {len(files)} files")

    file_tree = build_file_tree(files)
    languages = detect_languages(files)

    parse_stats = parse_source_files(
        files,
        on_progress=on_step_detail,
    )
    endpoints = extract_endpoints(files)
    complexity = compute_complexity(files)
    complexity["parse_stats"] = parse_stats
    dependencies = extract_dependencies(files)

    return AnalysisArtifacts(
        file_tree_json=file_tree,
        languages_json=languages,
        endpoints_json=endpoints,
        complexity_json=complexity,
        dependencies_json=dependencies,
        files=files,
    )


# ── Async DB operations ─────────────────────────────────────────

async def update_analysis_step(
    analysis_id: int,
    step_num: int,
    step_name: str,
    *,
    status: AnalysisStatus | None = None,
    step_detail: str | None = None,
    error: str | None = None,
    artifacts: AnalysisArtifacts | None = None,
    outline_json: list | None = None,
    outline_applied: bool | None = None,
    outline_skipped: bool | None = None,
    outline_skip_reason: str | None = None,
    unavailable_facts: list[str] | None = None,
    partial_failures: list[dict] | None = None,
    source_commit: str | None = None,
) -> None:
    async with async_session() as db:
        result = await db.execute(select(Analysis).where(Analysis.id == analysis_id))
        analysis = result.scalar_one_or_none()
        if not analysis:
            return

        analysis.step_number = step_num
        analysis.current_step = step_name
        analysis.total_steps = TOTAL_STEPS
        if step_detail is not None:
            analysis.step_detail = step_detail

        if status:
            analysis.status = status
            if status == AnalysisStatus.RUNNING and not analysis.started_at:
                analysis.started_at = datetime.utcnow()
            elif status in (AnalysisStatus.COMPLETED, AnalysisStatus.FAILED):
                analysis.completed_at = datetime.utcnow()

        if error:
            analysis.error_message = error

        if artifacts:
            analysis.file_tree_json = artifacts.file_tree_json
            analysis.languages_json = artifacts.languages_json
            analysis.endpoints_json = artifacts.endpoints_json
            analysis.complexity_json = artifacts.complexity_json
            analysis.file_contents_json = build_file_contents_json(artifacts.files)
            analysis.analysis_data = build_analysis_data(
                artifacts,
                unavailable_facts=unavailable_facts,
                partial_failures=partial_failures,
            )

        if source_commit is not None:
            analysis.source_commit = source_commit

        if outline_json is not None:
            setattr(analysis, "outline_json", outline_json)
        if outline_applied is not None:
            setattr(analysis, "outline_applied", outline_applied)
        if outline_skipped is not None:
            setattr(analysis, "outline_skipped", outline_skipped)
        if outline_skip_reason is not None:
            setattr(analysis, "outline_skip_reason", outline_skip_reason)

        await db.commit()


def update_analysis_step_sync(
    analysis_id: int,
    step_num: int,
    step_name: str,
    *,
    status: AnalysisStatus | None = None,
    step_detail: str | None = None,
    error: str | None = None,
    artifacts: AnalysisArtifacts | None = None,
    outline_json: list | None = None,
    outline_applied: bool | None = None,
    outline_skipped: bool | None = None,
    outline_skip_reason: str | None = None,
    unavailable_facts: list[str] | None = None,
    partial_failures: list[dict] | None = None,
    source_commit: str | None = None,
) -> None:
    """Synchronous version of update_analysis_step for use in Celery workers."""
    with SessionLocal() as db:
        analysis = db.query(Analysis).filter(Analysis.id == analysis_id).first()
        if not analysis:
            return

        analysis.step_number = step_num
        analysis.current_step = step_name
        analysis.total_steps = TOTAL_STEPS
        if step_detail is not None:
            analysis.step_detail = step_detail

        if status:
            analysis.status = status
            if status == AnalysisStatus.RUNNING and not analysis.started_at:
                analysis.started_at = datetime.utcnow()
            elif status in (AnalysisStatus.COMPLETED, AnalysisStatus.FAILED):
                analysis.completed_at = datetime.utcnow()

        if error:
            analysis.error_message = error

        if artifacts:
            analysis.file_tree_json = artifacts.file_tree_json
            analysis.languages_json = artifacts.languages_json
            analysis.endpoints_json = artifacts.endpoints_json
            analysis.complexity_json = artifacts.complexity_json
            analysis.file_contents_json = build_file_contents_json(artifacts.files)
            analysis.analysis_data = build_analysis_data(
                artifacts,
                unavailable_facts=unavailable_facts,
                partial_failures=partial_failures,
            )

        if source_commit is not None:
            analysis.source_commit = source_commit

        if outline_json is not None:
            setattr(analysis, "outline_json", outline_json)
        if outline_applied is not None:
            setattr(analysis, "outline_applied", outline_applied)
        if outline_skipped is not None:
            setattr(analysis, "outline_skipped", outline_skipped)
        if outline_skip_reason is not None:
            setattr(analysis, "outline_skip_reason", outline_skip_reason)

        db.commit()


async def create_analysis_snapshot(
    db: AsyncSession,
    project: Project,
    *,
    source_type: str,
    source_path: str | None = None,
    source_commit: str | None = None,
    source_metadata: dict | None = None,
) -> Analysis:
    analysis = Analysis(
        project_id=project.id,
        status=AnalysisStatus.PENDING,
        source_type=source_type,
        source_path=source_path,
        source_commit=source_commit,
        source_metadata=source_metadata,
        total_steps=TOTAL_STEPS,
        effective_exclusions_json=await get_effective_exclusions(project.id, db),
        is_current=False,
    )
    db.add(analysis)
    await db.flush()
    return analysis


async def mark_analysis_current(db: AsyncSession, analysis: Analysis) -> None:
    await db.execute(
        update(Analysis)
        .where(Analysis.project_id == analysis.project_id)
        .values(is_current=False)
    )
    analysis.is_current = True


def mark_analysis_current_sync(db, analysis: Analysis) -> None:
    db.query(Analysis).filter(Analysis.project_id == analysis.project_id).update(
        {Analysis.is_current: False}
    )
    analysis.is_current = True


def complete_analysis_snapshot_sync(
    analysis_id: int,
    artifacts: AnalysisArtifacts,
    *,
    unavailable_facts: list[str] | None = None,
    partial_failures: list[dict] | None = None,
    source_commit: str | None = None,
) -> None:
    with SessionLocal() as db:
        analysis = db.query(Analysis).filter(Analysis.id == analysis_id).first()
        if not analysis:
            return

        analysis.step_number = 7
        analysis.current_step = STEP_NAMES[7]
        analysis.step_detail = "Saved repository facts"
        analysis.status = AnalysisStatus.COMPLETED
        analysis.completed_at = datetime.utcnow()
        analysis.file_tree_json = artifacts.file_tree_json
        analysis.languages_json = artifacts.languages_json
        analysis.endpoints_json = artifacts.endpoints_json
        analysis.complexity_json = artifacts.complexity_json
        analysis.file_contents_json = build_file_contents_json(artifacts.files)
        analysis.analysis_data = build_analysis_data(
            artifacts,
            unavailable_facts=unavailable_facts,
            partial_failures=partial_failures,
        )
        if source_commit is not None:
            analysis.source_commit = source_commit

        mark_analysis_current_sync(db, analysis)
        project = db.query(Project).filter(Project.id == analysis.project_id).first()
        if project and source_commit:
            project.last_synced_commit = source_commit
        db.commit()


def get_active_credential_sync(user_id: int):
    """Synchronous version of get_active_credential for Celery workers."""
    with SessionLocal() as db:
        credential = db.query(UserAiCredential).filter(
            UserAiCredential.user_id == user_id,
            UserAiCredential.is_active == True,  # noqa: E712
        ).first()
        if not credential:
            return None

        from app.services.ai_credential_service import ActiveCredential
        api_key = crypto_service.decrypt_token(credential.api_key_encrypted)
        return ActiveCredential(
            id=credential.id,
            provider=credential.provider,
            model_id=credential.model_id,
            api_key=api_key,
        )


def _default_template_sections() -> list[dict]:
    return [
        {"heading": heading, "description": "", "order_index": index}
        for index, heading in enumerate(DEFAULT_SECTION_HEADINGS)
    ]


def _normalize_template_sections(raw_sections: list) -> list[dict]:
    normalized = []
    for index, raw_section in enumerate(raw_sections):
        if isinstance(raw_section, dict):
            normalized.append(
                {
                    "heading": raw_section.get("heading", f"Section {index + 1}"),
                    "description": raw_section.get("description", ""),
                    "order_index": index,
                }
            )
        else:
            normalized.append(
                {
                    "heading": str(raw_section),
                    "description": "",
                    "order_index": index,
                }
            )
    return normalized


def _template_sections_from_document_sync(db, document: Document | None) -> list[dict]:
    if document is None or document.template_id is None:
        return _default_template_sections()
    template = db.query(Template).filter(Template.id == document.template_id).first()
    if template and template.sections_json:
        return _normalize_template_sections(template.sections_json)
    return _default_template_sections()


async def _template_sections_from_document_async(
    db: AsyncSession,
    document: Document | None,
) -> list[dict]:
    if document is None or document.template_id is None:
        return _default_template_sections()
    template = await db.get(Template, document.template_id)
    if template and template.sections_json:
        return _normalize_template_sections(template.sections_json)
    return _default_template_sections()


def get_template_sections_for_project_sync(project_id: int) -> list[dict]:
    """Temporary legacy adapter for project-scoped outline generation workers."""
    with SessionLocal() as db:
        document = (
            db.query(Document)
            .filter(Document.project_id == project_id)
            .order_by(Document.updated_at.desc(), Document.id.desc())
            .first()
        )
        return _template_sections_from_document_sync(db, document)


def sections_are_untouched_sync(project_id: int) -> bool:
    """Synchronous version of sections_are_untouched for Celery workers."""
    with SessionLocal() as db:
        doc = db.query(Document).filter(Document.project_id == project_id).first()
        if not doc:
            return True
        sections = db.query(Section).filter(Section.document_id == doc.id).all()
        if not sections:
            return True
        for s in sections:
            if s.status != SectionStatus.PENDING:
                return False
            if (s.content_md or "").strip():
                return False
        return True


def apply_outline_to_document_sync(project_id: int, outline: list[dict]) -> None:
    """Synchronous version of apply_outline_to_document for Celery workers."""
    with SessionLocal() as db:
        doc = db.query(Document).filter(Document.project_id == project_id).first()
        if not doc:
            doc = Document(project_id=project_id, title="Documentation")
            db.add(doc)
            db.flush()

        db.query(Section).filter(Section.document_id == doc.id).delete()
        for item in outline:
            db.add(
                Section(
                    document_id=doc.id,
                    order_index=int(item.get("order_index", 0)),
                    heading=str(item["heading"]),
                    content_md="",
                    status=SectionStatus.PENDING,
                )
            )
        db.commit()


def run_outline_step_sync(
    project_id: int,
    analysis_id: int,
    artifacts: AnalysisArtifacts,
) -> list[dict]:
    """Synchronous version of run_outline_step for Celery workers."""
    with SessionLocal() as db:
        project = db.query(Project).filter(Project.id == project_id).first()
        if not project:
            raise ValueError(f"Project {project_id} not found")

        owner_id = project.created_by

    credential = get_active_credential_sync(owner_id)
    template_sections = get_template_sections_for_project_sync(project_id)

    if not credential:
        update_analysis_step_sync(
            analysis_id,
            8,
            STEP_NAMES[8],
            status=AnalysisStatus.COMPLETED,
            step_detail="Add an API key in Settings to generate documentation outline",
            outline_skipped=True,
            outline_skip_reason="no_ai_credential",
            outline_applied=False,
        )
        return []

    outline = generate_outline_with_ai(
        credential.provider,
        credential.api_key,
        credential.model_id,
        template_sections,
        artifacts,
    )
    update_analysis_step_sync(
        analysis_id,
        8,
        STEP_NAMES[8],
        outline_json=outline,
    )

    auto_apply = False
    if sections_are_untouched_sync(project_id):
        apply_outline_to_document_sync(project_id, outline)
        auto_apply = True

    update_analysis_step_sync(
        analysis_id,
        8,
        STEP_NAMES[8],
        status=AnalysisStatus.COMPLETED,
        outline_applied=auto_apply,
        outline_skipped=False,
        outline_skip_reason=None,
    )
    return outline


async def get_template_sections_for_project(project_id: int, db: AsyncSession) -> list[dict]:
    # Temporary legacy adapter for project-scoped analysis routes.
    # Active template ownership is document-scoped; this falls back to the most
    # recently updated document until the legacy project-level outline flow is removed.
    result = await db.execute(
        select(Document)
        .where(Document.project_id == project_id)
        .order_by(Document.updated_at.desc(), Document.id.desc())
    )
    document = result.scalar_one_or_none()
    return await _template_sections_from_document_async(db, document)


def generate_outline_with_ai(
    credential_provider: str,
    api_key: str,
    model_id: str,
    template_sections: list[dict],
    artifacts: AnalysisArtifacts,
) -> list[dict]:
    langs = artifacts.languages_json.get("breakdown", [])
    languages_summary = ", ".join(
        f"{x['language']} ({x['percent']}%)" for x in langs[:8]
    ) or "unknown"
    endpoint_count = artifacts.endpoints_json.get("count", 0)
    frameworks = ", ".join(artifacts.endpoints_json.get("frameworks", []))
    file_count = artifacts.complexity_json.get("total_files", 0)
    largest = artifacts.complexity_json.get("largest_files", [])
    complexity_notes = (
        f"Largest file: {largest[0]['path']} ({largest[0]['lines']} lines)"
        if largest
        else ""
    )

    user_msg = build_outline_user_message(
        template_sections,
        languages_summary,
        endpoint_count,
        frameworks,
        file_count,
        complexity_notes,
    )
    text = ai_service.complete_text(
        OUTLINE_SYSTEM,
        user_msg,
        credential_provider,
        api_key,
        model_id,
    )
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?\n?", "", text)
        text = re.sub(r"\n?```$", "", text)
    outline = json.loads(text)
    if not isinstance(outline, list):
        raise ValueError("Outline response is not a JSON array")
    normalized = []
    for i, item in enumerate(outline):
        if isinstance(item, dict) and item.get("heading"):
            normalized.append(
                {
                    "heading": str(item["heading"]),
                    "description": str(item.get("description") or ""),
                    "order_index": int(item.get("order_index", i)),
                }
            )
    return sorted(normalized, key=lambda x: x["order_index"])


async def sections_are_untouched(project_id: int, db: AsyncSession) -> bool:
    doc_result = await db.execute(
        select(Document).where(Document.project_id == project_id)
    )
    doc = doc_result.scalar_one_or_none()
    if not doc:
        return True
    sec_result = await db.execute(select(Section).where(Section.document_id == doc.id))
    sections = sec_result.scalars().all()
    if not sections:
        return True
    for s in sections:
        if s.status != SectionStatus.PENDING:
            return False
        if (s.content_md or "").strip():
            return False
    return True


async def apply_outline_to_document(
    project_id: int,
    outline: list[dict],
    *,
    db: AsyncSession | None = None,
) -> None:
    async def _apply(session: AsyncSession) -> None:
        doc_result = await session.execute(
            select(Document).where(Document.project_id == project_id)
        )
        doc = doc_result.scalar_one_or_none()
        if not doc:
            doc = Document(project_id=project_id, title="Documentation")
            session.add(doc)
            await session.flush()

        await session.execute(delete(Section).where(Section.document_id == doc.id))
        for item in outline:
            session.add(
                Section(
                    document_id=doc.id,
                    order_index=int(item.get("order_index", 0)),
                    heading=str(item["heading"]),
                    content_md="",
                    status=SectionStatus.PENDING,
                )
            )
        await session.commit()

    if db:
        await _apply(db)
    else:
        async with async_session() as session:
            await _apply(session)


async def run_outline_step(
    project_id: int,
    analysis_id: int,
    artifacts: AnalysisArtifacts,
) -> list[dict]:
    async with async_session() as db:
        project = await db.get(Project, project_id)
        if not project:
            raise ValueError(f"Project {project_id} not found")

        credential = await get_active_credential(db, project.created_by)
        template_sections = await get_template_sections_for_project(project_id, db)

    if not credential:
        await update_analysis_step(
            analysis_id,
            8,
            STEP_NAMES[8],
            status=AnalysisStatus.COMPLETED,
            step_detail="Add an API key in Settings to generate documentation outline",
            outline_skipped=True,
            outline_skip_reason="no_ai_credential",
            outline_applied=False,
        )
        return []

    outline = generate_outline_with_ai(
        credential.provider,
        credential.api_key,
        credential.model_id,
        template_sections,
        artifacts,
    )
    await update_analysis_step(
        analysis_id,
        8,
        STEP_NAMES[8],
        outline_json=outline,
    )

    auto_apply = False
    async with async_session() as db:
        if await sections_are_untouched(project_id, db):
            await apply_outline_to_document(project_id, outline, db=db)
            auto_apply = True

    await update_analysis_step(
        analysis_id,
        8,
        STEP_NAMES[8],
        status=AnalysisStatus.COMPLETED,
        outline_applied=auto_apply,
        outline_skipped=False,
        outline_skip_reason=None,
    )
    return outline


def build_steps_payload(
    step_number: int,
    status: AnalysisStatus,
    failed_step: int | None = None,
    outline_skipped: bool = False,
) -> list[dict]:
    steps = []
    for num in range(1, TOTAL_STEPS + 1):
        name = STEP_NAMES[num]
        if status == AnalysisStatus.PENDING:
            st = "pending"
        elif status == AnalysisStatus.FAILED:
            if num < (failed_step or step_number):
                st = "done"
            elif num == (failed_step or step_number):
                st = "failed"
            else:
                st = "pending"
        elif status == AnalysisStatus.COMPLETED:
            if outline_skipped and num == 8:
                st = "skipped"
            else:
                st = "done"
        elif num < step_number:
            st = "done"
        elif num == step_number:
            st = "running"
        else:
            st = "pending"
        steps.append({"number": num, "name": name, "status": st})
    return steps


def elapsed_seconds(analysis: Analysis) -> int | None:
    if not analysis.started_at:
        return None
    end = analysis.completed_at or datetime.utcnow()
    return int((end - analysis.started_at).total_seconds())


async def get_latest_analysis(project_id: int, db: AsyncSession) -> Analysis | None:
    current_result = await db.execute(
        select(Analysis)
        .where(Analysis.project_id == project_id, Analysis.is_current == True)  # noqa: E712
        .order_by(Analysis.created_at.desc())
        .limit(1)
    )
    current = current_result.scalar_one_or_none()
    if current:
        return current
    result = await db.execute(
        select(Analysis)
        .where(Analysis.project_id == project_id)
        .order_by(Analysis.created_at.desc())
        .limit(1)
    )
    return result.scalar_one_or_none()


async def get_outline_diff(project_id: int, db: AsyncSession) -> dict:
    analysis = await get_latest_analysis(project_id, db)
    outline_json = getattr(analysis, "outline_json", None) if analysis else None
    if not analysis or not outline_json:
        return {"current": [], "proposed": [], "has_changes": False}

    doc_result = await db.execute(
        select(Document)
        .where(Document.project_id == project_id)
        .options(selectinload(Document.sections))
    )
    doc = doc_result.scalar_one_or_none()
    current = []
    if doc:
        for s in sorted(doc.sections, key=lambda x: x.order_index):
            current.append(s.heading)

    proposed = [x["heading"] for x in outline_json]
    has_changes = current != proposed
    return {"current": current, "proposed": proposed, "has_changes": has_changes}
