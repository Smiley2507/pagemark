from pydantic import BaseModel, Field
from typing import Any, Optional, List
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

class ProjectSourceExclusionRequest(BaseModel):
    pattern: str = Field(..., min_length=1, max_length=500)
    reason: Optional[str] = None
    enabled: bool = True


class ProjectSourceExclusionResponse(ProjectSourceExclusionRequest):
    id: int
    project_id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ProjectCreateRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = None
    source_type: SourceTypeEnum = SourceTypeEnum.SCRATCH
    source_provider: Optional[str] = None
    source_owner: Optional[str] = None
    source_repository: Optional[str] = None
    selected_branch: Optional[str] = None
    default_branch: Optional[str] = None
    source_visibility: Optional[str] = None
    source_metadata: Optional[dict] = None
    ignore_patterns: Optional[List[str]] = None
    source_exclusions: Optional[List[ProjectSourceExclusionRequest]] = None


class ProjectUpdateRequest(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=200)
    description: Optional[str] = None
    starred: Optional[bool] = None
    status: Optional[ProjectStatusEnum] = None
    tags: Optional[List[str]] = None
    export_settings: Optional[dict] = None


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
    source_provider: Optional[str]
    source_owner: Optional[str]
    source_repository: Optional[str]
    selected_branch: Optional[str]
    default_branch: Optional[str]
    source_visibility: Optional[str]
    last_synced_commit: Optional[str] = None
    source_metadata: Optional[dict] = None
    source_exclusions: List[ProjectSourceExclusionResponse] = []
    context_md: Optional[str] = None
    webhook_secret: Optional[str] = None
    webhook_id: Optional[int] = None
    export_settings: Optional[dict] = None
    starred: bool
    tags: List[str] = []
    documents_count: int = 0
    sections_count: int = 0
    active_generation: bool = False
    sections_needing_input: int = 0
    review_state: str = "not_started"
    freshness_state: str = "fresh"
    recent_activity_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ProjectListResponse(BaseModel):
    projects: List[ProjectResponse]
    total: int


class AiContextProjectSummary(BaseModel):
    id: int
    name: str
    description: Optional[str] = None
    source_type: SourceTypeEnum
    source_provider: Optional[str] = None
    source_repository: Optional[str] = None
    selected_branch: Optional[str] = None
    last_synced_commit: Optional[str] = None


class AiContextAnalysisSummary(BaseModel):
    id: Optional[int] = None
    status: str
    is_current: bool = False
    completed_at: Optional[datetime] = None
    source_commit: Optional[str] = None
    total_files: int = 0
    languages: List[str] = []
    frameworks: List[str] = []
    endpoint_count: int = 0
    dependency_count: int = 0
    largest_files: List[Any] = []


class AiContextResponse(BaseModel):
    project: AiContextProjectSummary
    project_brief: Optional[str] = None
    analysis_summary: AiContextAnalysisSummary
    source_connection: dict[str, Any]
    facts: dict[str, Any] = {}
    unavailable_facts: List[Any] = []
    partial_failures: List[Any] = []
    effective_exclusions: List[Any] = []
    context_files_preview: List[dict[str, Any]] = []
    grounding_warnings: List[str] = []
