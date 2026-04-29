from sqlalchemy.orm import Session
from datetime import date
import uuid

from app.models import Checkup, User, Doctor, Hospital


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


def create_checkup(
    db: Session,
    user_id: str,
    hospital_id: str | None,
    doctor_id: str | None,
    checkup_type: str,
    tests_selected: list[str] | None,
    appointment_date: date,
    time_slot: str,
    notes: str | None = None,
    commit: bool = True,
):
    user_uuid = _coerce_uuid(user_id)
    hospital_uuid = _coerce_uuid(hospital_id) if hospital_id else None
    doctor_uuid = _coerce_uuid(doctor_id) if doctor_id else None
    if not user_uuid:
        raise ValueError("Invalid user.")

    checkup = Checkup(
        user_id=user_uuid,
        hospital_id=hospital_uuid,
        doctor_id=doctor_uuid,
        checkup_type=checkup_type,
        tests_selected=tests_selected or [],
        appointment_date=appointment_date,
        time_slot=time_slot,
        notes=notes,
        status="pending",
    )
    db.add(checkup)
    if commit:
        db.commit()
        db.refresh(checkup)
    else:
        db.flush()
        db.refresh(checkup)
    return checkup


def get_checkups_for_parent(db: Session, user: User):
    return (
        db.query(Checkup)
        .filter(Checkup.user_id == user.id)
        .order_by(Checkup.appointment_date.asc(), Checkup.time_slot.asc())
        .all()
    )


def get_upcoming_checkups_for_user(db: Session, user: User):
    today = date.today()
    return (
        db.query(Checkup)
        .filter(
            Checkup.user_id == user.id,
            Checkup.status != "cancelled",
            Checkup.appointment_date >= today,
        )
        .order_by(Checkup.appointment_date.asc(), Checkup.time_slot.asc())
        .all()
    )


def get_checkups_for_doctor(db: Session, doctor: Doctor):
    return (
        db.query(Checkup)
        .filter(Checkup.doctor_id == doctor.id)
        .order_by(Checkup.appointment_date.asc(), Checkup.time_slot.asc())
        .all()
    )


def get_checkups_for_nurse(db: Session, hospital_id):
    return (
        db.query(Checkup)
        .filter(Checkup.hospital_id == hospital_id)
        .order_by(Checkup.appointment_date.asc(), Checkup.time_slot.asc())
        .all()
    )


def build_checkup_list_items(db: Session, checkups: list[Checkup]):
    items = []
    hospital_map = {}
    doctor_map = {}

    for chk in checkups:
        if chk.hospital_id and chk.hospital_id not in hospital_map:
            hospital = db.query(Hospital).filter(Hospital.id == chk.hospital_id).first()
            hospital_map[chk.hospital_id] = hospital.name if hospital else "Unknown"
        if chk.doctor_id and chk.doctor_id not in doctor_map:
            doctor = db.query(Doctor).filter(Doctor.id == chk.doctor_id).first()
            doctor_map[chk.doctor_id] = doctor.name if doctor else "Unknown"

        items.append(
            {
                "id": str(chk.id),
                "checkup_type": chk.checkup_type,
                "tests_selected": chk.tests_selected or [],
                "appointment_date": chk.appointment_date.isoformat(),
                "time_slot": chk.time_slot,
                "doctor_name": doctor_map.get(chk.doctor_id),
                "hospital_name": hospital_map.get(chk.hospital_id),
                "status": chk.status,
                "priority": chk.priority or "normal",
                "report_url": chk.report_url,
                "remarks": chk.remarks,
                "notes": chk.notes,
            }
        )
    return items


def build_checkup_dashboard_items(db: Session, checkups: list[Checkup]):
    items = []
    hospital_map = {}
    doctor_map = {}
    patient_map = {}

    for chk in checkups:
        if chk.hospital_id and chk.hospital_id not in hospital_map:
            hospital = db.query(Hospital).filter(Hospital.id == chk.hospital_id).first()
            hospital_map[chk.hospital_id] = hospital.name if hospital else "Unknown"
        if chk.doctor_id and chk.doctor_id not in doctor_map:
            doctor = db.query(Doctor).filter(Doctor.id == chk.doctor_id).first()
            doctor_map[chk.doctor_id] = doctor.name if doctor else "Unknown"
        if chk.user_id and chk.user_id not in patient_map:
            patient = db.query(User).filter(User.id == chk.user_id).first()
            patient_map[chk.user_id] = patient.full_name if patient else "Unknown"

        items.append(
            {
                "id": str(chk.id),
                "patient_name": patient_map.get(chk.user_id),
                "doctor_name": doctor_map.get(chk.doctor_id),
                "hospital_name": hospital_map.get(chk.hospital_id),
                "checkup_type": chk.checkup_type,
                "tests_selected": chk.tests_selected or [],
                "appointment_date": chk.appointment_date.isoformat(),
                "time_slot": chk.time_slot,
                "status": chk.status,
                "priority": chk.priority or "normal",
                "report_url": chk.report_url,
                "remarks": chk.remarks,
                "notes": chk.notes,
            }
        )
    return items


def cancel_checkup(
    db: Session,
    checkup_id: str,
    user: User,
    commit: bool = True,
):
    if isinstance(checkup_id, dict):
        checkup_id = checkup_id.get("id") or checkup_id.get("value")

    variants = _uuid_variants(checkup_id)
    if not variants:
        return None, "Checkup not found."

    checkup = None
    for candidate in variants:
        try:
            checkup = db.query(Checkup).filter(Checkup.id == candidate).first()
            if checkup:
                break
        except Exception:
            continue

    if not checkup:
        return None, "Checkup not found."

    if user.role != "parent":
        return None, "Only parents can cancel checkups."

    if checkup.user_id != user.id:
        return None, "You can only cancel your own checkups."

    if checkup.appointment_date < date.today():
        return None, "Only future checkups can be cancelled."

    checkup.status = "cancelled"
    if commit:
        db.commit()
        db.refresh(checkup)
    else:
        db.flush()
        db.refresh(checkup)

    return checkup, None


def get_active_for_user(db: Session, user: User):
    today = date.today()
    query = db.query(Checkup).filter(
        Checkup.status.in_(["pending", "completed"]),
        Checkup.appointment_date >= today,
    )

    if user.role == "parent":
        query = query.filter(Checkup.user_id == user.id)
    elif user.role == "doctor":
        doctor = db.query(Doctor).filter(Doctor.user_id == user.id).first()
        if not doctor:
            return []
        query = query.filter(Checkup.doctor_id == doctor.id)
    elif user.role == "nurse":
        if not user.hospital_id:
            return []
        query = query.filter(Checkup.hospital_id == user.hospital_id)

    return query.order_by(Checkup.appointment_date.asc(), Checkup.time_slot.asc()).all()
