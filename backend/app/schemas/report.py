from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class ReportTrendPoint(BaseModel):
    date: str
    label: str
    count: int


class ReportCategoryBreakdown(BaseModel):
    category: str
    count: int


class ReportContributor(BaseModel):
    user_id: int
    name: Optional[str] = None
    email: str
    count: int


class ReportEvent(BaseModel):
    action: str
    resource: Optional[str] = None
    user_name: Optional[str] = None
    created_at: datetime
    source: str


class ReportSummary(BaseModel):
    total_actions: int
    active_users: int
    most_active_project: Optional[str] = None
    top_action: Optional[str] = None


class OrgActivityReport(BaseModel):
    org_id: int
    org_name: str
    days: int
    range_label: str
    generated_at: datetime
    summary: ReportSummary
    trend: list[ReportTrendPoint]
    categories: list[ReportCategoryBreakdown]
    contributors: list[ReportContributor]
    events: list[ReportEvent]
