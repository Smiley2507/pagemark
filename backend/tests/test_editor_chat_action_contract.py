from app.models.document import Document, Section
from app.models.project import Project, SourceType
from app.routers.documents import _change_from_editor_action, _editor_action_system_prompt


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
