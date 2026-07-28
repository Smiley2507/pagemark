from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, ConfigDict, Field


class AiModelOption(BaseModel):
    id: str
    label: str


class AiProviderCatalogItem(BaseModel):
    id: str
    label: str
    models: List[AiModelOption]


class AiProviderCatalogResponse(BaseModel):
    providers: List[AiProviderCatalogItem]


class AiProviderModelsResponse(BaseModel):
    provider: str
    models: List[AiModelOption]
    source: str


class AiCredentialResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    provider: str
    model_id: str
    key_hint: str
    is_active: bool
    validated_at: Optional[datetime] = None
    created_at: Optional[datetime] = None


class AiCredentialListResponse(BaseModel):
    credentials: List[AiCredentialResponse]
    has_active: bool


class AiCredentialUpsertRequest(BaseModel):
    api_key: str = Field(..., min_length=8)
    model_id: str


class AiCredentialTestRequest(BaseModel):
    api_key: str = Field(..., min_length=8)
    model_id: str


class AiCredentialTestResponse(BaseModel):
    success: bool
    message: str
