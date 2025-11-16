# app/analytics.py
import math
from collections import defaultdict
from typing import Any, Dict, List, Optional, Tuple

from .db import pool
from .storage import get_chat
from .llm import embed_text_async
from .utils import contains_pii, mask_pii, naive_category, ZUZU_CATEGORIES


# ===================================================================
# 🔹 FETCH BASIC NUMBERS
# ===================================================================
def _fetch_basic_aggregates(device_id: Optional[str]) -> Dict[str, Any]:
    """
    Fetch all synchronous DB aggregates:
    - total_chats
    - total_users (distinct device_id)
    - total_pii_flags (events)
    - pii_devices (distinct devices that triggered PII at least once)
    - category counts
    - daily usage (7d)
    - recent chat_ids for consistency
    """

    with pool.connection() as conn:

        # ---- TOTAL CHATS ----
        if device_id:
            row = conn.execute(
                "SELECT COUNT(*) FROM chats WHERE device_id=%s",
                (device_id,),
            ).fetchone()
        else:
            row = conn.execute("SELECT COUNT(*) FROM chats").fetchone()

        total_chats = int(row[0] if row else 0)

        # ---- TOTAL PII FLAGS (events) + PII DEVICES ----
        if device_id:
            # for a single device, pii_flags = how many times THIS device hit PII
            row = conn.execute(
                "SELECT COUNT(*) FROM pii_events WHERE device_id=%s",
                (device_id,),
            ).fetchone()
            pii_flags = int(row[0] if row else 0)

            # for a single device, pii_devices = 1 if it ever triggered, else 0
            pii_devices = 1 if pii_flags > 0 else 0
        else:
            # global admin view
            row = conn.execute("SELECT COUNT(*) FROM pii_events").fetchone()
            pii_flags = int(row[0] if row else 0)

            row = conn.execute(
                "SELECT COUNT(DISTINCT device_id) FROM pii_events"
            ).fetchone()
            pii_devices = int(row[0] if row else 0)

        # ---- TOTAL USERS (distinct device_id from chats) ----
        row = conn.execute("SELECT COUNT(DISTINCT device_id) FROM chats").fetchone()
        total_users = int(row[0] if row else 0)

        # ---- CATEGORY COUNTS ----
        if device_id:
            cat_rows = conn.execute(
                """
                SELECT me.category, COUNT(*) 
                FROM message_events me
                JOIN chats c ON c.chat_id = me.chat_id
                WHERE me.role = 'user' AND c.device_id=%s
                GROUP BY me.category
                ORDER BY COUNT(*) DESC
                """,
                (device_id,),
            ).fetchall()
        else:
            cat_rows = conn.execute(
                """
                SELECT category, COUNT(*)
                FROM message_events
                WHERE role='user'
                GROUP BY category
                ORDER BY COUNT(*) DESC
                """
            ).fetchall()

        top_categories = [
            {
                "category": (r[0] or "Other Inquiries"),
                "count": int(r[1]),
            }
            for r in cat_rows
        ]

        # ---- DAILY USAGE (7-day window) ----
        if device_id:
            day_rows = conn.execute(
                """
                SELECT TO_CHAR(me.created_at::date, 'YYYY-MM-DD') AS d,
                       COUNT(*) 
                FROM message_events me
                JOIN chats c ON c.chat_id = me.chat_id
                WHERE me.role='user'
                  AND c.device_id=%s
                  AND me.created_at >= CURRENT_DATE - INTERVAL '7 days'
                GROUP BY d
                ORDER BY d
                """,
                (device_id,),
            ).fetchall()
        else:
            day_rows = conn.execute(
                """
                SELECT TO_CHAR(created_at::date, 'YYYY-MM-DD') AS d,
                       COUNT(*)
                FROM message_events
                WHERE role='user'
                  AND created_at >= CURRENT_DATE - INTERVAL '7 days'
                GROUP BY d
                ORDER BY d
                """
            ).fetchall()

        by_day = [{"date": r[0], "count": int(r[1])} for r in day_rows]

        # ---- RECENT CHAT IDS (up to 200 chats) ----
        if device_id:
            chat_rows = conn.execute(
                """
                SELECT chat_id 
                FROM chats
                WHERE device_id=%s
                ORDER BY updated_at DESC
                LIMIT 200
                """,
                (device_id,),
            ).fetchall()
        else:
            chat_rows = conn.execute(
                """
                SELECT chat_id
                FROM chats
                ORDER BY updated_at DESC
                LIMIT 200
                """
            ).fetchall()

        chat_ids = [str(r[0]) for r in chat_rows]

    return {
        "totals": {
            "chats": total_chats,
            "users": total_users,
            "pii_flags": pii_flags,
            "pii_devices": pii_devices,
        },
        "top_categories": top_categories,
        "by_day": by_day,
        "chat_ids": chat_ids,
    }


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
        last_user = None

        for m in messages:
            role = (m.get("role") or "").lower()
            text = (m.get("content") or "").strip()
            if not text:
                continue

            if role == "user":
                last_user = text

            elif role == "assistant" and last_user:
                key = last_user.lower().strip()
                if len(key) > 200:
                    key = key[:200]

                qa_groups[key].append(
                    {
                        "answer": text,
                        "category": naive_category(last_user),
                    }
                )

                last_user = None

    # ---- ONLY QUESTIONS ASKED ≥ 2 TIMES ----
    repeated_groups = [g for g in qa_groups.values() if len(g) >= 2]

    if not repeated_groups:
        return 100.0, {cat: 100.0 for cat in ZUZU_CATEGORIES}

    all_sims = []
    per_cat_sims = {cat: [] for cat in ZUZU_CATEGORIES}

    # ---- COMPUTE SIMILARITIES ----
    for group in repeated_groups:
        embeddings = []

        group_cat = group[0]["category"] or "Other Inquiries"

        for item in group:
            ans = item["answer"]
            txt = mask_pii(ans) if contains_pii(ans) else ans
            txt = txt[:2000]

            try:
                vec = await embed_text_async(txt)
                if vec is not None:
                    embeddings.append(vec)
            except Exception:
                continue

        # need at least 2
        if len(embeddings) < 2:
            continue

        # pairwise cosine similarities
        n = len(embeddings)
        total = 0
        count = 0

        for i in range(n):
            a = embeddings[i]
            for j in range(i + 1, n):
                b = embeddings[j]

                dot = sum(x * y for x, y in zip(a, b))
                na = math.sqrt(sum(x * x for x in a))
                nb = math.sqrt(sum(x * x for x in b))
                if na > 0 and nb > 0:
                    total += dot / (na * nb)
                    count += 1

        if count > 0:
            sim = total / count
            all_sims.append(sim)
            per_cat_sims[group_cat].append(sim)

    if not all_sims:
        return 100.0, {cat: 100.0 for cat in ZUZU_CATEGORIES}

    def clamp(x: float) -> float:
        return max(0.0, min(1.0, x))

    global_score = round(clamp(sum(all_sims) / len(all_sims)) * 100, 1)

    per_cat = {}
    for cat in ZUZU_CATEGORIES:
        sims = per_cat_sims.get(cat) or []
        if not sims:
            per_cat[cat] = 100.0
        else:
            per_cat[cat] = round(clamp(sum(sims) / len(sims)) * 100, 1)

    return global_score, per_cat


# ===================================================================
# 🔹 PUBLIC ANALYTICS ENTRYPOINT
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
