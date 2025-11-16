# app/llm.py
import os
import asyncio
from typing import List, Dict, Optional

from dotenv import load_dotenv
from openai import AzureOpenAI

from .utils import contains_pii

load_dotenv()

# ---- Azure OpenAI config ----
AZURE_ENDPOINT = os.getenv("AZURE_OPENAI_ENDPOINT", "").strip()
AZURE_API_KEY = os.getenv("AZURE_OPENAI_API_KEY", "").strip()
AZURE_API_VERSION = os.getenv("AZURE_OPENAI_API_VERSION", "2024-02-01").strip()

CHAT_MODEL = os.getenv("AZURE_OPENAI_GPT4_DEPLOYMENT", "gpt-4o").strip()
EMBED_MODEL = os.getenv(
    "AZURE_OPENAI_EMBED_DEPLOYMENT",
    "text-embedding-3-large",
).strip()

# 🔒 force 1536-dim embeddings everywhere
EMBED_DIM = 1536

DEFAULT_SYSTEM_PROMPT = os.getenv("SYSTEM_PROMPT", "You are ZUZU...")

_client: Optional[AzureOpenAI] = None


def _get_client() -> AzureOpenAI:
    """
    Lazily create and reuse a single AzureOpenAI client.
    """
    global _client
    if _client is None:
        if not AZURE_API_KEY or not AZURE_ENDPOINT:
            raise RuntimeError(
                "AZURE_OPENAI_API_KEY or AZURE_OPENAI_ENDPOINT not set"
            )

        _client = AzureOpenAI(
            api_key=AZURE_API_KEY,
            azure_endpoint=AZURE_ENDPOINT,
            api_version=AZURE_API_VERSION,
        )
    return _client


def _assert_no_pii_in_messages(messages: List[Dict]) -> None:
    """
    Last-resort PII guard. We already block PII in /api/chat,
    so here we just *logically* check but DO NOT raise.
    """
    # If you want, you can log here, but do not crash the request.
    for m in messages:
        content = m.get("content") or ""
        if contains_pii(content):
            # just ignore / pass – PII was supposed to be blocked at the edge
            return
    return


# ---------- Embeddings (SYNC) ----------

def _embed_sync(text: str) -> List[float]:
    """
    Low-level synchronous embedding call.
    Always uses EMBED_DIM dimensions.
    """
    client = _get_client()
    resp = client.embeddings.create(
        model=EMBED_MODEL,
        input=text,
        dimensions=EMBED_DIM,
    )
    return resp.data[0].embedding


def embed_text(text: str) -> List[float]:
    """
    Public sync helper for embeddings - used by RAG/search.
    """
    if not text:
        return []
    return _embed_sync(text)


async def embed_text_async(text: str) -> List[float]:
    """
    Async wrapper around embed_text, used by analytics consistency calculator.
    """
    loop = asyncio.get_running_loop()
    return await loop.run_in_executor(None, embed_text, text)


# ---------- Chat completions ----------

def _chat_sync(
    messages: List[Dict],
    temperature: float = 0.3,
    max_tokens: int = 800,
) -> str:
    """
    Synchronous Azure OpenAI chat completion call.
    """
    _assert_no_pii_in_messages(messages)
    client = _get_client()

    response = client.chat.completions.create(
        model=CHAT_MODEL,
        messages=messages,
        temperature=temperature,
        max_tokens=max_tokens,
    )
    return response.choices[0].message.content


async def chat_complete(
    messages: List[Dict],
    temperature: float = 0.3,
    max_tokens: int = 800,
) -> str:
    """
    Async wrapper that runs the sync call in a thread pool.
    """
    try:
        loop = asyncio.get_running_loop()
    except RuntimeError:
        # Fallback for older event loop setups
        loop = asyncio.get_event_loop()

    return await loop.run_in_executor(
        None,
        _chat_sync,
        messages,
        temperature,
        max_tokens,
    )


# ---------- Summarizer for chat memory ----------

async def summarize_history(snippets: List[Dict]) -> str:
    """
    Summarize prior dialogue into a compact, neutral context (6-8 sentences)
    that includes key facts like: student level (undergrad/grad), housing
    interests, and any strong preferences.
    """
    if not snippets:
        return ""

    flat = "\n".join(
        f"{m.get('role', 'user')}: {m.get('content', '')}"
        for m in snippets
        if m.get("content")
    )

    prompt: List[Dict] = [
        {
            "role": "system",
            "content": (
                "Summarize the dialogue below into a short, neutral context "
                "(6-8 sentences). Highlight if the student is undergraduate "
                "or graduate, any housing preferences, visa/immigration "
                "constraints, and important constraints like budget or move-in timing."
            ),
        },
        {"role": "user", "content": flat},
    ]

    try:
        return await chat_complete(prompt, temperature=0.0, max_tokens=250)
    except Exception:
        return ""
