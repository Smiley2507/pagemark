from datetime import datetime
from enum import Enum
from typing import Any, Optional

from pydantic import BaseModel, Field

from app.schemas.template import TemplateResponse


class DocumentSetupStageEnum(str, Enum):
    PURPOSE = "purpose"
    TEMPLATE_SELECTION = "template_selection"
    OUTLINE_REVIEW = "outline_review"
    GENERATION_MODE = "generation_mode"
    EDITOR_READY = "editor_ready"


class DocumentCreateRequest(BaseModel):
    title: str = Field("Untitled Document", min_length=1, max_length=200)
    template_id: Optional[int] = None
    purpose: Optional[str] = None
    audience: Optional[str] = None
    context: Optional[str] = None
    setup_stage: DocumentSetupStageEnum = DocumentSetupStageEnum.TEMPLATE_SELECTION
    tags: list[str] = Field(default_factory=list)
    export_settings: Optional[dict[str, Any]] = None
    print_profile: Optional[dict[str, Any]] = None


class DocumentUpdateRequest(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=200)
    template_id: Optional[int] = None
    purpose: Optional[str] = None
    audience: Optional[str] = None
    context: Optional[str] = None
    setup_stage: Optional[DocumentSetupStageEnum] = None
    tags: Optional[list[str]] = None
    export_settings: Optional[dict[str, Any]] = None
    print_profile: Optional[dict[str, Any]] = None
    custom_outline_metadata: Optional[dict[str, Any]] = None


class DocumentProgressResponse(BaseModel):
    total_sections: int
    reviewed_sections: int
    generated_sections: int
    pct: float


class DocumentResponse(BaseModel):
    id: int
    project_id: int
    title: str
    setup_stage: DocumentSetupStageEnum
    status: str
    freshness: str
    progress: DocumentProgressResponse
    tags: list[str] = Field(default_factory=list)
    template: Optional[TemplateResponse] = None
    template_id: Optional[int] = None
    purpose: Optional[str] = None
    audience: Optional[str] = None
    context: Optional[str] = None
    export_settings: Optional[dict[str, Any]] = None
    print_profile: Optional[dict[str, Any]] = None
    custom_outline_metadata: Optional[dict[str, Any]] = None
    last_activity_at: datetime
    reviewer_id: Optional[int] = None
    created_at: datetime
    updated_at: datetime


class DocumentListResponse(BaseModel):
    documents: list[DocumentResponse]
    total: int


class TemplateRecommendationBasisEnum(str, Enum):
    RULE_BASED = "rule_based"
    AI_PERSONALIZED = "ai_personalized"
    CUSTOM_OUTLINE_SEEDED = "custom_outline_seeded"


class OutlineProposalStatusEnum(str, Enum):
    DRAFT = "draft"
    APPROVED = "approved"
    SUPERSEDED = "superseded"


class OutlineProposalBasisEnum(str, Enum):
    TEMPLATE = "template"
    CUSTOM_OUTLINE = "custom_outline"
    ANALYSIS_ADAPTED = "analysis_adapted"


class TemplateRecommendationRequest(BaseModel):
    basis: TemplateRecommendationBasisEnum = TemplateRecommendationBasisEnum.RULE_BASED
    refresh: bool = False


class TemplateRecommendationResponse(BaseModel):
    id: int
    document_id: int
    analysis_id: Optional[int]
    template_id: Optional[int]
    basis: TemplateRecommendationBasisEnum
    score: Optional[float]
    explanation: Optional[str]
    supporting_facts: dict[str, Any] = Field(default_factory=dict)
    provider_usage_ref: Optional[dict[str, Any]] = None
    template: Optional[TemplateResponse] = None
    created_at: datetime


class TemplateRecommendationListResponse(BaseModel):
    recommendations: list[TemplateRecommendationResponse]


class OutlineProposalCreateRequest(BaseModel):
    template_id: Optional[int] = None
    outline: Optional[list[dict[str, Any]]] = None
    basis: OutlineProposalBasisEnum = OutlineProposalBasisEnum.TEMPLATE
    explanation: Optional[dict[str, Any]] = None


class OutlineProposalUpdateRequest(BaseModel):
    outline: Optional[list[dict[str, Any]]] = None
    explanation: Optional[dict[str, Any]] = None


class OutlineProposalResponse(BaseModel):
    id: int
    document_id: int
    analysis_id: Optional[int]
    basis: OutlineProposalBasisEnum
    status: OutlineProposalStatusEnum
    version: int
    outline: list[dict[str, Any]]
    explanation: Optional[dict[str, Any]]
    approved_by: Optional[int]
    approved_at: Optional[datetime]
    approval_metadata: Optional[dict[str, Any]]
    superseded_at: Optional[datetime]
    created_at: datetime


class OutlineProposalListResponse(BaseModel):
    proposals: list[OutlineProposalResponse]


class ClarificationRequestCreateRequest(BaseModel):
    question: str = Field(..., min_length=1)
    affected_sections: list[str] = Field(default_factory=list)
    confidence_tradeoff: str


class ClarificationRequestResponse(BaseModel):
    id: int
    document_id: Optional[int]
    outline_proposal_id: Optional[int]
    section_id: Optional[int]
    question: str
    affected_sections: list[str] = Field(default_factory=list)
    confidence_tradeoff: Optional[str]
    status: str
    user_answer: Optional[str]
    created_at: datetime
    resolved_at: Optional[datetime]
    skipped_at: Optional[datetime]


class DocumentSetupStateResponse(BaseModel):
    document: DocumentResponse
    recommendations: list[TemplateRecommendationResponse] = Field(default_factory=list)
    outline_proposals: list[OutlineProposalResponse] = Field(default_factory=list)
    clarification_requests: list[ClarificationRequestResponse] = Field(default_factory=list)
    sections: list[dict[str, Any]] = Field(default_factory=list)


class GenerationModeEnum(str, Enum):
    COMPLETE_DOCUMENT = "complete_document"
    SECTION_ON_DEMAND = "section_on_demand"


class GenerationEstimateRequest(BaseModel):
    mode: GenerationModeEnum
    section_ids: list[int] | None = None


class GenerationEstimateResponse(BaseModel):
    mode: GenerationModeEnum
    provider: Optional[str] = None
    model: Optional[str] = None
    relative_usage: str
    estimated_prompt_tokens: int
    estimated_completion_tokens: int
    estimated_cost: float
    uncertainty: str
    section_breakdown: list[dict[str, Any]]
    pricing_note: str
    model_guidance: str


class GenerationRunCreateRequest(BaseModel):
    mode: GenerationModeEnum
    section_ids: list[int] | None = None
    execute: bool = True


class GenerationSectionTaskResponse(BaseModel):
    id: int
    generation_run_id: int
    section_id: int
    status: str
    dependency_section_ids: list[int] = Field(default_factory=list)
    actual_provider: Optional[str] = None
    actual_model: Optional[str] = None
    prompt_tokens: Optional[int] = None
    completion_tokens: Optional[int] = None
    cost: Optional[float] = None
    error_message: Optional[str] = None
    task_metadata: Optional[dict[str, Any]] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None


class GenerationRunResponse(BaseModel):
    id: int
    document_id: int
    mode: GenerationModeEnum
    intended_provider: Optional[str] = None
    intended_model: Optional[str] = None
    status: str
    failover_state: str
    estimated_prompt_tokens: Optional[int] = None
    estimated_completion_tokens: Optional[int] = None
    estimated_cost: Optional[float] = None
    actual_prompt_tokens: Optional[int] = None
    actual_completion_tokens: Optional[int] = None
    actual_cost: Optional[float] = None
    error_message: Optional[str] = None
    run_metadata: Optional[dict[str, Any]] = None
    section_tasks: list[GenerationSectionTaskResponse] = Field(default_factory=list)
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    created_at: datetime
    updated_at: Optional[datetime] = None


class GenerationRunListResponse(BaseModel):
    generation_runs: list[GenerationRunResponse]


class GenerationFailoverConfirmRequest(BaseModel):
    provider: str
    model: str
