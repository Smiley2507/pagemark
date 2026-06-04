from datetime import datetime
from typing import Any
from pydantic import BaseModel, ConfigDict


class NLPReportResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    project_id: int
    readability_score: float
    entities: list[Any]
    style_analysis: dict[str, Any]
    suggestions: list[Any]
    created_at: datetime
