from datetime import datetime
from enum import Enum
from typing import Optional
from pydantic import BaseModel, Field


class SharePermissionEnum(str, Enum):
    VIEW = "view"
    COMMENT = "comment"
    EDIT = "edit"


class ShareCreateRequest(BaseModel):
    user_id: int
    permission: SharePermissionEnum = SharePermissionEnum.VIEW


class ShareUpdateRequest(BaseModel):
    permission: SharePermissionEnum


class ShareResponse(BaseModel):
    id: int
    document_id: int
    user_id: int
    permission: SharePermissionEnum
    created_by: int
    created_at: datetime
    revoked_at: Optional[datetime] = None
    user_name: Optional[str] = None
    user_email: Optional[str] = None
    user_avatar: Optional[str] = None


class ShareListResponse(BaseModel):
    shares: list[ShareResponse]
    total: int
