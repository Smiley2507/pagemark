from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Any, Optional

from pydantic import BaseModel, Field


class AIWorkRunStatusEnum(str, Enum):
    PENDING = "pending"
    RUNNING = "running"
    PROPOSED = "proposed"
    PARTIALLY_ACCEPTED = "partially_accepted"
    ACCEPTED = "accepted"
    REJECTED = "rejected"
    UNDONE = "undone"
    FAILED = "failed"


class AIProposedChangeTypeEnum(str, Enum):
    GENERATE_SECTION = "generate_section"
    REWRITE_SELECTION = "rewrite_selection"
    INSERT_AT_CURSOR = "insert_at_cursor"
    REPLACE_SELECTION = "replace_selection"
    RENAME_SECTION = "rename_section"
    ADD_SECTION = "add_section"
    REORDER_SECTIONS = "reorder_sections"
    APPLY_OUTLINE_DIFF = "apply_outline_diff"


class AIProposedChangeStatusEnum(str, Enum):
    PROPOSED = "proposed"
    ACCEPTED = "accepted"
    REJECTED = "rejected"
    UNDONE = "undone"


class AIProposedChangeCreate(BaseModel):
    change_type: AIProposedChangeTypeEnum
    title: str = Field(..., min_length=1, max_length=240)
    section_id: Optional[int] = None
    rationale: Optional[str] = None
    before: Optional[dict[str, Any]] = None
    after: dict[str, Any]
    preview_markdown: Optional[str] = None


class AIWorkRunCreateRequest(BaseModel):
    provider: Optional[str] = None
    model: Optional[str] = None
    prompt_context: dict[str, Any] = Field(default_factory=dict)
    estimated_prompt_tokens: Optional[int] = None
    estimated_completion_tokens: Optional[int] = None
    estimated_cost: Optional[float] = None
    changes: list[AIProposedChangeCreate] = Field(default_factory=list)


class AIProposedChangeResponse(BaseModel):
    id: int
    work_run_id: int
    document_id: int
    section_id: Optional[int]
    change_type: AIProposedChangeTypeEnum
    status: AIProposedChangeStatusEnum
    title: str
    rationale: Optional[str]
    before: Optional[dict[str, Any]]
    after: dict[str, Any]
    preview_markdown: Optional[str]
    accepted_by: Optional[int]
    accepted_at: Optional[datetime]
    rejected_by: Optional[int]
    rejected_at: Optional[datetime]
    undone_at: Optional[datetime]
    created_at: datetime


class AIWorkRunResponse(BaseModel):
    id: int
    document_id: int
    provider: Optional[str]
    model: Optional[str]
    prompt_context: dict[str, Any] = Field(default_factory=dict)
    status: AIWorkRunStatusEnum
    estimated_prompt_tokens: Optional[int]
    estimated_completion_tokens: Optional[int]
    estimated_cost: Optional[float]
    actual_prompt_tokens: Optional[int]
    actual_completion_tokens: Optional[int]
    actual_cost: Optional[float]
    undo_group: Optional[dict[str, Any]]
    error_message: Optional[str]
    created_by: Optional[int]
    proposed_changes: list[AIProposedChangeResponse] = Field(default_factory=list)
    created_at: datetime
    updated_at: datetime
    completed_at: Optional[datetime]


class AIWorkRunListResponse(BaseModel):
    work_runs: list[AIWorkRunResponse]


class AIProposedChangeListResponse(BaseModel):
    proposed_changes: list[AIProposedChangeResponse]


class AIProposedChangePreviewResponse(BaseModel):
    change: AIProposedChangeResponse
    preview: dict[str, Any]


class AIEditorReference(BaseModel):
    type: str
    id: Optional[int] = None
    label: Optional[str] = None


class AIEditorSelection(BaseModel):
    section_id: int
    from_pos: Optional[int] = Field(default=None, alias="from")
    to_pos: Optional[int] = Field(default=None, alias="to")
    text: str = ""


class AIEditorCursor(BaseModel):
    section_id: int
    pos: Optional[int] = None


class AIChatActionRequest(BaseModel):
    message: str = Field(..., min_length=1)
    mode: str = "auto"
    model_name: Optional[str] = None
    target_section_id: Optional[int] = None
    selection: Optional[AIEditorSelection] = None
    cursor: Optional[AIEditorCursor] = None
    references: list[AIEditorReference] = Field(default_factory=list)
    resource_ids: list[int] = Field(default_factory=list)


class AIChatActionResponse(BaseModel):
    message: str
    action: str
    action_payload: Optional[dict[str, Any]] = None
    work_run: Optional[AIWorkRunResponse] = None
