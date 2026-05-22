import enum
from datetime import datetime
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
    file_tree_json = Column(JSON, nullable=True)
    languages_json = Column(JSON, nullable=True)
    endpoints_json = Column(JSON, nullable=True)
    complexity_json = Column(JSON, nullable=True)
    outline_json = Column(JSON, nullable=True)
    outline_applied = Column(Boolean, nullable=False, default=False)
    outline_skipped = Column(Boolean, nullable=False, default=False)
    outline_skip_reason = Column(String, nullable=True)
    error_message = Column(Text, nullable=True)
    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    project = relationship("Project", backref="analyses")
