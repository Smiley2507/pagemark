from datetime import datetime
from sqlalchemy import Column, Integer, Float, DateTime, ForeignKey, JSON
from app.database import Base


class NLPReport(Base):
    __tablename__ = "nlp_reports"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    readability_score = Column(Float, default=0.0)
    entities = Column(JSON, default=list)
    style_analysis = Column(JSON, default=dict)
    suggestions = Column(JSON, default=list)
    created_at = Column(DateTime, default=datetime.utcnow)
