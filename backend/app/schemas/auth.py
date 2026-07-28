from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator
from typing import Optional
from datetime import datetime

class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=8)
    name: str
    organization_name: Optional[str] = None

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class LoginResponse(BaseModel):
    requires_otp: bool = False
    user: Optional["MeResponse"] = None
    message: Optional[str] = None

class VerifyMfaRequest(BaseModel):
    email: EmailStr
    code: str

class MfaSettingsResponse(BaseModel):
    mfa_enabled: bool

class MfaEnableRequest(BaseModel):
    pass

class MfaVerifyEnableRequest(BaseModel):
    code: str

class ForgotPasswordRequest(BaseModel):
    email: EmailStr

class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str = Field(..., min_length=8)

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"

class UpdateMeRequest(BaseModel):
    name: Optional[str] = None
    avatar_url: Optional[str] = None
    password: Optional[str] = Field(None, min_length=8)

    @field_validator("avatar_url")
    @classmethod
    def validate_avatar_url(cls, v):
        if v is not None and not v.startswith(("http://", "https://")):
            raise ValueError("avatar_url must be a valid URL starting with http:// or https://")
        return v

class MeResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: str
    name: Optional[str]
    avatar_url: Optional[str]
    is_verified: bool
    is_first_login: bool = False
    created_at: datetime
