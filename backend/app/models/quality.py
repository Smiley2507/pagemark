import enum
from app.models.time import utcnow
from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Enum,
    Float,
    ForeignKey,
    Integer,
    JSON,
    String,
    Text,
    UniqueConstraint,
    text,
)
from sqlalchemy.orm import relationship
from app.database import Base


class IssueSeverity(enum.Enum):
    ERROR = "error"
    WARNING = "warning"
    INFO = "info"


class QualityFindingCategory(enum.Enum):
    COMPLETENESS = "completeness"
    ACCEPTANCE = "acceptance"
    TERMINOLOGY = "terminology"
    LINKS = "links"
    READABILITY = "readability"
    GRAMMAR = "grammar"
    ACCURACY = "accuracy"


class QualityFindingStatus(enum.Enum):
    OPEN = "open"
    PROPOSED = "proposed"
    RESOLVED = "resolved"
    DISMISSED = "dismissed"


class QualityReport(Base):
    __tablename__ = "quality_reports"
    __table_args__ = (
        UniqueConstraint("document_id", name="uq_quality_reports_document_id"),
    )

    id = Column(Integer, primary_key=True, index=True)
    document_id = Column(Integer, ForeignKey("documents.id"), nullable=False)
    overall_score = Column(Float, nullable=False, default=0.0)
    completeness = Column(Float, nullable=False, default=0.0)
    acceptance_coverage = Column(Float, nullable=False, default=100.0, server_default=text("100.0"))
    consistency = Column(Float, nullable=False, default=0.0)
    readability = Column(Float, nullable=False, default=0.0)
    accuracy = Column(Float, nullable=False, default=0.0)
    generated_at = Column(DateTime, default=utcnow)

    document = relationship("Document", back_populates="quality_reports")
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


class QualityFinding(Base):
    __tablename__ = "quality_findings"
    __table_args__ = (
        UniqueConstraint(
            "document_id",
            "category",
            "content_fingerprint",
            name="uq_quality_findings_document_category_fingerprint",
        ),
    )

    id = Column(Integer, primary_key=True, index=True)
    document_id = Column(Integer, ForeignKey("documents.id"), nullable=False)
    report_id = Column(Integer, ForeignKey("quality_reports.id"), nullable=True)
    category = Column(Enum(QualityFindingCategory), nullable=False)
    status = Column(Enum(QualityFindingStatus), nullable=False, default=QualityFindingStatus.OPEN)
    severity = Column(Enum(IssueSeverity), nullable=False, default=IssueSeverity.INFO)
    section_id = Column(Integer, ForeignKey("sections.id"), nullable=True)
    section_ref = Column(String, nullable=True)
    message = Column(Text, nullable=False)
    suggestion = Column(Text, nullable=True)
    quote = Column(Text, nullable=True)
    offset = Column(Integer, nullable=True)
    length = Column(Integer, nullable=True)
    replacements = Column(JSON, nullable=True)
    rule_id = Column(String, nullable=True)
    content_fingerprint = Column(String, nullable=False)
    provider = Column(String, nullable=True)
    provider_metadata = Column(JSON, nullable=True)
    stale_location = Column(Boolean, nullable=False, default=False, server_default=text("false"))
    first_seen_at = Column(DateTime, default=utcnow)
    last_seen_at = Column(DateTime, default=utcnow, onupdate=utcnow)

    document = relationship("Document")
    report = relationship("QualityReport")
    section = relationship("Section")


class BrokenLink(Base):
    __tablename__ = "broken_links"

    id = Column(Integer, primary_key=True, index=True)
    report_id = Column(Integer, ForeignKey("quality_reports.id"), nullable=False)
    url = Column(String, nullable=False)
    status_code = Column(Integer, nullable=True)   # None means connection error
    section_ref = Column(String, nullable=True)

    report = relationship("QualityReport", back_populates="broken_links")
