import enum
from datetime import datetime
from app.models.time import utcnow

from sqlalchemy import Column, DateTime, Enum, Float, ForeignKey, Integer, JSON, String, Text
from sqlalchemy.orm import relationship

from app.database import Base


class AIWorkRunStatus(enum.Enum):
    PENDING = "pending"
    RUNNING = "running"
    PROPOSED = "proposed"
    PARTIALLY_ACCEPTED = "partially_accepted"
    ACCEPTED = "accepted"
    REJECTED = "rejected"
    UNDONE = "undone"
    FAILED = "failed"


class AIProposedChangeType(enum.Enum):
    GENERATE_SECTION = "generate_section"
    REWRITE_SELECTION = "rewrite_selection"
    RENAME_SECTION = "rename_section"
    ADD_SECTION = "add_section"
    REORDER_SECTIONS = "reorder_sections"
    APPLY_OUTLINE_DIFF = "apply_outline_diff"


class AIProposedChangeStatus(enum.Enum):
    PROPOSED = "proposed"
    ACCEPTED = "accepted"
    REJECTED = "rejected"
    UNDONE = "undone"


class AIWorkRun(Base):
    __tablename__ = "ai_work_runs"

    id = Column(Integer, primary_key=True, index=True)
    document_id = Column(Integer, ForeignKey("documents.id"), nullable=False)
    provider = Column(String, nullable=True)
    model = Column(String, nullable=True)
    prompt_context = Column(JSON, nullable=True)
    status = Column(Enum(AIWorkRunStatus), nullable=False, default=AIWorkRunStatus.PENDING)
    estimated_prompt_tokens = Column(Integer, nullable=True)
    estimated_completion_tokens = Column(Integer, nullable=True)
    estimated_cost = Column(Float, nullable=True)
    actual_prompt_tokens = Column(Integer, nullable=True)
    actual_completion_tokens = Column(Integer, nullable=True)
    actual_cost = Column(Float, nullable=True)
    undo_group = Column(JSON, nullable=True)
    error_message = Column(Text, nullable=True)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=utcnow)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow)
    completed_at = Column(DateTime, nullable=True)

    document = relationship("Document", back_populates="ai_work_runs")
    creator = relationship("User", foreign_keys=[created_by])
    proposed_changes = relationship(
        "AIProposedChange",
        back_populates="work_run",
        cascade="all, delete-orphan",
    )


class AIProposedChange(Base):
    __tablename__ = "ai_proposed_changes"

    id = Column(Integer, primary_key=True, index=True)
    work_run_id = Column(Integer, ForeignKey("ai_work_runs.id"), nullable=False)
    document_id = Column(Integer, ForeignKey("documents.id"), nullable=False)
    section_id = Column(Integer, ForeignKey("sections.id"), nullable=True)
    change_type = Column(Enum(AIProposedChangeType), nullable=False)
    status = Column(
        Enum(AIProposedChangeStatus),
        nullable=False,
        default=AIProposedChangeStatus.PROPOSED,
    )
    title = Column(String, nullable=False)
    rationale = Column(Text, nullable=True)
    before_json = Column(JSON, nullable=True)
    after_json = Column(JSON, nullable=False)
    preview_markdown = Column(Text, nullable=True)
    accepted_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    accepted_at = Column(DateTime, nullable=True)
    rejected_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    rejected_at = Column(DateTime, nullable=True)
    undone_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=utcnow)

    work_run = relationship("AIWorkRun", back_populates="proposed_changes")
    document = relationship("Document")
    section = relationship("Section")
    accepter = relationship("User", foreign_keys=[accepted_by])
    rejecter = relationship("User", foreign_keys=[rejected_by])
