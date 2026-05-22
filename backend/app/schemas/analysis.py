from pydantic import BaseModel, HttpUrl
from typing import Optional, List, Any
from datetime import datetime
from .project import SourceTypeEnum


class AnalysisStatusResponse(BaseModel):
    id: int
    project_id: int
    status: str
    current_step: Optional[str]
    step_number: int
    total_steps: int
    source_type: str
    error_message: Optional[str]
    started_at: Optional[datetime]
    completed_at: Optional[datetime]

    class Config:
        from_attributes = True


class AnalysisResponse(AnalysisStatusResponse):
    file_tree_json: Optional[Any]
    languages_json: Optional[Any]
    endpoints_json: Optional[Any]
    complexity_json: Optional[Any]


class GitConnectUrlRequest(BaseModel):
    repo_url: str
    branch: str = "main"


class GitConnectOAuthRequest(BaseModel):
    owner: str
    repo: str
    branch: str = "main"


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
