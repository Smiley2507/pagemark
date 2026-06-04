import enum
from datetime import datetime
from sqlalchemy import (
    Column, Integer, String, Text, DateTime, ForeignKey, Enum, Boolean, JSON,
)
from sqlalchemy.orm import relationship
from app.database import Base


class SectionContentLifecycle(enum.Enum):
    EMPTY = "empty"
    GENERATED_DRAFT = "generated_draft"
    REVIEWED = "reviewed"


class SectionStatus(enum.Enum):
    PENDING = "pending"
    DRAFT = "draft"
    FINALIZED = "finalized"
    NEEDS_INPUT = "needs_input"


class LifecycleStatus(enum.Enum):
    ACTIVE = "active"
    DELETED = "deleted"
    ARCHIVED = "archived"


class DocumentStatus(enum.Enum):
    DRAFT = "DRAFT"
    IN_REVIEW = "IN_REVIEW"
    APPROVED = "APPROVED"


class DocumentSetupStage(enum.Enum):
    PURPOSE = "purpose"
    TEMPLATE_SELECTION = "template_selection"
    OUTLINE_REVIEW = "outline_review"
    GENERATION_MODE = "generation_mode"
    EDITOR_READY = "editor_ready"


class Document(Base):
    __tablename__ = "documents"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    template_id = Column(Integer, ForeignKey("templates.id"), nullable=True)
    title = Column(String, nullable=False, default="Documentation")
    status = Column(Enum(DocumentStatus), nullable=False, default=DocumentStatus.DRAFT)
    setup_stage = Column(Enum(DocumentSetupStage), nullable=False, default=DocumentSetupStage.PURPOSE)
    purpose = Column(Text, nullable=True)
    audience = Column(Text, nullable=True)
    context = Column(Text, nullable=True)
    custom_outline_metadata = Column(JSON, nullable=True)
    tags = Column(JSON, nullable=True)
    export_settings = Column(JSON, nullable=True)
    freshness_state = Column(String, nullable=True)
    sharing_settings = Column(JSON, nullable=True)
    reviewer_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    approved_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    project = relationship("Project", back_populates="documents")
    template = relationship("Template", back_populates="documents")
    reviewer = relationship("User", foreign_keys=[reviewer_id])
    sections = relationship("Section", back_populates="document", cascade="all, delete-orphan")
    outline_proposals = relationship(
        "OutlineProposal",
        back_populates="document",
        cascade="all, delete-orphan",
    )
    template_recommendations = relationship(
        "TemplateRecommendation",
        back_populates="document",
        cascade="all, delete-orphan",
    )
    generation_runs = relationship(
        "GenerationRun",
        back_populates="document",
        cascade="all, delete-orphan",
    )
    quality_reports = relationship(
        "QualityReport",
        back_populates="document",
        cascade="all, delete-orphan",
    )


class Section(Base):
    __tablename__ = "sections"

    id = Column(Integer, primary_key=True, index=True)
    document_id = Column(Integer, ForeignKey("documents.id"), nullable=False)
    parent_id = Column(Integer, ForeignKey("sections.id"), nullable=True)
    order_index = Column(Integer, nullable=False, default=0)
    heading = Column(String, nullable=False)
    title = Column(String, nullable=True)
    is_custom = Column(Boolean, default=False)
    lifecycle_status = Column(Enum(LifecycleStatus), nullable=False, default=LifecycleStatus.ACTIVE)
    confidence_score = Column(Integer, nullable=True)
    content_md = Column(Text, default="")
    content_lifecycle = Column(
        Enum(SectionContentLifecycle),
        nullable=False,
        default=SectionContentLifecycle.EMPTY,
    )
    status = Column(Enum(SectionStatus), nullable=False, default=SectionStatus.PENDING)
    needs_input = Column(Boolean, nullable=False, default=False)
    is_generating = Column(Boolean, nullable=False, default=False)
    has_failed = Column(Boolean, nullable=False, default=False)
    is_potentially_stale = Column(Boolean, nullable=False, default=False)
    workflow_metadata = Column(JSON, nullable=True)
    reviewed_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    reviewed_at = Column(DateTime, nullable=True)
    reviewed_against_analysis_id = Column(Integer, ForeignKey("analyses.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    document = relationship("Document", back_populates="sections")
    parent = relationship("Section", remote_side=[id], backref="children")
    reviewer = relationship("User", foreign_keys=[reviewed_by])
    reviewed_against_analysis = relationship("Analysis", foreign_keys=[reviewed_against_analysis_id])
    evidence_references = relationship(
        "EvidenceReference",
        back_populates="section",
        cascade="all, delete-orphan",
    )
    versions = relationship(
        "SectionVersion",
        back_populates="section",
        cascade="all, delete-orphan",
    )
    clarification_requests = relationship(
        "ClarificationRequest",
        back_populates="section",
        cascade="all, delete-orphan",
    )
