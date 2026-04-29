"""Embeddings generator using Google Gemini."""
from __future__ import annotations

from typing import Any, Dict, Iterable, List
import logging
import os

try:
    from google import genai  # type: ignore
    from google.genai import types  # type: ignore
except Exception:  # pragma: no cover
    import google.generativeai as genai  # type: ignore
    types = None  # type: ignore


LOGGER = logging.getLogger(__name__)
EMBEDDING_MODEL = "gemini-embedding-001"
OUTPUT_DIMENSIONALITY = 3072


def _get_client() -> genai.Client:
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise RuntimeError("GEMINI_API_KEY missing. Check .env loading.")
    if hasattr(genai, "Client"):
        return genai.Client(api_key=api_key)
    genai.configure(api_key=api_key)
    return genai


def _extract_vector(result: Any) -> List[float]:
    embeddings = getattr(result, "embeddings", None)
    if embeddings is None and isinstance(result, dict):
        embeddings = result.get("embeddings")
    if not embeddings:
        return []
    first = embeddings[0]
    values = getattr(first, "values", None)
    if values is None and isinstance(first, dict):
        values = first.get("values")
    if values is None:
        values = first
    return list(values)


def create_embeddings(chunks: Iterable[Dict[str, Any]]) -> List[Dict[str, Any]]:
    client = _get_client()
    chunk_list = list(chunks)
    if not chunk_list:
        return []
    texts = [chunk["text"] for chunk in chunk_list]

    vectors: List[List[float]] = []
    try:
        if hasattr(client, "models"):
            response = client.models.embed_content(
                model=EMBEDDING_MODEL,
                contents=texts,
                config=types.EmbedContentConfig(output_dimensionality=OUTPUT_DIMENSIONALITY)
                if types is not None
                else None,
            )
        else:
            response = client.embed_content(
                model=EMBEDDING_MODEL,
                content=texts,
            )
        if len(texts) == 1:
            vectors = [_extract_vector(response)]
        else:
            embeddings = getattr(response, "embeddings", None)
            if embeddings is None and isinstance(response, dict):
                embeddings = response.get("embeddings") or []
            for item in embeddings or []:
                values = getattr(item, "values", None)
                if values is None and isinstance(item, dict):
                    values = item.get("values")
                vectors.append(list(values or []))
        if len(vectors) != len(chunk_list):
            raise RuntimeError(
                f"Embedding count mismatch: expected {len(chunk_list)}, got {len(vectors)}"
            )
    except Exception:
        LOGGER.exception("Batch embedding failed, falling back to per-item embedding")
        vectors = []
        for text in texts:
            if hasattr(client, "models"):
                result = client.models.embed_content(
                    model=EMBEDDING_MODEL,
                    contents=text,
                    config=types.EmbedContentConfig(output_dimensionality=OUTPUT_DIMENSIONALITY)
                    if types is not None
                    else None,
                )
            else:
                result = client.embed_content(
                    model=EMBEDDING_MODEL,
                    content=text,
                )
            vectors.append(_extract_vector(result))

    embedded: List[Dict[str, Any]] = []
    for chunk, vector in zip(chunk_list, vectors):
        metadata = dict(chunk.get("metadata", {}))
        metadata["text"] = chunk["text"]
        embedded.append(
            {
                "id": chunk["chunk_id"],
                "embedding_vector": vector,
                "metadata": metadata,
                "text": chunk["text"],
            }
        )

    LOGGER.info("Embeddings generated: %s", len(embedded))
    return embedded


def embed_query(query: str) -> List[float]:
    client = _get_client()
    if hasattr(client, "models"):
        response = client.models.embed_content(
            model=EMBEDDING_MODEL,
            contents=query,
            config=types.EmbedContentConfig(output_dimensionality=OUTPUT_DIMENSIONALITY)
            if types is not None
            else None,
        )
    else:
        response = client.embed_content(
            model=EMBEDDING_MODEL,
            content=query,
        )
    return _extract_vector(response)


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
