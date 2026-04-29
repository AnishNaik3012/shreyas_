async def smalltalk_agent(message: str) -> str:
    text = (message or "").strip().lower()
    if text in {"thanks", "thank you"}:
        return "You're welcome! Let me know if you need anything."
    if text in {"bye", "goodbye"}:
        return "Goodbye! Take care."
    if text in {"good morning", "good evening", "good afternoon"}:
        return "Hello 🙂 I'm SaveMom assistant. How can I help you today?"
    return "Hello 🙂 I'm SaveMom assistant. How can I help you today?"
