from typing import Any, Dict
from .db import pool  # asyncpg pool

async def get_analytics() -> Dict[str, Any]:
    """
    Returns admin dashboard metrics in this shape:
    {
      "totals": {"chats": int, "messages_24h": int},
      "by_day": [{"date": "YYYY-MM-DD", "count": int}, ...],
      "top_categories": [{"category": str, "count": int}, ...]
    }
    """
    # Default safe payload
    out: Dict[str, Any] = {
        "totals": {"chats": 0, "messages_24h": 0},
        "by_day": [],
        "top_categories": [],
    }

    try:
        async with pool.acquire() as conn:
            chats_total = await conn.fetchval(
                "SELECT COALESCE(COUNT(*),0) FROM public.chats"
            )

            msgs_24h = await conn.fetchval(
                "SELECT COALESCE(COUNT(*),0) FROM public.message_events WHERE ts > now() - interval '24 hours'"
            )

            by_day_rows = await conn.fetch(
                """
                SELECT to_char(date_trunc('day', created_at), 'YYYY-MM-DD') AS d, COUNT(*) AS c
                FROM public.chats
                WHERE created_at >= now() - interval '7 days'
                GROUP BY 1
                ORDER BY 1 ASC
                """
            )
            by_day = [{"date": r["d"], "count": int(r["c"])} for r in by_day_rows]

            top_cat_rows = await conn.fetch(
                """
                SELECT COALESCE(category, 'uncategorized') AS category, COUNT(*) AS c
                FROM public.message_events
                WHERE ts >= now() - interval '7 days'
                GROUP BY 1
                ORDER BY c DESC
                LIMIT 10
                """
            )
            top_categories = [{"category": r["category"], "count": int(r["c"])} for r in top_cat_rows]

            out["totals"] = {"chats": int(chats_total or 0), "messages_24h": int(msgs_24h or 0)}
            out["by_day"] = by_day
            out["top_categories"] = top_categories
    except Exception as e:
        print(f"[analytics] WARN: {e}")  # keep API alive

    return out
