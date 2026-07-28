from datetime import datetime
from app.models.time import utcnow
from sqlalchemy import Column, Integer, String, Text, Boolean, DateTime, ForeignKey, JSON
from sqlalchemy.orm import relationship
from app.database import Base


class Template(Base):
    __tablename__ = "templates"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    category = Column(String, nullable=True)
    purpose = Column(Text, nullable=True)
    intended_audience = Column(Text, nullable=True)
    expected_outcome = Column(Text, nullable=True)
    structure_guidance = Column(JSON, nullable=True)
    section_generation_guidance = Column(JSON, nullable=True)
    recommended_print_profile = Column(JSON, nullable=True)
    compatible_repository_traits = Column(JSON, nullable=True)
    estimated_generation_scope = Column(JSON, nullable=True)
    outline_preview = Column(JSON, nullable=True)
    sections_json = Column(JSON, nullable=True)
    guidance = Column(Text, nullable=True)
    system_prompt = Column(Text, nullable=True)
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    is_builtin = Column(Boolean, default=False)
    created_at = Column(DateTime, default=utcnow)

    documents = relationship("Document", back_populates="template")
