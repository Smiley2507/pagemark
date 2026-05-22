import enum
from datetime import datetime

from sqlalchemy import Column, DateTime, Enum, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship

from app.database import Base


class AuthorType(enum.Enum):
    USER = "user"
    AI = "ai"


class SectionVersion(Base):
    __tablename__ = "section_versions"

    id = Column(Integer, primary_key=True, index=True)
    section_id = Column(Integer, ForeignKey("sections.id"), nullable=False)
    content_md = Column(Text, nullable=False)
    author_type = Column(Enum(AuthorType), nullable=False, default=AuthorType.USER)
    summary = Column(String, nullable=True)
    added = Column(Integer, nullable=False, default=0)
    removed = Column(Integer, nullable=False, default=0)
    modified = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)

    section = relationship("Section", back_populates="versions")
