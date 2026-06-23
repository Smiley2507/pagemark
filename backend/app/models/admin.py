import enum
from datetime import datetime
from app.models.time import utcnow
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Enum, Boolean, Text, Float
from sqlalchemy.orm import relationship
from app.database import Base


class SuperuserRequestStatus(enum.Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"


class AdminOtpCode(Base):
    __tablename__ = "admin_otp_codes"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    code_hash = Column(String, nullable=False)
    expires_at = Column(DateTime, nullable=False)
    used = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, default=utcnow)

    user = relationship("User")


class SuperuserRequest(Base):
    __tablename__ = "superuser_requests"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, nullable=False)
    name = Column(String, nullable=True)
    justification = Column(Text, nullable=True)
    status = Column(Enum(SuperuserRequestStatus), nullable=False, default=SuperuserRequestStatus.PENDING)
    reviewer_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    reviewed_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=utcnow)

    reviewer = relationship("User", foreign_keys=[reviewer_id])


class SystemSettings(Base):
    __tablename__ = "system_settings"

    id = Column(Integer, primary_key=True, index=True)
    allow_public_signup = Column(Boolean, default=True, nullable=False)
    default_org_quality_threshold = Column(Integer, default=70, nullable=False)
    maintenance_mode = Column(Boolean, default=False, nullable=False)
    max_orgs_per_user = Column(Integer, default=10, nullable=False)
    admin_session_timeout_minutes = Column(Integer, default=10, nullable=False)
    otp_expiry_minutes = Column(Integer, default=5, nullable=False)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow)
