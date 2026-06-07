from pydantic import BaseModel
from typing import Optional


class NotificationPreferences(BaseModel):
    member_activity: bool = True
    document_sharing: bool = True
    document_notes: bool = True
    generation: bool = True
    quality: bool = True
    stale_sections: bool = True
    source_sync: bool = True
    invites: bool = True


class NotificationPreferencesResponse(BaseModel):
    preferences: NotificationPreferences


class UpdateNotificationPreferencesRequest(BaseModel):
    preferences: NotificationPreferences
