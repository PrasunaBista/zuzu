# app/schemas.py
from pydantic import BaseModel
from typing import List, Optional
from uuid import UUID

class ChatCreate(BaseModel):
    title: Optional[str] = None

class ChatSummary(BaseModel):
    chat_id: UUID
    title: Optional[str]
    created_at: str
    updated_at: str

# PII-guarded post body
try:
    from pydantic import field_validator
    P2 = True
except Exception:
    from pydantic import validator
    P2 = False

from .utils import contains_pii

class ChatPost(BaseModel):
    chat_id: str
    message: str
    topic: Optional[str] = None  # "Housing > Residence Halls > Hamilton Hall"

    if P2:
        @field_validator('message')
        @classmethod
        def _no_pii_v2(cls, v: str):
            if contains_pii(v):
                raise ValueError("PII detected: please remove SSN/passport/phone/card numbers.")
            return v
    else:
        @validator('message')
        def _no_pii_v1(cls, v: str):
            if contains_pii(v):
                raise ValueError("PII detected: please remove SSN/passport/phone/card numbers.")
            return v

class ChatReply(BaseModel):
    chat_id: UUID
    reply: str
    sources: Optional[List[str]] = None
    pii_blocked: Optional[bool] = None
    warning: Optional[str] = None

class AnalyticsResponse(BaseModel):
    totalQuestions: int
    questionCategories: List[dict]
    dailyQuestions: List[dict]
    consistency: List[dict]
    pii_last7d: int
    pii_recent: List[dict]

class SearchRequest(BaseModel):
    query: str
    top_k: int = 5

class SearchHit(BaseModel):
    id: int
    title: Optional[str]
    url: Optional[str]
    score: float

class SearchResponse(BaseModel):
    hits: List[SearchHit]
