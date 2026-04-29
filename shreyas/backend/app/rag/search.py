"""Semantic search entrypoint for RAG."""
from __future__ import annotations

from typing import Any, Dict, List
import logging
import os
from functools import lru_cache
from pathlib import Path

from fastapi import APIRouter
from pydantic import BaseModel

from app.rag.embedder import embed_query
from app.rag.vector_store import query_index
from app.rag.loader import load_knowledge_base


LOGGER = logging.getLogger(__name__)
router = APIRouter(prefix="/rag", tags=["RAG"])


class RAGSearchRequest(BaseModel):
    query: str
    role: str
    department: str


class RAGSearchResponse(BaseModel):
    results: List[Dict[str, Any]]


def _keyword_overlap_bonus(query: str, text: str) -> float:
    query_terms = {token for token in query.lower().split() if token.isalnum()}
    if not query_terms or not text:
        return 0.0
    text_terms = {token for token in text.lower().split() if token.isalnum()}
    overlap = query_terms.intersection(text_terms)
    if not overlap:
        return 0.0
    return min(0.6, 0.1 * len(overlap))


@lru_cache(maxsize=1)
def _load_kb_docs() -> List[Dict[str, Any]]:
    root = Path(__file__).resolve().parents[2] / "knowledge_base"
    return load_knowledge_base(root)


def _local_search(query: str, role: str, department: str, top_k: int) -> List[Dict[str, Any]]:
    docs = _load_kb_docs()
    results: List[Dict[str, Any]] = []
    for doc in docs:
        roles = [r.lower() for r in (doc.get("role") or ["all"])]
        doc_dept = (doc.get("department") or "").lower()
        if role.lower() not in roles and "all" not in roles:
            continue
        if doc_dept and department.lower() not in {doc_dept, "all", "general medicine"}:
            continue
        title = doc.get("title") or ""
        tags = " ".join(doc.get("tags") or [])
        text = doc.get("content") or ""
        combined = f"{title}\n{tags}\n{text}"
        bonus = _keyword_overlap_bonus(query, combined)
        if bonus <= 0:
            continue
        results.append(
            {
                "id": doc.get("id"),
                "score": bonus,
                "semantic_score": 0.0,
                "keyword_bonus": bonus,
                "text": text,
                "metadata": {
                    "title": doc.get("title"),
                    "category": doc.get("category"),
                    "department": doc.get("department"),
                    "role": doc.get("role"),
                    "tags": doc.get("tags"),
                },
            }
        )
    results.sort(key=lambda item: item.get("score", 0.0), reverse=True)
    return results[:top_k]


def search_documents(
    query: str,
    role: str | None = None,
    department: str | None = None,
    category: str | None = None,
    top_k: int = 6,
) -> List[Dict[str, Any]]:
    if not os.getenv("PINECONE_API_KEY"):
        LOGGER.warning("PINECONE_API_KEY not set, using local keyword search")
        return _local_search(query, role or "all", department or "general medicine", top_k)

    vector = embed_query(query)
    metadata_filter: Dict[str, Any] = {}
    if role:
        metadata_filter["role"] = {"$in": [role, "all"]}
    if department:
        metadata_filter["department"] = {"$in": [department, "", "all", "general", "general medicine"]}
    if category:
        metadata_filter["category"] = {"$eq": category}
    try:
        response = query_index(vector=vector, top_k=top_k, metadata_filter=metadata_filter)
    except Exception:
        LOGGER.exception("Pinecone query failed, falling back to local keyword search")
        return _local_search(query, role, department, top_k)
    matches = response.get("matches", []) if isinstance(response, dict) else response.matches
    if not matches:
        return _local_search(query, role, department, top_k)

    results: List[Dict[str, Any]] = []
    for match in matches:
        metadata = match.get("metadata") if isinstance(match, dict) else match.metadata
        text = (metadata or {}).get("text") or ""
        title = (metadata or {}).get("title") or ""
        tags = " ".join((metadata or {}).get("tags") or [])
        combined = f"{title}\n{tags}\n{text}"
        base_score = match.get("score") if isinstance(match, dict) else match.score
        bonus = _keyword_overlap_bonus(query, combined)
        hybrid_score = (base_score or 0.0) + bonus
        results.append(
            {
                "id": match.get("id") if isinstance(match, dict) else match.id,
                "score": hybrid_score,
                "semantic_score": base_score,
                "keyword_bonus": bonus,
                "text": text,
                "metadata": metadata or {},
            }
        )

    # If query contains strong domain keywords, filter to matching docs
    lowered = query.lower()
    if "pregnancy" in lowered or "prenatal" in lowered or "trimester" in lowered:
        filtered = [r for r in results if "pregnan" in (r.get("text") or "").lower() or "pregnan" in (r.get("metadata") or {}).get("title", "").lower()]
        if filtered:
            results = filtered

    results.sort(key=lambda item: item.get("score", 0.0), reverse=True)
    return results[:top_k]


@router.post("/search", response_model=RAGSearchResponse)
def rag_search(data: RAGSearchRequest):
    results = search_documents(data.query, data.role, data.department, top_k=6)
    return RAGSearchResponse(results=results)


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
