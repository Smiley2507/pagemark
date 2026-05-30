import enum
from datetime import datetime
from sqlalchemy import (
    Column, Integer, String, Text, DateTime, Float, ForeignKey, Enum, UniqueConstraint,
)
from sqlalchemy.orm import relationship
from app.database import Base


class IssueSeverity(enum.Enum):
    ERROR = "error"
    WARNING = "warning"
    INFO = "info"


class QualityReport(Base):
    __tablename__ = "quality_reports"
    __table_args__ = (
        UniqueConstraint("project_id", name="uq_quality_reports_project_id"),
    )

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    overall_score = Column(Float, nullable=False, default=0.0)
    completeness = Column(Float, nullable=False, default=0.0)
    consistency = Column(Float, nullable=False, default=0.0)
    readability = Column(Float, nullable=False, default=0.0)
    accuracy = Column(Float, nullable=False, default=0.0)
    generated_at = Column(DateTime, default=datetime.utcnow)

    project = relationship("Project", backref="quality_reports")
    issues = relationship("QualityIssue", back_populates="report", cascade="all, delete-orphan")
    broken_links = relationship("BrokenLink", back_populates="report", cascade="all, delete-orphan")


class QualityIssue(Base):
    __tablename__ = "quality_issues"

    id = Column(Integer, primary_key=True, index=True)
    report_id = Column(Integer, ForeignKey("quality_reports.id"), nullable=False)
    severity = Column(Enum(IssueSeverity), nullable=False, default=IssueSeverity.INFO)
    section_ref = Column(String, nullable=True)
    message = Column(Text, nullable=False)
    suggestion = Column(Text, nullable=True)

    report = relationship("QualityReport", back_populates="issues")


class BrokenLink(Base):
    __tablename__ = "broken_links"

    id = Column(Integer, primary_key=True, index=True)
    report_id = Column(Integer, ForeignKey("quality_reports.id"), nullable=False)
    url = Column(String, nullable=False)
    status_code = Column(Integer, nullable=True)   # None means connection error
    section_ref = Column(String, nullable=True)

    report = relationship("QualityReport", back_populates="broken_links")
