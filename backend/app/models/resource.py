"""Resource ORM model — unified context resource for the AI panel."""

import enum
from datetime import datetime
from app.models.time import utcnow

from sqlalchemy import Column, DateTime, Enum, ForeignKey, Integer, LargeBinary, String, Text
from sqlalchemy.orm import relationship

from app.database import Base


class ResourceType(str, enum.Enum):
    UPLOAD = "upload"
    NOTE = "note"
    DOCUMENT = "document"
    SECTION = "section"
    REPO_FILE = "repo_file"
    SYMBOL = "symbol"
    ANALYSIS = "analysis"
    TRANSIENT = "transient"


class Resource(Base):
    __tablename__ = "resources"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    type = Column(Enum(ResourceType), nullable=False)
    original_name = Column(String, nullable=False)
    mime_type = Column(String, nullable=True)
    size_bytes = Column(Integer, nullable=True)

    data = Column(LargeBinary, nullable=True)
    extracted_text = Column(Text, nullable=True)
    thumbnail = Column(LargeBinary, nullable=True)

    reference_type = Column(String, nullable=True)
    reference_id = Column(Integer, nullable=True)
    file_path = Column(String, nullable=True)
    symbol_name = Column(String, nullable=True)

    created_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=utcnow)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow)

    project = relationship("Project", backref="resources")
    creator = relationship("User", backref="resources")
