from datetime import datetime
from enum import Enum
from typing import List, Optional

from pydantic import BaseModel, Field


class SectionStatusEnum(str, Enum):
    PENDING = "pending"
    DRAFT = "draft"
    FINALIZED = "finalized"
    NEEDS_INPUT = "needs_input"


class SectionResponse(BaseModel):
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
    status: SectionStatusEnum
    children: List["SectionResponse"] = Field(default_factory=list)

    class Config:
        from_attributes = True


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
