import os
import asyncio
from typing import List, Dict, Any

try:
    import google.genai as genai
except Exception as exc:  # pragma: no cover
    raise RuntimeError(
        "google-genai is not installed. Install it with: pip install google-genai"
    ) from exc


client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))


async def generate_response(
    system_prompt: str,
    user_message: str,
    messages: List[Dict[str, str]] | None = None,
    tools: List[Dict[str, Any]] | None = None,
    tool_choice: str | Dict[str, Any] | None = "auto",
) -> Dict[str, Any]:
    if not os.getenv("GEMINI_API_KEY"):
        raise RuntimeError("GEMINI_API_KEY is not set")

    history_text = ""
    if messages:
        for msg in messages:
            role = msg.get("role", "user")
            content = msg.get("content", "")
            history_text += f"{role}: {content}\n"

    prompt = (
        f"{system_prompt}\n\n"
        "Conversation history:\n"
        f"{history_text}\n"
        "User:\n"
        f"{user_message}"
    )

    try:
        response = await asyncio.to_thread(
            client.models.generate_content,
            model="gemini-flash-latest",
            contents=prompt,
        )
    except Exception as exc:  # pragma: no cover
        raise RuntimeError(f"Gemini response failed: {exc}") from exc

    return {
        "choices": [
            {
                "message": {
                    "content": response.text,
                    "tool_calls": None,
                }
            }
        ]
    }
