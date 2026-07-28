"""Built-in template seed data."""

BUILTIN_TEMPLATES = [
    {
        "name": "API Reference",
        "description": "Comprehensive API documentation template for HTTP and RPC services.",
        "category": "Technical",
        "purpose": "Document every public API surface the project exposes \u2014 HTTP endpoints, RPC methods, WebSocket channels \u2014 so that consumers can integrate correctly without reading implementation code.",
        "intended_audience": "Backend, frontend, and integration developers who need to call the API. They may have no prior knowledge of this project\u2019s internals.",
        "expected_outcome": "A reference document that helps developers call the API correctly on the first try: they can find the right endpoint, understand auth requirements, construct valid requests, parse responses, and handle errors.",
        "compatible_repository_traits": {"requires_endpoints": True, "languages": ["python", "typescript", "javascript", "java"]},
        "estimated_generation_scope": {"sections": 6, "relative_usage": "medium"},
        "guidance": (
            "Write for a developer who has read your README but has never seen the code. "
            "Every endpoint must include the HTTP method, path, required and optional parameters, request body schema, and example response. "
            "Authentication and authorization must be documented before any endpoint listing so the reader can test calls as they go. "
            "Include realistic request/response examples \u2014 use the project\u2019s own test fixtures or API contracts when available. "
            "Do not invent endpoints or parameters. If source analysis found endpoints, ground every documented endpoint in source evidence. "
            "Error codes should map to actual HTTP status codes the API returns, with remediation steps for each. "
            "Rate limiting documentation must include current documented limits, headers to track usage, and retry guidance."
        ),
        "system_prompt": (
            "You are generating an API reference document for a software project. "
            "Use the repository analysis to identify every HTTP or RPC endpoint the project exposes. "
            "For each endpoint, include the HTTP method, path, required and optional parameters, request body schema, and at least one response example. "
            "Do not invent endpoints, parameters, or response fields. "
            "When source evidence is ambiguous, note the uncertainty instead of guessing. "
            "Organize endpoints into logical groups (e.g., Auth, Users, Billing) rather than dumping them in one flat list. "
            "Authentication, error handling, and rate limiting each get their own section before the endpoint reference."
        ),
        "sections_json": [
            {"heading": "Overview", "description": "API overview, base URL, accepted content types, and versioning strategy.", "guidance": "State the base URL(s), supported content types (JSON, form-data, etc.), and how API versioning works (path prefix, header, or query param). Mention any global request ID or tracing headers the project supports.", "expected_sources": ["README.md", "docs/", "openapi.json", "swagger.json"]},
            {"heading": "Authentication", "description": "Every auth method the API accepts: API keys, OAuth2 flows, JWTs, basic auth.", "guidance": "List every authentication method the project supports. For each method, show how to include it in a request (header, cookie, query param). Call out any that are deprecated or only available on certain plans/environments. Include an example of obtaining and using a token for OAuth2 flows.", "expected_sources": ["auth/", "middleware/auth*", "config/auth*"]},
            {"heading": "Endpoints", "description": "Complete endpoint reference grouped by resource or domain.", "guidance": "Group endpoints by resource domain (Users, Orders, etc.). For each endpoint show: HTTP method, full path path with path parameters in curly braces, required and optional query/body parameters with types and descriptions, at least one example request and response. Reference the source file where the route handler is defined so readers can navigate the codebase.", "expected_sources": ["routes/", "controllers/", "api/", "handlers/"]},
            {"heading": "Request & Response Formats", "description": "Shared payload schemas and data types referenced by multiple endpoints.", "guidance": "Document reusable objects and enums that appear in multiple endpoints. Show the full schema with field names, types, constraints (required, nullable, min/max, format), and examples. Omit fields that are internal or server-only. Link back to endpoint sections that use each schema.", "expected_sources": ["models/", "schemas/", "types/", "serializers/"]},
            {"heading": "Error Codes", "description": "Standard error response format and per-endpoint error scenarios.", "guidance": "Describe the standard error response structure (status code, error code, message, request ID). List every error code the API can return, the HTTP status it maps to, and what the caller should do to resolve it. Include both global errors (rate limited, unauthorized) and per-endpoint errors.", "expected_sources": ["middleware/error*", "exceptions/", "errors/"]},
            {"heading": "Rate Limiting", "description": "Request quotas, reset intervals, and retry-after behavior.", "guidance": "Document the rate limit window, maximum requests per window, and which HTTP headers expose current status (X-RateLimit-Remaining, Retry-After, etc.). Describe what happens when a caller exceeds the limit and how to handle 429 responses. Note any per-endpoint or per-user tier differences in rate limits.", "expected_sources": ["middleware/ratelimit*", "config/", "deployment/"]},
        ],
    },
    {
        "name": "SDK Guide",
        "description": "Practical integration guide for developers installing and using the project as a library or SDK.",
        "category": "Developer",
        "purpose": "Teach developers how to install, configure, import, and use the SDK or library effectively so they can integrate it into their own application.",
        "intended_audience": "Application developers who want to consume this project programmatically. They are familiar with the language but new to this package.",
        "expected_outcome": "A practical guide with step-by-step setup instructions, clear configuration examples, explanation of core abstractions, reusable code snippets, and a troubleshooting section for common integration issues.",
        "compatible_repository_traits": {"languages": ["typescript", "javascript", "python", "java"]},
        "estimated_generation_scope": {"sections": 5, "relative_usage": "medium"},
        "guidance": (
            "Write for a developer who has just run `npm install` or `pip install`. "
            "Start with the simplest possible working example \u2014 a \u2018hello world\u2019 that they can copy and run. "
            "Configuration should be documented as concrete code examples, not prose descriptions. "
            "Core concepts must be explained in terms of the source types and classes the developer interacts with, not internal implementation details. "
            "Code examples should compile and run. Use the project\u2019s own test files or examples directory as source evidence. "
            "Troubleshooting must address the most common integration mistakes: wrong imports, missing configuration, version mismatches."
        ),
        "system_prompt": (
            "You are generating an SDK usage guide for a software library. "
            "Analyze the public API surface (exported classes, functions, types, and their signatures) from the repository analysis. "
            "Write examples that a developer can copy, paste, and run without modification \u2014 use the project\u2019s own example files or test fixtures as evidence. "
            "Explain core abstractions in terms of what the developer creates or configures, not how the library implements them internally. "
            "Include setup instructions for the primary supported languages. "
            "Do not invent configuration options that don\u2019t exist in source. If the analysis found configuration schemas or env vars, ground your documentation in those."
        ),
        "sections_json": [
            {"heading": "Getting Started", "description": "Installation command, minimum required runtime version, and a working \u2018hello world\u2019 example.", "guidance": "Show the exact install command for each supported package manager (npm, pip, cargo, etc.). State the minimum language runtime version. Provide a complete, runnable snippet that does something visible \u2014 this should be the simplest possible usage. Include import/require statements.", "expected_sources": ["README.md", "setup.py", "package.json", "Cargo.toml", "examples/"]},
            {"heading": "Configuration", "description": "Every configuration option the SDK accepts: constructor args, env vars, config files.", "guidance": "List every configuration parameter with its name, type, default value, and what it controls. Show code examples for the most common configurations: setting API keys, changing the base URL, configuring timeouts, enabling logging. Group options by concern (auth, networking, logging).", "expected_sources": ["src/config*", "src/client*", "__init__.py", "index.ts"]},
            {"heading": "Core Concepts", "description": "Key classes, interfaces, and patterns the developer must understand to use the SDK.", "guidance": "Document the main class hierarchy and how the pieces fit together. Explain the client lifecycle (create, configure, use, dispose). Cover the core patterns the SDK uses: builders, fluent APIs, callbacks/promises, streaming, pagination. Each concept must link to source evidence showing the actual type or interface.", "expected_sources": ["src/client*", "src/core*", "types/", "interfaces/"]},
            {"heading": "Code Examples", "description": "Reusable code snippets for the most common integration tasks.", "guidance": "Provide 3-5 complete examples covering the most common use cases: creating a resource, reading/listing, updating, deleting, and error handling. Each example should be self-contained with imports, setup, the core logic, and cleanup. Use the project\u2019s own test files or examples directory as source evidence for realistic patterns.", "expected_sources": ["tests/", "examples/", "samples/"]},
            {"heading": "Troubleshooting", "description": "Common errors, their causes, and how to resolve them.", "guidance": "List the most common errors developers encounter when integrating this SDK. For each error, show the error message, explain what causes it (wrong import, missing config, auth failure, version mismatch), and provide the fix. Check the project\u2019s issue tracker for frequently reported integration problems.", "expected_sources": ["README.md", "CONTRIBUTING.md", "issues/", "CHANGELOG.md"]},
        ],
    },
    {
        "name": "User Manual",
        "description": "End-user documentation for product features, workflows, and configuration.",
        "category": "Product",
        "purpose": "Explain how to use the product\u2019s features to accomplish real-world tasks. Focus on the observable product surface, not implementation internals.",
        "intended_audience": "End users and support teams who interact with the product through its UI, CLI, or configuration interface. They may not have a technical background.",
        "expected_outcome": "A task-oriented manual organized by user workflow. Each section answers \u2018how do I do X?\u2019 with step-by-step instructions, screenshots or terminal output, and references to related settings.",
        "compatible_repository_traits": {"languages": ["typescript", "javascript", "python"]},
        "estimated_generation_scope": {"sections": 6, "relative_usage": "medium"},
        "guidance": (
            "Write for a user who has just signed up or installed the product. Do not assume familiarity with the codebase. "
            "Every section should be task-oriented: \u2018How do I create a widget?\u2019 rather than \u2018The Widget object\u2019. "
            "Use step-by-step instructions with explicit UI labels, button names, and navigation paths. "
            "Keep implementation details secondary \u2014 mention them only when they affect the user\u2019s choices (e.g., \u2018this setting takes effect after a restart\u2019). "
            "When source analysis reveals CLI flags, environment variables, or config file options, document them in the Settings section, not inline in feature walkthroughs."
        ),
        "system_prompt": (
            "You are generating a user manual for a software product. "
            "Focus on the observable product surface: UI screens, CLI commands, menu options, settings panels. "
            "Do not describe internal implementation. Every instruction must be something a user can see or click. "
            "Organize by user tasks and workflows, not by code modules. "
            "When the repository contains UI components, CLI argument parsers, or config file schemas, ground your documentation in those \u2014 but always frame it as \u2018what the user sees or does\u2019, not \u2018what the code does\u2019. "
            "Use numbered steps for multi-step workflows."
        ),
        "sections_json": [
            {"heading": "Introduction", "description": "What the product does, who it is for, and what problem it solves.", "guidance": "Describe the product in one sentence. State the target user. List the key capabilities the manual covers. If there are system requirements (OS, browser, runtime), list them here. Link to the getting started section.", "expected_sources": ["README.md", "docs/intro*", "landing page assets"]},
            {"heading": "Getting Started", "description": "First-run experience: installation or sign-up, initial setup, and first task.", "guidance": "Walk through the first-run experience step by step. Cover: creating an account or installing the package, initial configuration or profile setup, and completing a simple first task that demonstrates value. Screenshots or terminal output should be referenced where available.", "expected_sources": ["README.md", "quickstart*", "docs/getting-started*"]},
            {"heading": "Features Guide", "description": "Walkthroughs of each major feature, organized by user workflow.", "guidance": "For each major feature, answer: \u2018What can I do here?\u2019 and \u2018How do I do it?\u2019 Use step-by-step numbered instructions. Reference exact UI labels, button names, and menu paths. Each walkthrough should be self-contained so users can jump to the feature they need.", "expected_sources": ["src/components/", "src/pages/", "docs/features*"]},
            {"heading": "Settings & Preferences", "description": "Every configurable option: UI settings, CLI flags, environment variables, config files.", "guidance": "List every setting the user can change, grouped by category (General, Notifications, Security, etc.). For each setting: name, possible values, default, and what it affects. Show where in the UI or which CLI flag controls it.", "expected_sources": ["src/settings*", "src/config*", "docs/settings*"]},
            {"heading": "FAQ", "description": "Answers to the most common questions users ask.", "guidance": "Answer the top 10-15 questions users commonly ask. Check the project\u2019s issue tracker, support tickets, or community forums for real user questions. If source analysis reveals a feature that is commonly misunderstood, include it here.", "expected_sources": ["README.md", "issues/", "discussions/", "docs/faq*"]},
            {"heading": "Support", "description": "How to get help: documentation links, community resources, bug reporting, contact information.", "guidance": "List every support channel: official documentation, community forum or chat, GitHub issues for bugs, email or contact form for private matters. Include response time expectations if disclosed. Provide the project\u2019s health status page URL if one exists.", "expected_sources": ["README.md", "CONTRIBUTING.md", ".github/"]},
        ],
    },
    {
        "name": "Architecture Doc",
        "description": "System architecture documentation explaining structure, components, and operational characteristics.",
        "category": "Technical",
        "purpose": "Explain the project\u2019s high-level architecture so maintainers, reviewers, and new team members can understand the system structure, component boundaries, data flow, and deployment model without reading every source file.",
        "intended_audience": "Maintainers, senior engineers, and technical reviewers who need to understand, modify, or operate the system. They are comfortable reading code but need a navigable map first.",
        "expected_outcome": "A living architecture overview that connects every system component to its source directory. Includes deployment context, technology choices with rationale, and data flow descriptions grounded in the actual codebase structure.",
        "compatible_repository_traits": {"min_files": 8, "languages": ["python", "typescript", "javascript", "java", "go", "rust"]},
        "estimated_generation_scope": {"sections": 5, "relative_usage": "medium"},
        "guidance": (
            "Write for a senior engineer who has just joined the project. They need to understand the system well enough to make their first pull request. "
            "Every component must link to its source directory. Every architectural claim must be backed by source evidence. "
            "Do not speculate about architecture decisions \u2014 if the source does not reveal a clear rationale, note the uncertainty. "
            "The Component Diagram section should document actual directory boundaries and service boundaries found in the source, not an idealized architecture. "
            "Technology choices should be explained in terms of actual dependencies found in package files (package.json, Cargo.toml, pyproject.toml, etc.). "
            "Data flow descriptions should trace through actual function boundaries and module imports."
        ),
        "system_prompt": (
            "You are generating an architecture document for a software project based on repository analysis. "
            "Use the file tree, module dependencies, language detection, and complexity analysis from the analysis snapshot. "
            "Every component boundary must correspond to an actual directory or module boundary in source. "
            "Do not invent architectural layers or components. If the project has a flat structure, describe it honestly. "
            "For technology choices, cite the actual dependency files (package.json, Cargo.toml, pyproject.toml). "
            "Data flow should be traced through function call chains and import relationships found in analysis, not through hypothetical layers. "
            "Include the deployment architecture only if the project contains deployment configs (Dockerfiles, CI pipelines, Helm charts)."
        ),
        "sections_json": [
            {"heading": "System Overview", "description": "High-level description of what the system does, its main subsystems, and how they relate.", "guidance": "Start with a one-paragraph summary of the system\u2019s purpose. Then describe each major subsystem identified from the source directory structure. List the languages and frameworks used in each subsystem. Include a simple ASCII architecture diagram or describe the boundaries between subsystems.", "expected_sources": ["README.md", "src/ directory structure", "docs/architecture*"]},
            {"heading": "Component Diagram", "description": "Service map, process boundaries, and dependency relationships between components.", "guidance": "Map every significant directory to its role (API server, worker, database layer, frontend, CLI). Show which components depend on which. If the project is a monorepo, document each package and its dependencies. Reference the actual directory paths for each component so readers can navigate the codebase.", "expected_sources": ["src/", "packages/", "services/", "docker-compose*", "Cargo.toml"]},
            {"heading": "Data Flow", "description": "Request lifecycle through the system: entry, processing, storage, response.", "guidance": "Trace the path of a typical request or event through the system: from HTTP handler or CLI entry point through business logic to storage and back. For each step, name the module, function, or class involved and reference its source path. Include error paths: what happens when a step fails?", "expected_sources": ["routes/", "controllers/", "services/", "handlers/", "middleware/"]},
            {"heading": "Technology Stack", "description": "Languages, frameworks, databases, infrastructure, and rationale for each choice.", "guidance": "List every technology the project uses, categorized by layer (language, framework, database, infrastructure). For each, cite the evidence file (package.json reveals Express, Dockerfile reveals base image). Include version numbers where meaningful. Note any technologies that are being migrated away from or evaluated.", "expected_sources": ["package.json", "Cargo.toml", "pyproject.toml", "Dockerfile*", "docker-compose*"]},
            {"heading": "Deployment Architecture", "description": "How the system is built, deployed, hosted, and monitored.", "guidance": "Describe the deployment pipeline from source to production: CI system, build process, artifact storage, deployment targets, and monitoring. Reference actual deployment configs (Dockerfiles, Helm charts, CI YAML files). If the project does not contain deployment configs, note that deployment is external and describe any documented requirements.", "expected_sources": [".github/", ".gitlab-ci*", "Dockerfile*", "helm/", "k8s/", "deploy/"]},
        ],
    },
    {
        "name": "Migration Guide",
        "description": "Step-by-step guide for upgrading between major versions of the project.",
        "category": "Technical",
        "purpose": "Help users and integrators upgrade from a previous major version to the current one by documenting every breaking change, deprecation, and behavioral difference they need to address.",
        "intended_audience": "Existing users upgrading from an earlier version. They know the previous API or behavior and need a precise list of what changed and how to adapt.",
        "expected_outcome": "A per-version migration checklist that the reader can follow sequentially. Each migration step includes: what changed, why it changed, the old way vs the new way, and exact code migration instructions.",
        "compatible_repository_traits": {"has_changelog": True, "languages": ["python", "typescript", "javascript", "java", "go", "rust"]},
        "estimated_generation_scope": {"sections": 4, "relative_usage": "low"},
        "guidance": (
            "Write for someone who already uses the project. They know the old API and need a precise diff, not a re-introduction. "
            "Every breaking change must include the old behavior, the new behavior, the reason for the change, and exact migration steps. "
            "Use side-by-side code blocks showing \u2018Before\u2019 and \u2018After\u2019 for every API change. "
            "Deprecation notices must include the version when the feature was deprecated, the planned removal version, and the recommended replacement. "
            "Organize migration steps by order of impact: config changes first, then API changes, then behavioral changes. "
            "Check the project\u2019s CHANGELOG, release notes, and git log for tag-based version boundaries."
        ),
        "system_prompt": (
            "You are generating a migration guide for a software project. "
            "Use the repository analysis to identify version boundaries from git tags, changelogs, and release notes. "
            "For each breaking change, provide: what changed, the old code or behavior, the new code or behavior, and exact migration instructions. "
            "Organize changes by category: configuration, API surface, database schema, dependencies, and behavioral. "
            "Only document changes that are verifiable from source analysis. Do not speculate about undocumented changes. "
            "If the project has a CHANGELOG.md or RELEASES.md, use it as the primary source of truth for per-version changes."
        ),
        "sections_json": [
            {"heading": "Upgrade Overview", "description": "Summary of what changed between versions: intended audience, upgrade impact, estimated effort.", "guidance": "State the from-version and to-version. List each major change category and whether it requires code changes, config changes, or is a no-op migration. Give an estimated total effort (minutes to hours). Link to the relevant CHANGELOG or release notes.", "expected_sources": ["CHANGELOG.md", "RELEASES.md", "git tag --list"]},
            {"heading": "Configuration & Dependencies", "description": "Changes to configuration files, environment variables, and dependency versions.", "guidance": "List every config key, env var, and dependency that changed. For each: old key/name, new key/name, default change, and migration steps. Include the minimum supported version for each changed dependency. Use side-by-side config file diffs where possible.", "expected_sources": ["CHANGELOG.md", "config/", ".env.example", "package.json", "pyproject.toml"]},
            {"heading": "API & Breaking Changes", "description": "Every breaking change to the public API surface with before/after migration examples.", "guidance": "List every breaking API change. For each: the old function/class/endpoint signature, the new signature, why it changed, and the exact code change required. Use side-by-side code blocks labeled \u2018Before\u2019 and \u2018After\u2019. Include both the error a user would see and the fix.", "expected_sources": ["CHANGELOG.md", "UPGRADING.md"]},
            {"heading": "Deprecations & Removals", "description": "Features deprecated in earlier versions that are now removed, with migration paths.", "guidance": "List every feature that was previously deprecated and is now removed. For each: when it was deprecated, what replaces it, and the final migration window. If a feature was removed without a replacement, explain the rationale and alternative approaches.", "expected_sources": ["CHANGELOG.md", "DEPRECATIONS.md"]},
        ],
    },
    {
        "name": "CLI Reference",
        "description": "Complete command-line interface reference for the project\u2019s CLI tools.",
        "category": "Technical",
        "purpose": "Document every command, subcommand, flag, argument, and environment variable the project\u2019s CLI exposes so users can operate the tool effectively from the terminal.",
        "intended_audience": "Developers and operators who interact with the project through its command-line interface. They prefer concise flag tables and examples over narrative prose.",
        "expected_outcome": "A complete CLI reference organized by command tree. Each command shows its full syntax, available options with types and defaults, argument specifications, usage examples, and exit codes.",
        "compatible_repository_traits": {"has_cli": True, "languages": ["python", "typescript", "javascript", "go", "rust"]},
        "estimated_generation_scope": {"sections": 4, "relative_usage": "low"},
        "guidance": (
            "Write for a terminal-first developer who wants to look up a flag or subcommand quickly. Use tables, not paragraphs. "
            "Organize the reference by the command tree: root command first, then subcommands, then global flags. "
            "Every flag must include: the long and short form, the type of its argument, the default value, and a one-line description. "
            "Examples should show the exact terminal invocation and the expected output. Use realistic inputs, not placeholder values. "
            "Exit codes must list every nonzero exit code the CLI produces, what it means, and common causes."
        ),
        "system_prompt": (
            "You are generating a CLI reference for a command-line tool. "
            "Use the repository analysis to identify CLI entry points, argument parsers, and flag definitions from source files. "
            "Organize the reference by command hierarchy: root, subcommands, nested subcommands. "
            "For each command, document: full usage line, all flags with their types and defaults, positional arguments, and at least one example. "
            "Document every non-zero exit code the CLI produces, what triggers it, and how to resolve it. "
            "Ground every flag and subcommand in source evidence \u2014 do not invent options that don\u2019t exist in the codebase."
        ),
        "sections_json": [
            {"heading": "Installation & Setup", "description": "How to install the CLI tool and perform initial setup.", "guidance": "Show install commands for each supported platform (npm, pip, brew, cargo, binary download). Include any post-install steps like initializing a config file or setting environment variables.", "expected_sources": ["README.md", "install.sh", "setup.py", "package.json"]},
            {"heading": "Global Flags", "description": "Flags available on every command: output format, verbosity, config path, etc.", "guidance": "List every global flag in a table: flag name, short alias, type, default, description. Include standard flags like --help, --version, --verbose, --quiet, --config, --output-format. Note any environment variable equivalents.", "expected_sources": ["src/cli*", "src/main*", "cli/root*"]},
            {"heading": "Commands", "description": "Complete command reference organized by command hierarchy.", "guidance": "Organize commands hierarchically. For each command, show: the full invocation syntax, a description of what it does, a table of its flags, its positional arguments, and 1-3 examples with realistic inputs and outputs. Group related subcommands.", "expected_sources": ["src/commands/", "cli/", "src/subcommands/"]},
            {"heading": "Exit Codes & Errors", "description": "All exit codes the CLI produces and common error resolutions.", "guidance": "List every exit code (except 0 for success) with its numeric value, meaning, and common causes. Include the error message the user sees and steps to resolve each error.", "expected_sources": ["src/errors*", "src/main*", "src/cli*"]},
        ],
    },
    {
        "name": "Contribution Guide",
        "description": "Guide for new contributors covering development setup, coding conventions, and the PR workflow.",
        "category": "Developer",
        "purpose": "Lower the barrier for new contributors by documenting everything they need to make their first pull request: local development environment, coding standards, test conventions, commit style, and PR submission process.",
        "intended_audience": "Open-source contributors and new team members who want to submit changes to the project. They are comfortable with Git and the language but unfamiliar with this project\u2019s conventions.",
        "expected_outcome": "A guide that a developer can follow from cloning the repo to submitting a reviewed pull request \u2014 including dev environment setup, code style, test writing, documentation, and commit conventions.",
        "compatible_repository_traits": {"languages": ["python", "typescript", "javascript", "java", "go", "rust"]},
        "estimated_generation_scope": {"sections": 5, "relative_usage": "low"},
        "guidance": (
            "Write for a competent developer who has never contributed to this project. Assume they know Git and the language but nothing about your conventions. "
            "The development setup section must produce a working dev environment from a fresh clone \u2014 test each step against the project\u2019s actual setup scripts. "
            "Coding standards should reference the project\u2019s actual lint config, formatter config, and type checking setup, not generic advice. "
            "The PR workflow section should reference any pull request template, CI checks, and review expectations documented in the repo. "
            "Documentation conventions are critical for this project \u2014 cover how to update docs alongside code changes."
        ),
        "system_prompt": (
            "You are generating a contribution guide for a software project based on repository analysis. "
            "Extract the actual development setup steps from the README, Makefile, Dockerfile, or setup scripts. "
            "Identify linting tools, formatters, type checkers, and test runners from the project\u2019s config files (package.json scripts, pyproject.toml, Makefile). "
            "Extract commit conventions from the project\u2019s commit history and any CONTRIBUTING.md files. "
            "Reference the actual commands, config file paths, and CI workflow names found in source. "
            "Do not give generic open-source advice \u2014 ground every instruction in the project\u2019s own configuration and conventions."
        ),
        "sections_json": [
            {"heading": "Development Setup", "description": "Step-by-step instructions to set up a local development environment from a fresh clone.", "guidance": "Start from `git clone`. List every prerequisite: runtime version, package manager, database, external services. Show exact commands for each step. Include instructions for running the project locally (dev server, watcher). Verify these steps against the project\u2019s actual setup scripts and Makefile.", "expected_sources": ["README.md", "CONTRIBUTING.md", "Makefile", "Dockerfile*", "setup.py"]},
            {"heading": "Coding Standards", "description": "Linting, formatting, type checking, and naming conventions enforced by the project.", "guidance": "List every code quality tool and the commands to run it. Reference the project\u2019s actual config files (.eslintrc, .prettierrc, pyproject.toml, rustfmt.toml). Document naming conventions and file organization patterns found in the source structure.", "expected_sources": [".eslintrc*", ".prettierrc*", "pyproject.toml", "rustfmt.toml", "Makefile"]},
            {"heading": "Testing", "description": "How to write and run tests: test framework, directory structure, fixtures, required services.", "guidance": "State the test framework and command to run all tests. Explain the test directory structure. Document how to write a new test: where to put it, how to use fixtures, how to mock external services. Include instructions for running a subset of tests during development.", "expected_sources": ["tests/", "Makefile", "package.json scripts", "pyproject.toml"]},
            {"heading": "Pull Request Workflow", "description": "Branch naming, commit conventions, PR template, CI checks, and review process.", "guidance": "Document the expected branch naming scheme (feature/, fix/, etc.). State the commit message convention (conventional commits? linear history?). Walk through the CI pipeline: which checks run on push vs PR. Explain the review criteria and approval process.", "expected_sources": ["CONTRIBUTING.md", ".github/", "PULL_REQUEST_TEMPLATE*", "git log"]},
            {"heading": "Documentation", "description": "How to update documentation alongside code changes.", "guidance": "Document where different types of docs live (README, inline code docs, API docs, user-facing docs). Explain the expectation for doc changes alongside code changes. Reference any documentation generation tools (Sphinx, Typedoc, rustdoc).", "expected_sources": ["README.md", "CONTRIBUTING.md", "docs/", "pyproject.toml", "package.json"]},
        ],
    },
    {
        "name": "Configuration Guide",
        "description": "Reference for every configuration option: environment variables, config files, CLI flags, and runtime settings.",
        "category": "Developer",
        "purpose": "Provide a single authoritative reference for every setting the project accepts, regardless of configuration mechanism, so operators and integrators can deploy and tune the project correctly.",
        "intended_audience": "Operators, DevOps engineers, and advanced users who need to configure, deploy, or tune the project. They prefer reference tables and validation rules over example-driven tutorials.",
        "expected_outcome": "A comprehensive reference organized by configuration domain (networking, storage, auth, logging, etc.). Each entry documents the setting name, type, default value, valid values, and where to set it (env var, config file key, CLI flag).",
        "compatible_repository_traits": {"languages": ["python", "typescript", "javascript", "go", "rust", "java"]},
        "estimated_generation_scope": {"sections": 4, "relative_usage": "low"},
        "guidance": (
            "Write for an operator who needs to deploy or debug the project. Use tables for settings and bullets for validation rules. "
            "Organize settings by domain (Server, Database, Auth, Logging, etc.). Within each domain, list settings alphabetically. "
            "Every setting must include: name, type, default value, valid values or constraints, and the configuration mechanism (env var, config file key, CLI flag). "
            "Include validation rules: what happens if a required setting is missing, if an invalid value is provided, or if mutually exclusive settings are both set. "
            "Note any settings that require a restart vs reload-on-change. "
            "Extract the actual setting definitions from the project\u2019s config parsing code and environment variable documentation."
        ),
        "system_prompt": (
            "You are generating a configuration reference for a software project. "
            "Extract every configuration parameter from the project\u2019s config parsing code: environment variables, config file schemas, CLI flags, and runtime settings. "
            "Organize settings by domain (Server, Database, Auth, Logging, Observability, etc.). "
            "For each setting, document: name (env var, config key, and CLI flag), type, default value, valid values or constraints, and whether it can be changed at runtime. "
            "Include validation rules: required settings, type constraints, range limits, and mutual exclusivity. "
            "Ground every documented setting in source evidence. Do not invent settings."
        ),
        "sections_json": [
            {"heading": "Quick Reference", "description": "Alphabetical table of every configuration option with type, default, and setting location.", "guidance": "Provide a single comprehensive table with columns: Setting Name, Type, Default, Config File Key, Env Var, CLI Flag. Alphabetical order within domain groups. This section is the landing page for operators who just need to look up a setting.", "expected_sources": ["src/config*", "src/settings*", ".env.example", "config/"]},
            {"heading": "Environment Variables", "description": "Every environment variable the project accepts, with validation and examples.", "guidance": "List every environment variable the project reads, organized by prefix or domain. Include: full variable name, required or optional, type, default value, validation constraints, and an example value. Note any that are sensitive (secrets, tokens) and must be handled securely.", "expected_sources": [".env.example", "src/config*", "docker-compose*", "deploy/"]},
            {"heading": "Configuration File", "description": "Full config file schema with example files for common deployment scenarios.", "guidance": "Document the complete config file schema. Show the file format (YAML, TOML, JSON, INI). Provide annotated example files for development, production, and testing scenarios. Document any hierarchical or nested configuration structure.", "expected_sources": ["config/", "src/config*", ".env.example", "pyproject.toml"]},
            {"heading": "Runtime Settings", "description": "Settings that can be changed at runtime without restarting the process.", "guidance": "List every setting that supports hot-reload or runtime changes. For each: the mechanism to change it (API endpoint, signal, admin panel), the scope of the change (per-request, per-session, global), and how to verify the change took effect.", "expected_sources": ["src/config*", "routes/admin*", "middleware/"]},
        ],
    },
]


DEFAULT_TECHNICAL_REPORT_PROFILE = {
    "name": "Technical report",
    "paper_size": "letter",
    "orientation": "portrait",
    "margins": "normal",
    "include_cover_page": True,
    "include_toc": True,
    "include_page_numbers": True,
    "page_number_position": "bottom-center",
    "page_number_format": "page-n-of-m",
    "logo_position": "title-page",
    "header_left": "",
    "header_center": "",
    "header_right": "",
    "footer_left": "",
    "footer_center": "",
    "footer_right": "",
    "h1_underline": False,
    "body_font_size": "10pt",
    "h1_font_size": "22pt",
    "h2_font_size": "16pt",
    "table_style": "striped",
    "code_theme": "github",
}


def _default_section_acceptance_criteria(template: dict, section: dict) -> list[str]:
    heading = section.get("heading", "This section")
    return [
        f"Addresses the Template guidance for {heading} with project-specific details.",
        "Uses concrete source evidence when available, including file paths, commands, APIs, configuration keys, schemas, or UI labels as appropriate.",
        "Covers the fields, examples, caveats, and unknowns requested by the section guidance instead of stopping at a summary paragraph.",
        "Clearly marks unsupported or missing facts as unknown rather than inventing behavior.",
        f"Contributes to the Template outcome: {template.get('expected_outcome', 'a source-grounded documentation artifact')}",
    ]


for template in BUILTIN_TEMPLATES:
    for section in template.get("sections_json") or []:
        section.setdefault("acceptance_criteria", _default_section_acceptance_criteria(template, section))
    template.setdefault(
        "structure_guidance",
        {
            "outline_role": "source-grounded technical report structure",
            "review_required": True,
            "adapt_template": "Use Analysis facts to rename, reorder, add, or drop sections before approval.",
        },
    )
    template.setdefault(
        "section_generation_guidance",
        {
            "evidence_required": True,
            "draft_state": "generated_draft",
            "maintainer_review_required": True,
        },
    )
    template.setdefault("recommended_print_profile", DEFAULT_TECHNICAL_REPORT_PROFILE.copy())
