"""Import all ORM models so SQLAlchemy mappers are registered (API, Alembic, Celery)."""

from app.models.user import User, UserRole, UserSettings
from app.models.template import Template
from app.models.organization import Organization, OrganizationMember, OrganizationJoinLink, OrgMemberRole, OrgMemberStatus
from app.models.project import Project, ProjectSourceExclusion, ProjectStatus, SourceType
from app.models.document import (
    Document,
    DocumentSetupStage,
    DocumentStatus,
    Section,
    SectionContentLifecycle,
    SectionStatus,
)
from app.models.version import SectionVersion
from app.models.analysis import Analysis, AnalysisStatus
from app.models.outline_proposal import OutlineProposal, OutlineProposalBasis, OutlineProposalStatus
from app.models.template_recommendation import TemplateRecommendation, TemplateRecommendationBasis
from app.models.generation import (
    FailoverState,
    GenerationMode,
    GenerationRun,
    GenerationRunStatus,
    GenerationSectionTask,
    GenerationTaskStatus,
)
from app.models.ai_work import (
    AIProposedChange,
    AIProposedChangeStatus,
    AIProposedChangeType,
    AIWorkRun,
    AIWorkRunStatus,
)
from app.models.evidence import EvidenceReference
from app.models.activity import ActivityEvent
from app.models.workspace_preference import WorkspacePreference
from app.models.oauth_token import OAuthToken
from app.models.ai_credential import UserAiCredential
from app.models.chat import ChatThread, ChatMessage, ChatMessageResource
from app.models.resource import Resource, ResourceType
from app.models.quality import (
    BrokenLink,
    QualityFinding,
    QualityFindingCategory,
    QualityFindingStatus,
    QualityIssue,
    QualityReport,
)
from app.models.audit import AuditLog
from app.models.key import UserAPIKey
from app.models.clarification import ClarificationRequest, ClarificationStatus
from app.models.note import CollaborationNote
from app.models.nlp import NLPReport
from app.models.document_share import DocumentShare, DocumentSharePermission

__all__ = [
    "User",
    "UserRole",
    "UserSettings",
    "Template",
    "Organization",
    "OrganizationMember",
    "OrganizationJoinLink",
    "OrgMemberRole",
    "OrgMemberStatus",
    "Project",
    "ProjectStatus",
    "ProjectSourceExclusion",
    "SourceType",
    "Document",
    "DocumentSetupStage",
    "DocumentStatus",
    "Section",
    "SectionContentLifecycle",
    "SectionStatus",
    "SectionVersion",
    "Analysis",
    "AnalysisStatus",
    "OutlineProposal",
    "OutlineProposalBasis",
    "OutlineProposalStatus",
    "TemplateRecommendation",
    "TemplateRecommendationBasis",
    "GenerationMode",
    "GenerationRun",
    "GenerationRunStatus",
    "GenerationSectionTask",
    "GenerationTaskStatus",
    "FailoverState",
    "AIWorkRun",
    "AIWorkRunStatus",
    "AIProposedChange",
    "AIProposedChangeType",
    "AIProposedChangeStatus",
    "EvidenceReference",
    "ActivityEvent",
    "WorkspacePreference",
    "OAuthToken",
    "UserAiCredential",
    "ChatThread",
    "ChatMessage",
    "ChatMessageResource",
    "Resource",
    "ResourceType",
    "QualityReport",
    "QualityIssue",
    "QualityFinding",
    "QualityFindingCategory",
    "QualityFindingStatus",
    "BrokenLink",
    "AuditLog",
    "UserAPIKey",
    "ClarificationRequest",
    "ClarificationStatus",
    "CollaborationNote",
    "NLPReport",
    "DocumentShare",
    "DocumentSharePermission",
]
