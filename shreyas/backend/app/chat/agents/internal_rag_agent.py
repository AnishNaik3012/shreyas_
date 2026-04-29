from __future__ import annotations

from typing import Dict, List, Tuple
import time

from app.chat.context_builder import build_context
from app.rag.search import search_documents


async def internal_rag_agent(
    message: str,
    role: str,
    department: str,
    history: List[Dict[str, str]],
    state: Dict[str, object] | None = None,
) -> Dict[str, str | None]:
    t0 = time.perf_counter()
    print("RAG TOOL QUERY:", message)
    state_role = (state or {}).get("role")
    if state_role == "doctor":
        allowed_categories = {"faq", "policy", "doctor"}
    else:
        allowed_categories = {"faq", "policy"}
    cache_key: Tuple[str, str, str, str] = (
        message.strip().lower(),
        role,
        department,
        ",".join(sorted(allowed_categories)),
    )
    cached = _RAG_CACHE.get(cache_key)
    now = time.time()
    if cached and now - cached["ts"] < _RAG_CACHE_TTL_SECONDS:
        docs = cached["docs"]
    else:
        docs = search_documents(
            query=message,
            role=role,
            department=department,
            top_k=6,
        )
        _RAG_CACHE[cache_key] = {"ts": now, "docs": docs}
    docs = [
        doc
        for doc in docs
        if (doc.get("metadata") or {}).get("category") in allowed_categories
    ]
    retrieved_text = build_context(docs)
    print("RETRIEVED CONTEXT:", retrieved_text)
    print(f"RAG TIMING ms: {(time.perf_counter() - t0) * 1000:.1f}")
    if not retrieved_text or retrieved_text.strip() == "":
        return {
            "status": "no_data",
            "content": "No internal hospital policy found for this query.",
            "source": "knowledge_base",
        }

    return {
        "status": "success",
        "content": retrieved_text,
        "source": "knowledge_base",
    }


_RAG_CACHE_TTL_SECONDS = 60
_RAG_CACHE: Dict[Tuple[str, str, str, str], Dict[str, object]] = {}
