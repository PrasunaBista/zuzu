# app/schemas.py
from pydantic import BaseModel
from typing import Optional, List, Dict
from uuid import UUID

class ChatCreate(BaseModel):
    title: Optional[str] = None

class ChatPost(BaseModel):
    chat_id: UUID
    message: str  # DO NOT VALIDATE PII HERE

class ChatReply(BaseModel):
    chat_id: UUID
    reply: str
    pii_blocked: Optional[bool] = False
    warning: Optional[str] = None
    sources: Optional[List[dict]] = []

class ChatSummary(BaseModel):
    chat_id: UUID
    title: str
    created_at: str
    updated_at: str

class SearchRequest(BaseModel):
    query: str
    top_k: int = 5

class SearchResponse(BaseModel):
    hits: List[dict]

class CategoryCount(BaseModel):
    category: str
    count: int


class DayCount(BaseModel):
    date: str
    count: int


class AdminAnalyticsResponse(BaseModel):
    totals: Dict[str, int]
    top_categories: List[CategoryCount]
    by_day: List[DayCount]
    consistencyScore: float
    consistencyByCategory: Dict[str, float]
