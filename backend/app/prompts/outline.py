"""Prompt templates for documentation outline generation."""
import json

OUTLINE_SYSTEM = """You adapt documentation outline templates based on codebase analysis facts.
Return ONLY valid JSON: an array of objects with keys: heading (string), description (string, optional), order_index (integer starting at 0).
Rename, reorder, add, or remove sections so the outline fits the repository. Drop sections that do not apply (e.g. API Reference if no HTTP endpoints).
Keep headings concise (title case). Do not write section body content."""

OUTLINE_USER_TEMPLATE = """Template sections (starting outline):
{template_sections}

Codebase analysis summary:
- Languages: {languages_summary}
- Endpoint count: {endpoint_count}
- Notable frameworks detected: {frameworks}
- Total source files: {file_count}
- Complexity notes: {complexity_notes}

Adapt this template into a documentation outline for this project. Return JSON array only."""


def build_outline_user_message(
    template_sections: list,
    languages_summary: str,
    endpoint_count: int,
    frameworks: str,
    file_count: int,
    complexity_notes: str,
) -> str:
    return OUTLINE_USER_TEMPLATE.format(
        template_sections=json.dumps(template_sections, indent=2),
        languages_summary=languages_summary,
        endpoint_count=endpoint_count,
        frameworks=frameworks or "unknown",
        file_count=file_count,
        complexity_notes=complexity_notes or "none",
    )


def build_outline_prompt(
    project_name: str,
    language: str,
    framework: str,
    classes: list,
    functions: list,
    endpoints: list,
    dependencies: list,
) -> str:
    """Return a prompt asking Claude to suggest a documentation outline.

    Claude will return JSON: {"sections": [{"heading": str, "description": str}]}
    """
    class_list = ", ".join(classes[:20]) if classes else "none detected"
    func_list = ", ".join(functions[:20]) if functions else "none detected"
    ep_list = ", ".join(endpoints[:20]) if endpoints else "none detected"
    dep_list = ", ".join(dependencies[:20]) if dependencies else "none detected"

    return f"""You are a technical documentation expert.

Analyze the following codebase facts for the project "{project_name}" and suggest an ideal documentation outline.

## Codebase Facts
- **Primary Language**: {language or "unknown"}
- **Framework**: {framework or "unknown"}
- **Key Classes**: {class_list}
- **Key Functions**: {func_list}
- **API Endpoints**: {ep_list}
- **Dependencies**: {dep_list}

## Task
Suggest a documentation outline with section headings and brief descriptions.
The outline should cover all relevant aspects of the codebase.
Drop sections that clearly do not apply (e.g. "API Reference" if there are no endpoints).

Return ONLY valid JSON in this exact format:
{{"sections": [{{"heading": "string", "description": "string"}}]}}

No preamble, no explanation — only the JSON object."""
