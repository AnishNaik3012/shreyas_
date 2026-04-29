from __future__ import annotations

from sqlalchemy.orm import Session
from sqlalchemy import func, or_
from datetime import date as date_type, datetime, time, timedelta
import uuid

from app.models.doctor import Doctor
from app.models.appointment import Appointment
from app.models.checkup import Checkup
from app.models.user import User
from app.models.patient_vital import PatientVital
from app.models.doctor_availability import DoctorAvailability


def _coerce_uuid(value: str | uuid.UUID | None) -> uuid.UUID | None:
    if value is None:
        return None
    if isinstance(value, uuid.UUID):
        return value
    try:
        return uuid.UUID(str(value))
    except (TypeError, ValueError):
        return None


def get_departments(db: Session, hospital_id: uuid.UUID) -> list[dict]:
    rows = (
        db.query(Doctor.department)
        .filter(
            Doctor.hospital_id == hospital_id,
            Doctor.is_active.is_(True),
        )
        .distinct()
        .order_by(Doctor.department.asc())
        .all()
    )
    names = [row[0] for row in rows if row[0]]
    return [{"department": name} for name in names]


def get_checkup_types_for_department(
    db: Session,
    hospital_id: uuid.UUID,
    department_name: str,
) -> list[dict]:
    rows = (
        db.query(Checkup.checkup_type)
        .join(Doctor, Doctor.id == Checkup.doctor_id)
        .filter(
            Checkup.hospital_id == hospital_id,
            Doctor.department == department_name,
        )
        .distinct()
        .order_by(Checkup.checkup_type.asc())
        .all()
    )
    names = [row[0] for row in rows if row[0]]
    return [{"checkup_type": name} for name in names]


def get_doctors_for_department(
    db: Session,
    hospital_id: uuid.UUID,
    department_name: str,
) -> list[Doctor]:
    return (
        db.query(Doctor)
        .filter(
            Doctor.hospital_id == hospital_id,
            Doctor.department == department_name,
            Doctor.is_active.is_(True),
        )
        .order_by(Doctor.name.asc())
        .all()
    )


def get_doctor_for_hospital(
    db: Session,
    hospital_id: uuid.UUID,
    doctor_id: str,
) -> Doctor | None:
    doctor_uuid = _coerce_uuid(doctor_id)
    if not doctor_uuid:
        return None
    return (
        db.query(Doctor)
        .filter(
            Doctor.id == doctor_uuid,
            Doctor.hospital_id == hospital_id,
        )
        .first()
    )


def get_appointments_for_doctor(
    db: Session,
    hospital_id: uuid.UUID,
    doctor_id: str,
) -> list[dict] | None:
    doctor_uuid = _coerce_uuid(doctor_id)
    if not doctor_uuid:
        return None

    rows = (
        db.query(Appointment, User.full_name)
        .join(User, User.id == Appointment.user_id)
        .filter(
            Appointment.hospital_id == hospital_id,
            Appointment.doctor_id == doctor_uuid,
        )
        .order_by(
            Appointment.appointment_date.asc(),
            Appointment.time_slot.asc(),
        )
        .all()
    )

    items = []
    for appointment, patient_name in rows:
        items.append(
            {
                "appointment_id": str(appointment.id),
                "patient_name": patient_name or "Unknown",
                "date": appointment.appointment_date.isoformat(),
                "time": appointment.time_slot,
                "status": appointment.status,
                "priority": appointment.priority or "normal",
            }
        )
    return items


def get_hospital_appointments(
    db: Session,
    hospital_id: uuid.UUID,
    department: str | None = None,
    doctor_id: str | None = None,
    status: str | None = None,
    priority: str | None = None,
    date: str | None = None,
) -> tuple[list[dict], str | None]:
    query = (
        db.query(
            Appointment,
            User.full_name.label("patient_name"),
            Doctor.name.label("doctor_name"),
        )
        .join(User, User.id == Appointment.user_id)
        .join(Doctor, Doctor.id == Appointment.doctor_id)
        .filter(Appointment.hospital_id == hospital_id)
    )

    if department:
        query = query.filter(Appointment.department == department.strip())
    if doctor_id:
        doctor_uuid = _coerce_uuid(doctor_id)
        if not doctor_uuid:
            return [], "Invalid doctor id."
        query = query.filter(Appointment.doctor_id == doctor_uuid)
    if status:
        query = query.filter(Appointment.status == status.strip().lower())
    if priority:
        query = query.filter(Appointment.priority == priority.strip().lower())
    if date:
        try:
            parsed_date = date_type.fromisoformat(date.strip())
            query = query.filter(Appointment.appointment_date == parsed_date)
        except ValueError:
            return [], "Invalid date value."

    rows = query.order_by(
        Appointment.appointment_date.asc(),
        Appointment.time_slot.asc(),
    ).all()

    items: list[dict] = []
    for appointment, patient_name, doctor_name in rows:
        items.append(
            {
                "appointment_id": str(appointment.id),
                "patient_name": patient_name or "Unknown",
                "doctor_name": doctor_name or "Unknown",
                "department": appointment.department,
                "date": appointment.appointment_date.isoformat(),
                "time": appointment.time_slot,
                "status": appointment.status,
                "priority": appointment.priority or "normal",
            }
        )
    return items, None


def _get_appointment_for_hospital(
    db: Session,
    hospital_id: uuid.UUID,
    appointment_id: str,
) -> Appointment | None:
    appointment_uuid = _coerce_uuid(appointment_id)
    if not appointment_uuid:
        return None
    return (
        db.query(Appointment)
        .filter(
            Appointment.id == appointment_uuid,
            Appointment.hospital_id == hospital_id,
        )
        .first()
    )


def complete_appointment(
    db: Session,
    hospital_id: uuid.UUID,
    appointment_id: str,
) -> tuple[Appointment | None, str | None]:
    appointment = _get_appointment_for_hospital(db, hospital_id, appointment_id)
    if not appointment:
        return None, "Appointment not found."
    if appointment.status != "pending":
        return None, "Only pending appointments can be completed."
    appointment.status = "completed"
    db.commit()
    db.refresh(appointment)
    return appointment, None


def cancel_appointment(
    db: Session,
    hospital_id: uuid.UUID,
    appointment_id: str,
) -> tuple[Appointment | None, str | None]:
    appointment = _get_appointment_for_hospital(db, hospital_id, appointment_id)
    if not appointment:
        return None, "Appointment not found."
    if appointment.status != "pending":
        return None, "Only pending appointments can be cancelled."
    appointment.status = "cancelled"
    db.commit()
    db.refresh(appointment)
    return appointment, None


def set_appointment_priority(
    db: Session,
    hospital_id: uuid.UUID,
    appointment_id: str,
    priority: str,
) -> tuple[Appointment | None, str | None]:
    normalized = (priority or "").strip().lower()
    if normalized not in {"high", "normal", "low"}:
        return None, "Invalid priority value. Use high, normal, or low."
    appointment = _get_appointment_for_hospital(db, hospital_id, appointment_id)
    if not appointment:
        return None, "Appointment not found."
    appointment.priority = normalized
    db.commit()
    db.refresh(appointment)
    return appointment, None


def get_checkups_for_doctor(
    db: Session,
    hospital_id: uuid.UUID,
    doctor_id: str,
    status: str | None = None,
) -> list[dict] | None:
    doctor_uuid = _coerce_uuid(doctor_id)
    if not doctor_uuid:
        return None

    query = (
        db.query(Checkup, User.full_name)
        .join(User, User.id == Checkup.user_id)
        .filter(
            Checkup.hospital_id == hospital_id,
            Checkup.doctor_id == doctor_uuid,
        )
    )

    if status:
        query = query.filter(Checkup.status == status.strip().lower())

    rows = query.order_by(
        Checkup.appointment_date.asc(),
        Checkup.time_slot.asc(),
    ).all()

    items = []
    for checkup, patient_name in rows:
        items.append(
            {
                "checkup_id": str(checkup.id),
                "patient_name": patient_name or "Unknown",
                "date": checkup.appointment_date.isoformat(),
                "time": checkup.time_slot,
                "status": checkup.status,
                "priority": checkup.priority or "normal",
            }
        )
    return items


def get_hospital_checkups(
    db: Session,
    hospital_id: uuid.UUID,
    department: str | None = None,
    doctor_id: str | None = None,
    checkup_type: str | None = None,
    status: str | None = None,
    priority: str | None = None,
    date: str | None = None,
) -> tuple[list[dict], str | None]:
    query = (
        db.query(
            Checkup,
            User.full_name.label("patient_name"),
            Doctor.name.label("doctor_name"),
            Doctor.department.label("department"),
        )
        .join(User, User.id == Checkup.user_id)
        .join(Doctor, Doctor.id == Checkup.doctor_id)
        .filter(Checkup.hospital_id == hospital_id)
    )

    if department:
        query = query.filter(Doctor.department == department.strip())
    if doctor_id:
        doctor_uuid = _coerce_uuid(doctor_id)
        if not doctor_uuid:
            return [], "Invalid doctor id."
        query = query.filter(Checkup.doctor_id == doctor_uuid)
    if checkup_type:
        query = query.filter(Checkup.checkup_type == checkup_type.strip())
    if status:
        query = query.filter(Checkup.status == status.strip().lower())
    if priority:
        query = query.filter(Checkup.priority == priority.strip().lower())
    if date:
        try:
            parsed_date = date_type.fromisoformat(date.strip())
            query = query.filter(Checkup.appointment_date == parsed_date)
        except ValueError:
            return [], "Invalid date value."

    rows = query.order_by(
        Checkup.appointment_date.asc(),
        Checkup.time_slot.asc(),
    ).all()

    items: list[dict] = []
    for checkup, patient_name, doctor_name, department_name in rows:
        items.append(
            {
                "checkup_id": str(checkup.id),
                "patient_name": patient_name or "Unknown",
                "doctor_name": doctor_name or "Unknown",
                "department": department_name or "Unknown",
                "checkup_type": checkup.checkup_type,
                "date": checkup.appointment_date.isoformat(),
                "time": checkup.time_slot,
                "status": checkup.status,
                "priority": checkup.priority or "normal",
                "reason": checkup.notes,
                "report_url": checkup.report_url,
                "remarks": checkup.remarks,
            }
        )
    return items, None


def _get_checkup_for_hospital(
    db: Session,
    hospital_id: uuid.UUID,
    checkup_id: str,
) -> Checkup | None:
    checkup_uuid = _coerce_uuid(checkup_id)
    if not checkup_uuid:
        return None
    return (
        db.query(Checkup)
        .filter(
            Checkup.id == checkup_uuid,
            Checkup.hospital_id == hospital_id,
        )
        .first()
    )


def complete_checkup(
    db: Session,
    hospital_id: uuid.UUID,
    checkup_id: str,
) -> tuple[Checkup | None, str | None]:
    checkup = _get_checkup_for_hospital(db, hospital_id, checkup_id)
    if not checkup:
        return None, "Checkup not found."
    if checkup.status != "pending":
        return None, "Only pending checkups can be completed."
    checkup.status = "completed"
    db.commit()
    db.refresh(checkup)
    return checkup, None


def cancel_checkup(
    db: Session,
    hospital_id: uuid.UUID,
    checkup_id: str,
) -> tuple[Checkup | None, str | None]:
    checkup = _get_checkup_for_hospital(db, hospital_id, checkup_id)
    if not checkup:
        return None, "Checkup not found."
    if checkup.status != "pending":
        return None, "Only pending checkups can be cancelled."
    checkup.status = "cancelled"
    db.commit()
    db.refresh(checkup)
    return checkup, None


def set_checkup_priority(
    db: Session,
    hospital_id: uuid.UUID,
    checkup_id: str,
    priority: str,
) -> tuple[Checkup | None, str | None]:
    normalized = (priority or "").strip().lower()
    if normalized not in {"high", "normal", "low"}:
        return None, "Invalid priority value. Use high, normal, or low."
    checkup = _get_checkup_for_hospital(db, hospital_id, checkup_id)
    if not checkup:
        return None, "Checkup not found."
    checkup.priority = normalized
    db.commit()
    db.refresh(checkup)
    return checkup, None


def set_checkup_remarks(
    db: Session,
    hospital_id: uuid.UUID,
    checkup_id: str,
    remarks: str,
) -> tuple[Checkup | None, str | None]:
    normalized = (remarks or "").strip()
    if not normalized:
        return None, "Remarks cannot be empty."
    checkup = _get_checkup_for_hospital(db, hospital_id, checkup_id)
    if not checkup:
        return None, "Checkup not found."
    checkup.remarks = normalized
    db.commit()
    db.refresh(checkup)
    return checkup, None


def set_checkup_report_url(
    db: Session,
    hospital_id: uuid.UUID,
    checkup_id: str,
    report_url: str,
) -> tuple[Checkup | None, str | None]:
    checkup = _get_checkup_for_hospital(db, hospital_id, checkup_id)
    if not checkup:
        return None, "Checkup not found."
    checkup.report_url = report_url
    db.commit()
    db.refresh(checkup)
    return checkup, None


def get_patient_summaries(
    db: Session,
    hospital_id: uuid.UUID,
) -> list[dict]:
    appointment_subq = (
        db.query(
            Appointment.user_id.label("user_id"),
            func.max(Appointment.appointment_date).label("last_appointment"),
        )
        .group_by(Appointment.user_id)
        .subquery()
    )
    checkup_subq = (
        db.query(
            Checkup.user_id.label("user_id"),
            func.max(Checkup.appointment_date).label("last_checkup"),
        )
        .group_by(Checkup.user_id)
        .subquery()
    )
    rows = (
        db.query(
            User,
            appointment_subq.c.last_appointment,
            checkup_subq.c.last_checkup,
        )
        .outerjoin(appointment_subq, appointment_subq.c.user_id == User.id)
        .outerjoin(checkup_subq, checkup_subq.c.user_id == User.id)
        .filter(User.role == "parent")
        .order_by(User.full_name.asc())
        .all()
    )
    items: list[dict] = []
    for user, last_appointment, last_checkup in rows:
        items.append(
            {
                "patient_id": str(user.id),
                "patient_name": user.full_name or "Unknown",
                "age": None,
                "last_appointment": last_appointment.isoformat() if last_appointment else None,
                "last_checkup": last_checkup.isoformat() if last_checkup else None,
            }
        )
    return items


def _patient_has_hospital_records(
    db: Session,
    hospital_id: uuid.UUID,
    patient_id: uuid.UUID,
) -> bool:
    appointment_exists = (
        db.query(Appointment.id)
        .filter(
            Appointment.hospital_id == hospital_id,
            Appointment.user_id == patient_id,
        )
        .first()
        is not None
    )
    if appointment_exists:
        return True
    return (
        db.query(Checkup.id)
        .filter(
            Checkup.hospital_id == hospital_id,
            Checkup.user_id == patient_id,
        )
        .first()
        is not None
    )


def get_patient_profile(
    db: Session,
    hospital_id: uuid.UUID,
    patient_id: str,
) -> tuple[User | None, str | None]:
    patient_uuid = _coerce_uuid(patient_id)
    if not patient_uuid:
        return None, "Invalid patient id."
    user = db.query(User).filter(User.id == patient_uuid).first()
    if not user:
        return None, "Patient not found."
    if not _patient_has_hospital_records(db, hospital_id, patient_uuid):
        return None, "Patient not found."
    return user, None


def get_patient_appointments(
    db: Session,
    hospital_id: uuid.UUID,
    patient_id: uuid.UUID,
) -> list[dict]:
    rows = (
        db.query(
            Appointment,
            Doctor.name.label("doctor_name"),
        )
        .join(Doctor, Doctor.id == Appointment.doctor_id)
        .filter(
            Appointment.hospital_id == hospital_id,
            Appointment.user_id == patient_id,
        )
        .order_by(Appointment.appointment_date.desc(), Appointment.time_slot.desc())
        .all()
    )
    items: list[dict] = []
    for appointment, doctor_name in rows:
        items.append(
            {
                "appointment_id": str(appointment.id),
                "doctor_name": doctor_name or "Unknown",
                "department": appointment.department,
                "date": appointment.appointment_date.isoformat(),
                "time": appointment.time_slot,
                "status": appointment.status,
                "priority": appointment.priority or "normal",
            }
        )
    return items


def get_patient_checkups(
    db: Session,
    hospital_id: uuid.UUID,
    patient_id: uuid.UUID,
) -> list[dict]:
    rows = (
        db.query(
            Checkup,
            Doctor.name.label("doctor_name"),
        )
        .join(Doctor, Doctor.id == Checkup.doctor_id)
        .filter(
            Checkup.hospital_id == hospital_id,
            Checkup.user_id == patient_id,
        )
        .order_by(Checkup.appointment_date.desc(), Checkup.time_slot.desc())
        .all()
    )
    items: list[dict] = []
    for checkup, doctor_name in rows:
        items.append(
            {
                "checkup_id": str(checkup.id),
                "doctor_name": doctor_name or "Unknown",
                "checkup_type": checkup.checkup_type,
                "date": checkup.appointment_date.isoformat(),
                "time": checkup.time_slot,
                "status": checkup.status,
                "priority": checkup.priority or "normal",
                "report_url": checkup.report_url,
                "remarks": checkup.remarks,
            }
        )
    return items


def get_patient_vitals(
    db: Session,
    hospital_id: uuid.UUID,
    patient_id: uuid.UUID,
) -> list[dict]:
    rows = (
        db.query(PatientVital)
        .filter(
            PatientVital.hospital_id == hospital_id,
            PatientVital.user_id == patient_id,
        )
        .order_by(PatientVital.recorded_at.desc())
        .all()
    )
    items: list[dict] = []
    for vital in rows:
        items.append(
            {
                "vital_id": str(vital.id),
                "blood_pressure": vital.blood_pressure,
                "heart_rate": vital.heart_rate,
                "temperature": vital.temperature,
                "respiratory_rate": vital.respiratory_rate,
                "oxygen_saturation": vital.oxygen_saturation,
                "weight": vital.weight,
                "notes": vital.notes,
                "recorded_at": vital.recorded_at.isoformat() if vital.recorded_at else None,
            }
        )
    return items


def create_patient_vital(
    db: Session,
    hospital_id: uuid.UUID,
    patient_id: uuid.UUID,
    payload: dict,
) -> PatientVital:
    vital = PatientVital(
        user_id=patient_id,
        hospital_id=hospital_id,
        blood_pressure=payload.get("blood_pressure"),
        heart_rate=payload.get("heart_rate"),
        temperature=payload.get("temperature"),
        respiratory_rate=payload.get("respiratory_rate"),
        oxygen_saturation=payload.get("oxygen_saturation"),
        weight=payload.get("weight"),
        notes=payload.get("notes"),
    )
    db.add(vital)
    db.commit()
    db.refresh(vital)
    return vital


def get_patient_reports(
    db: Session,
    hospital_id: uuid.UUID,
    patient_id: uuid.UUID,
) -> list[dict]:
    rows = (
        db.query(Checkup)
        .filter(
            Checkup.hospital_id == hospital_id,
            Checkup.user_id == patient_id,
            Checkup.report_url.isnot(None),
        )
        .order_by(Checkup.appointment_date.desc(), Checkup.time_slot.desc())
        .all()
    )
    return [
        {
            "checkup_id": str(checkup.id),
            "checkup_type": checkup.checkup_type,
            "date": checkup.appointment_date.isoformat(),
            "report_url": checkup.report_url,
        }
        for checkup in rows
    ]


def generate_time_slots(
    start_time: str,
    end_time: str,
    slot_duration: int,
) -> list[str]:
    if slot_duration <= 0:
        return []
    for fmt in ("%H:%M", "%I:%M %p"):
        try:
            start = datetime.strptime(start_time.strip(), fmt).time()
            end = datetime.strptime(end_time.strip(), fmt).time()
            break
        except ValueError:
            continue
    else:
        return []

    today = datetime.utcnow().date()
    current = datetime.combine(today, start)
    end_dt = datetime.combine(today, end)
    if end_dt <= current:
        return []

    slots: list[str] = []
    while current < end_dt:
        slots.append(current.strftime("%H:%M"))
        current += timedelta(minutes=slot_duration)
    return slots


def get_doctors_for_hospital(
    db: Session,
    hospital_id: uuid.UUID,
    department: str | None = None,
    target_date: date_type | None = None,
) -> list[dict]:
    query = db.query(Doctor).filter(Doctor.hospital_id == hospital_id)
    if department:
        query = query.filter(Doctor.department == department)
    doctors = query.order_by(Doctor.name.asc()).all()

    today = target_date or date_type.today()
    items: list[dict] = []
    for doctor in doctors:
        availability_rows = (
            db.query(DoctorAvailability)
            .filter(
                DoctorAvailability.doctor_id == doctor.id,
                DoctorAvailability.date == today,
            )
            .all()
        )
        status = "unavailable"
        if availability_rows:
            statuses = {row.status for row in availability_rows}
            if "emergency" in statuses:
                status = "emergency"
            elif "leave" in statuses:
                status = "leave"
            elif "available" in statuses:
                status = "available"
        working_hours = None
        if availability_rows:
            starts = [row.start_time for row in availability_rows if row.start_time]
            ends = [row.end_time for row in availability_rows if row.end_time]
            if starts and ends:
                working_hours = f"{min(starts)} - {max(ends)}"
        appointments_today = (
            db.query(Appointment)
            .filter(
                Appointment.doctor_id == doctor.id,
                Appointment.appointment_date == today,
            )
            .count()
        )
        items.append(
            {
                "doctor_id": str(doctor.id),
                "name": doctor.name,
                "department": doctor.department,
                "is_active": doctor.is_active,
                "status": status,
                "working_hours": working_hours,
                "appointments_today": appointments_today,
            }
        )
    return items


def set_doctor_availability(
    db: Session,
    hospital_id: uuid.UUID,
    doctor_id: uuid.UUID,
    date_value: date_type,
    start_time_value: str,
    end_time_value: str,
    slot_duration: int,
    status: str,
) -> list[DoctorAvailability]:
    slots = generate_time_slots(start_time_value, end_time_value, slot_duration)
    if not slots:
        return []
    db.query(DoctorAvailability).filter(
        DoctorAvailability.doctor_id == doctor_id,
        DoctorAvailability.date == date_value,
    ).delete()
    is_available = status == "available"
    rows: list[DoctorAvailability] = []
    for slot in slots:
        row = DoctorAvailability(
            doctor_id=doctor_id,
            hospital_id=hospital_id,
            date=date_value,
            time_slot=slot,
            start_time=start_time_value,
            end_time=end_time_value,
            slot_duration=slot_duration,
            status=status,
            is_available=is_available,
        )
        db.add(row)
        rows.append(row)
    db.commit()
    for row in rows:
        db.refresh(row)
    return rows


def update_doctor_availability_status(
    db: Session,
    doctor_id: uuid.UUID,
    date_value: date_type,
    status: str,
) -> int:
    is_available = status == "available"
    rows = (
        db.query(DoctorAvailability)
        .filter(
            DoctorAvailability.doctor_id == doctor_id,
            DoctorAvailability.date == date_value,
        )
        .all()
    )
    for row in rows:
        row.status = status
        row.is_available = is_available
    db.commit()
    return len(rows)


def get_doctor_schedule(
    db: Session,
    doctor_id: uuid.UUID,
    date_value: date_type,
) -> dict:
    availability = (
        db.query(DoctorAvailability)
        .filter(
            DoctorAvailability.doctor_id == doctor_id,
            DoctorAvailability.date == date_value,
        )
        .order_by(DoctorAvailability.time_slot.asc())
        .all()
    )
    appointments = (
        db.query(Appointment, User.full_name)
        .join(User, User.id == Appointment.user_id)
        .filter(
            Appointment.doctor_id == doctor_id,
            Appointment.appointment_date == date_value,
        )
        .order_by(Appointment.time_slot.asc())
        .all()
    )
    booked_slots = {appointment.time_slot for appointment, _ in appointments}
    slots = []
    for row in availability:
        slots.append(
            {
                "time": row.time_slot,
                "status": "booked" if row.time_slot in booked_slots else "free",
            }
        )
    total = len(appointments)
    pending = sum(1 for appointment, _ in appointments if appointment.status == "pending")
    completed = sum(1 for appointment, _ in appointments if appointment.status == "completed")
    return {
        "availability": [
            {
                "date": row.date.isoformat(),
                "start_time": row.start_time,
                "end_time": row.end_time,
                "slot_duration": row.slot_duration,
                "status": row.status,
            }
            for row in availability
        ],
        "slots": slots,
        "appointments": [
            {
                "appointment_id": str(appointment.id),
                "patient_name": patient_name or "Unknown",
                "time_slot": appointment.time_slot,
                "status": appointment.status,
                "priority": appointment.priority or "normal",
            }
            for appointment, patient_name in appointments
        ],
        "workload": {
            "total": total,
            "pending": pending,
            "completed": completed,
        },
        "patient_count": len({appointment.user_id for appointment, _ in appointments}),
    }


def get_doctor_appointments(
    db: Session,
    doctor_id: uuid.UUID,
    date_value: date_type,
) -> list[dict]:
    rows = (
        db.query(Appointment, User.full_name)
        .join(User, User.id == Appointment.user_id)
        .filter(
            Appointment.doctor_id == doctor_id,
            Appointment.appointment_date == date_value,
        )
        .order_by(Appointment.time_slot.asc())
        .all()
    )
    return [
        {
            "patient_name": patient_name or "Unknown",
            "time_slot": appointment.time_slot,
            "status": appointment.status,
            "priority": appointment.priority or "normal",
        }
        for appointment, patient_name in rows
    ]
