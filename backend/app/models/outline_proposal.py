import enum
from datetime import datetime
from app.models.time import utcnow

from sqlalchemy import inspect
from sqlalchemy import Column, DateTime, Enum, ForeignKey, Integer, JSON, String
from sqlalchemy import event
from sqlalchemy.orm import relationship

from app.database import Base


class OutlineProposalStatus(enum.Enum):
    DRAFT = "draft"
    APPROVED = "approved"
    SUPERSEDED = "superseded"


class OutlineProposalBasis(enum.Enum):
    TEMPLATE = "template"
    CUSTOM_OUTLINE = "custom_outline"
    ANALYSIS_ADAPTED = "analysis_adapted"


class OutlineProposal(Base):
    __tablename__ = "outline_proposals"

    id = Column(Integer, primary_key=True, index=True)
    document_id = Column(Integer, ForeignKey("documents.id"), nullable=False)
    analysis_id = Column(Integer, ForeignKey("analyses.id"), nullable=True)
    basis = Column(Enum(OutlineProposalBasis), nullable=False)
    status = Column(
        Enum(OutlineProposalStatus),
        nullable=False,
        default=OutlineProposalStatus.DRAFT,
    )
    version = Column(Integer, nullable=False, default=1)
    outline_json = Column(JSON, nullable=False)
    explanation_json = Column(JSON, nullable=True)
    approved_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    approved_at = Column(DateTime, nullable=True)
    approval_metadata = Column(JSON, nullable=True)
    superseded_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=utcnow)

    document = relationship("Document", back_populates="outline_proposals")
    analysis = relationship("Analysis", back_populates="outline_proposals")
    approver = relationship("User", foreign_keys=[approved_by])


@event.listens_for(OutlineProposal, "before_update")
def prevent_approved_outline_mutation(mapper, connection, target):
    if target.status != OutlineProposalStatus.APPROVED:
        return

    state = inspect(target)
    immutable_fields = [
        "document_id",
        "analysis_id",
        "basis",
        "outline_json",
        "explanation_json",
    ]
    for field in immutable_fields:
        if state.attrs[field].history.has_changes():
            raise ValueError("Approved Outline Proposals are immutable")
