from pydantic import BaseModel
from typing import Optional, List
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
