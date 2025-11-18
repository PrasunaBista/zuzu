# app/analytics.py
import math
from collections import defaultdict
from typing import Any, Dict, List, Optional, Tuple

from .db import pool
from .storage import get_chat
from .llm import embed_text_async
from .utils import naive_category, ZUZU_CATEGORIES


# ===================================================================
# 🔹 FETCH BASIC NUMBERS (totals, categories, weekly usage)
# ===================================================================
def _fetch_basic_aggregates(device_id: Optional[str]) -> Dict[str, Any]:
    """
    Basic aggregates for analytics:
      - totals: { totalUsers, totalQuestions, totalPiiEvents }
      - top_categories: [ { category, count }, ... ]
      - by_day: [ { date: "YYYY-MM-DD", count }, ... ]
      - chat_ids: [ ... ] used for consistency scoring
    """
    where = ""
    params: List[Any] = []

    if device_id is not None:
        where = " AND device_id = %s"
        params.append(device_id)

    with pool.connection() as conn:
        # ---- Total distinct users (devices) ----
        row = conn.execute(
            "SELECT COUNT(DISTINCT device_id) FROM chats"
        ).fetchone()
        total_users = int(row[0]) if row is not None else 0

        # ---- Total questions (user messages) ----
        row = conn.execute(
            f"""
            SELECT COUNT(*)
            FROM message_events
            WHERE role = 'user'
            {where}
            """,
            params,
        ).fetchone()
        total_questions = int(row[0]) if row is not None else 0

        # ---- PII events (global count) ----
        row = conn.execute(
            "SELECT COUNT(*) FROM pii_events"
        ).fetchone()
        pii_events = int(row[0]) if row is not None else 0

        # ---- Usage by day (last 7 days, only user messages) ----
        by_day_rows = conn.execute(
            f"""
            SELECT created_at::date AS d, COUNT(*)
            FROM message_events
            WHERE role = 'user'
              AND created_at >= CURRENT_DATE - INTERVAL '7 days'
              {where}
            GROUP BY created_at::date
            ORDER BY d
            """,
            params,
        ).fetchall()

        by_day = [
            {"date": r[0].isoformat(), "count": int(r[1])} for r in by_day_rows
        ]

        # ---- Top categories ----
        cat_rows = conn.execute(
            f"""
            SELECT category, COUNT(*)
            FROM message_events
            WHERE role = 'user'
            {where}
            GROUP BY category
            ORDER BY COUNT(*) DESC
            """,
            params,
        ).fetchall()

        top_categories: List[Dict[str, Any]] = []
        for cat, cnt in cat_rows:
            name = cat or "Other Inquiries"
            top_categories.append(
                {"category": name, "count": int(cnt)}
            )

        # ---- Chat IDs used for consistency calculations ----
        chat_rows = conn.execute(
            f"""
            SELECT DISTINCT chat_id
            FROM message_events
            WHERE role = 'user'
            {where}
            """,
            params,
        ).fetchall()

        chat_ids = [r[0] for r in chat_rows]

    return {
        "chat_ids": chat_ids,
        "totals": {
            "totalUsers": total_users,
            "totalQuestions": total_questions,
            "totalPiiEvents": pii_events,
        },
        "top_categories": top_categories,
        "by_day": by_day,
    }



# def _fetch_basic_aggregates(device_id: Optional[str]) -> Dict[str, Any]:
#     """
#     Fetch all synchronous DB aggregates:
#     - total_chats
#     - total_users (distinct device_id)
#     - total_questions (user messages)
#     - total_pii_events
#     - pii_devices (distinct devices that triggered PII)
#     - top categories
#     - daily usage (last 7 days)
#     - recent chat_ids for consistency scoring
#     """

#     with pool.connection() as conn:

#         # ---- TOTAL CHATS ----
#         if device_id:
#             row = conn.execute(
#                 "SELECT COUNT(*) FROM chats WHERE device_id=%s",
#                 (device_id,),
#             ).fetchone()
#         else:
#             row = conn.execute("SELECT COUNT(*) FROM chats").fetchone()
#         total_chats = int(row[0] if row else 0)

#         # ---- TOTAL QUESTIONS (user messages) ----
#         if device_id:
#             row = conn.execute(
#                 """
#                 SELECT COUNT(*)
#                 FROM message_events me
#                 JOIN chats c ON c.chat_id = me.chat_id
#                 WHERE me.role = 'user'
#                   AND c.device_id = %s
#                 """,
#                 (device_id,),
#             ).fetchone()
#         else:
#             row = conn.execute(
#                 """
#                 SELECT COUNT(*)
#                 FROM message_events
#                 WHERE role = 'user'
#                 """
#             ).fetchone()
#         total_questions = int(row[0] if row else 0)

#         # ---- TOTAL PII EVENTS ----
#         if device_id:
#             row = conn.execute(
#                 "SELECT COUNT(*) FROM pii_events WHERE device_id=%s",
#                 (device_id,),
#             ).fetchone()
#         else:
#             row = conn.execute("SELECT COUNT(*) FROM pii_events").fetchone()
#         total_pii_events = int(row[0] if row else 0)

#         # ---- PII DEVICES (distinct devices that triggered PII at least once) ----
#         if device_id:
#             row = conn.execute(
#                 "SELECT COUNT(DISTINCT device_id) FROM pii_events WHERE device_id=%s",
#                 (device_id,),
#             ).fetchone()
#         else:
#             row = conn.execute(
#                 "SELECT COUNT(DISTINCT device_id) FROM pii_events"
#             ).fetchone()
#         pii_devices = int(row[0] if row else 0)

#         # ---- TOTAL USERS (distinct device_id from chats) ----
#         row = conn.execute("SELECT COUNT(DISTINCT device_id) FROM chats").fetchone()
#         total_users = int(row[0] if row else 0)

#         # ---- CATEGORY COUNTS (for analytics donut / bar chart) ----
#         if device_id:
#             cat_rows = conn.execute(
#                 """
#                 SELECT me.category, COUNT(*) 
#                 FROM message_events me
#                 JOIN chats c ON c.chat_id = me.chat_id
#                 WHERE me.role = 'user' AND c.device_id=%s
#                 GROUP BY me.category
#                 ORDER BY COUNT(*) DESC
#                 """,
#                 (device_id,),
#             ).fetchall()
#         else:
#             cat_rows = conn.execute(
#                 """
#                 SELECT category, COUNT(*)
#                 FROM message_events
#                 WHERE role='user'
#                 GROUP BY category
#                 ORDER BY COUNT(*) DESC
#                 """
#             ).fetchall()

#         top_categories: List[Dict[str, Any]] = []
#         denom = max(total_questions, 1)
#         for cat, cnt in cat_rows:
#             name = cat or "Other Inquiries"
#             pct = (cnt / denom) * 100.0
#             top_categories.append(
#                 {
#                     "category": name,
#                     "count": int(cnt),
#                     "percent": round(pct, 1),
#                 }
#             )

#         # ---- WEEKLY USAGE (LAST 7 DAYS, TOTAL QUESTIONS PER DAY) ----
#         if device_id:
#             day_rows = conn.execute(
#                 """
#                 SELECT TO_CHAR(me.created_at::date, 'YYYY-MM-DD') AS d,
#                        COUNT(*) AS cnt
#                 FROM message_events me
#                 JOIN chats c ON c.chat_id = me.chat_id
#                 WHERE me.role='user'
#                   AND c.device_id = %s
#                   AND me.created_at >= CURRENT_DATE - INTERVAL '7 days'
#                 GROUP BY d
#                 ORDER BY d
#                 """,
#                 (device_id,),
#             ).fetchall()
#         else:
#             day_rows = conn.execute(
#                 """
#                 SELECT TO_CHAR(created_at::date, 'YYYY-MM-DD') AS d,
#                        COUNT(*) AS cnt
#                 FROM message_events
#                 WHERE role='user'
#                   AND created_at >= CURRENT_DATE - INTERVAL '7 days'
#                 GROUP BY d
#                 ORDER BY d
#                 """
#             ).fetchall()

#         by_day = [
#             {"date": r[0], "count": int(r[1])}
#             for r in day_rows
#         ]

#         # ---- RECENT CHAT IDS FOR CONSISTENCY CALC ----
#         if device_id:
#             chat_rows = conn.execute(
#                 """
#                 SELECT chat_id
#                 FROM chats
#                 WHERE device_id = %s
#                 ORDER BY updated_at DESC
#                 LIMIT 50
#                 """,
#                 (device_id,),
#             ).fetchall()
#         else:
#             chat_rows = conn.execute(
#                 """
#                 SELECT chat_id
#                 FROM chats
#                 ORDER BY updated_at DESC
#                 LIMIT 50
#                 """
#             ).fetchall()

#         chat_ids = [str(r[0]) for r in chat_rows]

#     return {
#         "totals": {
#             "totalChats": total_chats,
#             "totalUsers": total_users,
#             "totalQuestions": total_questions,
#             "totalPiiEvents": total_pii_events,
#             "piiDevices": pii_devices,
#         },
#         "top_categories": top_categories,
#         "by_day": by_day,
#         "chat_ids": chat_ids,
#     }


# ===================================================================
# 🔹 DEEP CONSISTENCY CALCULATOR USING EMBEDDINGS
# ===================================================================

async def _compute_consistency(chat_ids: List[str]) -> Tuple[float, Dict[str, float]]:
    """
    For each chat:
    - pair user question + assistant answer
    - group questions by normalized text
    - for each question asked 2+ times, compute embedding similarity
    - global consistency = avg pairwise similarity (0–100)
    - per-category consistency = similarity grouped by naive category
    """

    qa_groups: Dict[str, List[Dict[str, str]]] = defaultdict(list)

    # ---- BUILD Q/A GROUPS ----
    for chat_id in chat_ids:
        messages = await get_chat(chat_id)
        if not messages:
            continue

        last_user: Optional[str] = None

        for m in messages:
            role = m.get("role")
            content = (m.get("content") or "").strip()
            if not content:
                continue

            if role == "user":
                last_user = content
            elif role == "assistant" and last_user:
                q = last_user
                a = content
                key = _normalize_question(q)
                cat = naive_category(q)
                qa_groups[key].append(
                    {
                        "question": q,
                        "answer": a,
                        "category": cat,
                    }
                )
                last_user = None

    # ---- COMPUTE SIMILARITIES ----
    global_sims: List[float] = []
    per_cat_sims: Dict[str, List[float]] = defaultdict(list)

    for key, qa_list in qa_groups.items():
        if len(qa_list) < 2:
            continue  # only 1 answer, nothing to compare

        # Embed all answers for this normalized question
        answers = [item["answer"] for item in qa_list]
        embeddings: List[List[float]] = []
        for ans in answers:
            emb = await embed_text_async(ans)
            embeddings.append(emb)

        # Pairwise cosine similarities
        n = len(embeddings)
        for i in range(n):
            for j in range(i + 1, n):
                sim = _cosine(embeddings[i], embeddings[j])
                if sim is None:
                    continue
                global_sims.append(sim)

                cat_i = qa_list[i]["category"] or "Other Inquiries"
                per_cat_sims[cat_i].append(sim)

    # ---- REDUCE TO SCORES 0–100 ----
    if global_sims:
        global_score = round(100.0 * (sum(global_sims) / len(global_sims)), 1)
    else:
        # If we have no repeated questions, treat as fully consistent
        global_score = 100.0

    per_cat_scores: Dict[str, float] = {}
    for cat in ZUZU_CATEGORIES:
        sims = per_cat_sims.get(cat, [])
        if sims:
            per_cat_scores[cat] = round(100.0 * (sum(sims) / len(sims)), 1)
        else:
            per_cat_scores[cat] = 100.0

    # Also include any other categories that showed up
    for cat, sims in per_cat_sims.items():
        if cat not in per_cat_scores:
            per_cat_scores[cat] = round(100.0 * (sum(sims) / len(sims)), 1)

    return global_score, per_cat_scores


def _normalize_question(q: str) -> str:
    """
    Very rough normalization so that
    'Tell me about housing' and 'tell me about Housing?' group together.
    """
    return " ".join(q.lower().strip().split())


def _cosine(u: List[float], v: List[float]) -> Optional[float]:
    if not u or not v or len(u) != len(v):
        return None
    dot = 0.0
    nu = 0.0
    nv = 0.0
    for a, b in zip(u, v):
        dot += a * b
        nu += a * a
        nv += b * b
    if nu == 0.0 or nv == 0.0:
        return None
    return dot / math.sqrt(nu * nv)


# ===================================================================
# 🔹 PUBLIC ENTRY POINT
# ===================================================================

async def get_analytics(device_id: Optional[str]) -> Dict[str, Any]:
    
    basics = _fetch_basic_aggregates(device_id)
    global_score, per_cat_scores = await _compute_consistency(
        basics["chat_ids"]
    )

    return {
        "totals": basics["totals"],
        "top_categories": basics["top_categories"],
        "by_day": basics["by_day"],
        "consistencyScore": global_score,
        "consistencyByCategory": per_cat_scores,
    }
