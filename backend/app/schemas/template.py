from pydantic import BaseModel, Field
from typing import Optional, List, Any
from datetime import datetime


# ── Request schemas ──────────────────────────────────────────────

class TemplateCreateRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = None
    category: Optional[str] = None
    sections_json: Optional[List[Any]] = None


class TemplateUpdateRequest(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=200)
    description: Optional[str] = None
    category: Optional[str] = None
    sections_json: Optional[List[Any]] = None


# ── Response schemas ─────────────────────────────────────────────

class TemplateResponse(BaseModel):
    id: int
    name: str
    description: Optional[str]
    category: Optional[str]
    sections_json: Optional[List[Any]]
    owner_id: Optional[int]
    is_builtin: bool
    created_at: datetime

    class Config:
        from_attributes = True


class TemplateListResponse(BaseModel):
    templates: List[TemplateResponse]
