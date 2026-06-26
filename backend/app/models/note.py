from datetime import datetime
from app.models.time import utcnow
from sqlalchemy import Column, Integer, Text, DateTime, ForeignKey, JSON
from sqlalchemy.orm import relationship
from app.database import Base


class CollaborationNote(Base):
    __tablename__ = "collaboration_notes"

    id = Column(Integer, primary_key=True, index=True)
    document_id = Column(Integer, ForeignKey("documents.id"), nullable=False)
    section_id = Column(Integer, ForeignKey("sections.id"), nullable=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    content = Column(Text, nullable=False)
    references_json = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=utcnow)

    document = relationship("Document", backref="notes")
    section = relationship("Section", backref="notes")
    user = relationship("User", backref="notes")
