from sqlalchemy.orm import Session
from datetime import date, timedelta
import uuid

from app.models import Appointment, User, Doctor, DoctorAvailability, Hospital


ACTIVE_STATUSES = {"pending", "confirmed"}
CHATBOT_ACTIVE_STATUSES = {"pending", "scheduled"}
DEFAULT_TIME_SLOTS = [
    "09:00 AM",
    "10:00 AM",
    "11:00 AM",
    "12:00 PM",
    "02:00 PM",
    "03:00 PM",
    "04:00 PM",
    "05:00 PM",
]


def _coerce_uuid(value):
    if value is None:
        return None
    if isinstance(value, uuid.UUID):
        return value
    try:
        return uuid.UUID(str(value))
    except (ValueError, TypeError):
        return None


def _uuid_variants(value):
    candidate = _coerce_uuid(value)
    if not candidate:
        return []
    return [candidate, str(candidate), candidate.hex]


def is_doctor_slot_taken(
    db: Session,
    doctor_id: str | None,
    appointment_date: date,
    time_slot: str,
) -> bool:
    variants = _uuid_variants(doctor_id)
    if not variants:
        return False
    for candidate in variants:
        try:
            existing = (
                db.query(Appointment)
                .filter(
                    Appointment.doctor_id == candidate,
                    Appointment.appointment_date == appointment_date,
                    Appointment.time_slot == time_slot,
                    Appointment.status.in_(ACTIVE_STATUSES),
                )
                .first()
            )
            if existing is not None:
                return True
        except Exception:
            continue
    return False


def create_appointment(
    db: Session,
    user_id: str,
    department: str,
    doctor_id: str,
    hospital_id: str,
    appointment_date: date,
    time_slot: str,
    reason: str | None = None,
    symptoms: str | None = None,
    commit: bool = True,
):
    user_uuid = _coerce_uuid(user_id)
    doctor_uuid = _coerce_uuid(doctor_id)
    hospital_uuid = _coerce_uuid(hospital_id)
    if not user_uuid or not doctor_uuid or not hospital_uuid:
        raise ValueError("Invalid appointment identifiers.")

    appointment = Appointment(
        user_id=user_uuid,
        department=department,
        doctor_id=doctor_uuid,
        hospital_id=hospital_uuid,
        appointment_date=appointment_date,
        time_slot=time_slot,
        reason=reason,
        symptoms=symptoms,
        status="pending",
    )

    db.add(appointment)
    if commit:
        db.commit()
        db.refresh(appointment)
    else:
        db.flush()
        db.refresh(appointment)

    return appointment


def mark_slot_unavailable(
    db: Session,
    doctor_id: str,
    appointment_date: date,
    time_slot: str,
    commit: bool = True,
):
    variants = _uuid_variants(doctor_id)
    if not variants:
        return None
    slot = None
    for candidate in variants:
        try:
            slot = (
                db.query(DoctorAvailability)
                .filter(
                    DoctorAvailability.doctor_id == candidate,
                    DoctorAvailability.date == appointment_date,
                    DoctorAvailability.time_slot == time_slot,
                )
                .first()
            )
            if slot:
                break
        except Exception:
            continue

    if not slot:
        return None

    slot.is_available = False
    if commit:
        db.commit()
        db.refresh(slot)
    else:
        db.flush()
        db.refresh(slot)
    return slot


def get_available_slots_for_date(
    db: Session,
    doctor_id: str,
    target_date: date,
) -> list[str]:
    variants = _uuid_variants(doctor_id)
    if not variants:
        return []
    slots = []
    for candidate in variants:
        try:
            slots = (
                db.query(DoctorAvailability)
                .filter(
                    DoctorAvailability.doctor_id == candidate,
                    DoctorAvailability.date == target_date,
                    DoctorAvailability.is_available.is_(True),
                )
                .order_by(DoctorAvailability.time_slot.asc())
                .all()
            )
            break
        except Exception:
            continue

    if not slots:
        # Fallback: provide default slots if availability table is empty for the date.
        return [slot for slot in DEFAULT_TIME_SLOTS if not is_doctor_slot_taken(db, doctor_id, target_date, slot)]

    booked = []
    for candidate in variants:
        try:
            booked = (
                db.query(Appointment.time_slot)
                .filter(
                    Appointment.doctor_id == candidate,
                    Appointment.appointment_date == target_date,
                    Appointment.status.in_(ACTIVE_STATUSES),
                )
                .all()
            )
            break
        except Exception:
            continue
    booked_slots = {row[0] for row in booked}

    return [slot.time_slot for slot in slots if slot.time_slot not in booked_slots]


def get_next_available_slot(
    db: Session,
    doctor_id: str,
    start_date: date,
    max_days: int = 30,
):
    doctor_uuid = _coerce_uuid(doctor_id)
    if not doctor_uuid:
        return None

    for offset in range(0, max_days + 1):
        target_date = start_date + timedelta(days=offset)
        slots = get_available_slots_for_date(db, doctor_uuid, target_date)
        if slots:
            return target_date, slots[0]
    return None


def get_upcoming_for_user(db: Session, user: User):
    today = date.today()

    query = db.query(Appointment).filter(
        Appointment.status != "cancelled",
        Appointment.appointment_date >= today,
    )

    if user.role == "parent":
        query = query.filter(Appointment.user_id == user.id)
    elif user.role == "doctor":
        doctor = db.query(Doctor).filter(Doctor.user_id == user.id).first()
        if not doctor:
            return []
        query = query.filter(Appointment.doctor_id == doctor.id)
    elif user.role == "nurse":
        if not user.hospital_id:
            return []
        query = query.filter(Appointment.hospital_id == user.hospital_id)

    return query.order_by(
        Appointment.appointment_date.asc(),
        Appointment.time_slot.asc(),
    ).all()


def get_current_for_user(db: Session, user: User):
    today = date.today()

    query = db.query(Appointment).filter(
        Appointment.status.in_(CHATBOT_ACTIVE_STATUSES),
        Appointment.appointment_date >= today,
    )

    if user.role == "parent":
        query = query.filter(Appointment.user_id == user.id)
    elif user.role == "doctor":
        doctor = db.query(Doctor).filter(Doctor.user_id == user.id).first()
        if not doctor:
            return []
        query = query.filter(Appointment.doctor_id == doctor.id)
    elif user.role == "nurse":
        if not user.hospital_id:
            return []
        query = query.filter(Appointment.hospital_id == user.hospital_id)

    return query.order_by(
        Appointment.appointment_date.asc(),
        Appointment.time_slot.asc(),
    ).all()


def get_past_for_user(db: Session, user: User):
    today = date.today()

    query = db.query(Appointment).filter(
        Appointment.status != "cancelled",
        Appointment.appointment_date < today,
    )

    if user.role == "parent":
        query = query.filter(Appointment.user_id == user.id)
    elif user.role == "doctor":
        doctor = db.query(Doctor).filter(Doctor.user_id == user.id).first()
        if not doctor:
            return []
        query = query.filter(Appointment.doctor_id == doctor.id)
    elif user.role == "nurse":
        if not user.hospital_id:
            return []
        query = query.filter(Appointment.hospital_id == user.hospital_id)

    return query.order_by(
        Appointment.appointment_date.desc(),
        Appointment.time_slot.desc(),
    ).all()


def build_appointment_list_items(db: Session, appointments: list[Appointment]):
    items = []
    today = date.today()

    hospital_map = {}
    doctor_map = {}

    needs_commit = False
    for appt in appointments:
        if appt.hospital_id not in hospital_map:
            hospital = db.query(Hospital).filter(Hospital.id == appt.hospital_id).first()
            hospital_map[appt.hospital_id] = hospital.name if hospital else "Unknown"
        if appt.doctor_id not in doctor_map:
            doctor = db.query(Doctor).filter(Doctor.id == appt.doctor_id).first()
            doctor_map[appt.doctor_id] = doctor.name if doctor else "Unknown"

        derived_status = appt.status
        if appt.appointment_date < today and appt.status not in {"completed", "cancelled"}:
            derived_status = "missed"
            if appt.status != "missed":
                appt.status = "missed"
                needs_commit = True

        items.append(
            {
                "id": str(appt.id),
                "appointment_date": appt.appointment_date,
                "time_slot": appt.time_slot,
                "department": appt.department,
                "doctor_name": doctor_map.get(appt.doctor_id, "Unknown"),
                "hospital_name": hospital_map.get(appt.hospital_id, "Unknown"),
                "status": derived_status,
            }
        )

    if needs_commit:
        db.commit()

    return items


def build_dashboard_items(db: Session, appointments: list[Appointment]):
    items = []
    doctor_map = {}
    patient_map = {}

    for appt in appointments:
        if appt.doctor_id not in doctor_map:
            doctor = db.query(Doctor).filter(Doctor.id == appt.doctor_id).first()
            doctor_map[appt.doctor_id] = doctor.name if doctor else "Unknown"
        if appt.user_id not in patient_map:
            patient = db.query(User).filter(User.id == appt.user_id).first()
            patient_map[appt.user_id] = patient.full_name if patient else "Unknown"

        items.append(
            {
                "id": str(appt.id),
                "patient_name": patient_map.get(appt.user_id, "Unknown"),
                "doctor_name": doctor_map.get(appt.doctor_id, "Unknown"),
                "department": appt.department,
                "appointment_date": appt.appointment_date,
                "time_slot": appt.time_slot,
                "reason": appt.reason,
                "status": appt.status,
            }
        )

    return items


def cancel_appointment(
    db: Session,
    appointment_id: str,
    user: User,
    commit: bool = True,
):
    if isinstance(appointment_id, dict):
        appointment_id = appointment_id.get("id") or appointment_id.get("value")

    variants = _uuid_variants(appointment_id)
    if not variants:
        return None, "Appointment not found."

    appointment = None
    for candidate in variants:
        try:
            appointment = (
                db.query(Appointment)
                .filter(Appointment.id == candidate)
                .first()
            )
            if appointment:
                break
        except Exception:
            continue

    if not appointment:
        return None, "Appointment not found."

    if user.role != "parent":
        return None, "Only parents can cancel appointments."

    if appointment.user_id != user.id:
        return None, "You can only cancel your own appointments."

    if appointment.appointment_date < date.today():
        return None, "Only future appointments can be cancelled."

    appointment.status = "cancelled"
    if commit:
        db.commit()
        db.refresh(appointment)
    else:
        db.flush()
        db.refresh(appointment)

    return appointment, None


def update_appointment_status(
    db: Session,
    appointment_id: str,
    user: User,
    status: str,
    commit: bool = True,
):
    if user.role not in {"doctor", "nurse"}:
        return None, "Only doctors or nurses can update appointment status."

    appointment = db.query(Appointment).filter(Appointment.id == appointment_id).first()

    if not appointment:
        return None, "Appointment not found."

    if user.role == "doctor":
        doctor = db.query(Doctor).filter(Doctor.user_id == user.id).first()
        if not doctor:
            return None, "Doctor profile not found."
        if appointment.doctor_id != doctor.id:
            return None, "You can only update your own appointments."
    if user.role == "nurse":
        if not user.hospital_id:
            return None, "Nurse hospital not set."
        if appointment.hospital_id != user.hospital_id:
            return None, "You can only update your hospital appointments."

    allowed_statuses = {"pending", "confirmed", "completed", "missed", "cancelled"}
    if status not in allowed_statuses:
        return None, "Invalid status. Use pending, confirmed, completed, missed, or cancelled."

    appointment.status = status
    if commit:
        db.commit()
        db.refresh(appointment)
    else:
        db.flush()
        db.refresh(appointment)

    return appointment, None
