from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings

app = FastAPI(title="Pagemark API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.FRONTEND_URL],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
async def health_check():
    return {"status": "ok", "version": "1.0.0"}

# Routers will be included here as they are created
# from app.routers import auth, users, projects, templates, documents, sections, versions, analysis, ai, quality, export, sharing, knowledge

# Example of how to include them:
# app.include_router(auth.router)
# app.include_router(users.router)
# ... etc
