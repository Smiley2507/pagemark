"""Prompt builder for generating a specific documentation section."""


def build_section_prompt(
    section_heading: str,
    project_context: dict,
    analysis: dict,
    user_clarification: str | None = None,
    template_system_prompt: str | None = None,
    section_guidance: str | None = None,
    expected_sources: list[str] | None = None,
) -> str:
    """Return a prompt for generating a documentation section in markdown.

    project_context keys: name, language, framework, tone, audience,
                          key_features, custom_instructions, preferred_terms
    analysis keys: classes, functions, endpoints, dependencies, languages,
                   file_count, complexity_notes
    template_system_prompt: optional writing instructions from the project's template.
    section_guidance: per-section guidance from the template on what to include.
    expected_sources: per-section source path hints for evidence.
    """
    name = project_context.get("name", "this project")
    language = project_context.get("language", "")
    framework = project_context.get("framework", "")
    tone = project_context.get("tone", "professional")
    audience = project_context.get("audience", "developers")
    key_features = project_context.get("key_features", "")
    custom_instructions = project_context.get("custom_instructions", "")
    preferred_terms = project_context.get("preferred_terms", "")

    classes = analysis.get("classes", [])
    functions = analysis.get("functions", [])
    endpoints = analysis.get("endpoints", [])
    dependencies = analysis.get("dependencies", [])
    source_files = analysis.get("source_files", [])
    languages = analysis.get("languages", "")
    file_count = analysis.get("file_count", 0)
    complexity_notes = analysis.get("complexity_notes", "")

    lines = [
        "You are writing technical documentation for a software project.",
        "",
        "## Project Context",
        f"- **Name**: {name}",
    ]
    if language:
        lines.append(f"- **Primary Language**: {language}")
    if framework:
        lines.append(f"- **Framework**: {framework}")
    if languages:
        lines.append(f"- **Detected Languages**: {languages}")
    lines.append(f"- **Tone**: {tone}")
    lines.append(f"- **Target Audience**: {audience}")
    if key_features:
        lines.append(f"- **Key Features**: {key_features}")
    if preferred_terms:
        lines.append(f"- **Preferred Terminology**: {preferred_terms}")

    lines += [
        "",
        "## Codebase Analysis",
        f"- **Total Source Files**: {file_count}",
    ]
    if classes:
        class_list = ", ".join(classes[:20]) if isinstance(classes, list) else str(classes)
        lines.append(f"- **Key Classes**: {class_list}")
    if functions:
        func_list = ", ".join(functions[:20]) if isinstance(functions, list) else str(functions)
        lines.append(f"- **Key Functions**: {func_list}")
    if endpoints:
        ep_list = ", ".join(endpoints[:20]) if isinstance(endpoints, list) else str(endpoints)
        lines.append(f"- **API Endpoints**: {ep_list}")
    if dependencies:
        dep_list = ", ".join(dependencies[:20]) if isinstance(dependencies, list) else str(dependencies)
        lines.append(f"- **Dependencies**: {dep_list}")
    if source_files:
        file_list = ", ".join(source_files[:20]) if isinstance(source_files, list) else str(source_files)
        lines.append(f"- **Source Files**: {file_list}")
    if complexity_notes:
        lines.append(f"- **Complexity Notes**: {complexity_notes}")

    if template_system_prompt:
        lines += [
            "",
            "## Template Instructions",
            template_system_prompt,
        ]

    if section_guidance:
        lines += [
            "",
            "## Section Guidance",
            section_guidance,
        ]

    if expected_sources:
        srcs = ", ".join(expected_sources)
        lines += [
            "",
            "## Expected Source Evidence",
            f"Ground the content in these source paths when available: {srcs}",
        ]

    lines += [
        "",
        "## Task",
        f"Write the **{section_heading}** section of the documentation for {name}.",
        f"Use a {tone} tone appropriate for {audience}.",
        "Be specific to this project. Prefer concrete files, APIs, commands, components, and observed source facts over generic best practices.",
        "If source evidence is thin, provide the best grounded draft you can and clearly mark the assumptions. Ask one targeted question only if a single missing fact blocks the section.",
        "Do not invent product behavior, API semantics, deployment details, security guarantees, or business rules that are not supported by the Project Context, user clarification, template guidance, or Codebase Analysis.",
        "Use concise Markdown with useful headings, lists, code blocks, and examples only when they add real clarity.",
    ]
    if custom_instructions:
        lines.append(f"Additional instructions: {custom_instructions}")
    if user_clarification:
        lines += [
            "",
            "## User Clarification",
            "The user provided the following additional context to help you write this section:",
            f"{user_clarification}",
        ]

    lines += [
        "",
        "Choose exactly one JSON response shape:",
        '{"content": "<grounded markdown content>", "confidence_score": <integer 0-100 reflecting confidence based on provided evidence>}',
        '{"action": "ask_user", "question": "<one targeted question asking for the missing detail>"}',
        "Use 'ask_user' when a specific answer would unblock the section.",
        "Do not return any text outside the JSON object. No preamble.",
    ]

    return "\n".join(lines)
