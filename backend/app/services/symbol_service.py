"""Symbol index service — extracts symbols from file contents via regex.

Used to resolve @SymbolName references in the AI context picker.
Built on demand from Analysis.file_contents_json, cached in-memory with TTL.
"""

import logging
import re
import time
from dataclasses import dataclass, field
from typing import Optional

logger = logging.getLogger(__name__)

# ── Data model ────────────────────────────────────────────────────


@dataclass
class Symbol:
    name: str
    kind: str       # class, function, interface, type, enum, method
    file_path: str
    line: int
    language: str


# ── Language-specific patterns ────────────────────────────────────
# Each entry: (kind, compiled_regex)
# Group 1 must be the symbol name.

_M = re.MULTILINE

_LANG_PATTERNS: dict[str, list[tuple[str, re.Pattern]]] = {
    "python": [
        ("class", re.compile(r"^\s*class\s+(\w+)", _M)),
        ("function", re.compile(r"^\s*async\s+def\s+(\w+)", _M)),
        ("function", re.compile(r"^\s*def\s+(\w+)", _M)),
    ],
    "typescript": [
        ("class", re.compile(r"^\s*(?:export\s+)?(?:default\s+)?class\s+(\w+)", _M)),
        ("interface", re.compile(r"^\s*(?:export\s+)?(?:default\s+)?interface\s+(\w+)", _M)),
        ("type", re.compile(r"^\s*(?:export\s+)?type\s+(\w+)", _M)),
        ("enum", re.compile(r"^\s*(?:export\s+)?enum\s+(\w+)", _M)),
        ("function", re.compile(r"^\s*(?:export\s+)?(?:default\s+)?function\s+(\w+)", _M)),
    ],
    "javascript": [
        ("class", re.compile(r"^\s*(?:export\s+)?(?:default\s+)?class\s+(\w+)", _M)),
        ("function", re.compile(r"^\s*(?:export\s+)?(?:default\s+)?function\s+(\w+)", _M)),
    ],
    "java": [
        ("class", re.compile(r"^\s*(?:public|private|protected)?\s*class\s+(\w+)", _M)),
        ("interface", re.compile(r"^\s*(?:public|private|protected)?\s*interface\s+(\w+)", _M)),
        ("enum", re.compile(r"^\s*(?:public|private|protected)?\s*enum\s+(\w+)", _M)),
    ],
    "go": [
        ("function", re.compile(r"^\s*func\s+(\w+)", _M)),
        ("type", re.compile(r"^\s*type\s+(\w+)\s", _M)),
    ],
    "rust": [
        ("function", re.compile(r"^\s*(?:pub\s+)?(?:unsafe\s+)?fn\s+(\w+)", _M)),
        ("struct", re.compile(r"^\s*(?:pub\s+)?struct\s+(\w+)", _M)),
        ("enum", re.compile(r"^\s*(?:pub\s+)?enum\s+(\w+)", _M)),
        ("trait", re.compile(r"^\s*(?:pub\s+)?trait\s+(\w+)", _M)),
        ("type", re.compile(r"^\s*(?:pub\s+)?type\s+(\w+)", _M)),
    ],
    "ruby": [
        ("class", re.compile(r"^\s*class\s+(\w+)", _M)),
        ("module", re.compile(r"^\s*module\s+(\w+)", _M)),
        ("function", re.compile(r"^\s*def\s+(\w+)", _M)),
    ],
    "csharp": [
        ("class", re.compile(r"^\s*(?:public|private|protected|internal)?\s*(?:static\s+)?class\s+(\w+)", _M)),
        ("interface", re.compile(r"^\s*(?:public|private|protected|internal)?\s*interface\s+(\w+)", _M)),
        ("enum", re.compile(r"^\s*(?:public|private|protected|internal)?\s*enum\s+(\w+)", _M)),
        ("struct", re.compile(r"^\s*(?:public|private|protected|internal)?\s*struct\s+(\w+)", _M)),
    ],
    "swift": [
        ("class", re.compile(r"^\s*(?:public|private|internal)?\s*(?:final\s+)?class\s+(\w+)", _M)),
        ("struct", re.compile(r"^\s*(?:public|private|internal)?\s*struct\s+(\w+)", _M)),
        ("enum", re.compile(r"^\s*(?:public|private|internal)?\s*enum\s+(\w+)", _M)),
        ("protocol", re.compile(r"^\s*(?:public|private|internal)?\s*protocol\s+(\w+)", _M)),
        ("function", re.compile(r"^\s*func\s+(\w+)", _M)),
    ],
    "kotlin": [
        ("class", re.compile(r"^\s*(?:data\s+)?class\s+(\w+)", _M)),
        ("interface", re.compile(r"^\s*interface\s+(\w+)", _M)),
        ("object", re.compile(r"^\s*object\s+(\w+)", _M)),
        ("function", re.compile(r"^\s*fun\s+(\w+)", _M)),
    ],
}

# ── In-memory cache ───────────────────────────────────────────────
# Key: analysis_id, Value: (timestamp, list[Symbol])
_cache: dict[int, tuple[float, list[Symbol]]] = {}
_CACHE_TTL = 3600  # 1 hour


def _infer_language(file_path: str) -> Optional[str]:
    ext = file_path.rsplit(".", 1)[-1].lower() if "." in file_path else ""
    ext_map = {
        "py": "python",
        "ts": "typescript",
        "tsx": "typescript",
        "js": "javascript",
        "jsx": "javascript",
        "java": "java",
        "go": "go",
        "rs": "rust",
        "rb": "ruby",
        "cs": "csharp",
        "swift": "swift",
        "kt": "kotlin",
    }
    return ext_map.get(ext)


def build_symbol_index(analysis_id: int, file_contents: dict[str, str]) -> list[Symbol]:
    """Scan file_contents dict and extract all symbols.

    Args:
        analysis_id: Analysis ID (for cache key).
        file_contents: {rel_path: content} dict from Analysis.file_contents_json.

    Returns:
        Sorted list of Symbol (by file_path, then line).
    """
    symbols: list[Symbol] = []

    for file_path, content in file_contents.items():
        language = _infer_language(file_path)
        if not language or language not in _LANG_PATTERNS:
            continue

        patterns = _LANG_PATTERNS[language]
        for kind, pattern in patterns:
            for m in pattern.finditer(content):
                line_num = content[: m.start()].count("\n") + 1
                symbols.append(Symbol(
                    name=m.group(1),
                    kind=kind,
                    file_path=file_path,
                    line=line_num,
                    language=language,
                ))

    symbols.sort(key=lambda s: (s.file_path, s.line))

    # Update cache
    _cache[analysis_id] = (time.time(), symbols)

    logger.info("Built symbol index for analysis %d: %d symbols", analysis_id, len(symbols))
    return symbols


def get_symbol_index(analysis_id: int, file_contents: dict[str, str]) -> list[Symbol]:
    """Return cached symbol index, or build + cache if missing/stale."""
    entry = _cache.get(analysis_id)
    if entry and (time.time() - entry[0]) < _CACHE_TTL:
        return entry[1]
    return build_symbol_index(analysis_id, file_contents)


def search_symbols(
    analysis_id: int,
    file_contents: dict[str, str],
    query: str,
    *,
    max_results: int = 20,
) -> list[Symbol]:
    """Search cached symbol index by name (case-insensitive substring match)."""
    if not query:
        return []
    index = get_symbol_index(analysis_id, file_contents)
    q = query.lower()
    results = [s for s in index if q in s.name.lower()]
    return results[:max_results]


def clear_cache(analysis_id: int | None = None) -> None:
    """Clear symbol index cache for one analysis or all."""
    if analysis_id is not None:
        _cache.pop(analysis_id, None)
    else:
        _cache.clear()
