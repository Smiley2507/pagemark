from __future__ import annotations

from typing import Literal

from pydantic import BaseModel


class StructuralSuggestion(BaseModel):
    type: Literal["reorder", "rename", "add", "remove", "merge"]
    section_id: int | None = None
    target_section_id: int | None = None
    heading: str | None = None
    suggested_heading: str | None = None
    suggested_order: int | None = None
    suggested_parent_heading: str | None = None
    suggested_content_md: str | None = None
    reasoning: str


class SuggestStructureResponse(BaseModel):
    suggestions: list[StructuralSuggestion]
