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

class Message(BaseModel):
    role: str  # 'user' | 'assistant'
    content: str
    timestamp: Optional[str] = None

class ChatPost(BaseModel):
    chat_id: UUID
    message: str

class ChatReply(BaseModel):
    chat_id: UUID
    reply: str

class AnalyticsResponse(BaseModel):
    totalQuestions: int
    questionCategories: List[dict]
    dailyQuestions: List[dict]

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
