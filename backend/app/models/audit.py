from datetime import datetime
from app.models.time import utcnow
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from app.database import Base


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    org_id = Column(Integer, ForeignKey("organizations.id"), nullable=True)
    action = Column(String, nullable=False)   # e.g. "create_project", "invite_member"
    resource = Column(String, nullable=True)  # e.g. "project:42", "member:user@example.com"
    created_at = Column(DateTime, default=utcnow, index=True)

    user = relationship("User", foreign_keys=[user_id])
