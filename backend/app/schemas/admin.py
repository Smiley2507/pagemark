from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, EmailStr


# ── Auth ─────────────────────────────────────────────────────────

class AdminLoginRequest(BaseModel):
    email: EmailStr
    password: str


class AdminLoginResponse(BaseModel):
    requires_otp: bool = True
    message: str = "OTP sent to your email"


class AdminVerifyOtpRequest(BaseModel):
    email: EmailStr
    code: str


class AdminVerifyOtpResponse(BaseModel):
    access_token: str
    token_type: str = "admin"
    expires_in_minutes: int = 10


class AdminMeResponse(BaseModel):
    id: int
    email: str
    name: Optional[str] = None
    is_superuser: bool


class SuperuserRequestCreate(BaseModel):
    email: EmailStr
    name: Optional[str] = None
    justification: Optional[str] = None


class SuperuserRequestOut(BaseModel):
    id: int
    email: str
    name: Optional[str] = None
    justification: Optional[str] = None
    status: str
    reviewer_id: Optional[int] = None
    reviewed_at: Optional[datetime] = None
    created_at: datetime

    class Config:
        from_attributes = True


class SuperuserRequestAction(BaseModel):
    action: str  # "approve" or "reject"


# ── Stats ────────────────────────────────────────────────────────

class SystemStats(BaseModel):
    total_users: int
    total_organizations: int
    total_projects: int
    total_documents: int
    active_users_last_24h: int
    active_users_last_7d: int
    active_users_last_30d: int
    documents_generated: int
    pending_superuser_requests: int


class GrowthDataPoint(BaseModel):
    date: str
    users: int = 0
    organizations: int = 0
    projects: int = 0
    documents: int = 0


class GrowthDataResponse(BaseModel):
    data: List[GrowthDataPoint]


# ── User management ──────────────────────────────────────────────

class AdminUserOut(BaseModel):
    id: int
    email: str
    name: Optional[str] = None
    is_verified: bool
    is_superuser: bool
    is_suspended: bool
    login_count: int
    created_at: datetime
    updated_at: Optional[datetime] = None
    organization_count: int = 0

    class Config:
        from_attributes = True


class AdminUserUpdate(BaseModel):
    is_suspended: Optional[bool] = None
    is_superuser: Optional[bool] = None
    name: Optional[str] = None


class AdminUserListResponse(BaseModel):
    users: List[AdminUserOut]
    total: int
    page: int
    page_size: int


# ── Organization management ──────────────────────────────────────

class AdminOrganizationOut(BaseModel):
    id: int
    name: str
    slug: str
    personal: bool
    quality_threshold: int
    created_by: int
    created_at: datetime
    member_count: int = 0
    project_count: int = 0

    class Config:
        from_attributes = True


class AdminOrganizationUpdate(BaseModel):
    name: Optional[str] = None
    quality_threshold: Optional[int] = None
    is_suspended: Optional[bool] = None


class AdminOrganizationListResponse(BaseModel):
    organizations: List[AdminOrganizationOut]
    total: int
    page: int
    page_size: int


# ── System settings ──────────────────────────────────────────────

class SystemSettingsOut(BaseModel):
    allow_public_signup: bool
    default_org_quality_threshold: int
    maintenance_mode: bool
    max_orgs_per_user: int
    admin_session_timeout_minutes: int
    otp_expiry_minutes: int

    class Config:
        from_attributes = True


class SystemSettingsUpdate(BaseModel):
    allow_public_signup: Optional[bool] = None
    default_org_quality_threshold: Optional[int] = None
    maintenance_mode: Optional[bool] = None
    max_orgs_per_user: Optional[int] = None
    admin_session_timeout_minutes: Optional[int] = None
    otp_expiry_minutes: Optional[int] = None


# ── Activity ─────────────────────────────────────────────────────

class AdminActivityEvent(BaseModel):
    id: int
    event_type: str
    message: Optional[str] = None
    user_id: Optional[int] = None
    user_name: Optional[str] = None
    project_id: Optional[int] = None
    project_name: Optional[str] = None
    organization_id: Optional[int] = None
    organization_name: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class AdminActivityResponse(BaseModel):
    events: List[AdminActivityEvent]
    total: int
    page: int
    page_size: int
