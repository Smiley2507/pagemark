from datetime import datetime
from enum import Enum
from typing import List, Optional

from pydantic import BaseModel


class AuthorTypeEnum(str, Enum):
    USER = "user"
    AI = "ai"


class SectionVersionResponse(BaseModel):
    id: int
    section_id: int
    author_type: AuthorTypeEnum
    summary: Optional[str] = None
    added: int
    removed: int
    modified: int
    created_at: datetime

    class Config:
        from_attributes = True


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
