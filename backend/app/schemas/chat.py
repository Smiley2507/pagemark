"""Pydantic schemas for chat threads and messages."""

from datetime import datetime
from enum import Enum
from typing import List, Optional

from pydantic import BaseModel


class MessageRoleEnum(str, Enum):
    USER = "user"
    AI = "ai"


class ChatMessageResponse(BaseModel):
    id: int
    thread_id: int
    role: MessageRoleEnum
    content: str
    created_at: datetime

    class Config:
        from_attributes = True


class ChatThreadResponse(BaseModel):
    id: int
    project_id: int
    title: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ChatThreadWithMessages(ChatThreadResponse):
    messages: List[ChatMessageResponse] = []


class CreateThreadRequest(BaseModel):
    title: Optional[str] = None
    first_message: Optional[str] = None


class SendMessageRequest(BaseModel):
    message: str
    model_name: Optional[str] = None
    temperature: Optional[float] = None
    max_tokens: Optional[int] = None
    target_section_id: Optional[int] = None
    references: Optional[List[str]] = None
    resource_ids: Optional[List[int]] = None
