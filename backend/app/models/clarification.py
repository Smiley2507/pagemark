import enum
from datetime import datetime
from app.models.time import utcnow
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Enum, JSON
from sqlalchemy.orm import relationship
from app.database import Base

class ClarificationStatus(enum.Enum):
    PENDING = "pending"
    RESOLVED = "resolved"
    SKIPPED = "skipped"

class ClarificationRequest(Base):
    __tablename__ = "clarification_requests"

    id = Column(Integer, primary_key=True, index=True)
    section_id = Column(Integer, ForeignKey("sections.id"), nullable=True)
    document_id = Column(Integer, ForeignKey("documents.id"), nullable=True)
    outline_proposal_id = Column(Integer, ForeignKey("outline_proposals.id"), nullable=True)
    question = Column(Text, nullable=False)
    user_answer = Column(Text, nullable=True)
    affected_sections_json = Column(JSON, nullable=True)
    confidence_tradeoff = Column(Text, nullable=True)
    status = Column(Enum(ClarificationStatus), nullable=False, default=ClarificationStatus.PENDING)
    created_at = Column(DateTime, default=utcnow)
    resolved_at = Column(DateTime, nullable=True)
    skipped_at = Column(DateTime, nullable=True)

    section = relationship("Section", back_populates="clarification_requests")
    document = relationship("Document")
    outline_proposal = relationship("OutlineProposal")
