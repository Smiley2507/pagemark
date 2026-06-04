from datetime import datetime

from sqlalchemy import Column, DateTime, Float, ForeignKey, Integer, JSON, String
from sqlalchemy.orm import relationship

from app.database import Base


class ActivityEvent(Base):
    __tablename__ = "activity_events"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    event_type = Column(String, nullable=False)
    weight = Column(Float, nullable=False, default=1.0)
    analysis_id = Column(Integer, ForeignKey("analyses.id"), nullable=True)
    document_id = Column(Integer, ForeignKey("documents.id"), nullable=True)
    section_id = Column(Integer, ForeignKey("sections.id"), nullable=True)
    generation_run_id = Column(Integer, ForeignKey("generation_runs.id"), nullable=True)
    payload = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    project = relationship("Project")
    analysis = relationship("Analysis")
    document = relationship("Document")
    section = relationship("Section")
    generation_run = relationship("GenerationRun")
