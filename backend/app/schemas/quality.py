from pydantic import BaseModel, Field
from typing import Any, Optional, List
from datetime import datetime

from app.models.quality import IssueSeverity


class QualityIssueOut(BaseModel):
    id: int
    report_id: int
    severity: str
    section_ref: Optional[str] = None
    message: str
    suggestion: Optional[str] = None

    model_config = {"from_attributes": True}


class BrokenLinkOut(BaseModel):
    id: int
    report_id: int
    url: str
    status_code: Optional[int] = None
    section_ref: Optional[str] = None

    model_config = {"from_attributes": True}


class QualityReportOut(BaseModel):
    id: int
    document_id: int
    overall_score: float
    completeness: float
    acceptance_coverage: float
    consistency: float
    readability: float
    accuracy: float
    generated_at: datetime
    issues: List[QualityIssueOut] = []
    broken_links: List[BrokenLinkOut] = []
    findings: List["QualityFindingOut"] = []

    model_config = {"from_attributes": True}


class QualityRunResponse(BaseModel):
    message: str
    task_id: str


class QualityReportSummary(BaseModel):
    id: int
    document_id: int
    overall_score: float
    generated_at: datetime

    model_config = {"from_attributes": True}


class QualityStatusResponse(BaseModel):
    status: str
    task_id: str
    message: str
    report: Optional[QualityReportSummary] = None
    error: Optional[str] = None


class QualityFindingOut(BaseModel):
    id: int
    document_id: int
    report_id: Optional[int] = None
    category: str
    status: str
    severity: str
    section_id: Optional[int] = None
    section_ref: Optional[str] = None
    message: str
    suggestion: Optional[str] = None
    quote: Optional[str] = None
    offset: Optional[int] = None
    length: Optional[int] = None
    replacements: list[str] = Field(default_factory=list)
    rule_id: Optional[str] = None
    content_fingerprint: str
    provider: Optional[str] = None
    provider_metadata: Optional[dict[str, Any]] = None
    stale_location: bool = False
    first_seen_at: datetime
    last_seen_at: datetime

    model_config = {"from_attributes": True}


class QualityFindingStatusUpdate(BaseModel):
    status: str


class QualityGrammarRunRequest(BaseModel):
    section_id: Optional[int] = None
    language: str = "en-US"


class QualityAIFixRequest(BaseModel):
    finding_id: Optional[int] = None
    category: Optional[str] = None
    section_id: Optional[int] = None
    status: Optional[str] = "open"
    action: str = "fix_findings"
