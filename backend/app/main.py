from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy.future import select

from app.config import settings
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
        "sections_json": [
            {"heading": "Overview", "description": "API overview and base URL"},
            {"heading": "Authentication", "description": "Auth methods and tokens"},
            {"heading": "Endpoints", "description": "Full endpoint listing"},
            {"heading": "Request & Response Formats", "description": "Payload schemas"},
            {"heading": "Error Codes", "description": "Error handling reference"},
            {"heading": "Rate Limiting", "description": "Throttling and quotas"},
        ],
    },
    {
        "name": "SDK Guide",
        "description": "SDK integration and usage guide template",
        "category": "Developer",
        "sections_json": [
            {"heading": "Getting Started", "description": "Installation and setup"},
            {"heading": "Configuration", "description": "SDK configuration options"},
            {"heading": "Core Concepts", "description": "Key abstractions and patterns"},
            {"heading": "Code Examples", "description": "Common usage patterns"},
            {"heading": "Troubleshooting", "description": "Common issues and fixes"},
        ],
    },
    {
        "name": "User Manual",
        "description": "End-user documentation template",
        "category": "Product",
        "sections_json": [
            {"heading": "Introduction", "description": "Product overview"},
            {"heading": "Getting Started", "description": "First steps and onboarding"},
            {"heading": "Features Guide", "description": "Feature walkthroughs"},
            {"heading": "Settings & Preferences", "description": "Customization options"},
            {"heading": "FAQ", "description": "Frequently asked questions"},
            {"heading": "Support", "description": "Contact and help resources"},
        ],
    },
    {
        "name": "Architecture Doc",
        "description": "System architecture documentation template",
        "category": "Technical",
        "sections_json": [
            {"heading": "System Overview", "description": "High-level architecture"},
            {"heading": "Component Diagram", "description": "Service map and dependencies"},
            {"heading": "Data Flow", "description": "Request lifecycle and data pipelines"},
            {"heading": "Technology Stack", "description": "Languages, frameworks, infra"},
            {"heading": "Deployment Architecture", "description": "Hosting and CI/CD"},
        ],
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
                sections_json=data["sections_json"],
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
