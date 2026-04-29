from __future__ import annotations

from datetime import date, timedelta
from typing import Any

from sqlalchemy.orm import Session

from app.models.doctor import Doctor
from app.models.hospital import Hospital
from app.models.doctor_availability import DoctorAvailability


def get_available_doctors(db: Session) -> dict[str, Any]:
    doctors = (
        db.query(Doctor)
        .filter(Doctor.is_active.is_(True))
        .order_by(Doctor.name.asc())
        .all()
    )
    if not doctors:
        return {"message": "No doctors are available right now.", "buttons": None}
    buttons = [{"label": doc.name, "action": "book_appointment"} for doc in doctors]
    lines = [f"- {doc.name} ({doc.department})" for doc in doctors]
    return {
        "message": "Available doctors:\n" + "\n".join(lines),
        "buttons": buttons,
    }


def get_hospital_contact(db: Session) -> dict[str, Any]:
    hospital = db.query(Hospital).first()
    if not hospital:
        return {"message": "Hospital contact details are not available.", "buttons": None}
    return {
        "message": f"{hospital.name}\nLocation: {hospital.location}",
        "buttons": None,
    }


def get_doctor_availability(db: Session) -> dict[str, Any]:
    today = date.today()
    end_date = today + timedelta(days=7)
    availability = (
        db.query(DoctorAvailability)
        .filter(
            DoctorAvailability.date >= today,
            DoctorAvailability.date <= end_date,
            DoctorAvailability.is_available.is_(True),
        )
        .order_by(DoctorAvailability.date.asc(), DoctorAvailability.time_slot.asc())
        .limit(10)
        .all()
    )
    if not availability:
        return {"message": "No upcoming availability found.", "buttons": None}
    lines = [
        f"- {slot.date} {slot.time_slot}"
        for slot in availability
    ]
    return {
        "message": "Upcoming availability:\n" + "\n".join(lines),
        "buttons": None,
    }


def search_database_context(db: Session, message: str) -> str:
    text = message.lower()
    if "contact" in text or "hospital" in text:
        result = get_hospital_contact(db)
        return result.get("message", "")
    if "availability" in text or "slots" in text:
        result = get_doctor_availability(db)
        return result.get("message", "")
    if "doctor" in text:
        result = get_available_doctors(db)
        return result.get("message", "")
    return ""
