from types import SimpleNamespace

from app.models.ai_work import AIProposedChangeStatus, AIProposedChangeType, AIWorkRunStatus
from app.routers.documents import _template_print_profile
from app.schemas.ai_work import AIProposedChangeCreate, AIProposedChangeTypeEnum, AIWorkRunCreateRequest
from app.services.ai_work_service import change_to_response, preview_change, run_to_response


def test_template_print_profile_returns_copy():
    template = SimpleNamespace(recommended_print_profile={"paper_size": "letter"})

    first = _template_print_profile(template)
    second = _template_print_profile(template)

    assert first == {"paper_size": "letter"}
    assert second == {"paper_size": "letter"}
    assert first is not second


def test_ai_work_run_create_request_accepts_typed_changes():
    request = AIWorkRunCreateRequest(
        provider="rule-based",
        model="none",
        prompt_context={"source": "chat"},
        changes=[
            AIProposedChangeCreate(
                change_type=AIProposedChangeTypeEnum.REWRITE_SELECTION,
                title="Rewrite introduction",
                section_id=10,
                after={"content_md": "Draft"},
            )
        ],
    )

    assert request.changes[0].change_type == AIProposedChangeTypeEnum.REWRITE_SELECTION
    assert request.changes[0].after["content_md"] == "Draft"


def test_ai_work_response_helpers_expose_review_state():
    change = SimpleNamespace(
        id=2,
        work_run_id=1,
        document_id=3,
        section_id=4,
        change_type=AIProposedChangeType.REWRITE_SELECTION,
        status=AIProposedChangeStatus.PROPOSED,
        title="Rewrite overview",
        rationale="Tighten wording",
        before_json={"content_md": "Old"},
        after_json={"content_md": "New"},
        preview_markdown="New",
        accepted_by=None,
        accepted_at=None,
        rejected_by=None,
        rejected_at=None,
        undone_at=None,
        created_at=None,
    )
    run = SimpleNamespace(
        id=1,
        document_id=3,
        provider="anthropic",
        model="claude",
        prompt_context={"section_id": 4},
        status=AIWorkRunStatus.PROPOSED,
        estimated_prompt_tokens=100,
        estimated_completion_tokens=50,
        estimated_cost=0.01,
        actual_prompt_tokens=None,
        actual_completion_tokens=None,
        actual_cost=None,
        undo_group=None,
        error_message=None,
        created_by=7,
        proposed_changes=[change],
        created_at=None,
        updated_at=None,
        completed_at=None,
    )

    assert change_to_response(change)["status"] == "proposed"
    assert preview_change(change)["after"]["content_md"] == "New"
    assert run_to_response(run)["proposed_changes"][0]["change_type"] == "rewrite_selection"
