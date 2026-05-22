from pydantic import BaseModel
from typing import Optional, List, Any, Literal
from datetime import datetime

from app.models.analysis import Analysis, AnalysisStatus
from app.services.analysis_service import (
    STEP_NAMES,
    TOTAL_STEPS,
    build_steps_payload,
    elapsed_seconds,
)


class AnalysisStepItem(BaseModel):
    number: int
    name: str
    status: Literal["pending", "running", "done", "failed"]


class AnalysisStatusResponse(BaseModel):
    id: int
    project_id: int
    status: str
    current_step: Optional[str]
    step_number: int
    step_detail: Optional[str] = None
    total_steps: int
    source_type: str
    error_message: Optional[str]
    started_at: Optional[datetime]
    completed_at: Optional[datetime]
    steps: List[AnalysisStepItem] = []
    elapsed_seconds: Optional[int] = None
    outline_applied: bool = False


class AnalysisResponse(AnalysisStatusResponse):
    file_tree_json: Optional[Any] = None
    languages_json: Optional[Any] = None
    endpoints_json: Optional[Any] = None
    complexity_json: Optional[Any] = None
    outline_json: Optional[Any] = None


class OutlineDiffResponse(BaseModel):
    current: List[str]
    proposed: List[str]
    has_changes: bool


class ApplyOutlineResponse(BaseModel):
    applied: bool
    section_count: int


class GitConnectUrlRequest(BaseModel):
    repo_url: str
    branch: str = "main"


class GitConnectOAuthRequest(BaseModel):
    owner: str
    repo: str
    branch: str = "main"
    provider: str = "github"


class GitRepoResponse(BaseModel):
    id: int
    name: str
    full_name: str
    description: Optional[str]
    private: bool
    default_branch: str
    updated_at: datetime
    language: Optional[str]
    stars_count: int
    html_url: str


class GitBranchResponse(BaseModel):
    name: str
    is_default: bool


class GitHubStatusResponse(BaseModel):
    connected: bool
    username: Optional[str] = None
    avatar: Optional[str] = None


def analysis_to_status_response(analysis: Analysis) -> AnalysisStatusResponse:
    status_val = (
        analysis.status.value
        if isinstance(analysis.status, AnalysisStatus)
        else str(analysis.status)
    )
    failed_step = analysis.step_number if status_val == "failed" else None
    steps = build_steps_payload(
        analysis.step_number or 0,
        analysis.status
        if isinstance(analysis.status, AnalysisStatus)
        else AnalysisStatus(status_val),
        failed_step=failed_step,
    )
    return AnalysisStatusResponse(
        id=analysis.id,
        project_id=analysis.project_id,
        status=status_val,
        current_step=analysis.current_step,
        step_number=analysis.step_number or 0,
        step_detail=analysis.step_detail,
        total_steps=analysis.total_steps or TOTAL_STEPS,
        source_type=analysis.source_type,
        error_message=analysis.error_message,
        started_at=analysis.started_at,
        completed_at=analysis.completed_at,
        steps=steps,
        elapsed_seconds=elapsed_seconds(analysis),
        outline_applied=bool(analysis.outline_applied),
    )


def analysis_to_full_response(analysis: Analysis) -> AnalysisResponse:
    base = analysis_to_status_response(analysis)
    return AnalysisResponse(
        **base.model_dump(),
        file_tree_json=analysis.file_tree_json,
        languages_json=analysis.languages_json,
        endpoints_json=analysis.endpoints_json,
        complexity_json=analysis.complexity_json,
        outline_json=analysis.outline_json,
    )
