"""Unit tests for static analysis helpers."""

import tempfile
from pathlib import Path

from app.services.analysis_service import (
    AnalysisArtifacts,
    collect_repo_files,
    detect_languages,
    extract_endpoints,
    build_file_tree,
    compute_complexity,
    build_analysis_data,
)
from app.models.analysis import Analysis, AnalysisStatus
from app.schemas.analysis import analysis_to_full_response


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


def test_partial_analysis_response_preserves_available_facts_and_discloses_missing():
    artifacts = AnalysisArtifacts(
        file_tree_json={"name": "/", "type": "dir", "children": [{"name": "main.py"}]},
        languages_json={"primary": ["python"], "breakdown": [{"language": "python"}]},
        endpoints_json={"count": 1, "items": [{"path": "/health"}], "frameworks": ["fastapi"]},
        complexity_json={"total_files": 1, "total_lines": 8, "complexity_metrics": []},
        dependencies_json=[],
    )
    analysis = Analysis(
        id=1,
        project_id=10,
        status=AnalysisStatus.COMPLETED,
        source_type="zip",
        is_current=True,
        effective_exclusions_json=[{"pattern": "node_modules/**"}],
        file_tree_json=artifacts.file_tree_json,
        languages_json=artifacts.languages_json,
        endpoints_json=artifacts.endpoints_json,
        complexity_json=artifacts.complexity_json,
        analysis_data=build_analysis_data(
            artifacts,
            unavailable_facts=["dependencies"],
            partial_failures=[
                {
                    "fact": "dependencies",
                    "reason": "Dependency parser unavailable for this source",
                }
            ],
        ),
    )

    response = analysis_to_full_response(analysis)

    assert response.status == "completed"
    assert response.is_current is True
    assert response.sync_supported is False
    assert response.languages_json == artifacts.languages_json
    assert response.endpoints_json == artifacts.endpoints_json
    assert response.facts["stack_languages"]["available"] is True
    assert response.facts["endpoints"]["available"] is True
    assert response.facts["dependencies"]["available"] is False
    assert response.unavailable_facts == ["dependencies"]
    assert response.partial_failures[0]["reason"] == "Dependency parser unavailable for this source"
