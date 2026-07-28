import enum
from datetime import datetime
from app.models.time import utcnow
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Enum
from sqlalchemy.orm import relationship
from app.database import Base


class DocumentSharePermission(enum.Enum):
    VIEW = "view"
    COMMENT = "comment"
    EDIT = "edit"


class DocumentShare(Base):
    __tablename__ = "document_shares"

    id = Column(Integer, primary_key=True, index=True)
    document_id = Column(Integer, ForeignKey("documents.id"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    permission = Column(Enum(DocumentSharePermission), nullable=False, default=DocumentSharePermission.VIEW)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=utcnow)
    revoked_at = Column(DateTime, nullable=True)

    document = relationship("Document", foreign_keys=[document_id])
    user = relationship("User", foreign_keys=[user_id])
    creator = relationship("User", foreign_keys=[created_by])
