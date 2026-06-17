from datetime import datetime
from enum import Enum
from typing import List, Optional

from pydantic import BaseModel, ConfigDict


class AuthorTypeEnum(str, Enum):
    USER = "user"
    AI = "ai"


class SectionVersionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    section_id: int
    author_type: AuthorTypeEnum
    summary: Optional[str] = None
    added: int
    removed: int
    modified: int
    created_at: datetime


class DiffLineType(str, Enum):
    ADDED = "added"
    REMOVED = "removed"
    UNCHANGED = "unchanged"


class DiffLineResponse(BaseModel):
    type: DiffLineType
    content: str
    line_number: int


class VersionDiffResponse(BaseModel):
    version_id: int
    content_old: str
    content_new: str
    diff_lines: List[DiffLineResponse]
