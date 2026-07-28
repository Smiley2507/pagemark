from datetime import datetime
from app.models.time import utcnow

from sqlalchemy import Column, DateTime, ForeignKey, Integer, JSON, String
from sqlalchemy.orm import relationship

from app.database import Base


class EvidenceReference(Base):
    __tablename__ = "evidence_references"

    id = Column(Integer, primary_key=True, index=True)
    section_id = Column(Integer, ForeignKey("sections.id"), nullable=False)
    claim_anchor = Column(String, nullable=True)
    analysis_id = Column(Integer, ForeignKey("analyses.id"), nullable=False)
    artifact_type = Column(String, nullable=False)
    path = Column(String, nullable=True)
    symbol = Column(String, nullable=True)
    line_range_hint = Column(JSON, nullable=True)
    reference_metadata = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=utcnow)

    section = relationship("Section", back_populates="evidence_references")
    analysis = relationship("Analysis", back_populates="evidence_references")
