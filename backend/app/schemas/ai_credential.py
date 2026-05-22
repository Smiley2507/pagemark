from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field


class AiModelOption(BaseModel):
    id: str
    label: str


class AiProviderCatalogItem(BaseModel):
    id: str
    label: str
    models: List[AiModelOption]


class AiProviderCatalogResponse(BaseModel):
    providers: List[AiProviderCatalogItem]


class AiCredentialResponse(BaseModel):
    id: int
    provider: str
    model_id: str
    key_hint: str
    is_active: bool
    validated_at: Optional[datetime] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class AiCredentialListResponse(BaseModel):
    credentials: List[AiCredentialResponse]
    has_active: bool


class AiCredentialUpsertRequest(BaseModel):
    api_key: str = Field(..., min_length=8)
    model_id: str
