from __future__ import annotations

from typing import Dict, List

from app.ai.client import generate_response


async def medical_ai_agent(
    message: str,
    role: str | None = None,
    history: List[Dict[str, str]] | None = None,
    state: Dict[str, object] | None = None,
) -> Dict[str, str | None]:
    print("MEDICAL TOOL INPUT:", message)
    if (state or {}).get("role") == "doctor":
        system_prompt = (
            "You are a clinical AI assistant supporting healthcare professionals. "
            "Use professional terminology."
        )
    else:
        system_prompt = """
You are a safe clinical medical assistant.

Rules:
- Answer ONLY based on user question.
- NEVER assume diseases not mentioned.
- DO NOT infer diabetes, pregnancy, or other conditions.
- If unclear, ask clarification instead.
""".strip()
    response = await generate_response(
        system_prompt=system_prompt,
        user_message=message,
        messages=history or [],
    )
    reply = response["choices"][0]["message"]["content"]
    return {"message": reply, "source": "medical_ai"}
