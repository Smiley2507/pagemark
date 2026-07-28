from app.models.document import Document, Section
from app.models.project import Project, SourceType
from app.models.template import Template
from app.routers.documents import (
    _change_from_editor_action,
    _document_context_block,
    _editor_action_system_prompt,
    _source_context_block,
    _template_context_block,
)


def test_editor_action_prompt_forbids_copy_paste_guidance():
    project = Project(id=1, name="Demo", source_type=SourceType.SCRATCH)
    document = Document(id=10, project_id=1, title="Guide")
    section = Section(id=42, document_id=10, order_index=0, heading="Overview", content_md="Existing")

    prompt = _editor_action_system_prompt(
        project,
        document,
        [section],
        {"languages": "TypeScript", "file_count": 12, "source_files": ["src/App.tsx"]},
    )

    assert "Pagemark's in-editor documentation assistant" in prompt
    assert "Never tell the user to copy and paste into README.md" in prompt
    assert '{"action":"add_section"' in prompt
    assert '{"action":"insert_at_cursor"' in prompt
    assert '{"action":"replace_selection"' in prompt
    assert "42: Overview" in prompt


def test_editor_add_section_action_becomes_reviewable_change():
    document = Document(id=10, project_id=1, title="Guide")
    document.sections = [
        Section(id=42, document_id=10, order_index=0, heading="Overview", content_md="Existing")
    ]

    change = _change_from_editor_action(
        {
            "action": "add_section",
            "title": "Add setup section",
            "heading": "Setup",
            "content_md": "Install with `npm install`.",
            "order_index": 1,
            "rationale": "Setup instructions are missing.",
        },
        document,
        document.sections[0],
    )

    assert change is not None
    assert change.change_type.value == "add_section"
    assert change.after["heading"] == "Setup"
    assert change.after["content_md"] == "Install with `npm install`."
    assert change.preview_markdown == "Install with `npm install`."


def test_document_reference_context_includes_outline_and_section_content():
    document = Document(id=10, project_id=1, title="Guide", purpose="User onboarding", audience="Developers")
    sections = [
        Section(id=42, document_id=10, order_index=0, heading="Overview", content_md="Existing overview"),
        Section(id=43, document_id=10, order_index=1, heading="API", content_md="Endpoint details"),
    ]

    block = _document_context_block(document, sections)

    assert "Attached Document Context" in block
    assert "Purpose: User onboarding" in block
    assert "### Overview\nExisting overview" in block
    assert "### API\nEndpoint details" in block


def test_source_and_template_context_blocks_include_grounding_facts():
    source_block = _source_context_block({
        "languages": "TypeScript",
        "file_count": 8,
        "complexity_notes": "Small app",
        "source_files": ["src/App.tsx"],
        "endpoints": ["/api/health"],
    })
    template_block = _template_context_block(Template(
        name="User Guide",
        purpose="Explain product usage",
        guidance="Use task-oriented sections.",
        sections_json=[{"heading": "Setup"}],
    ))

    assert "Attached Source Analysis" in source_block
    assert "src/App.tsx" in source_block
    assert "/api/health" in source_block
    assert template_block is not None
    assert "Attached Document Template" in template_block
    assert "Use task-oriented sections." in template_block
