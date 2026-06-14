"""Prompt builder for refining an existing documentation section."""


def build_refine_prompt(
    section_heading: str,
    current_content: str,
    instruction: str,
    project_context: dict,
    template_system_prompt: str | None = None,
) -> str:
    """Return a prompt that refines existing section content per user instruction.

    project_context keys: name, language, framework, tone, audience,
                          key_features, custom_instructions, preferred_terms
    template_system_prompt: optional writing instructions from the project's template.
    Returns JSON with either grounded content or a clarification/insufficient-context action.
    """
    name = project_context.get("name", "this project")
    tone = project_context.get("tone", "professional")
    audience = project_context.get("audience", "developers")
    preferred_terms = project_context.get("preferred_terms", "")
    custom_instructions = project_context.get("custom_instructions", "")

    lines = [
        f"You are refining a documentation section for a software project.",
        f"",
        f"## Project Context",
        f"- **Name**: {name}",
        f"- **Tone**: {tone}",
        f"- **Target Audience**: {audience}",
    ]
    if preferred_terms:
        lines.append(f"- **Preferred Terminology**: {preferred_terms}")
    if custom_instructions:
        lines += [
            f"",
            f"## Project Brief",
            custom_instructions,
        ]

    if template_system_prompt:
        lines += [
            f"",
            f"## Template Instructions",
            template_system_prompt,
        ]

    lines += [
        f"",
        f"## Section: {section_heading}",
        f"",
        f"### Current Content",
        f"```markdown",
        current_content,
        f"```",
        f"",
        f"## Refinement Instruction",
        instruction,
        f"",
        f"Apply the instruction above to improve the section content. "
        f"Maintain the {tone} tone appropriate for {audience}.",
        f"",
        f"Only preserve or add claims that are supported by the current content, project brief, template instructions, or the user's refinement instruction.",
        f"Do not invent missing source behavior, commands, APIs, or business rules.",
        f"",
        f"Choose exactly one JSON response shape:",
        f'{{"content": "<the improved section content in markdown>"}}',
        f'{{"action": "ask_user", "question": "<one targeted question asking for missing detail>"}}',
        f'{{"action": "insufficient_context", "reason": "<why the requested refinement is unsupported>"}}',
        f"Return only valid JSON. No preamble.",
    ]

    return "\n".join(lines)
