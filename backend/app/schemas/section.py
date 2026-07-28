from datetime import datetime
from enum import Enum
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field


class SectionStatusEnum(str, Enum):
    PENDING = "pending"
    DRAFT = "draft"
    FINALIZED = "finalized"
    NEEDS_INPUT = "needs_input"


class SectionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    document_id: int
    parent_id: Optional[int] = None
    order_index: int
    heading: str
    title: Optional[str] = None
    is_custom: bool = False
    lifecycle_status: str
    confidence_score: Optional[int] = None
    content_md: str
    content_lifecycle: str = "empty"
    status: SectionStatusEnum
    needs_input: bool = False
    is_generating: bool = False
    has_failed: bool = False
    is_potentially_stale: bool = False
    reviewed_by: Optional[int] = None
    reviewed_at: Optional[datetime] = None
    reviewed_against_analysis_id: Optional[int] = None
    workflow_metadata: Optional[dict] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    children: List["SectionResponse"] = Field(default_factory=list)


class SectionUpdateRequest(BaseModel):
    content_md: Optional[str] = None
    status: Optional[SectionStatusEnum] = None


class SectionAutosaveRequest(BaseModel):
    content_md: str


class SectionAutosaveResponse(BaseModel):
    saved: bool
    updated_at: datetime


class SectionStatusUpdateRequest(BaseModel):
    status: SectionStatusEnum


class SectionStatusUpdateResponse(BaseModel):
    status: SectionStatusEnum
    completion_pct: float


class SectionReorderRequest(BaseModel):
    section_ids: List[int]


class SectionTitleRequest(BaseModel):
    title: str


class CustomSectionRequest(BaseModel):
    title: str


class SectionTreeResponse(BaseModel):
    document_id: int
    sections: List[SectionResponse]
    status: str = "DRAFT"
    reviewer_id: Optional[int] = None


SectionResponse.model_rebuild()
