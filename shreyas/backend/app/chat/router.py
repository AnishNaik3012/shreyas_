from __future__ import annotations

from typing import Dict, List
import json

from app.ai.client import generate_response


EMERGENCY_TERMS = [
    "chest pain",
    "unconscious",
    "can't breathe",
    "severe bleeding",
    "emergency",
    "not breathing",
    "stroke",
    "heart attack",
]

FOLLOWUP_PHRASES = [
    "can i take",
    "is it safe",
    "what about",
    "and then",
    "this medicine",
    "this report",
    "this prescription",
]

ALLOWED_INTENTS = {
    "medical_query",
    "hospital_info",
    "report_analysis",
    "prescription_analysis",
    "workflow",
    "smalltalk",
    "fallback",
}


def _contains_phrase(text: str, phrases: List[str]) -> bool:
    return any(phrase in text for phrase in phrases)


def is_emergency(message: str) -> bool:
    text = (message or "").lower()
    return _contains_phrase(text, EMERGENCY_TERMS)


def _parse_intent(raw: str) -> str:
    if not raw:
        return "fallback"
    cleaned = raw.strip().replace("```json", "").replace("```", "")
    start = cleaned.find("{")
    end = cleaned.rfind("}")
    if start == -1 or end == -1 or end <= start:
        return "fallback"
    try:
        payload = json.loads(cleaned[start : end + 1])
    except Exception:
        return "fallback"
    intent = (payload.get("intent") or "").strip()
    return intent if intent in ALLOWED_INTENTS else "fallback"


async def classify_intent(message: str, state: Dict[str, object]) -> str:
    text = (message or "").lower()
    if is_emergency(message):
        return "emergency"
    workflow_terms = [
        "appointment",
        "appointments",
        "book appointment",
        "cancel appointment",
        "reschedule appointment",
        "checkup",
        "checkups",
        "book checkup",
        "cancel checkup",
        "reschedule checkup",
    ]
    if _contains_phrase(text, workflow_terms):
        return "workflow"
    hospital_info_terms = [
        "policy",
        "policies",
        "guideline",
        "guidelines",
        "protocol",
        "protocols",
        "ethical",
        "ethics",
        "clinical rule",
        "doctor policy",
        "hospital rule",
        "practice rule",
        "internal policy",
    ]
    if _contains_phrase(text, hospital_info_terms):
        return "hospital_info"
    report_terms = [
        "report",
        "lab report",
        "scan report",
        "test report",
        "medical report",
        "report summary",
    ]
    prescription_terms = [
        "prescription",
        "medicine list",
        "medications",
        "prescription summary",
    ]
    if _contains_phrase(text, report_terms):
        return "report_analysis"
    if _contains_phrase(text, prescription_terms):
        return "prescription_analysis"
    role = (state or {}).get("role")
    last_tool = (state or {}).get("last_tool")
    if last_tool == "medical_query" and _contains_phrase(text, FOLLOWUP_PHRASES):
        return "medical_query"

    history = (state or {}).get("history") or []
    last_two = history[-2:]
    history_text = "\n".join(
        f"{item.get('role', 'user')}: {item.get('content', '')}" for item in last_two
    )
    # Only free-form chatbot questions should hit the LLM classifier.
    if not history_text and not text:
        return "fallback"
    system_prompt = (
        "Classify the user intent into EXACTLY ONE category:\n"
        "medical_query\n"
        "hospital_info\n"
        "report_analysis\n"
        "prescription_analysis\n"
        "workflow\n"
        "smalltalk\n"
        "fallback\n\n"
        "IMPORTANT:\n"
        "hospital_info includes:\n"
        "- hospital policies\n"
        "- administrative guidelines\n"
        "- doctor policies\n"
        "- ethical guidelines\n"
        "- clinical workflow policies\n"
        "- internal hospital protocols\n"
        "- scheduling rules\n"
        "- operational guidelines\n\n"
        "Return JSON only:\n"
        '{"intent":"category"}'
    )
    user_message = (
        f"User Role: {role}\n\n"
        f"History:\n{history_text}\n\n"
        f"User:\n{message}"
    )

    try:
        response = await generate_response(
            system_prompt=system_prompt,
            user_message=user_message,
            messages=None,
        )
    except Exception:
        return "fallback"

    raw = response["choices"][0]["message"]["content"]
    intent = _parse_intent(raw)
    if role == "doctor":
        if intent == "medical_query":
            return "clinical_info"
        if intent == "workflow":
            return "workflow_admin"
    return intent
