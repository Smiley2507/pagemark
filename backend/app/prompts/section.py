"""Prompt builder for generating a specific documentation section."""


def build_section_prompt(
    section_heading: str,
    project_context: dict,
    analysis: dict,
) -> str:
    """Return a prompt for generating a documentation section in markdown.

    project_context keys: name, language, framework, tone, audience,
                          key_features, custom_instructions, preferred_terms
    analysis keys: classes, functions, endpoints, dependencies, languages,
                   file_count, complexity_notes
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
    languages = analysis.get("languages", "")
    file_count = analysis.get("file_count", 0)
    complexity_notes = analysis.get("complexity_notes", "")

    lines = [
        f"You are writing technical documentation for a software project.",
        f"",
        f"## Project Context",
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
        f"",
        f"## Codebase Analysis",
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
    if complexity_notes:
        lines.append(f"- **Complexity Notes**: {complexity_notes}")

    lines += [
        f"",
        f"## Task",
        f"Write the **{section_heading}** section of the documentation for {name}.",
        f"Use a {tone} tone appropriate for {audience}.",
    ]
    if custom_instructions:
        lines.append(f"Additional instructions: {custom_instructions}")

    lines += [
        f"",
        f"If you do not have enough business logic or context to document this section accurately, you MUST return a JSON response with the following structure: {{'action': 'ask_user', 'question': '<write a clear, targeted question asking for the missing detail>'}}.",
        f"Otherwise, you MUST return a JSON response with the following structure: {{'content': '<the generated markdown content>', 'confidence_score': <integer 0-100 reflecting how confident you are in the accuracy based on the provided analysis>}}.",
        f"Do not return any text outside the JSON object. No preamble.",
    ]

    return "\n".join(lines)
