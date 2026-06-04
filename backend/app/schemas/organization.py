from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, ConfigDict
from app.models.organization import OrgMemberRole, OrgMemberStatus


# ── Organization ──────────────────────────────────────────────────────────────

class OrganizationCreate(BaseModel):
    name: str
    avatar_url: Optional[str] = None


class OrganizationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    slug: str
    avatar_url: Optional[str]
    personal: bool
    created_at: datetime
    quality_threshold: int = 70
    ai_provider: Optional[str] = None


# ── Member ────────────────────────────────────────────────────────────────────

class MemberResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    org_id: int
    role: OrgMemberRole
    status: OrgMemberStatus
    joined_at: datetime
    user_name: Optional[str] = None
    user_email: Optional[str] = None
    user_avatar: Optional[str] = None


class InviteMemberRequest(BaseModel):
    email: str
    role: OrgMemberRole = OrgMemberRole.DEVELOPER


class UpdateMemberRoleRequest(BaseModel):
    role: OrgMemberRole


# ── Audit Log ─────────────────────────────────────────────────────────────────

class AuditLogResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    org_id: Optional[int]
    action: str
    resource: Optional[str]
    created_at: datetime
    user_name: Optional[str] = None
    user_email: Optional[str] = None
