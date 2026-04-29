"""Knowledge base loader for Savemom RAG."""
from __future__ import annotations

from pathlib import Path
from typing import Any, Dict, List
import json
import logging


LOGGER = logging.getLogger(__name__)

SUPPORTED_FOLDERS = [
    "checkup_guidelines",
    "hospital_faq",
    "hospital_policies",
    "doctor_instructions",
    "medical_instructions",
    "pregnancy_information",
]

CATEGORY_BY_FOLDER = {
    "hospital_faq": "faq",
    "checkup_guidelines": "guideline",
    "pregnancy_information": "pregnancy",
    "medical_instructions": "instruction",
    "hospital_policies": "policy",
    "doctor_instructions": "instruction",
}


def _normalize_tags(doc: Dict[str, Any]) -> List[str]:
    tags: List[str] = []
    for key in ("tags", "intent_tags", "search_keywords"):
        value = doc.get(key)
        if isinstance(value, list):
            tags.extend([str(item) for item in value if str(item).strip()])
    seen = set()
    unique = []
    for tag in tags:
        normalized = tag.strip()
        if not normalized or normalized in seen:
            continue
        seen.add(normalized)
        unique.append(normalized)
    return unique


def _normalize_role(value: Any) -> List[str]:
    if value is None:
        return ["all"]
    if isinstance(value, list):
        roles = [str(item).strip().lower() for item in value if str(item).strip()]
        return roles or ["all"]
    return [str(value).strip().lower()] if str(value).strip() else ["all"]


def load_knowledge_base(root: Path) -> List[Dict[str, Any]]:
    documents: List[Dict[str, Any]] = []
    for folder in SUPPORTED_FOLDERS:
        folder_path = root / folder
        if not folder_path.exists():
            LOGGER.warning("Knowledge base folder missing: %s", folder_path)
            continue
        for path in folder_path.rglob("*.json"):
            try:
                with path.open("r", encoding="utf-8") as handle:
                    raw = json.load(handle)
            except Exception:
                LOGGER.exception("Failed to load knowledge base document: %s", path)
                continue

            content = raw.get("content") or raw.get("conversation_response") or ""
            document = {
                "id": raw.get("id") or path.stem,
                "title": raw.get("title") or path.stem.replace("_", " ").title(),
                "category": raw.get("category") or CATEGORY_BY_FOLDER.get(folder, "faq"),
                "department": raw.get("department") or "general medicine",
                "role": _normalize_role(raw.get("role")),
                "content": str(content).strip(),
                "tags": _normalize_tags(raw),
                "priority": raw.get("priority"),
                "source": raw.get("source"),
            }
            documents.append(document)

    LOGGER.info("Loaded knowledge base documents: %s", len(documents))
    return documents


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    load_knowledge_base(Path("backend/knowledge_base"))
