import enum
from datetime import datetime
from app.models.time import utcnow
from sqlalchemy import (
    Column, Integer, String, Text, DateTime, ForeignKey, Enum, JSON, Boolean,
)
from sqlalchemy.orm import relationship
from app.database import Base


class AnalysisStatus(enum.Enum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"


class Analysis(Base):
    __tablename__ = "analyses"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    status = Column(Enum(AnalysisStatus), nullable=False, default=AnalysisStatus.PENDING)
    current_step = Column(String, nullable=True)
    step_number = Column(Integer, default=0)
    step_detail = Column(String, nullable=True)
    total_steps = Column(Integer, default=8)
    source_type = Column(String, nullable=False)          # 'zip' or 'git'
    source_path = Column(String, nullable=True)            # local path to source
    source_commit = Column(String, nullable=True)
    is_current = Column(Boolean, nullable=False, default=False)
    effective_exclusions_json = Column(JSON, nullable=True)
    source_metadata = Column(JSON, nullable=True)
    file_tree_json = Column(JSON, nullable=True)
    languages_json = Column(JSON, nullable=True)
    endpoints_json = Column(JSON, nullable=True)
    complexity_json = Column(JSON, nullable=True)
    analysis_data = Column(JSON, nullable=True)
    file_contents_json = Column(JSON, nullable=True)
    error_message = Column(Text, nullable=True)
    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=utcnow)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow)

    project = relationship("Project", back_populates="analyses")
    outline_proposals = relationship("OutlineProposal", back_populates="analysis")
    template_recommendations = relationship("TemplateRecommendation", back_populates="analysis")
    evidence_references = relationship("EvidenceReference", back_populates="analysis")
