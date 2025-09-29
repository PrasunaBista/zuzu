import os
import orjson
from uuid import uuid4, UUID
from datetime import datetime, timezone
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .schemas import (
    ChatCreate, ChatSummary, ChatPost, ChatReply,
    AnalyticsResponse, SearchRequest, SearchResponse
)
from .db import pool, ensure_schema
from .storage import append_message, get_chat, delete_chat, get_last_messages
from .llm import chat_complete, summarize_history
from .analytics import get_analytics
from .search import search_docs
from .utils import naive_category

app = FastAPI(title="ZUZU Backend")

origins = [o.strip() for o in os.getenv("ALLOWED_ORIGINS", "*").split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --------- Env toggles ---------
SOURCES_TOPK = int(os.getenv("SOURCES_TOPK", "3"))                 # how many URLs to attach
APPEND_SOURCES = os.getenv("APPEND_SOURCES", "true").lower() == "true"

MEMORY_LAST_TURNS = int(os.getenv("MEMORY_LAST_TURNS", "6"))       # raw recent turns to include
MEMORY_SUMMARIZE = os.getenv("MEMORY_SUMMARIZE", "true").lower() == "true"
MEMORY_SUMMARY_THRESHOLD = int(os.getenv("MEMORY_SUMMARY_THRESHOLD", "8"))

SYSTEM_PROMPT = os.getenv(
    "SYSTEM_PROMPT",
    "You are ZUZU, a helpful international student advisor for Wright State University. "
    "Be concise, warm, and actionable. If policy or dates are uncertain, say so and suggest how to verify. "
    "When relevant, cite sources using the provided context."
)

@app.on_event("startup")
def _startup():
    ensure_schema()

# ----------------- Chat CRUD -----------------

@app.post("/api/chats", response_model=ChatSummary)
async def create_chat(body: ChatCreate):
    cid = uuid4()
    title = body.title or "New Conversation"
    with pool.connection() as conn:
        conn.execute("INSERT INTO chats(chat_id,title) VALUES(%s,%s)", (cid, title))
    now = datetime.now(timezone.utc).isoformat()
    return ChatSummary(chat_id=cid, title=title, created_at=now, updated_at=now)

@app.get("/api/chats", response_model=list[ChatSummary])
async def list_chats(limit: int = 50, offset: int = 0):
    with pool.connection() as conn:
        rows = conn.execute(
            "SELECT chat_id, title, created_at, updated_at FROM chats "
            "ORDER BY updated_at DESC LIMIT %s OFFSET %s",
            (limit, offset)
        ).fetchall()
    return [
        ChatSummary(chat_id=r[0], title=r[1],
                    created_at=r[2].isoformat(), updated_at=r[3].isoformat())
        for r in rows
    ]

@app.get("/api/chats/{chat_id}")
async def get_chat_messages(chat_id: UUID):
    return JSONResponse(await get_chat(str(chat_id)))

@app.delete("/api/chats/{chat_id}")
async def delete_chat_route(chat_id: UUID):
    await delete_chat(str(chat_id))
    with pool.connection() as conn:
        conn.execute("DELETE FROM chats WHERE chat_id=%s", (chat_id,))
        conn.execute("DELETE FROM message_events WHERE chat_id=%s", (chat_id,))
    return {"ok": True}

# ----------------- Chat with LLM (+ Memory + Sources) -----------------

@app.post("/api/chat", response_model=ChatReply)
async def chat_api(body: ChatPost):
    chat_id = str(body.chat_id)
    user_msg = (body.message or "").strip()
    if not user_msg:
        raise HTTPException(400, "Empty message")

    # Persist user message (Blob + analytics row)
    await append_message(chat_id, "user", user_msg)
    with pool.connection() as conn:
        conn.execute(
            "INSERT INTO message_events(chat_id, role, category) VALUES(%s,'user',%s)",
            (chat_id, naive_category(user_msg))
        )
        conn.execute("UPDATE chats SET updated_at=now() WHERE chat_id=%s", (chat_id,))

    # ---- MEMORY (Blob) ----
    # Load recent messages and optionally summarize if long
    recent = await get_last_messages(chat_id, limit=max(MEMORY_LAST_TURNS, MEMORY_SUMMARY_THRESHOLD))
    summary = ""
    try:
        if MEMORY_SUMMARIZE and len(recent) >= MEMORY_SUMMARY_THRESHOLD:
            summary = await summarize_history(recent)
    except Exception:
        summary = ""

    # ---- RAG Sources (from Postgres docs) ----
    hits = []
    context_block = ""
    try:
        if SOURCES_TOPK > 0:
            hits = search_docs(user_msg, top_k=SOURCES_TOPK)
            context_lines = [f"- {(h.get('title') or h.get('url') or 'Source')}: {h.get('url') or ''}".strip()
                             for h in hits]
            context_block = "\n".join([ln for ln in context_lines if ln])
    except Exception:
        hits = []
        context_block = ""

    # Build prompt
    messages: list[dict] = [
        {"role": "system", "content": SYSTEM_PROMPT},
    ]

    if summary:
        messages.append({
            "role": "system",
            "content": f"Conversation summary so far (for continuity):\n{summary}"
        })

    # include last N raw turns for fidelity (only user/assistant)
    raw_recent = recent[-MEMORY_LAST_TURNS:] if MEMORY_LAST_TURNS > 0 else []
    for m in raw_recent:
        r = m.get("role")
        c = m.get("content")
        if r in ("user", "assistant") and c:
            messages.append({"role": r, "content": c})

    if context_block:
        messages.append({
            "role": "system",
            "content": f"Relevant sources you can reference (title and URL):\n{context_block}"
        })

    messages.append({"role": "user", "content": user_msg})

    # Call LLM
    reply = await chat_complete(messages)

    # Append Sources list like ChatGPT (guaranteed when hits exist)
    if APPEND_SOURCES and hits:
        dedup = []
        seen = set()
        for h in hits:
            url = (h.get("url") or "").strip()
            title = (h.get("title") or url or "Source").strip()
            key = url or title
            if key and key not in seen:
                seen.add(key)
                dedup.append(f"- {title} — {url}" if url else f"- {title}")
        if dedup:
            reply = reply.rstrip() + "\n\nSources:\n" + "\n".join(dedup)

    # Persist assistant message and analytics row
    await append_message(chat_id, "assistant", reply)
    with pool.connection() as conn:
        conn.execute(
            "INSERT INTO message_events(chat_id, role, category) VALUES(%s,'assistant',NULL)",
            (chat_id,)
        )

    return ChatReply(chat_id=UUID(chat_id), reply=reply)

# ----------------- Analytics & Search -----------------

@app.get("/api/analytics", response_model=AnalyticsResponse)
async def analytics(tf: str = "7d"):
    data = await get_analytics(tf)
    return JSONResponse(data)

@app.post("/api/search", response_model=SearchResponse)
async def semantic_search(req: SearchRequest):
    hits = search_docs(req.query, req.top_k)
    return {"hits": hits}
