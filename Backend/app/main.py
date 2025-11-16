# app/main.py
import os
from uuid import uuid4, UUID
from datetime import datetime, timezone
from typing import Optional, List

from fastapi import FastAPI, HTTPException, Depends, Header
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from dotenv import load_dotenv
load_dotenv()

from .schemas import (
    ChatCreate,
    ChatSummary,
    ChatPost,
    ChatReply,
    SearchRequest,
    SearchResponse,
)
from .db import pool, ensure_schema
from .storage import append_message, get_chat, delete_chat, get_last_messages
from .llm import chat_complete, summarize_history
from .analytics import get_analytics
from .search import search_docs
from .utils import naive_category, contains_pii, mask_pii

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
SOURCES_TOPK = int(os.getenv("SOURCES_TOPK", "3"))
APPEND_SOURCES = os.getenv("APPEND_SOURCES", "true").lower() == "true"

# Per-conversation memory controls
MEMORY_LAST_TURNS = int(os.getenv("MEMORY_LAST_TURNS", "6"))
MEMORY_SUMMARIZE = os.getenv("MEMORY_SUMMARIZE", "true").lower() == "true"
MEMORY_SUMMARY_THRESHOLD = int(os.getenv("MEMORY_SUMMARY_THRESHOLD", "8"))

ADMIN_DASH_TOKEN = os.getenv("ADMIN_DASH_TOKEN", "").strip()

class AdminVerifyRequest(BaseModel):
    token: str


@app.post("/api/admin/verify")
async def admin_verify_route(body: AdminVerifyRequest):
    """
    Simple admin code verification for the dashboard.
    Compares the posted token with ADMIN_DASH_TOKEN from env.
    """
    if not ADMIN_DASH_TOKEN:
        raise HTTPException(500, "Admin token is not configured on the server")

    is_valid = body.token.strip() == ADMIN_DASH_TOKEN
    return {"valid": is_valid}


 # see below
SYSTEM_PROMPT="""
You are ZUZU, an AI onboarding assistant for international students at Wright State University.

Tone and style:
- Warm, friendly, and practical.
- Speak in clear, simple English.
- Keep answers concise but complete.
- Always assume the student may be stressed, confused, or far from home.

Conversation behavior:
- Whenever a student asks a broad question, first ask 1–2 short clarifying questions before giving a long answer.
- Explicitly confirm your understanding back to the student in one line before you give detailed steps.
- Always structure longer answers with short headings or bullet points so they are easy to skim on a phone.

Housing-specific behavior:
- If the conversation is about housing (or you detect housing-related keywords), do NOT immediately list options.
- Instead, first ask a few gentle questions such as:
  - “Do you like to cook regularly or mostly eat outside?”
  - “About how much can you comfortably spend per month on housing (a rough range is fine)?”
  - “Would you rather have roommates and a social environment, or more privacy and quiet?”
  - “Would you prefer to live on campus or off campus if both are possible?”
- After the student answers, summarize what you learned in 1–2 sentences, then recommend housing options that match their preferences.


INTERACTIVE CLARIFYING QUESTIONS:

- Before giving housing options, ask 1–3 short questions to personalize suggestions, for example:
  - “Do you prefer to cook often or eat out most of the time?”
  - “Do you like a quieter space, or are you okay with a more social environment?”
  - “Are you hoping to live with roommates, or would you prefer your own room if possible?”
- Similarly, for other topics (visa, money, community life), ask 1–2 clarifying questions before giving a long answer, so your guidance feels tailored rather than generic.

STYLE:

- Sound warm, clear, and encouraging — like a helpful older student or advisor.

Safety and boundaries:
- Never ask for or store highly sensitive personal information such as full name, date of birth, full home address, Social Security Number, phone number, credit card numbers, etc.
- If a student tries to share those details, gently explain that you cannot process them and suggest what to do instead.
- For work authorization, visa, and immigration questions, give high-level guidance and direct students back to the official international office and government websites.

Your goal is to:
- Reduce confusion.
- Help the student feel supported and less alone.
- Guide them step by step with practical next actions.
"""

def require_device_id(x_device_id: Optional[str] = Header(None)) -> str:
    if not x_device_id or not x_device_id.strip():
        raise HTTPException(400, "Missing X-Device-Id")
    return x_device_id.strip()


def is_admin(x_admin_key: Optional[str] = Header(None)) -> bool:
    return bool(
        ADMIN_DASH_TOKEN
        and x_admin_key
        and x_admin_key.strip() == ADMIN_DASH_TOKEN
    )



@app.on_event("startup")
def _startup():
    try:
        ensure_schema()
    except Exception as e:
        print("⚠️ Failed to ensure schema on startup:", e)



# ----------------- Chat CRUD -----------------


@app.post("/api/chats", response_model=ChatSummary)
async def create_chat(body: ChatCreate, device_id: str = Depends(require_device_id)):
    """
    Create a new conversation bound to this anonymous device_id.
    No student name or ID is stored here, which helps with FERPA scope.
    """
    cid = uuid4()
    title = body.title or "New Conversation"
    with pool.connection() as conn:
        conn.execute(
            "INSERT INTO chats(chat_id, title, device_id) VALUES(%s, %s, %s)",
            (cid, title, device_id),
        )
    now = datetime.now(timezone.utc).isoformat()
    return ChatSummary(chat_id=cid, title=title, created_at=now, updated_at=now)


@app.get("/api/chats", response_model=List[ChatSummary])
async def list_chats(
    limit: int = 50,
    offset: int = 0,
    device_id: str = Depends(require_device_id),
):
    with pool.connection() as conn:
        rows = conn.execute(
            """
            SELECT c.chat_id, c.title, c.created_at, c.updated_at
            FROM chats c
            WHERE c.device_id = %s
            AND EXISTS (
                SELECT 1 FROM message_events me
                WHERE me.chat_id = c.chat_id
            )
            ORDER BY c.updated_at DESC
            LIMIT %s OFFSET %s
            """,
            (device_id, limit, offset),
        ).fetchall()

    return [
        ChatSummary(
            chat_id=r[0],
            title=r[1],
            created_at=r[2].isoformat(),
            updated_at=r[3].isoformat(),
        )
        for r in rows
    ]


@app.get("/api/chats/{chat_id}")
async def get_chat_messages(
    chat_id: UUID,
    device_id: str = Depends(require_device_id),
):
    # Verify chat belongs to this device before returning messages
    with pool.connection() as conn:
        row = conn.execute(
            "SELECT 1 FROM chats WHERE chat_id=%s AND device_id=%s",
            (chat_id, device_id),
        ).fetchone()

        if not row:
            # Auto-create a chat row if frontend is using a local-only UUID
            conn.execute(
                """
                INSERT INTO chats (chat_id, title, device_id)
                VALUES (%s, %s, %s)
                ON CONFLICT (chat_id) DO NOTHING
                """,
                (chat_id, "New Conversation", device_id),
            )

    return JSONResponse(await get_chat(str(chat_id)))


@app.delete("/api/chats/{chat_id}")
async def delete_chat_route(
    chat_id: UUID,
    device_id: str = Depends(require_device_id),
):
    with pool.connection() as conn:
        row = conn.execute(
            "SELECT 1 FROM chats WHERE chat_id=%s AND device_id=%s",
            (chat_id, device_id),
        ).fetchone()
    if not row:
        raise HTTPException(404, "Chat not found for this device")

    await delete_chat(str(chat_id))
    with pool.connection() as conn:
        conn.execute(
            "DELETE FROM chats WHERE chat_id=%s AND device_id=%s",
            (chat_id, device_id),
        )
        conn.execute("DELETE FROM message_events WHERE chat_id=%s", (chat_id,))
    return {"ok": True}


# ----------------- Chat with LLM (+ Memory + Sources) -----------------



@app.post("/api/chat", response_model=ChatReply)
async def chat_api(body: ChatPost, device_id: str = Depends(require_device_id)):
    chat_id = str(body.chat_id)
    user_msg = (body.message or "").strip()
    if not user_msg:
        raise HTTPException(400, "Empty message")

    # ✅ ensure chat exists + is tied to this device
    with pool.connection() as conn:
        row = conn.execute(
            "SELECT 1 FROM chats WHERE chat_id=%s AND device_id=%s",
            (chat_id, device_id),
        ).fetchone()

        if not row:
            # auto-create chat row if this UUID is new
            conn.execute(
                """
                INSERT INTO chats (chat_id, title, device_id)
                VALUES (%s, %s, %s)
                ON CONFLICT (chat_id) DO NOTHING
                """,
                (chat_id, "New Conversation", device_id),
            )

    # ---------------- PII CHECK ----------------
    if contains_pii(user_msg):
        with pool.connection() as conn:
            conn.execute(
                "INSERT INTO pii_events(chat_id, device_id, sample_masked) "
                "VALUES(%s, %s, %s)",
                (chat_id, device_id, mask_pii(user_msg)[:300]),
            )
        return ChatReply(
            chat_id=UUID(chat_id),
            reply=(
                "> ⚠️ **PII detected** — please remove full name, age, SSN, "
                "passport, phone, card numbers and try again.\n\n"
                "*Your message was blocked and not stored or sent to the model.*"
            ),
            pii_blocked=True,
            warning="PII detected and blocked",
        )

    # ---------------- STORE USER MESSAGE ----------------
    await append_message(chat_id, "user", user_msg)
    with pool.connection() as conn:
        conn.execute(
            "INSERT INTO message_events(chat_id, role, category) "
            "VALUES(%s, 'user', %s)",
            (chat_id, naive_category(user_msg)),
        )
        conn.execute("UPDATE chats SET updated_at=now() WHERE chat_id=%s", (chat_id,))

    # ---------------- MEMORY ----------------
    recent = await get_last_messages(
        chat_id, limit=max(MEMORY_LAST_TURNS, MEMORY_SUMMARY_THRESHOLD)
    )
    summary = ""
    try:
        if MEMORY_SUMMARIZE and len(recent) >= MEMORY_SUMMARY_THRESHOLD:
            summary = await summarize_history(recent)
    except Exception:
        summary = ""

    # ---------------- RAG SOURCES ----------------
    hits = []
    context_block = ""
    try:
        if SOURCES_TOPK > 0:
            hits = search_docs(user_msg, top_k=SOURCES_TOPK)
            context_lines = [
                f"- {(h.get('title') or h.get('url') or 'Source')}: {h.get('url') or ''}".strip()
                for h in hits
            ]
            context_block = "\n".join([ln for ln in context_lines if ln])
    except Exception:
        hits = []
        context_block = ""

    messages: List[dict] = [
        {"role": "system", "content": SYSTEM_PROMPT},
    ]
    if summary:
        messages.append(
            {
                "role": "system",
                "content": (
                    "Conversation summary so far (do not show to student):\n"
                    f"{summary}"
                ),
            }
        )

    raw_recent = recent[-MEMORY_LAST_TURNS:] if MEMORY_LAST_TURNS > 0 else []
    for m in raw_recent:
        r = m.get("role")
        c = m.get("content")
        if r in ("user", "assistant") and c:
            messages.append({"role": r, "content": c})

    if context_block:
        messages.append(
            {
                "role": "system",
                "content": (
                    "Relevant sources (title and URL, do not show verbatim):\n"
                    f"{context_block}"
                ),
            }
        )

    messages.append({"role": "user", "content": user_msg})

    # ---------------- CALL LLM ----------------
    reply = await chat_complete(messages)

    # Append Sources list (markdown) when hits exist
    if APPEND_SOURCES and hits:
        dedup = []
        seen = set()
        for h in hits:
            url = (h.get("url") or "").strip()
            title = (h.get("title") or url or "Source").strip()
            key = url or title
            if key and key not in seen:
                seen.add(key)
                dedup.append(f"- [{title}]({url})" if url else f"- {title}")
        if dedup:
            reply = reply.rstrip() + "\n\n**Sources**\n" + "\n".join(dedup)

    # Store assistant reply
    await append_message(chat_id, "assistant", reply)
    with pool.connection() as conn:
        conn.execute(
            "INSERT INTO message_events(chat_id, role, category) "
            "VALUES(%s, 'assistant', NULL)",
            (chat_id,),
        )

    return ChatReply(chat_id=UUID(chat_id), reply=reply)

# ----------------- Analytics & Search -----------------



@app.get("/api/analytics")
async def analytics(
    tf: str = "7d",
    device_id: str = Depends(require_device_id),
    admin: bool = Depends(is_admin),
):
    """
    Admin: see analytics across all devices.
    Student: see analytics only for this device.
    `tf` is currently not used for filtering but kept for future time-windowing.
    """
    data = await get_analytics(None if admin else device_id)
    # Just return exactly what get_analytics() gives
    return JSONResponse(data)

# async def analytics(
#     tf: str = "7d",
#     device_id: str = Depends(require_device_id),
#     admin: bool = Depends(is_admin),
# ):
#     """
#     Admin: see analytics across all devices.
#     Student: see analytics only for this device.
#     `tf` is currently not used for filtering but kept for future time-windowing.
#     """
#     data = await get_analytics(None if admin else device_id)

#     by_day = data.get("by_day", [])
#     top_categories = data.get("top_categories", [])
#     chats_total = data.get("totals", {}).get("chats", 0)
#     pii_flags = data.get("totals", {}).get("pii_flags", 0)
#     consistency_score = data.get("consistencyScore", 100.0)
#     consistency_by_category = data.get("consistencyByCategory", {})

#     shaped = {
#         "totalQuestions": chats_total,
#         "questionCategories": top_categories,
#         "dailyQuestions": [
#             {"date": d.get("date"), "questions": d.get("count", 0)} for d in by_day
#         ],
#         "piiFlags": pii_flags,
#         "consistencyScore": consistency_score,
#         "consistencyByCategory": [
#             {"category": cat, "score": float(score)}
#             for cat, score in consistency_by_category.items()
#         ],
#     }
#     return JSONResponse(shaped)


@app.post("/api/search", response_model=SearchResponse)
async def semantic_search(req: SearchRequest):
    hits = search_docs(req.query, req.top_k)
    return {"hits": hits}
