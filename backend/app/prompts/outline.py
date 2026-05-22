"""Prompt templates for AdaptTemplate outline generation."""

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
    import json

    return OUTLINE_USER_TEMPLATE.format(
        template_sections=json.dumps(template_sections, indent=2),
        languages_summary=languages_summary,
        endpoint_count=endpoint_count,
        frameworks=frameworks or "unknown",
        file_count=file_count,
        complexity_notes=complexity_notes or "none",
    )
