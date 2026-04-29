"""Document loader for the RAG knowledge base."""
from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, List
import json
import logging
import re


LOGGER = logging.getLogger(__name__)

REQUIRED_FIELDS = {"id", "title", "category", "department", "role", "content", "tags"}
SUPPORTED_EXTENSIONS = {".json", ".md", ".txt"}

CATEGORY_BY_FOLDER = {
    "hospital_faq": "faq",
    "checkup_guidelines": "guideline",
    "pregnancy_information": "pregnancy",
    "medical_instructions": "instruction",
    "hospital_policies": "policy",
    "doctor_instructions": "instruction",
}


@dataclass
class Document:
    data: Dict[str, Any]
    source_path: Path


def normalize_text(text: str) -> str:
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def _title_from_content_or_name(content: str, path: Path) -> str:
    match = re.search(r"(?m)^#{1,3}\s+(.+)$", content)
    if match:
        return match.group(1).strip()
    return path.stem.replace("_", " ").replace("-", " ").title()


def _infer_doc_from_text(path: Path, content: str) -> Dict[str, Any]:
    folder = path.parent.name
    category = CATEGORY_BY_FOLDER.get(folder, "faq")
    return {
        "id": path.stem,
        "title": _title_from_content_or_name(content, path),
        "category": category,
        "department": "general medicine",
        "role": "all",
        "content": content,
        "tags": [],
    }


def validate_schema(doc: Dict[str, Any]) -> None:
    missing = REQUIRED_FIELDS - set(doc.keys())
    if missing:
        raise ValueError(f"Missing required fields: {sorted(missing)}")
    if not isinstance(doc.get("tags"), list):
        raise ValueError("tags must be a list")


def load_documents(root: Path) -> List[Document]:
    documents: List[Document] = []
    for path in root.rglob("*"):
        if not path.is_file() or path.suffix.lower() not in SUPPORTED_EXTENSIONS:
            continue

        if path.suffix.lower() == ".json":
            with path.open("r", encoding="utf-8") as handle:
                data = json.load(handle)
        else:
            content = normalize_text(path.read_text(encoding="utf-8"))
            data = _infer_doc_from_text(path, content)

        data["content"] = normalize_text(str(data.get("content", "")))
        validate_schema(data)
        documents.append(Document(data=data, source_path=path))

    LOGGER.info("Total documents loaded: %s", len(documents))
    return documents


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    load_documents(Path("backend/knowledge_base"))
