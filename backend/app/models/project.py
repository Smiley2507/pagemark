import enum
from datetime import datetime
from app.models.time import utcnow
from sqlalchemy import (
    Column, Integer, String, Boolean, DateTime, ForeignKey, Enum, Text,
    ARRAY, JSON,
)
from sqlalchemy.orm import relationship
from app.database import Base


class ProjectStatus(enum.Enum):
    PENDING = "pending"
    DRAFT = "draft"
    FINALIZED = "finalized"


class SourceType(enum.Enum):
    ZIP = "zip"
    GIT = "git"
    SCRATCH = "scratch"


class Project(Base):
    __tablename__ = "projects"

    id = Column(Integer, primary_key=True, index=True)
    org_id = Column(Integer, ForeignKey("organizations.id"), nullable=False)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    name = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    status = Column(Enum(ProjectStatus), nullable=False, default=ProjectStatus.PENDING)
    source_type = Column(Enum(SourceType), nullable=False, default=SourceType.SCRATCH)
    source_provider = Column(String, nullable=True)
    source_owner = Column(String, nullable=True)
    source_repository = Column(String, nullable=True)
    selected_branch = Column(String, nullable=True)
    default_branch = Column(String, nullable=True)
    source_visibility = Column(String, nullable=True)
    last_synced_commit = Column(String, nullable=True)
    source_metadata = Column(JSON, nullable=True)
    tags = Column(ARRAY(String), default=[], server_default="{}")
    starred = Column(Boolean, default=False)
    context_md = Column(Text, nullable=True)
    export_settings = Column(JSON, nullable=True)
    webhook_secret = Column(String, nullable=True)
    webhook_id = Column(Integer, nullable=True)
    deleted_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=utcnow)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow)

    organization = relationship("Organization", foreign_keys=[org_id])
    creator = relationship("User", foreign_keys=[created_by], backref="created_projects")
    documents = relationship("Document", back_populates="project", cascade="all, delete-orphan")
    analyses = relationship("Analysis", back_populates="project", cascade="all, delete-orphan")
    source_exclusions = relationship(
        "ProjectSourceExclusion",
        back_populates="project",
        cascade="all, delete-orphan",
    )


class ProjectSourceExclusion(Base):
    __tablename__ = "project_source_exclusions"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    pattern = Column(String, nullable=False)
    reason = Column(Text, nullable=True)
    enabled = Column(Boolean, nullable=False, default=True)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=utcnow)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow)

    project = relationship("Project", back_populates="source_exclusions")
    creator = relationship("User", foreign_keys=[created_by])
