"""Pinecone vector store integration."""
from __future__ import annotations

from typing import Any, Dict, Iterable, List
import logging
import os

from pinecone import Pinecone, ServerlessSpec


LOGGER = logging.getLogger(__name__)

INDEX_DIMENSION = 3072
INDEX_METRIC = "cosine"


def _get_client() -> Pinecone:
    api_key = os.getenv("PINECONE_API_KEY")
    if not api_key:
        raise RuntimeError("PINECONE_API_KEY is not set")
    return Pinecone(api_key=api_key)


def get_index() -> Any:
    pc = _get_client()
    index_name = os.getenv("PINECONE_INDEX")
    if not index_name:
        raise RuntimeError("PINECONE_INDEX is not set")

    host = os.getenv("PINECONE_HOST")
    if host:
        return pc.Index(host=host)

    existing = {idx["name"] for idx in pc.list_indexes()}
    if index_name not in existing:
        cloud = os.getenv("PINECONE_CLOUD")
        region = os.getenv("PINECONE_REGION")
        if not cloud or not region:
            raise RuntimeError("PINECONE_CLOUD and PINECONE_REGION are required to create a new index")
        pc.create_index(
            name=index_name,
            dimension=INDEX_DIMENSION,
            metric=INDEX_METRIC,
            spec=ServerlessSpec(cloud=cloud, region=region),
        )
        LOGGER.info("Created Pinecone index: %s", index_name)

    return pc.Index(index_name)


def upsert_embeddings(embedded: Iterable[Dict[str, Any]]) -> int:
    index = get_index()
    records = [
        (item["id"], item["embedding_vector"], item.get("metadata", {}))
        for item in embedded
    ]
    if not records:
        return 0

    index.upsert(records)
    LOGGER.info("Vectors uploaded: %s", len(records))
    return len(records)


def query_index(vector: List[float], top_k: int, metadata_filter: Dict[str, Any]) -> Dict[str, Any]:
    index = get_index()
    return index.query(vector=vector, top_k=top_k, include_metadata=True, filter=metadata_filter)


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
