"""Semantic chunking utilities for RAG."""
from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict, Iterable, List
import logging
import re


LOGGER = logging.getLogger(__name__)


@dataclass
class Chunk:
    chunk_id: str
    text: str
    metadata: Dict[str, Any]


def estimate_tokens(text: str) -> int:
    # Heuristic: average token ~= 0.75 words
    words = re.findall(r"\b\w+\b", text)
    return int(len(words) / 0.75) if words else 0


def split_into_sections(content: str) -> List[tuple[str, List[str]]]:
    lines = content.split("\n")
    sections: List[tuple[str, List[str]]] = []
    current_title = "General"
    current_lines: List[str] = []

    for line in lines:
        heading = re.match(r"^#{1,3}\s+(.+)$", line.strip())
        if heading:
            if current_lines:
                sections.append((current_title, current_lines))
            current_title = heading.group(1).strip()
            current_lines = []
        else:
            current_lines.append(line)

    if current_lines:
        sections.append((current_title, current_lines))

    return sections


def split_into_sentences(text: str) -> List[str]:
    # Avoid random splitting: prefer punctuation boundaries.
    sentences = re.split(r"(?<=[.!?])\s+", text.strip())
    return [s.strip() for s in sentences if s.strip()]


def chunk_documents(
    documents: Iterable[Dict[str, Any]],
    chunk_size: int = 500,
    overlap: int = 100,
) -> List[Dict[str, Any]]:
    chunks: List[Dict[str, Any]] = []

    for doc in documents:
        content = doc.get("content", "")
        sections = split_into_sections(content)
        chunk_index = 0

        for section_title, section_lines in sections:
            section_text = "\n".join(section_lines).strip()
            if not section_text:
                continue

            sentences = split_into_sentences(section_text)
            if not sentences:
                continue

            current: List[str] = [f"# {section_title}"]
            current_tokens = estimate_tokens(current[0])

            for sentence in sentences:
                sentence_tokens = estimate_tokens(sentence)
                if current_tokens + sentence_tokens > chunk_size and current_tokens > 0:
                    chunk_text = " ".join(current).strip()
                    chunks.append(
                        {
                            "chunk_id": f"{doc['id']}::{chunk_index}",
                            "text": chunk_text,
                            "metadata": {
                                "doc_id": doc["id"],
                                "category": doc.get("category"),
                                "department": doc.get("department"),
                                "role": doc.get("role"),
                            },
                        }
                    )
                    chunk_index += 1

                    # Overlap: keep trailing sentences within overlap window
                    overlap_sentences: List[str] = []
                    overlap_tokens = 0
                    for prev in reversed(current[1:]):
                        prev_tokens = estimate_tokens(prev)
                        if overlap_tokens + prev_tokens > overlap:
                            break
                        overlap_sentences.insert(0, prev)
                        overlap_tokens += prev_tokens

                    current = [f"# {section_title}"] + overlap_sentences
                    current_tokens = estimate_tokens(current[0]) + overlap_tokens

                current.append(sentence)
                current_tokens += sentence_tokens

            if current_tokens > 0:
                chunk_text = " ".join(current).strip()
                chunks.append(
                    {
                        "chunk_id": f"{doc['id']}::{chunk_index}",
                        "text": chunk_text,
                        "metadata": {
                            "doc_id": doc["id"],
                            "category": doc.get("category"),
                            "department": doc.get("department"),
                            "role": doc.get("role"),
                        },
                    }
                )
                chunk_index += 1

    LOGGER.info("Chunks created: %s", len(chunks))
    return chunks


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
