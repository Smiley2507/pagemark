from __future__ import annotations

import json
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.exceptions import NeedsClarificationException
from app.models.analysis import AnalysisStatus
from app.models.project import SourceType
from app.routers.projects import _build_ai_context_response
from app.services.ai_doc_service import AIService

pytestmark = pytest.mark.anyio


async def test_ai_context_response_returns_project_brief_and_latest_analysis():
    project = MagicMock()
    project.id = 1
    project.name = "Docs API"
    project.description = "Documentation API"
    project.source_type = SourceType.GIT
    project.source_provider = "github"
    project.source_owner = "acme"
    project.source_repository = "docs-api"
    project.selected_branch = "main"
    project.last_synced_commit = "abc123"
    project.source_metadata = {}
    project.context_md = "Use maintainer-approved terminology."

    analysis = MagicMock()
    analysis.id = 42
    analysis.status = AnalysisStatus.COMPLETED
    analysis.source_commit = "abc123"
    analysis.is_current = True
    analysis.completed_at = None
    analysis.source_metadata = {"repo_url": "https://github.com/acme/docs-api"}
    analysis.effective_exclusions_json = None
    analysis.file_tree_json = {"total_files": 2, "files": ["app/main.py", "app/routes.py"]}
    analysis.languages_json = {
        "primary": ["Python"],
        "breakdown": [{"language": "Python", "files": 2, "lines": 120, "percent": 100}],
    }
    analysis.endpoints_json = {
        "count": 1,
        "items": [{"method": "GET", "path": "/health", "file": "app/main.py"}],
        "frameworks": ["fastapi"],
    }
    analysis.complexity_json = {
        "total_files": 2,
        "total_lines": 120,
        "largest_files": [{"path": "app/main.py", "lines": 80}],
    }
    analysis.analysis_data = {
        "dependencies": [{"source": "app/main.py", "target": "fastapi"}],
        "unavailable_facts": ["symbols"],
        "partial_failures": [{"fact": "symbols", "reason": "parser unavailable"}],
    }
    analysis.file_contents_json = {"app/main.py": "from fastapi import FastAPI\napp = FastAPI()\n"}

    response = _build_ai_context_response(
        project,
        analysis,
        [{"pattern": "node_modules/**", "reason": "Generated dependencies", "enabled": True}],
    )
    payload = response.model_dump(mode="json")
    assert payload["project_brief"] == "Use maintainer-approved terminology."
    assert payload["analysis_summary"]["status"] == "completed"
    assert payload["analysis_summary"]["total_files"] == 2
    assert payload["analysis_summary"]["languages"] == ["Python"]
    assert payload["analysis_summary"]["endpoint_count"] == 1
    assert payload["analysis_summary"]["dependency_count"] == 1
    assert payload["facts"]["endpoints"][0]["path"] == "/health"
    assert payload["unavailable_facts"] == ["symbols"]
    assert payload["partial_failures"][0]["fact"] == "symbols"
    assert payload["effective_exclusions"][0]["pattern"] == "node_modules/**"
    assert payload["context_files_preview"][0]["path"] == "app/main.py"


async def test_ai_context_endpoint_handles_scratch_project_without_analysis(client, test_project):
    response = await client.get(f"/projects/{test_project.id}/ai-context")

    assert response.status_code == 200
    payload = response.json()
    assert payload["analysis_summary"]["status"] == "missing"
    assert payload["analysis_summary"]["total_files"] == 0
    assert "No Analysis snapshot is available" in payload["grounding_warnings"][0]


async def test_generate_section_treats_insufficient_context_as_clarification():
    service = AIService()
    mock_project = MagicMock()
    mock_project.id = 1
    mock_project.name = "Test"
    mock_project.description = None
    mock_project.context_md = None

    mock_section = MagicMock()
    mock_section.id = 10
    mock_section.heading = "Deployment"
    mock_section.document_id = 5
    mock_section.workflow_metadata = {}

    mock_document = MagicMock()
    mock_document.id = 5
    mock_document.project_id = 1
    mock_document.template_id = None

    with (
        patch.object(service, "_fetch_project", new=AsyncMock(return_value=mock_project)),
        patch.object(service, "_fetch_section", new=AsyncMock(return_value=mock_section)),
        patch.object(service, "_fetch_document", new=AsyncMock(return_value=mock_document)),
        patch.object(service, "_fetch_latest_analysis", new=AsyncMock(return_value=None)),
        patch.object(service, "_get_template_prompt", new=AsyncMock(return_value=None)),
        patch.object(
            service,
            "_complete_with_active_provider",
            new=AsyncMock(return_value=json.dumps({
                "action": "insufficient_context",
                "reason": "No deployment source facts are available.",
            })),
        ),
    ):
        with pytest.raises(NeedsClarificationException) as exc:
            await service.generate_section(1, 10, MagicMock(), 1)

    assert exc.value.action == "insufficient_context"
    assert "deployment source facts" in exc.value.question


async def test_refine_section_returns_action_without_refined_content():
    service = AIService()
    mock_section = MagicMock()
    mock_section.id = 10
    mock_section.heading = "API"
    mock_section.document_id = 5
    mock_section.content_md = "Existing content"

    mock_document = MagicMock()
    mock_document.id = 5
    mock_document.project_id = 1
    mock_document.template_id = None

    mock_project = MagicMock()
    mock_project.id = 1
    mock_project.name = "Test"
    mock_project.description = None
    mock_project.context_md = None

    with (
        patch.object(service, "_fetch_section", new=AsyncMock(return_value=mock_section)),
        patch.object(service, "_fetch_project", new=AsyncMock(return_value=mock_project)),
        patch.object(service, "_get_template_prompt", new=AsyncMock(return_value=None)),
        patch.object(
            service,
            "_complete_with_active_provider",
            new=AsyncMock(return_value=json.dumps({
                "action": "ask_user",
                "question": "Which auth flow should be documented?",
            })),
        ),
    ):
        db = AsyncMock()
        db.execute.return_value.scalar_one_or_none = MagicMock(return_value=mock_document)
        result = await service.refine_section(10, "Add auth details", db, 1)

    assert result["action"] == "ask_user"
    assert result["refined"] == ""
    assert result["question"] == "Which auth flow should be documented?"
