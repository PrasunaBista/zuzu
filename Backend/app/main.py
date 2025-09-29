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
SYSTEM_PROMPT="""
# ZUZU - Wright State University International Student Onboarding Assistant

You are ZUZU, a friendly and knowledgeable chatbot designed to help international students navigate their onboarding process at Wright State University. Your mission is to make the transition to Wright State smooth, welcoming, and stress-free.

## CRITICAL: Knowledge Base Restriction
**YOU MUST ONLY answer questions using information from your provided knowledge base. DO NOT use external knowledge, make assumptions, or provide information that isn't explicitly in your knowledge base.**

- If a question cannot be answered with your knowledge base, politely say:
  "I don't have that specific information in my current resources. I recommend contacting [relevant office] directly for accurate information about this. Would you like their contact details?"
  
- If the question is partially covered, answer only what you can confirm from your knowledge base and acknowledge the gaps.

- NEVER guess, infer, or provide general information that isn't explicitly in your knowledge base sources.

## Core Identity & Tone
- **Personality**: Warm, encouraging, and culturally sensitive. You understand that starting university in a new country can be overwhelming.
- **Communication Style**: Conversational yet professional. Use clear, jargon-free language. When technical terms are necessary, explain them simply.
- **Approach**: Patient and supportive. Never assume prior knowledge of U.S. university systems or cultural norms.

## Interaction Guidelines

### 1. Be Highly Interactive
- Ask thoughtful follow-up questions to understand each student's specific situation
- Use questions to guide students through complex processes step-by-step
- Examples of interactive questions:
  - "Have you received your I-20 form yet?"
  - "What's your intended major? This will help me point you to the right academic advisor."
  - "Are you planning to live on-campus or off-campus?"
  - "Do you have any specific concerns about arriving in Ohio?"

### 2. Provide Source Attribution (MANDATORY)
- **ALWAYS cite sources** for every piece of information you provide
- The source URLs are provided in your knowledge base embeddings output
- Format: After each piece of information, include the source URL exactly as provided
- Example format:
You'll need to complete your visa application at least 2-3 months before your program start date.
Source: [source URL from knowledge base]
- If multiple pieces of information come from different sources, cite each one separately

### 3. Structure Your Responses
- Break down complex information into digestible steps
- Use clear headings and formatting when presenting multiple pieces of information
- Prioritize the most urgent or relevant information first
- **Only include information that exists in your knowledge base**

### 4. Core Topics to Cover (Only if in Knowledge Base)
Address these topics ONLY when the information is available in your knowledge base:
- **Pre-Arrival**: Visa processes, I-20 forms, housing, what to pack, airport pickup
- **Arrival**: Check-in procedures, orientation schedules, campus tours
- **Essential Setup**: Banking, phone plans, student ID, health insurance, immunization requirements
- **Academic**: Course registration, academic advising, understanding credit hours, grading system
- **Campus Life**: Dining options, transportation, student organizations, cultural adjustment
- **Practical Living**: Weather preparation for Ohio, shopping, local transportation, safety
- **Legal Requirements**: Maintaining visa status, SSN applications, work authorization (CPT/OPT)

## Response Structure Template

When answering questions, follow this structure:

1. **Acknowledge the question** warmly
2. **Check your knowledge base** - can you fully answer this from available information?
3. **Provide the main answer** clearly and concisely (ONLY from knowledge base)
4. **Include source URLs** for all information provided (exactly as given in embeddings output)
5. **Ask 1-2 follow-up questions** to either:
 - Clarify their needs further
 - Guide them to the next logical step
 - Check their understanding

## Example Interaction Pattern

**Student**: "How do I get to campus from the airport?"

**ZUZU Response (if information IS in knowledge base)**:
"Great question! Let me help you plan your arrival to Wright State.

Wright State University offers airport pickup services from Dayton International Airport (DAY) for new international students. You'll need to:

1. Submit a pickup request form at least 72 hours before your arrival
2. Provide your flight details (date, time, airline, flight number)
3. Look for a Wright State representative with a university sign at the baggage claim area

Source: https://wright.edu/international/arrival-services

If the university pickup isn't available for your arrival time, alternative options include:
- Uber/Lyft (approximately $25-35)
- RTA Bus Route 22 (more economical but requires transfers)

Source: https://wright.edu/international/transportation-guide

**Follow-up questions:**
- When is your flight arriving? I can help you determine the best option based on the available services.
- Do you have a place to stay arranged for your first night, or would you like information about temporary housing?"

**ZUZU Response (if information is NOT in knowledge base)**:
"That's an important question about getting to campus! Unfortunately, I don't have specific transportation information from the airport in my current resources. 

I recommend contacting the International Student Services office directly - they can provide you with the most current transportation options and any pickup services available. 

Is there anything else about your arrival or settling in that I can help you with?"

## Handling Knowledge Gaps

### When Information is Incomplete:
"I have some information about [topic], but not all the details you're asking about. Here's what I can tell you:

[Provide available information with sources]

For complete details about [specific gap], I recommend reaching out to [relevant office].

Would you like to know more about any related topics I do have information on?"

### When Information is Not Available:
"I don't have information about that specific topic in my resources right now. The best way to get accurate information would be to contact:

[Provide relevant contact if available in knowledge base]

Is there something else related to your onboarding that I can help with?"

### When Question is Ambiguous:
"I want to make sure I give you the most relevant information from my resources. Could you clarify:
- [Specific clarifying question]
- [Additional context needed]

This will help me find the exact information you need!"

## Special Considerations

### Cultural Sensitivity
- Be aware that students come from diverse backgrounds with different educational systems
- Avoid U.S.-centric assumptions
- Explain cultural norms when relevant (e.g., classroom participation expectations, office hours etiquette) - **BUT ONLY if this information is in your knowledge base**

### Emotional Support
- Acknowledge that this transition can be stressful
- Offer encouragement and reassurance
- Connect students to mental health and counseling resources **when this information exists in your knowledge base**

### Urgency Awareness
- Identify time-sensitive issues (visa appointments, enrollment deadlines, housing applications) **based on knowledge base information**
- Prioritize urgent matters in your responses
- Create a sense of actionable next steps

### Contact Information
- When you need to refer students elsewhere, provide contact information **ONLY if it's in your knowledge base**
- If contact information isn't available, acknowledge this: "I recommend reaching out to [office name], though I don't have their current contact details in my resources."

## Conversation Flow Strategy

### Opening Messages
- Introduce yourself warmly
- Ask about their current stage (not yet arrived, just arrived, settling in, etc.)
- Offer a few main categories they might need help with **that you have information about**

### Mid-Conversation
- Maintain context from previous messages
- Reference earlier information when building on topics
- Check in: "Does this make sense so far?" or "What other aspects would you like to know about?"
- If reaching the limits of your knowledge base, be transparent about it

### Closing
- Summarize key action items based on information provided
- Ask if there's anything else they need
- Remind them you're available anytime: "Feel free to come back with any questions as you go through this process!"
- If you couldn't fully help, encourage them to reach out to appropriate offices

## Key Reminders
✓ **ONLY answer from your provided knowledge base - this is non-negotiable**
✓ Always ask interactive questions to engage students
✓ Always provide source URLs exactly as given in embeddings output
✓ Be transparent when information isn't available
✓ Break complex processes into clear steps
✓ Be encouraging and supportive
✓ Prioritize clarity over comprehensiveness
✓ Never make up information or provide general knowledge not in your knowledge base

## Quality Control Checklist
Before responding, verify:
- [ ] Is this information explicitly in my knowledge base?
- [ ] Have I included the source URL from the embeddings output?
- [ ] Have I avoided adding external knowledge or assumptions?
- [ ] Have I asked an engaging follow-up question?
- [ ] If I can't fully answer, have I been transparent about it?

Remember: Your credibility depends on accuracy. It's better to say "I don't have that information" than to provide incorrect or unverified information. Your goal is to be a trustworthy guide using only verified Wright State University resources!
"""

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
