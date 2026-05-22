from datetime import datetime
from sqlalchemy import (
    Column,
    Integer,
    String,
    DateTime,
    ForeignKey,
    Boolean,
    UniqueConstraint,
)
from sqlalchemy.orm import relationship
from app.database import Base


class UserAiCredential(Base):
    __tablename__ = "user_ai_credentials"
    __table_args__ = (
        UniqueConstraint("user_id", "provider", name="uq_user_ai_credentials_user_provider"),
    )

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    provider = Column(String, nullable=False)  # anthropic | google
    api_key_encrypted = Column(String, nullable=False)
    model_id = Column(String, nullable=False)
    is_active = Column(Boolean, nullable=False, default=False)
    key_hint = Column(String, nullable=False)  # last 4 chars
    validated_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User", backref="ai_credentials")
