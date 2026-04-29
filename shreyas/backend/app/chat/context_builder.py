from __future__ import annotations

import re
from typing import Any, List, Dict


def _clean_text(text: str) -> str:
    cleaned = re.sub(r"^#+\s*", "", text.strip())
    cleaned = re.sub(r"\s+", " ", cleaned)
    return cleaned.strip()


def build_context(docs: List[dict[str, Any]], max_docs: int = 3) -> str:
    if not docs:
        return ""
    parts: List[str] = []
    for doc in docs[:max_docs]:
        text = _clean_text(doc.get("text") or "")
        if text:
            parts.append(text)
    return "\n".join(parts).strip()


def build_context_block(
    appointments: List[Dict[str, Any]],
    checkups: List[Dict[str, Any]],
    chat_memory: List[Dict[str, str]] | None = None,
) -> str:
    lines: List[str] = []
    lines.append("Appointments:")
    if not appointments:
        lines.append("- None")
    else:
        for item in appointments:
            lines.append(
                f"- {item.get('doctor')} on {item.get('date')} at {item.get('time')} "
                f"({item.get('status')})"
            )

    lines.append("Checkups:")
    if not checkups:
        lines.append("- None")
    else:
        for item in checkups:
            lines.append(
                f"- {item.get('checkup_type')} on {item.get('date')} at {item.get('time')} "
                f"({item.get('status')})"
            )

    if chat_memory:
        lines.append("Recent chat:")
        for msg in chat_memory[-6:]:
            lines.append(f"- {msg.get('role')}: {msg.get('content')}")

    return "\n".join(lines)
