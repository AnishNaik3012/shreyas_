async def fallback_agent(message: str | None = None, state: dict | None = None) -> dict[str, str | None]:
    return {
        "message": (
            "I can help with appointments, checkups, hospital policies, and general medical questions. "
            "Tell me what you need."
        ),
        "source": "fallback",
    }
