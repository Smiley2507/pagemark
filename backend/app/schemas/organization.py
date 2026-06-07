from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, ConfigDict, field_serializer, field_validator
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

    @field_serializer("role")
    def serialize_role(self, role: OrgMemberRole) -> str:
        return role.name

    @field_serializer("status")
    def serialize_status(self, status: OrgMemberStatus) -> str:
        return status.name


class InviteMemberRequest(BaseModel):
    email: str
    role: OrgMemberRole = OrgMemberRole.DEVELOPER

    @field_validator("role", mode="before")
    @classmethod
    def coerce_role(cls, v):
        if isinstance(v, str):
            return v.lower()
        return v


class UpdateMemberRoleRequest(BaseModel):
    role: OrgMemberRole

    @field_validator("role", mode="before")
    @classmethod
    def coerce_role(cls, v):
        if isinstance(v, str):
            return v.lower()
        return v


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
