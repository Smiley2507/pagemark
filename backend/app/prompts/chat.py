"""Prompt builder for conversational AI chat about documentation."""

from typing import Any


def build_chat_prompt(
    messages: list,
    current_section_heading: str,
    current_section_content: str,
    project_context: dict,
    analysis_summary: dict,
    template_system_prompt: str | None = None,
) -> tuple[str, list]:
    """Build system prompt and messages list for the Claude API.

    Returns a (system_prompt, messages) tuple.
    - system_prompt: string for the Claude 'system' parameter
    - messages: list of {role, content} dicts including conversation history

    messages input: list of {role: 'user'|'assistant', content: str}
    project_context keys: name, language, framework, tone, audience,
                          key_features, custom_instructions, preferred_terms
    analysis_summary keys: languages, file_count, endpoint_count,
                           frameworks, complexity_notes
    template_system_prompt: optional writing instructions from the project's template.
    """
    name = project_context.get("name", "the project")
    language = project_context.get("language", "")
    framework = project_context.get("framework", "")
    tone = project_context.get("tone", "professional")
    audience = project_context.get("audience", "developers")
    key_features = project_context.get("key_features", "")
    preferred_terms = project_context.get("preferred_terms", "")
    custom_instructions = project_context.get("custom_instructions", "")

    languages = analysis_summary.get("languages", "")
    file_count = analysis_summary.get("file_count", 0)
    endpoint_count = analysis_summary.get("endpoint_count", 0)
    frameworks = analysis_summary.get("frameworks", "")
    complexity_notes = analysis_summary.get("complexity_notes", "")

    system_lines = [
        f"You are a documentation assistant helping write and improve technical documentation "
        f"for a software project called **{name}**.",
        f"",
        f"## Project Details",
    ]
    if language:
        system_lines.append(f"- **Primary Language**: {language}")
    if framework:
        system_lines.append(f"- **Framework**: {framework}")
    if languages:
        system_lines.append(f"- **Detected Languages**: {languages}")
    system_lines.append(f"- **Total Files**: {file_count}")
    if endpoint_count:
        system_lines.append(f"- **API Endpoints**: {endpoint_count}")
    if frameworks:
        system_lines.append(f"- **Frameworks Detected**: {frameworks}")
    if complexity_notes:
        system_lines.append(f"- **Complexity Notes**: {complexity_notes}")
    if key_features:
        system_lines.append(f"- **Key Features**: {key_features}")
    if preferred_terms:
        system_lines.append(f"- **Preferred Terminology**: {preferred_terms}")
    if custom_instructions:
        system_lines += [
            "",
            "## Project Brief",
            custom_instructions,
        ]

    if template_system_prompt:
        system_lines += [
            f"",
            f"## Template Instructions",
            template_system_prompt,
        ]

    system_lines += [
        f"",
        f"## Current Section: {current_section_heading}",
        f"",
        f"The user is currently working on the **{current_section_heading}** section.",
        f"Current content:",
        f"```markdown",
        current_section_content or "(empty)",
        f"```",
        f"",
        f"## Instructions",
        f"- Answer questions about the project and assist with documentation writing.",
        f"- Use a {tone} tone appropriate for {audience}.",
        f"- When generating or editing content, return clean markdown.",
        f"- Be concise and helpful.",
    ]

    system_prompt = "\n".join(system_lines)

    # Map message roles: the DB uses 'ai', Claude uses 'assistant'
    api_messages = []
    for msg in messages:
        role = msg.get("role", "user")
        if role == "ai":
            role = "assistant"
        api_messages.append({"role": role, "content": msg.get("content", "")})

    return system_prompt, api_messages
