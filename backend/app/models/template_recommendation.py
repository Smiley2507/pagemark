import enum
from datetime import datetime
from app.models.time import utcnow

from sqlalchemy import Column, DateTime, Enum, Float, ForeignKey, Integer, JSON, Text
from sqlalchemy.orm import relationship

from app.database import Base


class TemplateRecommendationBasis(enum.Enum):
    RULE_BASED = "rule_based"
    AI_PERSONALIZED = "ai_personalized"
    CUSTOM_OUTLINE_SEEDED = "custom_outline_seeded"


class TemplateRecommendation(Base):
    __tablename__ = "template_recommendations"

    id = Column(Integer, primary_key=True, index=True)
    document_id = Column(Integer, ForeignKey("documents.id"), nullable=False)
    analysis_id = Column(Integer, ForeignKey("analyses.id"), nullable=True)
    template_id = Column(Integer, ForeignKey("templates.id"), nullable=True)
    basis = Column(Enum(TemplateRecommendationBasis), nullable=False)
    score = Column(Float, nullable=True)
    explanation = Column(Text, nullable=True)
    supporting_facts_json = Column(JSON, nullable=True)
    provider_usage_ref = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=utcnow)

    document = relationship("Document", back_populates="template_recommendations")
    analysis = relationship("Analysis", back_populates="template_recommendations")
    template = relationship("Template")
