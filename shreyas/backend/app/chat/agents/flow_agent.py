from __future__ import annotations

from typing import Any, Dict, Tuple

from sqlalchemy.orm import Session

from app.chat import appointment_flow as appt
from app.chat import checkup_flow as checkup
from app.models.user import User


def detect_flow_intent(message: str) -> str | None:
    text = message.lower()
    if "cancel appointment" in text:
        return "cancel_appointment"
    if "view appointment" in text or "view appointments" in text:
        return "view_appointments"
    if "book appointment" in text or "schedule appointment" in text or "appointment booking" in text:
        return "book_appointment"
    if "cancel checkup" in text:
        return "cancel_checkup"
    if "view checkup" in text or "view checkups" in text:
        return "view_checkups"
    if "checkup booking" in text or "book checkup" in text or "schedule checkup" in text:
        return "book_checkup"
    return None


def start_flow(intent: str, db: Session, user: User) -> Tuple[Dict[str, Any], Any]:
    if intent in {"book_appointment", "appointments"}:
        return appt.start_booking_flow(db, user)
    if intent == "view_appointments":
        return appt.start_view_flow(db, user)
    if intent == "cancel_appointment":
        return appt.start_cancel_flow(db, user)
    if intent in {"book_checkup", "checkups", "view_checkups", "cancel_checkup"}:
        return checkup.start_checkup_flow(db, user)
    return {"message": "I didn't recognize that request.", "options": None, "step": None}, None


def handle_flow_step(
    db: Session,
    user: User,
    current_flow: str,
    step: str,
    value: Any,
) -> Tuple[Dict[str, Any], Any]:
    if current_flow == checkup.FLOW_CHECKUP:
        return checkup.handle_step(db, user, step, value)
    return appt.handle_step(db, user, step, value)
