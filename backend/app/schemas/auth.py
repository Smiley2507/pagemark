from pydantic import BaseModel, EmailStr, Field
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

class MeResponse(BaseModel):
    id: int
    email: str
    name: Optional[str]
    avatar_url: Optional[str]
    is_verified: bool
    created_at: datetime

    class Config:
        from_attributes = True
