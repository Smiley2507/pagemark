from pydantic import BaseModel, Field
from typing import Optional, List, Any
from datetime import datetime


# ── Request schemas ──────────────────────────────────────────────

class TemplateCreateRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = None
    category: Optional[str] = None
    purpose: Optional[str] = None
    intended_audience: Optional[str] = None
    expected_outcome: Optional[str] = None
    structure_guidance: Optional[dict[str, Any]] = None
    section_generation_guidance: Optional[dict[str, Any]] = None
    recommended_print_profile: Optional[dict[str, Any]] = None
    compatible_repository_traits: Optional[dict[str, Any]] = None
    estimated_generation_scope: Optional[dict[str, Any]] = None
    outline_preview: Optional[List[Any]] = None
    sections_json: Optional[List[Any]] = None
    guidance: Optional[str] = None
    system_prompt: Optional[str] = None


class TemplateUpdateRequest(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=200)
    description: Optional[str] = None
    category: Optional[str] = None
    purpose: Optional[str] = None
    intended_audience: Optional[str] = None
    expected_outcome: Optional[str] = None
    structure_guidance: Optional[dict[str, Any]] = None
    section_generation_guidance: Optional[dict[str, Any]] = None
    recommended_print_profile: Optional[dict[str, Any]] = None
    compatible_repository_traits: Optional[dict[str, Any]] = None
    estimated_generation_scope: Optional[dict[str, Any]] = None
    outline_preview: Optional[List[Any]] = None
    sections_json: Optional[List[Any]] = None
    guidance: Optional[str] = None
    system_prompt: Optional[str] = None


# ── Response schemas ─────────────────────────────────────────────

class TemplateResponse(BaseModel):
    id: int
    name: str
    description: Optional[str]
    category: Optional[str]
    purpose: Optional[str]
    intended_audience: Optional[str]
    expected_outcome: Optional[str]
    structure_guidance: Optional[dict[str, Any]]
    section_generation_guidance: Optional[dict[str, Any]]
    recommended_print_profile: Optional[dict[str, Any]]
    compatible_repository_traits: Optional[dict[str, Any]]
    estimated_generation_scope: Optional[dict[str, Any]]
    outline_preview: Optional[List[Any]]
    sections_json: Optional[List[Any]]
    guidance: Optional[str]
    system_prompt: Optional[str]
    owner_id: Optional[int]
    is_builtin: bool
    created_at: datetime

    class Config:
        from_attributes = True


class TemplateListResponse(BaseModel):
    templates: List[TemplateResponse]
