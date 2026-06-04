import enum
from datetime import datetime

from sqlalchemy import Column, DateTime, Enum, Float, ForeignKey, Integer, JSON, String, Text
from sqlalchemy.orm import relationship

from app.database import Base


class GenerationMode(enum.Enum):
    COMPLETE_DOCUMENT = "complete_document"
    SECTION_ON_DEMAND = "section_on_demand"


class GenerationRunStatus(enum.Enum):
    PENDING = "pending"
    RUNNING = "running"
    PAUSED = "paused"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELED = "canceled"


class GenerationTaskStatus(enum.Enum):
    QUEUED = "queued"
    GENERATING = "generating"
    READY = "ready"
    PAUSED = "paused"
    FAILED = "failed"
    SKIPPED = "skipped"


class FailoverState(enum.Enum):
    NOT_REQUIRED = "not_required"
    NEEDS_CONFIRMATION = "needs_confirmation"
    CONFIRMED = "confirmed"
    DECLINED = "declined"


class GenerationRun(Base):
    __tablename__ = "generation_runs"

    id = Column(Integer, primary_key=True, index=True)
    document_id = Column(Integer, ForeignKey("documents.id"), nullable=False)
    mode = Column(Enum(GenerationMode), nullable=False)
    intended_provider = Column(String, nullable=True)
    intended_model = Column(String, nullable=True)
    status = Column(Enum(GenerationRunStatus), nullable=False, default=GenerationRunStatus.PENDING)
    failover_state = Column(Enum(FailoverState), nullable=False, default=FailoverState.NOT_REQUIRED)
    estimated_prompt_tokens = Column(Integer, nullable=True)
    estimated_completion_tokens = Column(Integer, nullable=True)
    estimated_cost = Column(Float, nullable=True)
    actual_prompt_tokens = Column(Integer, nullable=True)
    actual_completion_tokens = Column(Integer, nullable=True)
    actual_cost = Column(Float, nullable=True)
    error_message = Column(Text, nullable=True)
    run_metadata = Column(JSON, nullable=True)
    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    document = relationship("Document", back_populates="generation_runs")
    section_tasks = relationship(
        "GenerationSectionTask",
        back_populates="generation_run",
        cascade="all, delete-orphan",
    )


class GenerationSectionTask(Base):
    __tablename__ = "generation_section_tasks"

    id = Column(Integer, primary_key=True, index=True)
    generation_run_id = Column(Integer, ForeignKey("generation_runs.id"), nullable=False)
    section_id = Column(Integer, ForeignKey("sections.id"), nullable=False)
    status = Column(Enum(GenerationTaskStatus), nullable=False, default=GenerationTaskStatus.QUEUED)
    dependency_section_ids = Column(JSON, nullable=True)
    actual_provider = Column(String, nullable=True)
    actual_model = Column(String, nullable=True)
    prompt_tokens = Column(Integer, nullable=True)
    completion_tokens = Column(Integer, nullable=True)
    cost = Column(Float, nullable=True)
    error_message = Column(Text, nullable=True)
    task_metadata = Column(JSON, nullable=True)
    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    generation_run = relationship("GenerationRun", back_populates="section_tasks")
    section = relationship("Section")
