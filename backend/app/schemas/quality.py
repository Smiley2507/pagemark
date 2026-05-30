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
    project_id: int
    overall_score: float
    completeness: float
    consistency: float
    readability: float
    accuracy: float
    generated_at: datetime
    issues: List[QualityIssueOut] = []
    broken_links: List[BrokenLinkOut] = []

    model_config = {"from_attributes": True}


class QualityRunResponse(BaseModel):
    message: str
