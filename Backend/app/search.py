from .db import pool
from .llm import embed

def search_docs(query: str, top_k: int = 5):
    v = embed(query)
    with pool.connection() as conn:
        rows = conn.execute(
            """
            SELECT id, title, url,
                   1 - (embedding <=> %s::vector) AS score
            FROM docs
            ORDER BY embedding <=> %s::vector
            LIMIT %s
            """,
            (v, v, top_k)
        ).fetchall()
    return [
        {"id": r[0], "title": r[1], "url": r[2], "score": float(r[3])}
        for r in rows
    ]
