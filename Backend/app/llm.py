from datetime import datetime, timedelta, timezone
from .db import pool

async def get_analytics(timeframe: str):
    now = datetime.now(timezone.utc)
    start = {
        "24h": now - timedelta(days=1),
        "7d":  now - timedelta(days=7),
        "30d": now - timedelta(days=30),
        "90d": now - timedelta(days=90),
    }.get(timeframe, now - timedelta(days=7))

    with pool.connection() as conn:
        total = conn.execute(
            "SELECT count(*) FROM message_events WHERE role='user' AND ts >= %s",
            (start,)
        ).fetchone()[0]

        cats = conn.execute(
            """
            SELECT coalesce(category,'Other Inquiries') AS category, count(*)
            FROM message_events
            WHERE role='user' AND ts >= %s
            GROUP BY 1 ORDER BY 2 DESC
            """,
            (start,)
        ).fetchall()

        daily = conn.execute(
            """
            SELECT to_char(date_trunc('day', ts), 'Mon DD') AS d, count(*)
            FROM message_events
            WHERE role='user' AND ts >= %s
            GROUP BY 1 ORDER BY min(ts)
            """,
            (start,)
        ).fetchall()

    return {
        "totalQuestions": int(total),
        "questionCategories": [{"category": c[0], "count": int(c[1])} for c in cats],
        "dailyQuestions": [{"date": d[0], "questions": int(d[1])} for d in daily],
    }
async def summarize_history(snippets: list[dict]) -> str:
    if not snippets:
        return ""
    flat = "\n".join(f"{m['role']}: {m['content']}" for m in snippets)
    prompt = [
        {"role":"system","content":"Summarize the dialogue below into a short, neutral context (6-8 sentences)."},
        {"role":"user","content": flat}
    ]
    return await chat_complete(prompt)

