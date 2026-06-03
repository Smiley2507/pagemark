import enum
from datetime import datetime
from sqlalchemy import (
    Column, Integer, String, Text, DateTime, ForeignKey, Enum, Boolean,
)
from sqlalchemy.orm import relationship
from app.database import Base


class SectionStatus(enum.Enum):
    PENDING = "pending"
    DRAFT = "draft"
    FINALIZED = "finalized"
    NEEDS_INPUT = "needs_input"


class LifecycleStatus(enum.Enum):
    ACTIVE = "active"
    DELETED = "deleted"
    ARCHIVED = "archived"


class Document(Base):
    __tablename__ = "documents"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    title = Column(String, nullable=False, default="Documentation")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    project = relationship("Project", back_populates="documents")
    sections = relationship("Section", back_populates="document", cascade="all, delete-orphan")


class Section(Base):
    __tablename__ = "sections"

    id = Column(Integer, primary_key=True, index=True)
    document_id = Column(Integer, ForeignKey("documents.id"), nullable=False)
    parent_id = Column(Integer, ForeignKey("sections.id"), nullable=True)
    order_index = Column(Integer, nullable=False, default=0)
    heading = Column(String, nullable=False)
    title = Column(String, nullable=True)
    is_custom = Column(Boolean, default=False)
    lifecycle_status = Column(Enum(LifecycleStatus), nullable=False, default=LifecycleStatus.ACTIVE)
    confidence_score = Column(Integer, nullable=True)
    content_md = Column(Text, default="")
    status = Column(Enum(SectionStatus), nullable=False, default=SectionStatus.PENDING)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    document = relationship("Document", back_populates="sections")
    parent = relationship("Section", remote_side=[id], backref="children")
    versions = relationship(
        "SectionVersion",
        back_populates="section",
        cascade="all, delete-orphan",
    )
    clarification_requests = relationship(
        "ClarificationRequest",
        back_populates="section",
        cascade="all, delete-orphan",
    )
