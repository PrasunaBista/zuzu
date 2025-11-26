# app/main.py
import os
from uuid import uuid4, UUID
from datetime import datetime, timezone
from typing import Optional, List

import logging
from dotenv import load_dotenv
from psycopg import OperationalError

from fastapi import (
    FastAPI,
    HTTPException,
    Depends,
    Header,
    Body,
)
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel

load_dotenv()
logger = logging.getLogger(__name__)

# -------------------------------------------------------------------
# Local imports
# -------------------------------------------------------------------
from .schemas import (
    ChatCreate,
    ChatSummary,
    ChatPost,
    ChatReply,
    SearchRequest,
    SearchResponse,
    AdminAnalyticsResponse,
)
from .db import pool, ensure_schema
from .storage import append_message, get_chat, delete_chat, get_last_messages
from .llm import chat_complete, summarize_history, SYSTEM_PROMPT
from .search import search_docs
from .utils import naive_category, contains_pii, mask_pii

# -------------------------------------------------------------------
# FastAPI app
# -------------------------------------------------------------------
app = FastAPI(title="ZUZU Backend")


@app.get("/debug/ping")
def ping():
    return {"status": "alive"}


@app.on_event("startup")
async def on_startup():
    """
    Ensure DB schema exists on startup.
    Do NOT crash the app if this fails.
    """
    try:
        ensure_schema()
    except Exception as e:
        logger.exception(
            "❌ ensure_schema failed on startup, continuing without crash: %s", e
        )
        # Don't re-raise – app should still run
        pass


# -------------------------------------------------------------------
# CORS
# -------------------------------------------------------------------
ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "").split(",")
ALLOWED_ORIGINS = [o.strip() for o in ALLOWED_ORIGINS if o.strip()]

if not ALLOWED_ORIGINS:
    # Open for now; tighten later
    ALLOWED_ORIGINS = ["*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS if ALLOWED_ORIGINS != ["*"] else ["*"],
    allow_credentials=False,  # must be False when using "*"
    allow_methods=["*"],
    allow_headers=["*"],
)

ADMIN_DASH_TOKEN = os.getenv("ADMIN_DASH_TOKEN", "WSU")


# -------------------------------------------------------------------
# Device ID helper
# -------------------------------------------------------------------
def require_device_id(
    x_device_id: Optional[str] = Header(None, alias="X-Device-Id"),
) -> str:
    """
    Use the real device id when the frontend sends it.
    Fall back to 'anonymous' for preflight / health / misc requests so
    we don't throw 400s and break CORS.
    """
    if x_device_id:
        return x_device_id
    return "anonymous"


# -------------------------------------------------------------------
# Helpers
# -------------------------------------------------------------------
def _shape_chat_summary_row(row) -> ChatSummary:
    return ChatSummary(
        chat_id=row[0],
        title=row[1],
        created_at=row[2].isoformat(),
        updated_at=row[3].isoformat(),
    )


# -------------------------------------------------------------------
# Chats list + history
# -------------------------------------------------------------------
@app.get("/api/chats", response_model=List[ChatSummary])
async def list_chats(
    device_id: str = Depends(require_device_id),
    limit: int = 50,
    offset: int = 0,
):
    """List chats for a given device, newest first."""
    with pool.connection() as conn:
        rows = conn.execute(
            """
            SELECT chat_id, title, created_at, updated_at
            FROM chats
            WHERE device_id=%s
            ORDER BY updated_at DESC
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
    """
    Return messages for a chat.
    Ensure the chat row exists & belongs to this device.
    """
    try:
        with pool.connection() as conn:
            row = conn.execute(
                "SELECT 1 FROM chats WHERE chat_id=%s AND device_id=%s",
                (chat_id, device_id),
            ).fetchone()

            if not row:
                # Auto-create chat row if this UUID is new
                conn.execute(
                    """
                    INSERT INTO chats (chat_id, device_id, title, created_at, updated_at)
                    VALUES (%s, %s, %s, now(), now())
                    ON CONFLICT (chat_id) DO NOTHING
                    """,
                    (chat_id, device_id, "New Conversation"),
                )
    except OperationalError as e:
        logger.exception("Database connection error in get_chat_messages: %s", e)
        raise HTTPException(
            500,
            "Temporary database connection issue. Please try again.",
        )

    return JSONResponse(await get_chat(str(chat_id)))


@app.post("/api/chats", response_model=ChatSummary)
async def create_chat(
    body: ChatCreate,
    device_id: str = Depends(require_device_id),
):
    """Create a new empty chat record and return its summary."""
    chat_id = uuid4()
    now = datetime.now(timezone.utc)

    with pool.connection() as conn:
        conn.execute(
            """
            INSERT INTO chats (chat_id, device_id, title, created_at, updated_at)
            VALUES (%s, %s, %s, %s, %s)
            """,
            (chat_id, device_id, body.title or "New Conversation", now, now),
        )

    return ChatSummary(
        chat_id=chat_id,
        title=body.title or "New Conversation",
        created_at=now.isoformat(),
        updated_at=now.isoformat(),
    )


@app.delete("/api/chats/{chat_id}")
async def delete_chat_api(
    chat_id: UUID,
    device_id: str = Depends(require_device_id),
):
    """Delete a chat and its messages."""
    with pool.connection() as conn:
        row = conn.execute(
            "SELECT 1 FROM chats WHERE chat_id=%s AND device_id=%s",
            (chat_id, device_id),
        ).fetchone()

        if not row:
            raise HTTPException(404, "Chat not found or does not belong to this device")

    await delete_chat(str(chat_id))
    return {"ok": True}


# -------------------------------------------------------------------
# Chat with LLM (+ Memory + Sources)
# -------------------------------------------------------------------
@app.post("/api/chat", response_model=ChatReply)
async def chat_api(
    body: ChatPost,
    device_id: str = Depends(require_device_id),
):
    chat_id = str(body.chat_id)
    user_msg = (body.message or "").strip()
    if not user_msg:
        raise HTTPException(400, "Empty message")

    # 1) Ensure chat exists and belongs to this device
    try:
        with pool.connection() as conn:
            row = conn.execute(
                "SELECT 1 FROM chats WHERE chat_id=%s AND device_id=%s",
                (chat_id, device_id),
            ).fetchone()

            if not row:
                conn.execute(
                    """
                    INSERT INTO chats (chat_id, device_id, title, created_at, updated_at)
                    VALUES (%s, %s, %s, now(), now())
                    ON CONFLICT (chat_id) DO NOTHING
                    """,
                    (chat_id, device_id, "New Conversation"),
                )
    except OperationalError as e:
        logger.error("DB error in chat_api (ensure chat): %s", e)
        return JSONResponse(
            status_code=503,
            content={
                "error": "db_unavailable",
                "message": "Temporary database issue. Please try again in a moment.",
            },
        )

    # 2) PII check
    if contains_pii(user_msg):
        try:
            with pool.connection() as conn:
                conn.execute(
                    """
                    INSERT INTO pii_events (chat_id, device_id, pii_type, created_at)
                    VALUES (%s, %s, %s, now())
                    """,
                    (chat_id, device_id, "generic"),
                )
        except OperationalError as e:
            logger.error("DB error saving pii_events: %s", e)

        friendly_msg = (
            "⚠️ Oops, this message looks like it includes personal details "
            "such as your full name, address, phone number, or ID number.\n\n"
            "For your safety, I can’t use or store that kind of information, "
            "so this message wasn’t saved or sent anywhere.\n\n"
            "Please ask your question again *without* any personal details."
        )

        return ChatReply(
            chat_id=UUID(chat_id),
            reply=friendly_msg,
            pii_blocked=True,
            warning="Personal information detected. Message ignored for your safety.",
        )

    # 3) Store user message + event
    try:
        await append_message(chat_id, "user", user_msg)
        with pool.connection() as conn:
            conn.execute(
                """
                INSERT INTO message_events (chat_id, device_id, role, category, created_at)
                VALUES (%s, %s, 'user', %s, now())
                """,
                (chat_id, device_id, naive_category(user_msg)),
            )
            conn.execute(
                "UPDATE chats SET updated_at = now() WHERE chat_id = %s",
                (chat_id,),
            )
    except OperationalError as e:
        logger.error("DB error saving user message/message_event: %s", e)
        # Continue anyway; worst case analytics miss an event

    # 4) Memory
    recent = await get_last_messages(
        chat_id,
        limit=int(os.getenv("MEMORY_LAST_TURNS", "8")),
    )

    summary: Optional[str] = None
    if os.getenv("MEMORY_SUMMARIZE", "true").lower() == "true":
        if len(recent) >= int(os.getenv("MEMORY_SUMMARY_THRESHOLD", "4")):
            try:
                summary = await summarize_history(recent)
            except Exception:
                summary = None

    # 5) Retrieval context / vector search
    context_block = ""
    hits: List[dict] = []
    try:
        sources_topk = int(os.getenv("SOURCES_TOPK", "6"))
        hits = search_docs(user_msg, sources_topk)
        logger.info("Vector search for '%s' returned %d hits", user_msg, len(hits))

        if hits:
            context_lines = [
                f"[{h['source']}] {h['content_snippet']}"
                for h in hits
            ]
            context_block = "\n".join([ln for ln in context_lines if ln])
    except Exception as e:
        logger.exception("Vector search failed: %s", e)
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
                    "Conversation so far (summary for context):\n"
                    f"{summary}"
                ),
            }
        )

    if context_block:
        messages.append(
            {
                "role": "system",
                "content": (
                    "Here are ZUZU knowledge snippets that might be relevant. "
                    "Use them when helpful, and ALWAYS cite the source like "
                    "**Source: Housing site** in your answer when you use one.\n\n"
                    f"{context_block}"
                ),
            }
        )

    messages.append({"role": "user", "content": user_msg})

    # 6) Call LLM
    reply = await chat_complete(messages)

    # 7) Store assistant message + event
    try:
        await append_message(chat_id, "assistant", reply)
        with pool.connection() as conn:
            conn.execute(
                """
                INSERT INTO message_events (chat_id, device_id, role, category, created_at)
                VALUES (%s, %s, 'assistant', %s, now())
                """,
                (chat_id, device_id, naive_category(reply)),
            )
            conn.execute(
                "UPDATE chats SET updated_at = now() WHERE chat_id = %s",
                (chat_id,),
            )
    except OperationalError as e:
        logger.error("DB error saving assistant message/message_event: %s", e)

    return ChatReply(
        chat_id=UUID(chat_id),
        reply=reply,
        sources=hits,
    )


# -------------------------------------------------------------------
# Category tracking (analytics)
# -------------------------------------------------------------------
class TrackCategoryEvent(BaseModel):
    chat_id: str
    category: str


@app.post("/api/track-category")
def track_category(
    event: TrackCategoryEvent,
    device_id: str = Depends(require_device_id),
):
    """
    Record a category selection as a 'user' message_event without
    creating a visible chat message.

    This endpoint is defensive:
    - If chat_id is missing or not found in chats, it just logs and returns ok.
    - It will not raise ForeignKeyViolation.
    """
    chat_id = event.chat_id
    category = event.category or "Other Inquiries"

    if not chat_id:
        logger.warning("track_category called without chat_id, skipping")
        return {"status": "ok"}

    try:
        with pool.connection() as conn:
            # 1) Verify chat exists
            row = conn.execute(
                "SELECT 1 FROM chats WHERE chat_id = %s",
                (chat_id,),
            ).fetchone()

            if not row:
                logger.warning(
                    "track_category: chat_id %s not found in chats, skipping insert",
                    chat_id,
                )
                return {"status": "ok"}

            # 2) Safe insert, FK will not explode
            conn.execute(
                """
                INSERT INTO message_events (chat_id, device_id, role, category, created_at)
                VALUES (%s, %s, 'user', %s, NOW())
                """,
                (chat_id, device_id, category),
            )
            conn.execute(
                "UPDATE chats SET updated_at = now() WHERE chat_id = %s",
                (chat_id,),
            )

        return {"status": "ok"}

    except OperationalError as e:
        logger.error("DB error in track-category: %s", e)
        # Let frontend continue without killing the whole request
        return {"status": "error", "detail": "db_error"}


# -------------------------------------------------------------------
# Admin verify
# -------------------------------------------------------------------
@app.post("/api/admin/verify")
async def verify_admin(payload: dict = Body(None)):
    """
    Verify the admin dashboard code.

    Frontend sends: { "token": "<code>" } (or "code"/"adminCode"/"password")
    It expects: { "valid": true/false }
    """
    if not isinstance(payload, dict):
        return {"valid": False}

    code = (
        payload.get("code")
        or payload.get("adminCode")
        or payload.get("token")
        or payload.get("password")
    )

    if not code:
        return {"valid": False}

    if code == ADMIN_DASH_TOKEN:
        return {"valid": True}

    return {"valid": False}


# -------------------------------------------------------------------
# Analytics
# -------------------------------------------------------------------
@app.get("/api/analytics", response_model=AdminAnalyticsResponse)
async def analytics_api(
    device_id: Optional[str] = Depends(require_device_id),
    admin_token: Optional[str] = Header(None, alias="X-Admin-Key"),
):
    """
    If X-Admin-Key == ADMIN_DASH_TOKEN → return system-wide analytics.
    Otherwise → return analytics scoped to this device_id.
    """
    if admin_token == ADMIN_DASH_TOKEN:
        device_filter = None
    else:
        device_filter = device_id

    try:
        from .analytics import get_analytics

        return await get_analytics(device_filter)
    except Exception as e:
        logger.exception("analytics_api failed: %s", e)
        # Safe fallback shape that matches AdminAnalyticsResponse
        return {
            "totals": {
                "totalUsers": 0,
                "totalQuestions": 0,
                "totalPiiEvents": 0,
            },
            "top_categories": [],
            "by_day": [],
            "consistencyScore": 100.0,
            "consistencyByCategory": {},
        }


# -------------------------------------------------------------------
# Semantic search
# -------------------------------------------------------------------
@app.post("/api/search", response_model=SearchResponse)
async def semantic_search(req: SearchRequest):
    hits = search_docs(req.query, req.top_k)
    return {"hits": hits}



# # app/main.py
# import os
# from uuid import uuid4, UUID
# from datetime import datetime, timezone
# from typing import Optional, List

# from fastapi import FastAPI, HTTPException, Depends, Header
# from fastapi.middleware.cors import CORSMiddleware
# from fastapi.responses import JSONResponse
# from pydantic import BaseModel
# from dotenv import load_dotenv
# from psycopg import OperationalError

# import logging


# logger = logging.getLogger(__name__)
# load_dotenv()

# from .schemas import (
#     ChatCreate,
#     ChatSummary,
#     ChatPost,
#     ChatReply,
#     SearchRequest,
#     SearchResponse,
#     AdminAnalyticsResponse, 
# )
# from .db import pool, ensure_schema
# from .storage import append_message, get_chat, delete_chat, get_last_messages
# from .llm import chat_complete, summarize_history,SYSTEM_PROMPT
# # from .analytics import get_analytics


# from .search import search_docs
# from .utils import naive_category, contains_pii, mask_pii

# app = FastAPI(title="ZUZU Backend")

# @app.get("/debug/ping")
# def ping():
#     return {"status": "alive"}

# @app.on_event("startup")
# async def on_startup():
#     try:
#         ensure_schema()
#     except Exception as e:
#         logger.exception("❌ ensure_schema failed on startup, continuing without crash: %s", e)
#         # Do NOT re-raise – we want the app to keep running
#         pass



# # ------------------------------------------------------
# # CORS
# # ------------------------------------------------------
# ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "").split(",")
# ALLOWED_ORIGINS = [o.strip() for o in ALLOWED_ORIGINS if o.strip()]

# if not ALLOWED_ORIGINS:
#     ALLOWED_ORIGINS = ["*"]

# # app.add_middleware(
# #     CORSMiddleware,
# #     allow_origins=ALLOWED_ORIGINS,
# #     allow_credentials=True,
# #     allow_methods=["*"],
# #     allow_headers=["*"],
# # )
# app.add_middleware(
#     CORSMiddleware,
#     allow_origins=["*"],       # open for now
#     allow_credentials=False,   # MUST be False when using "*"
#     allow_methods=["*"],
#     allow_headers=["*"],
# )
# ADMIN_DASH_TOKEN = os.getenv("ADMIN_DASH_TOKEN", "WSU")


# # ------------------------------------------------------
# # Pydantic models (if not already in schemas)
# # ------------------------------------------------------
# class DeviceHeader(BaseModel):
#     device_id: str


# # def require_device_id(
# #     x_device_id: Optional[str] = Header(None, alias="X-Device-Id"),
# # ) -> str:
# #     """
# #     Extract device id from the X-Device-Id header (as sent by the frontend).
# #     """
# #     if not x_device_id:
# #         raise HTTPException(400, "Missing X-Device-Id header")
# #     return x_device_id

# def require_device_id(
#     x_device_id: Optional[str] = Header(None, alias="X-Device-Id"),
# ) -> str:
#     """
#     Use the real device id when the frontend sends it.
#     Fall back to 'anonymous' for preflight / health / misc requests
#     so we don't throw 400s and break CORS.
#     """
#     if x_device_id:
#         return x_device_id

#     # For OPTIONS, health checks, or any tools that don't send the header.
#     return "anonymous"
# # ------------------------------------------------------
# # Startup: ensure DB schema
# # ------------------------------------------------------
# # @app.on_event("startup")
# # async def on_startup():
# #     ensure_schema()


# # ------------------------------------------------------
# # Chats list + history
# # ------------------------------------------------------
# def _shape_chat_summary_row(row) -> ChatSummary:
#     return ChatSummary(
#         chat_id=row[0],
#         title=row[1],
#         created_at=row[2].isoformat(),
#         updated_at=row[3].isoformat(),
#     )


# @app.get("/api/chats", response_model=List[ChatSummary])
# async def list_chats(
#     device_id: str = Depends(require_device_id),
#     limit: int = 50,
#     offset: int = 0,
# ):
#     """List chats for a given device, newest first."""
#     with pool.connection() as conn:
#         rows = conn.execute(
#             """
#             SELECT chat_id, title, created_at, updated_at
#             FROM chats
#             WHERE device_id=%s
#             ORDER BY updated_at DESC
#             LIMIT %s OFFSET %s
#             """,
#             (device_id, limit, offset),
#         ).fetchall()

#     return [
#         ChatSummary(
#             chat_id=r[0],
#             title=r[1],
#             created_at=r[2].isoformat(),
#             updated_at=r[3].isoformat(),
#         )
#         for r in rows
#     ]


# @app.get("/api/chats/{chat_id}")
# async def get_chat_messages(
#     chat_id: UUID,
#     device_id: str = Depends(require_device_id),
# ):
#     # Verify chat belongs to this device before returning messages
#         # ✅ ensure chat exists + is tied to this device
#     try:
#         with pool.connection() as conn:
#             row = conn.execute(
#                 "SELECT 1 FROM chats WHERE chat_id=%s AND device_id=%s",
#                 (chat_id, device_id),
#             ).fetchone()

#             if not row:
#                 # auto-create chat row if this UUID is new
#                 conn.execute(
#                     """
#                     INSERT INTO chats (chat_id, title, device_id)
#                     VALUES (%s, %s, %s)
#                     ON CONFLICT (chat_id) DO NOTHING
#                     """,
#                     (chat_id, "New Conversation", device_id),
#                 )
#     except OperationalError as e:
#         logger.exception("Database connection error in chat_api: %s", e)
#         raise HTTPException(
#             500,
#             "Temporary database connection issue. Please try your question again in a moment.",
#         )


#     return JSONResponse(await get_chat(str(chat_id)))


# @app.post("/api/chats", response_model=ChatSummary)
# async def create_chat(
#     body: ChatCreate,
#     device_id: str = Depends(require_device_id),
# ):
#     """Create a new empty chat record and return its summary."""
#     chat_id = uuid4()
#     now = datetime.now(timezone.utc)

#     with pool.connection() as conn:
#         conn.execute(
#             """
#             INSERT INTO chats (chat_id, device_id, title, created_at, updated_at)
#             VALUES (%s, %s, %s, %s, %s)
#             """,
#             (chat_id, device_id, body.title or "New Conversation", now, now),
#         )

#     return ChatSummary(
#         chat_id=chat_id,
#         title=body.title or "New Conversation",
#         created_at=now.isoformat(),
#         updated_at=now.isoformat(),
#     )


# @app.delete("/api/chats/{chat_id}")
# async def delete_chat_api(
#     chat_id: UUID,
#     device_id: str = Depends(require_device_id),
# ):
#     """Delete a chat and its messages."""
#     with pool.connection() as conn:
#         row = conn.execute(
#             "SELECT 1 FROM chats WHERE chat_id=%s AND device_id=%s",
#             (chat_id, device_id),
#         ).fetchone()

#         if not row:
#             raise HTTPException(404, "Chat not found or does not belong to this device")

#     await delete_chat(str(chat_id))
#     return {"ok": True}


# # ----------------- Chat with LLM (+ Memory + Sources) -----------------


# @app.post("/api/chat", response_model=ChatReply)
# async def chat_api(body: ChatPost, device_id: str = Depends(require_device_id)):
#     chat_id = str(body.chat_id)
#     user_msg = (body.message or "").strip()
#     if not user_msg:
#         raise HTTPException(400, "Empty message")

#     # ✅ ensure chat exists + is tied to this device
#     with pool.connection() as conn:
#         row = conn.execute(
#             "SELECT 1 FROM chats WHERE chat_id=%s AND device_id=%s",
#             (chat_id, device_id),
#         ).fetchone()

#         if not row:
#             # auto-create chat row if this UUID is new
#             conn.execute(
#                 """
#                 INSERT INTO chats (chat_id, title, device_id)
#                 VALUES (%s, %s, %s)
#                 ON CONFLICT (chat_id) DO NOTHING
#                 """,
#                 (chat_id, "New Conversation", device_id),
#             )

#     # ---------------- PII CHECK ----------------
#         # ---------------- PII CHECK ----------------
#     if contains_pii(user_msg):
#         with pool.connection() as conn:
#             conn.execute(
#                 "INSERT INTO pii_events(chat_id, device_id, pii_type) "
#                 "VALUES(%s, %s, %s)",
#                 (chat_id, device_id, "generic"),
#             )

#         friendly_msg = (
#             "⚠️ Oops, this message looks like it includes personal details "
#             "such as your full name, address, phone number, or ID/number.\n\n"
#             "For your safety, I can’t use or store that kind of information, "
#             "so this message wasn’t saved or sent anywhere.\n\n"
#             "Please ask your question again *without* any personal details "
#             "— for example, you can say “a student like me” instead of your "
#             "real name or exact information."
#         )

#         return ChatReply(
#             chat_id=UUID(chat_id),
#             reply=friendly_msg,
#             pii_blocked=True,
#             warning="Personal information detected. Message ignored for your safety.",
#         )

#     # ---------------- STORE USER MESSAGE ----------------
#         # ---------------- STORE USER MESSAGE ----------------
#     await append_message(chat_id, "user", user_msg)
#     with pool.connection() as conn:
#         conn.execute(
#             """
#             INSERT INTO message_events (chat_id, device_id, role, category, created_at)
#             VALUES (%s, %s, 'user', %s, now())
#             """,
#             (chat_id, device_id, naive_category(user_msg)),
#         )
#         conn.execute(
#             "UPDATE chats SET updated_at = now() WHERE chat_id = %s",
#             (chat_id,),
#         )


#     # ---------------- MEMORY ----------------
#     recent = await get_last_messages(
#         chat_id,
#         limit=int(os.getenv("MEMORY_LAST_TURNS", "6")),
#     )

#     summary: Optional[str] = None
#     if os.getenv("MEMORY_SUMMARIZE", "true").lower() == "true":
#         if len(recent) >= int(os.getenv("MEMORY_SUMMARY_THRESHOLD", "8")):
#             try:
#                 summary = await summarize_history(recent)
#             except Exception:
#                 summary = None

#     # ---------------- RETRIEVAL CONTEXT ----------------
    

# # ...

# # ---------------- RETRIEVAL CONTEXT ----------------
#     context_block = ""
#     hits = []
#     try:
#         from .search import search_docs

#         sources_topk = int(os.getenv("SOURCES_TOPK", "6"))
#         hits = search_docs(user_msg, sources_topk)
#         logger.info("Vector search for '%s' returned %d hits", user_msg, len(hits))

#         if hits:
#             context_lines = [
#                 f"[{h['source']}] {h['content_snippet']}"
#                 for h in hits
#             ]
#             context_block = "\n".join([ln for ln in context_lines if ln])
#     except Exception as e:
#         logger.exception("Vector search failed: %s", e)
#         hits = []
#         context_block = ""


#     messages: List[dict] = [
#         {"role": "system", "content": SYSTEM_PROMPT},
#     ]
#     if summary:
#         messages.append(
#             {
#                 "role": "system",
#                 "content": (
#                     "Conversation so far (summary for context):\n"
#                     f"{summary}"
#                 ),
#             }
#         )

#     if context_block:
#         messages.append(
#             {
#                 "role": "system",
#                 "content": (
#                     "Here are ZUZU knowledge snippets that might be relevant. "
#                     "Use them when helpful, and ALWAYS cite the source like "
#                     "**Source: Housing site** in your answer when you use one.\n\n"
#                     f"{context_block}"
#                 ),
#             }
#         )

#     messages.append({"role": "user", "content": user_msg})

#     # ---------------- CALL LLM ----------------
#     reply = await chat_complete(messages)
#     # Always append sources if we used the vector DB
#     # if hits and os.getenv("APPEND_SOURCES", "true").lower() == "true":
#     #     source_lines = []
#     #     for h in hits:
#     #         label = h.get("title") or h.get("source") or "ZUZU knowledge"
#     #         source_lines.append(f"- {label}")
#     #     reply += "\n\n**Sources**:\n" + "\n".join(source_lines)


#     # ---------------- STORE ASSISTANT MESSAGE ----------------
#         # ---------------- STORE ASSISTANT MESSAGE ----------------
#     await append_message(chat_id, "assistant", reply)
#     with pool.connection() as conn:
#         conn.execute(
#             """
#             INSERT INTO message_events (chat_id, device_id, role, category)
#             VALUES (%s, %s, 'assistant', %s)
#             """,
#             (chat_id, device_id, naive_category(reply)),
#         )
#         conn.execute(
#             "UPDATE chats SET updated_at = now() WHERE chat_id = %s",
#             (chat_id,),
#         )


#     return ChatReply(
#         chat_id=UUID(chat_id),
#         reply=reply,
#         sources=hits,
#     )

# from fastapi import Body

# class CategoryEvent(BaseModel):
#     chat_id: str
#     category: str
#     subcategory: Optional[str] = None
#     detail: Optional[str] = None


# @app.post("/api/track-category")
# async def track_category(
#     body: CategoryEvent,
#     device_id: str = Depends(require_device_id),
# ):
#     """
#     Record a category selection as a 'user' message_event without
#     creating a visible chat message.
#     """
#     chat_id = body.chat_id

#     from psycopg import OperationalError

#     try:
#         with pool.connection() as conn:
#             conn.execute(
#                 """
#                 INSERT INTO message_events (chat_id, device_id, role, category, created_at)
#                 VALUES (%s, %s, 'user', %s, now())
#                 """,
#                 (chat_id, device_id, body.category or "Other Inquiries"),
#             )
#             conn.execute(
#                 "UPDATE chats SET updated_at = now() WHERE chat_id = %s",
#                 (chat_id,),
#             )
#     except OperationalError as e:
#         logger.exception("DB error in track-category: %s", e)
#         raise HTTPException(500, "Database error while tracking category")

#     return {"ok": True}


# @app.post("/api/admin/verify")
# async def verify_admin(payload: dict = Body(None)):
#     """
#     Verify the admin dashboard code.

#     Frontend sends: { "token": "<code>" }
#     It expects: { "valid": true/false }
#     """
#     if not isinstance(payload, dict):
#         return {"valid": False}

#     code = (
#         payload.get("code")
#         or payload.get("adminCode")
#         or payload.get("token")
#         or payload.get("password")
#     )

#     if not code:
#         return {"valid": False}

#     if code == ADMIN_DASH_TOKEN:
#         return {"valid": True}

#     return {"valid": False}

# # ----------------- Analytics -----------------


# # ----------------- Analytics -----------------


# # @app.get("/api/analytics", response_model=AdminAnalyticsResponse)
# # async def analytics_api(
# #     device_id: Optional[str] = Depends(require_device_id),
# #     admin_token: Optional[str] = Header(None, alias="X-Admin-Key"),
# # ):
# #     """
# #     If X-Admin-Key == ADMIN_DASH_TOKEN → return system-wide analytics.
# #     Otherwise → return analytics scoped to this device_id.
# #     """
# #     if admin_token == ADMIN_DASH_TOKEN:
# #         device_filter = None
# #     else:
# #         device_filter = device_id

# #     return await get_analytics(device_filter)

# @app.get("/api/analytics", response_model=AdminAnalyticsResponse)
# async def analytics_api(
#     device_id: Optional[str] = Depends(require_device_id),
#     admin_token: Optional[str] = Header(None, alias="X-Admin-Key"),
# ):
#     if admin_token == ADMIN_DASH_TOKEN:
#         device_filter = None
#     else:
#         device_filter = device_id

#     try:
#         from .analytics import get_analytics
#         return await get_analytics(device_filter)
#     except Exception as e:
#         logger.exception("analytics_api failed: %s", e)
#         return {
#             "totals": {
#                 "totalUsers": 0,
#                 "totalQuestions": 0,
#                 "totalPiiEvents": 0,
#             },
#             "top_categories": [],
#             "by_day": [],
#             "consistencyScore": 100.0,
#             "consistencyByCategory": {},
#         }




# # If you ever want a "flat" analytics shape instead, you can reshape here
# # but right now the frontend expects the structure returned by get_analytics.


# @app.post("/api/search", response_model=SearchResponse)
# async def semantic_search(req: SearchRequest):
#     hits = search_docs(req.query, req.top_k)
#     return {"hits": hits}
