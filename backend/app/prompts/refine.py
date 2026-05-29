"""Prompt builder for refining an existing documentation section."""


def build_refine_prompt(
    section_heading: str,
    current_content: str,
    instruction: str,
    project_context: dict,
) -> str:
    """Return a prompt that refines existing section content per user instruction.

    project_context keys: name, language, framework, tone, audience,
                          key_features, custom_instructions, preferred_terms
    Returns ONLY the improved content in markdown.
    """
    name = project_context.get("name", "this project")
    tone = project_context.get("tone", "professional")
    audience = project_context.get("audience", "developers")
    preferred_terms = project_context.get("preferred_terms", "")

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
        f"Return only the improved section content in markdown. No preamble.",
    ]

    return "\n".join(lines)
