import os
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy.future import select

from app.config import settings

os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
from app.database import async_session
from app.models.template import Template
from app.routers import auth, projects, templates, git, documents, sections, versions, clarification, grammar, terminology, search as search_router, notes as notes_router, nlp as nlp_router, uploads as uploads_router, webhooks as webhooks_router
from app.routers import ai as ai_router
from app.routers import quality as quality_router
from app.routers import export as export_router
from app.routers import organizations as org_router
from app.routers import keys as keys_router
from app.routers import shares as shares_router
from app.routers import resources as resources_router
from app.routers import context_search as context_search_router
from app.data.builtin_templates import BUILTIN_TEMPLATES


async def seed_builtin_templates() -> None:
    """Upsert built-in templates by name so code changes always take effect."""
    async with async_session() as session:
        for data in BUILTIN_TEMPLATES:
            existing = await session.execute(
                select(Template).where(Template.name == data["name"], Template.is_builtin == True)
            )
            tmpl = existing.scalar_one_or_none()
            if tmpl is not None:
                tmpl.description = data["description"]
                tmpl.category = data["category"]
                tmpl.purpose = data["purpose"]
                tmpl.intended_audience = data["intended_audience"]
                tmpl.expected_outcome = data["expected_outcome"]
                tmpl.structure_guidance = data.get("structure_guidance")
                tmpl.section_generation_guidance = data.get("section_generation_guidance")
                tmpl.recommended_print_profile = data.get("recommended_print_profile")
                tmpl.compatible_repository_traits = data["compatible_repository_traits"]
                tmpl.estimated_generation_scope = data["estimated_generation_scope"]
                tmpl.outline_preview = data["sections_json"]
                tmpl.sections_json = data["sections_json"]
                tmpl.guidance = data["guidance"]
                tmpl.system_prompt = data["system_prompt"]
            else:
                tmpl = Template(
                    name=data["name"],
                    description=data["description"],
                    category=data["category"],
                    purpose=data["purpose"],
                    intended_audience=data["intended_audience"],
                    expected_outcome=data["expected_outcome"],
                    structure_guidance=data.get("structure_guidance"),
                    section_generation_guidance=data.get("section_generation_guidance"),
                    recommended_print_profile=data.get("recommended_print_profile"),
                    compatible_repository_traits=data["compatible_repository_traits"],
                    estimated_generation_scope=data["estimated_generation_scope"],
                    outline_preview=data["sections_json"],
                    sections_json=data["sections_json"],
                    guidance=data["guidance"],
                    system_prompt=data["system_prompt"],
                    is_builtin=True,
                    owner_id=None,
                )
                session.add(tmpl)
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


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    origin = request.headers.get("origin")
    headers = {}
    if origin:
        headers["Access-Control-Allow-Origin"] = origin
        headers["Access-Control-Allow-Credentials"] = "true"
        headers["Access-Control-Expose-Headers"] = "*"
    return JSONResponse(
        status_code=500,
        content={"detail": f"Internal server error: {type(exc).__name__}. Check server logs for details."},
        headers=headers or None,
    )


app.include_router(auth.router)
app.include_router(search_router.router)
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
app.include_router(notes_router.router)
app.include_router(nlp_router.router)
app.include_router(uploads_router.router)
app.include_router(shares_router.router)
app.include_router(resources_router.router)
app.include_router(context_search_router.router)
app.include_router(webhooks_router.router)
from app.routers import admin as admin_router
app.include_router(admin_router.router)

app.mount("/static", StaticFiles(directory=settings.UPLOAD_DIR), name="static")


@app.get("/health")
async def health_check():
    return {"status": "ok", "version": "1.0.0"}
