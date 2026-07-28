from pydantic import BaseModel
from typing import Optional


class GrammarCheckRequest(BaseModel):
    text: str
    language: str = "en-US"
    document_id: int | None = None
    section_id: int | None = None


class GrammarMatchReplacement(BaseModel):
    value: str


class GrammarMatch(BaseModel):
    message: str
    short_message: str
    offset: int
    length: int
    rule_id: str
    rule_issue_type: str
    replacements: list[GrammarMatchReplacement] = []


class GrammarCheckResponse(BaseModel):
    matches: list[GrammarMatch]
    text: str
