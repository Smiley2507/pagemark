"""Unit tests for static analysis helpers."""

import tempfile
from pathlib import Path

from app.services.analysis_service import (
    collect_repo_files,
    detect_languages,
    extract_endpoints,
    build_file_tree,
    compute_complexity,
)


def test_detect_languages_and_endpoints_on_sample_repo():
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        (root / "main.py").write_text(
            '''
from fastapi import APIRouter
router = APIRouter()

@router.get("/health")
def health():
    return {"ok": True}
'''
        )
        (root / "app.ts").write_text(
            'import express from "express";\nconst app = express();\napp.get("/api", () => {});\n'
        )
        files = collect_repo_files(str(root))
        assert len(files) >= 2
        langs = detect_languages(files)
        assert any(x["language"] == "python" for x in langs["breakdown"])
        endpoints = extract_endpoints(files)
        assert endpoints["count"] >= 1
        tree = build_file_tree(files)
        assert tree["type"] == "dir"
        complexity = compute_complexity(files)
        assert complexity["total_files"] >= 2
