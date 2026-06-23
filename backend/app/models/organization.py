import enum
from datetime import datetime
from app.models.time import utcnow
from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Enum
from sqlalchemy.orm import relationship
from app.database import Base


class OrgMemberRole(enum.Enum):
    ADMIN = "admin"
    PROJECT_MANAGER = "project_manager"
    DEVELOPER = "developer"
    TECHNICAL_WRITER = "technical_writer"
    VIEWER = "viewer"


class OrgMemberStatus(enum.Enum):
    ACTIVE = "active"
    INVITED = "invited"
    SUSPENDED = "suspended"
    DECLINED = "declined"
    CANCELLED = "cancelled"


class Organization(Base):
    __tablename__ = "organizations"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    slug = Column(String, unique=True, nullable=False, index=True)
    avatar_url = Column(String, nullable=True)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=utcnow)
    personal = Column(Boolean, default=False, nullable=False)
    quality_threshold = Column(Integer, default=70, nullable=False)
    ai_provider = Column(String, nullable=True)
    ai_key_encrypted = Column(String, nullable=True)

    members = relationship("OrganizationMember", back_populates="organization", cascade="all, delete-orphan")
    creator = relationship("User", foreign_keys=[created_by])


class OrganizationMember(Base):
    __tablename__ = "organization_members"

    id = Column(Integer, primary_key=True, index=True)
    org_id = Column(Integer, ForeignKey("organizations.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    role = Column(Enum(OrgMemberRole), nullable=False, default=OrgMemberRole.DEVELOPER)
    invited_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    joined_at = Column(DateTime, default=utcnow)
    status = Column(Enum(OrgMemberStatus), nullable=False, default=OrgMemberStatus.ACTIVE)
    invite_token = Column(String, nullable=True, index=True)
    invite_token_expires = Column(DateTime, nullable=True)

    organization = relationship("Organization", back_populates="members")
    user = relationship("User", foreign_keys=[user_id], backref="org_memberships")
    inviter = relationship("User", foreign_keys=[invited_by])


class OrganizationJoinLink(Base):
    __tablename__ = "organization_join_links"

    id = Column(Integer, primary_key=True, index=True)
    org_id = Column(Integer, ForeignKey("organizations.id"), nullable=False, index=True)
    code = Column(String, unique=True, nullable=False, index=True)
    role = Column(Enum(OrgMemberRole), nullable=False, default=OrgMemberRole.DEVELOPER)
    max_uses = Column(Integer, nullable=True)
    use_count = Column(Integer, default=0, nullable=False)
    expires_at = Column(DateTime, nullable=True)
    revoked_at = Column(DateTime, nullable=True)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=utcnow)

    organization = relationship("Organization", foreign_keys=[org_id])
    creator = relationship("User", foreign_keys=[created_by])
