"""End-to-end indexer for the knowledge base."""
from __future__ import annotations

from pathlib import Path
import logging

from dotenv import load_dotenv

from app.rag.loader import load_knowledge_base
from app.rag.chunker import chunk_documents
from app.rag.embedder import create_embeddings
from app.rag.vector_store import upsert_embeddings
from app.rag.search import search_documents


LOGGER = logging.getLogger(__name__)


def index_knowledge_base(root: Path) -> int:
    documents = load_knowledge_base(root)
    for doc in documents:
        title = doc.get("title") or ""
        content = doc.get("content") or ""
        doc["content"] = f"{title}\n\n{content}".strip()
        print("Indexed:", doc.get("id"))
    chunks = chunk_documents(documents)
    if not chunks:
        LOGGER.warning("No chunks to embed. Check knowledge base content.")
        return 0
    embeddings = create_embeddings(chunks)
    uploaded = upsert_embeddings(embeddings)
    LOGGER.info("Indexed %s documents, %s chunks, %s vectors", len(documents), len(chunks), uploaded)
    return uploaded


def main() -> None:
    logging.basicConfig(level=logging.INFO)
    load_dotenv()
    root = Path("knowledge_base")
    index_knowledge_base(root)
    test_results = search_documents("hospital visiting hours", role="all", department="general medicine")
    LOGGER.info("Test query results: %s", [item.get("id") for item in test_results])


if __name__ == "__main__":
    main()
