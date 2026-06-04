from datetime import datetime
from enum import Enum
from typing import Any, Optional

from pydantic import BaseModel, Field

from app.schemas.template import TemplateResponse


class DocumentSetupStageEnum(str, Enum):
    PURPOSE = "purpose"
    TEMPLATE_SELECTION = "template_selection"
    OUTLINE_REVIEW = "outline_review"
    GENERATION_MODE = "generation_mode"
    EDITOR_READY = "editor_ready"


class DocumentCreateRequest(BaseModel):
    title: str = Field("Untitled Document", min_length=1, max_length=200)
    template_id: Optional[int] = None
    purpose: Optional[str] = None
    audience: Optional[str] = None
    context: Optional[str] = None
    setup_stage: DocumentSetupStageEnum = DocumentSetupStageEnum.PURPOSE
    tags: list[str] = Field(default_factory=list)
    export_settings: Optional[dict[str, Any]] = None


class DocumentUpdateRequest(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=200)
    template_id: Optional[int] = None
    purpose: Optional[str] = None
    audience: Optional[str] = None
    context: Optional[str] = None
    setup_stage: Optional[DocumentSetupStageEnum] = None
    tags: Optional[list[str]] = None
    export_settings: Optional[dict[str, Any]] = None
    custom_outline_metadata: Optional[dict[str, Any]] = None


class DocumentProgressResponse(BaseModel):
    total_sections: int
    reviewed_sections: int
    generated_sections: int
    pct: float


class DocumentResponse(BaseModel):
    id: int
    project_id: int
    title: str
    setup_stage: DocumentSetupStageEnum
    status: str
    freshness: str
    progress: DocumentProgressResponse
    tags: list[str] = Field(default_factory=list)
    template: Optional[TemplateResponse] = None
    template_id: Optional[int] = None
    purpose: Optional[str] = None
    audience: Optional[str] = None
    context: Optional[str] = None
    export_settings: Optional[dict[str, Any]] = None
    custom_outline_metadata: Optional[dict[str, Any]] = None
    last_activity_at: datetime
    reviewer_id: Optional[int] = None
    created_at: datetime
    updated_at: datetime


class DocumentListResponse(BaseModel):
    documents: list[DocumentResponse]
    total: int
