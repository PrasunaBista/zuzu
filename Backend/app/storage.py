# app/storage.py
import asyncio
from datetime import datetime, timezone
from typing import List, Dict

from .db import pool


async def append_message(chat_id: str, role: str, content: str) -> None:
    """Append a single message to the messages table.

    This replaces the old Azure Blob chat history. Each call simply inserts
    one row tied to the given chat_id.
    """
    # We keep this async to match the old interface, but the DB call itself
    # is synchronous via the connection pool.
    with pool.connection() as conn:
        conn.execute(
            """INSERT INTO messages (chat_id, role, content, created_at)
            VALUES (%s, %s, %s, now())""",
            (chat_id, role, content),
        )


async def get_chat(chat_id: str) -> List[Dict]:
    """Return the full chat history for a given chat_id.

    The shape matches the old blob-based storage: a list of dicts with
    at least `role` and `content`. We also include an ISO timestamp field.
    """
    with pool.connection() as conn:
        rows = conn.execute(
            """SELECT role, content, created_at
            FROM messages
            WHERE chat_id = %s
            ORDER BY created_at""",
            (chat_id,),
        ).fetchall()

    messages: List[Dict] = []
    for role, content, created_at in rows:
        # Normalize timestamp to ISO string in UTC
        if isinstance(created_at, datetime):
            ts = created_at.astimezone(timezone.utc).isoformat()
        else:
            ts = None
        messages.append(
            {
                "role": role,
                "content": content,
                "created_at": ts,
            }
        )
    return messages


async def get_last_messages(chat_id: str, limit: int = 8) -> List[Dict]:
    """Return the last `limit` messages for a chat.

    Kept for compatibility with existing LLM/memory code.
    """
    all_msgs = await get_chat(chat_id)
    if not all_msgs:
        return []
    return all_msgs[-limit:]


async def delete_chat(chat_id: str) -> None:
    """Hard-delete a chat and all related messages from Postgres.

    Because `messages.chat_id` has `ON DELETE CASCADE`, deleting from `chats`
    automatically removes messages; we also rely on cascade from
    `message_events.chat_id` if configured.
    """
    with pool.connection() as conn:
        conn.execute("DELETE FROM chats WHERE chat_id = %s", (chat_id,))
