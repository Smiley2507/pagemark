from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict


class APIKeyCreate(BaseModel):
    name: str
    expires_at: Optional[datetime] = None


class APIKeyResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    created_at: datetime
    expires_at: Optional[datetime]
    # raw_key is only returned once at creation time; not stored in DB
    raw_key: Optional[str] = None
