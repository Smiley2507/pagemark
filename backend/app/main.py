import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy.future import select

from app.config import settings

os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
from app.database import async_session
from app.models.template import Template
from app.routers import auth, projects, templates, git, documents, sections, versions, clarification, grammar, terminology, search as search_router, notes as notes_router, nlp as nlp_router, uploads as uploads_router
from app.routers import ai as ai_router
from app.routers import quality as quality_router
from app.routers import export as export_router
from app.routers import organizations as org_router
from app.routers import keys as keys_router


# ── Built-in template seed data ─────────────────────────────────

BUILTIN_TEMPLATES = [
    {
        "name": "API Reference",
        "description": "Comprehensive API documentation template",
        "category": "Technical",
        "purpose": "Document HTTP or RPC APIs for implementation and integration.",
        "intended_audience": "Backend, frontend, and integration developers.",
        "expected_outcome": "A reference that helps developers call the API correctly.",
        "compatible_repository_traits": {"requires_endpoints": True, "languages": ["python", "typescript", "javascript", "java"]},
        "estimated_generation_scope": {"sections": 6, "relative_usage": "medium"},
        "sections_json": [
            {"heading": "Overview", "description": "API overview and base URL"},
            {"heading": "Authentication", "description": "Auth methods and tokens"},
            {"heading": "Endpoints", "description": "Full endpoint listing"},
            {"heading": "Request & Response Formats", "description": "Payload schemas"},
            {"heading": "Error Codes", "description": "Error handling reference"},
            {"heading": "Rate Limiting", "description": "Throttling and quotas"},
        ],
        "guidance": "Prioritize exact endpoints, methods, payloads, auth, and error behavior.",
        "system_prompt": "Create source-grounded API reference outlines. Do not invent endpoints.",
    },
    {
        "name": "SDK Guide",
        "description": "SDK integration and usage guide template",
        "category": "Developer",
        "purpose": "Explain how developers install, configure, and use an SDK or library.",
        "intended_audience": "Application developers integrating this project.",
        "expected_outcome": "A practical guide with setup steps, concepts, examples, and troubleshooting.",
        "compatible_repository_traits": {"languages": ["typescript", "javascript", "python", "java"]},
        "estimated_generation_scope": {"sections": 5, "relative_usage": "medium"},
        "sections_json": [
            {"heading": "Getting Started", "description": "Installation and setup"},
            {"heading": "Configuration", "description": "SDK configuration options"},
            {"heading": "Core Concepts", "description": "Key abstractions and patterns"},
            {"heading": "Code Examples", "description": "Common usage patterns"},
            {"heading": "Troubleshooting", "description": "Common issues and fixes"},
        ],
        "guidance": "Emphasize developer tasks, examples, and integration pitfalls.",
        "system_prompt": "Create SDK guide outlines grounded in public package and source structure.",
    },
    {
        "name": "User Manual",
        "description": "End-user documentation template",
        "category": "Product",
        "purpose": "Explain product usage workflows for non-implementation readers.",
        "intended_audience": "End users and support teams.",
        "expected_outcome": "A task-oriented manual that helps users operate the product.",
        "compatible_repository_traits": {"languages": ["typescript", "javascript", "python"]},
        "estimated_generation_scope": {"sections": 6, "relative_usage": "medium"},
        "sections_json": [
            {"heading": "Introduction", "description": "Product overview"},
            {"heading": "Getting Started", "description": "First steps and onboarding"},
            {"heading": "Features Guide", "description": "Feature walkthroughs"},
            {"heading": "Settings & Preferences", "description": "Customization options"},
            {"heading": "FAQ", "description": "Frequently asked questions"},
            {"heading": "Support", "description": "Contact and help resources"},
        ],
        "guidance": "Keep implementation details secondary and focus on user tasks.",
        "system_prompt": "Create user manual outlines from observable product surfaces and workflows.",
    },
    {
        "name": "Architecture Doc",
        "description": "System architecture documentation template",
        "category": "Technical",
        "purpose": "Explain system structure, components, dependencies, and operational shape.",
        "intended_audience": "Maintainers, senior engineers, and technical reviewers.",
        "expected_outcome": "A maintainable architecture overview grounded in repository structure.",
        "compatible_repository_traits": {"min_files": 8, "languages": ["python", "typescript", "javascript", "java", "go", "rust"]},
        "estimated_generation_scope": {"sections": 5, "relative_usage": "medium"},
        "sections_json": [
            {"heading": "System Overview", "description": "High-level architecture"},
            {"heading": "Component Diagram", "description": "Service map and dependencies"},
            {"heading": "Data Flow", "description": "Request lifecycle and data pipelines"},
            {"heading": "Technology Stack", "description": "Languages, frameworks, infra"},
            {"heading": "Deployment Architecture", "description": "Hosting and CI/CD"},
        ],
        "guidance": "Connect components to source paths and avoid speculative architecture claims.",
        "system_prompt": "Create architecture document outlines grounded in repository facts.",
    },
]


async def seed_builtin_templates() -> None:
    """Seed built-in templates if the table is empty."""
    async with async_session() as session:
        result = await session.execute(select(Template).limit(1))
        if result.scalar_one_or_none() is not None:
            return  # table already has data

        for data in BUILTIN_TEMPLATES:
            template = Template(
                name=data["name"],
                description=data["description"],
                category=data["category"],
                purpose=data["purpose"],
                intended_audience=data["intended_audience"],
                expected_outcome=data["expected_outcome"],
                compatible_repository_traits=data["compatible_repository_traits"],
                estimated_generation_scope=data["estimated_generation_scope"],
                outline_preview=data["sections_json"],
                sections_json=data["sections_json"],
                guidance=data["guidance"],
                system_prompt=data["system_prompt"],
                is_builtin=True,
                owner_id=None,
            )
            session.add(template)
        await session.commit()


@asynccontextmanager
async def lifespan(app: FastAPI):
    await seed_builtin_templates()
    yield


app = FastAPI(title="Pagemark API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        settings.FRONTEND_URL,
        "http://localhost:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:5174",
    ],
    allow_origin_regex=r"^http://(localhost|127\.0\.0\.1):517\d$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(projects.router)
app.include_router(templates.router)
app.include_router(git.router)
app.include_router(documents.router)
app.include_router(sections.router)
app.include_router(versions.router)
app.include_router(terminology.router)
app.include_router(ai_router.router)
app.include_router(clarification.router)
app.include_router(grammar.router)
app.include_router(quality_router.router)
app.include_router(export_router.router)
app.include_router(org_router.router)
app.include_router(keys_router.router)
app.include_router(search_router.router)
app.include_router(notes_router.router)
app.include_router(nlp_router.router)
app.include_router(uploads_router.router)

app.mount("/static", StaticFiles(directory=settings.UPLOAD_DIR), name="static")


@app.get("/health")
async def health_check():
    return {"status": "ok", "version": "1.0.0"}
