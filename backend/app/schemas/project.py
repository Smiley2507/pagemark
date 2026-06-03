from pydantic import BaseModel, Field
from typing import Optional, List, List
from datetime import datetime
from enum import Enum


class ProjectStatusEnum(str, Enum):
    PENDING = "pending"
    DRAFT = "draft"
    FINALIZED = "finalized"


class SourceTypeEnum(str, Enum):
    ZIP = "zip"
    GIT = "git"
    SCRATCH = "scratch"


# ── Request schemas ──────────────────────────────────────────────

class ProjectCreateRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = None
    source_type: SourceTypeEnum = SourceTypeEnum.SCRATCH
    git_repo_url: Optional[str] = None
    git_branch: Optional[str] = None
    template_id: Optional[int] = None
    ignore_patterns: Optional[List[str]] = None


class ProjectUpdateRequest(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=200)
    description: Optional[str] = None
    starred: Optional[bool] = None
    status: Optional[ProjectStatusEnum] = None
    tags: Optional[List[str]] = None


# ── Response schemas ─────────────────────────────────────────────

class ProjectResponse(BaseModel):
    id: int
    org_id: int
    created_by: int
    name: str
    description: Optional[str]
    status: ProjectStatusEnum
    completion_pct: float
    source_type: SourceTypeEnum
    git_repo_url: Optional[str]
    git_branch: Optional[str]
    template_id: Optional[int]
    starred: bool
    tags: List[str] = []
    sections_count: int = 0
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ProjectListResponse(BaseModel):
    projects: List[ProjectResponse]
    total: int
