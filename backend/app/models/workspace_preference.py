from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey, Integer, JSON, String, UniqueConstraint
from sqlalchemy.orm import relationship

from app.database import Base


class WorkspacePreference(Base):
    __tablename__ = "workspace_preferences"
    __table_args__ = (
        UniqueConstraint(
            "user_id",
            "surface",
            "context_id",
            name="uq_workspace_preferences_user_surface_context",
        ),
    )

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    surface = Column(String, nullable=False)
    context_id = Column(String, nullable=True)
    preferences_json = Column(JSON, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User")
