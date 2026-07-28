from types import SimpleNamespace

import pytest
from fastapi import HTTPException

from app.services import template_recommendation_service


def test_parse_adapted_outline_accepts_json_array():
    outline = template_recommendation_service._parse_adapted_outline(
        '[{"heading":"Overview","description":"Summary","order_index":1},{"heading":"Setup","order_index":0}]'
    )

    assert [item["heading"] for item in outline] == ["Setup", "Overview"]
    assert outline[1]["description"] == "Summary"


def test_parse_adapted_outline_rejects_empty_result():
    with pytest.raises(HTTPException) as exc_info:
        template_recommendation_service._parse_adapted_outline('{"sections":[]}')

    assert exc_info.value.status_code == 502


@pytest.mark.anyio
async def test_adapt_template_outline_uses_active_provider(monkeypatch):
    document = SimpleNamespace(project_id=10)
    template = SimpleNamespace(
        id=5,
        outline_preview=[
            {"heading": "Overview", "description": "Original overview"},
            {"heading": "API Reference", "description": "Original API"},
        ],
        sections_json=None,
    )
    analysis = SimpleNamespace(
        id=7,
        languages_json={"python": {"files": 4}},
        endpoints_json=[{"path": "/projects", "framework": "fastapi"}],
        file_tree_json={"total_files": 12},
        complexity_json={"summary": "moderate service"},
        analysis_data={},
    )
    credential = SimpleNamespace(
        id=2,
        provider="openai",
        api_key="test-key",
        model_id="gpt-5",
    )
    calls = {}

    async def fake_active(_db, _user_id):
        return credential

    async def fake_analysis(_db, _project_id):
        return analysis

    def fake_complete(system, user, provider, api_key, model_id, *, max_tokens):
        calls.update(
            {
                "system": system,
                "user": user,
                "provider": provider,
                "api_key": api_key,
                "model_id": model_id,
                "max_tokens": max_tokens,
            }
        )
        return '{"sections":[{"heading":"FastAPI Service Overview","order_index":0}]}'

    monkeypatch.setattr(template_recommendation_service, "get_active_credential", fake_active)
    monkeypatch.setattr(template_recommendation_service, "get_current_analysis", fake_analysis)
    monkeypatch.setattr(template_recommendation_service, "complete_text", fake_complete)

    outline, metadata = await template_recommendation_service.adapt_template_outline(
        None,
        document,
        template,
        user_id=42,
    )

    assert outline[0]["heading"] == "FastAPI Service Overview"
    assert metadata["provider_usage_ref"]["provider"] == "openai"
    assert metadata["provider_usage_ref"]["model"] == "gpt-5"
    assert calls["provider"] == "openai"
    assert calls["api_key"] == "test-key"
    assert "fastapi" in calls["user"].lower()
