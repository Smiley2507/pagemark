"""Import all ORM models so SQLAlchemy mappers are registered (API, Alembic, Celery)."""

from app.models.user import User, UserRole, UserSettings
from app.models.template import Template
from app.models.organization import Organization, OrganizationMember, OrgMemberRole, OrgMemberStatus
from app.models.project import Project
from app.models.document import Document, Section
from app.models.version import SectionVersion
from app.models.analysis import Analysis
from app.models.oauth_token import OAuthToken
from app.models.ai_credential import UserAiCredential
from app.models.chat import ChatThread, ChatMessage
from app.models.quality import QualityReport, QualityIssue, BrokenLink
from app.models.audit import AuditLog
from app.models.key import UserAPIKey

__all__ = [
    "User",
    "UserRole",
    "UserSettings",
    "Template",
    "Organization",
    "OrganizationMember",
    "OrgMemberRole",
    "OrgMemberStatus",
    "Project",
    "Document",
    "Section",
    "SectionVersion",
    "Analysis",
    "OAuthToken",
    "UserAiCredential",
    "ChatThread",
    "ChatMessage",
    "QualityReport",
    "QualityIssue",
    "BrokenLink",
    "AuditLog",
    "UserAPIKey",
]
