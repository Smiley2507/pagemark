from datetime import datetime
from app.models.time import utcnow
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from app.database import Base


class UserAPIKey(Base):
    __tablename__ = "user_api_keys"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    name = Column(String, nullable=False)
    key_hash = Column(String, unique=True, nullable=False, index=True)
    created_at = Column(DateTime, default=utcnow)
    expires_at = Column(DateTime, nullable=True)

    user = relationship("User", foreign_keys=[user_id])
