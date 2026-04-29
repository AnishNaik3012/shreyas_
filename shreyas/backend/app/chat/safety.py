def check_risk(text: str):
    text = text.lower()

    emergency_keywords = [
        "bleeding",
        "severe pain",
        "fainting",
        "unconscious",
        "suicidal",
        "hopeless",
        "heavy bleeding"
    ]

    if any(word in text for word in emergency_keywords):
        return (
            "This may be serious. Please contact your doctor "
            "or visit the nearest hospital immediately."
        )

    return None
