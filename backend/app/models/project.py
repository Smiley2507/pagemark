import enum
from datetime import datetime
from typing import Optional
from sqlalchemy import (
    Column, Integer, String, Float, Boolean, DateTime, ForeignKey, Enum, Text,
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
    completion_pct = Column(Float, default=0.0)
    source_type = Column(Enum(SourceType), nullable=False, default=SourceType.SCRATCH)
    git_repo_url = Column(String, nullable=True)
    git_branch = Column(String, nullable=True)
    git_provider = Column(String, nullable=True)  # 'github', 'gitlab', 'bitbucket'
    template_id = Column(Integer, ForeignKey("templates.id"), nullable=True)
    starred = Column(Boolean, default=False)
    context_md = Column(Text, nullable=True)  # user-defined AI context (JSON or free text)
    deleted_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    organization = relationship("Organization", foreign_keys=[org_id])
    creator = relationship("User", foreign_keys=[created_by], backref="created_projects")
    template = relationship("Template", backref="projects")
    documents = relationship("Document", back_populates="project", cascade="all, delete-orphan")
