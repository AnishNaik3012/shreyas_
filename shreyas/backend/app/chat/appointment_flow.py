from datetime import datetime, date, timedelta
from typing import Any
import uuid

from sqlalchemy.orm import Session
from sqlalchemy import inspect

from app.models.chat_session import ChatSession
import logging
from app.models.user import User
from app.models.doctor import Doctor
from app.models.hospital import Hospital
from app.models.appointment import Appointment
from app.appointments.service import (
    build_appointment_list_items,
    cancel_appointment,
    create_appointment,
    get_upcoming_for_user,
    is_doctor_slot_taken,
    get_available_slots_for_date,
    mark_slot_unavailable,
)

SESSION_TIMEOUT = timedelta(minutes=15)
logger = logging.getLogger(__name__)

FLOW_APPOINTMENT = "appointment"

STEP_START = "start"
STEP_CHOOSE_ACTION = "choose_action"
STEP_SELECT_DEPARTMENT = "select_department"
STEP_SELECT_DOCTOR = "select_doctor"
STEP_CHOOSE_DAY_TYPE = "choose_day_type"
STEP_SELECT_DATE = "select_date"
STEP_SELECT_SLOT = "select_slot"
STEP_ENTER_REASON = "enter_reason"
STEP_ENTER_DESCRIPTION = "enter_description"
STEP_CONFIRM_BOOKING = "confirm_booking"
STEP_COMPLETED = "completed"

DEPARTMENTS = [
    "Gynecology",
    "Pediatrics",
    "General Medicine",
    "Nutrition",
    "Mental Health",
]

VALID_STEPS = {
    STEP_START,
    STEP_CHOOSE_ACTION,
    STEP_SELECT_DEPARTMENT,
    STEP_SELECT_DOCTOR,
    STEP_CHOOSE_DAY_TYPE,
    STEP_SELECT_DATE,
    STEP_SELECT_SLOT,
    STEP_ENTER_REASON,
    STEP_ENTER_DESCRIPTION,
    STEP_CONFIRM_BOOKING,
    STEP_COMPLETED,
}


def _now_utc():
    return datetime.utcnow()


def _is_session_expired(session: ChatSession) -> bool:
    if not session.updated_at:
        return False
    return _now_utc() - session.updated_at.replace(tzinfo=None) > SESSION_TIMEOUT


def _reset_session(
    db: Session,
    user_id,
    step: str,
    context: dict[str, Any] | None = None,
):
    session = db.query(ChatSession).filter(ChatSession.user_id == user_id).first()
    if session and inspect(session).deleted:
        db.expunge(session)
        session = None
    if not session:
        session = ChatSession(
            user_id=user_id,
            current_flow=FLOW_APPOINTMENT,
            current_step=step,
            context=context or {},
        )
        session.updated_at = _now_utc()
        db.add(session)
    else:
        session.current_flow = FLOW_APPOINTMENT
        session.current_step = step
        session.context = context or {}
        session.updated_at = _now_utc()
    db.flush()
    return session


def _clear_session(db: Session, user_id):
    session = db.query(ChatSession).filter(ChatSession.user_id == user_id).first()
    if session:
        db.delete(session)


def _touch_session(db: Session, session: ChatSession):
    session.updated_at = _now_utc()
    db.flush()
    return session


def _get_session(db: Session, user_id) -> ChatSession | None:
    session = db.query(ChatSession).filter(ChatSession.user_id == user_id).first()
    if not session:
        return None
    if _is_session_expired(session):
        db.delete(session)
        db.flush()
        return None
    return session


def _parse_date(value: str) -> date | None:
    for fmt in ("%Y-%m-%d", "%d %b %Y", "%d %B %Y"):
        try:
            return datetime.strptime(value, fmt).date()
        except ValueError:
            continue
    return None


def _doctor_id_variants(value: str | None):
    if not value:
        return []
    try:
        parsed = uuid.UUID(str(value))
        return [parsed, str(parsed), parsed.hex]
    except (ValueError, TypeError):
        return [value]


def _human_date(target_date: date) -> str:
    today = date.today()
    if target_date == today:
        return "Today"
    if target_date == today + timedelta(days=1):
        return "Tomorrow"
    return target_date.strftime("%b %d, %Y")


def _format_summary(context: dict[str, Any]) -> list[str]:
    return [
        f"Doctor: {context.get('doctor_name', 'TBD')}",
        f"Department: {context.get('department', 'TBD')}",
        f"Date: {context.get('appointment_date', 'TBD')}",
        f"Time: {context.get('time_slot', 'TBD')}",
        f"Reason: {context.get('reason', 'TBD') or 'TBD'}",
        f"Description: {context.get('description', 'TBD') or 'TBD'}",
    ]


def _base_response(
    message: str,
    options: list[str] | list[dict[str, str]] | None = None,
    step: str | None = None,
):
    return {"message": message, "options": options, "step": step}


def _department_options() -> list[str]:
    return list(DEPARTMENTS)


def _doctor_options(db: Session, department: str) -> list[str]:
    doctors = (
        db.query(Doctor)
        .filter(Doctor.department == department, Doctor.is_active.is_(True))
        .order_by(Doctor.name.asc())
        .all()
    )
    return [doc.name for doc in doctors]


def _slot_options(db: Session, doctor_id: str, target_date: date) -> list[str]:
    return get_available_slots_for_date(db, doctor_id, target_date)


def _prompt_for_current_step(
    db: Session,
    session: ChatSession,
    context: dict[str, Any],
):
    step = session.current_step
    if step == STEP_CHOOSE_ACTION:
        return _base_response(
            "What would you like to do?",
            ["Book Appointment", "View Appointments", "Cancel Appointment"],
            STEP_CHOOSE_ACTION,
        )

    if step == STEP_SELECT_DEPARTMENT:
        return _base_response(
            "Select department",
            _department_options(),
            STEP_SELECT_DEPARTMENT,
        )

    if step == STEP_SELECT_DOCTOR:
        department = context.get("department")
        if not department:
            session.current_step = STEP_SELECT_DEPARTMENT
            return _base_response(
                "Select department",
                _department_options(),
                STEP_SELECT_DEPARTMENT,
            )
        doctors = _doctor_options(db, department)
        if not doctors:
            session.current_step = STEP_SELECT_DEPARTMENT
            return _base_response(
                f"No doctors are available for {department}. Please choose another department.",
                _department_options(),
                STEP_SELECT_DEPARTMENT,
            )
        return _base_response(
            "Choose doctor",
            doctors,
            STEP_SELECT_DOCTOR,
        )

    if step == STEP_CHOOSE_DAY_TYPE:
        return _base_response(
            "Choose appointment type",
            ["Today", "Next Available"],
            STEP_CHOOSE_DAY_TYPE,
        )

    if step == STEP_SELECT_DATE:
        return _base_response(
            "Select date",
            None,
            STEP_SELECT_DATE,
        )

    if step == STEP_SELECT_SLOT:
        doctor_id = context.get("doctor_id")
        appointment_date = context.get("appointment_date")
        parsed = _parse_date(str(appointment_date)) if appointment_date else None
        if not doctor_id or not parsed:
            session.current_step = STEP_CHOOSE_DAY_TYPE
            return _base_response(
                "Choose appointment type",
                ["Today", "Next Available"],
                STEP_CHOOSE_DAY_TYPE,
            )
        slots = _slot_options(db, doctor_id, parsed)
        if not slots:
            session.current_step = STEP_CHOOSE_DAY_TYPE
            return _base_response(
                "No slots are available for that date. Please choose another.",
                ["Today", "Next Available"],
                STEP_CHOOSE_DAY_TYPE,
            )
        return _base_response(
            "Select time slot",
            slots,
            STEP_SELECT_SLOT,
        )

    if step == STEP_ENTER_REASON:
        return _base_response(
            "What is the reason for visit?",
            None,
            STEP_ENTER_REASON,
        )

    if step == STEP_ENTER_DESCRIPTION:
        return _base_response(
            "Add a brief description for the appointment.",
            None,
            STEP_ENTER_DESCRIPTION,
        )

    if step == STEP_CONFIRM_BOOKING:
        summary = "\n".join(_format_summary(context))
        return _base_response(
            f"Appointment Summary:\n{summary}",
            ["Yes Confirm Booking", "Cancel"],
            STEP_CONFIRM_BOOKING,
        )

    session.current_step = STEP_CHOOSE_ACTION
    return _base_response(
        "What would you like to do?",
        ["Book Appointment", "View Appointments", "Cancel Appointment"],
        STEP_CHOOSE_ACTION,
    )


def _normalize_step(value: Any) -> str:
    return str(value).strip().lower()


def start_booking_flow(db: Session, user: User):
    session = _reset_session(db, user.id, STEP_CHOOSE_ACTION, {})
    response = _base_response(
        "What would you like to do?",
        ["Book Appointment", "View Appointments", "Cancel Appointment"],
        STEP_CHOOSE_ACTION,
    )
    return response, session


def start_view_flow(db: Session, user: User):
    if user.role != "parent":
        return _base_response("Only parents can view their appointments here.", step=None), None

    session = _reset_session(db, user.id, STEP_CHOOSE_ACTION, {})
    response = _base_response(
        "What would you like to do?",
        ["Book Appointment", "View Appointments", "Cancel Appointment"],
        STEP_CHOOSE_ACTION,
    )
    return response, session


def start_cancel_flow(db: Session, user: User):
    if user.role != "parent":
        return _base_response("Only parents can cancel appointments.", step=None), None

    session = _reset_session(db, user.id, STEP_CHOOSE_ACTION, {})
    response = _base_response(
        "What would you like to do?",
        ["Book Appointment", "View Appointments", "Cancel Appointment"],
        STEP_CHOOSE_ACTION,
    )
    return response, session


def handle_step(db: Session, user: User, step: str, value: Any):
    step = _normalize_step(step)
    if step not in VALID_STEPS:
        step = STEP_CHOOSE_ACTION

    session = _get_session(db, user.id)
    if not session:
        session = _reset_session(db, user.id, STEP_CHOOSE_ACTION, {})
        return (
            _base_response(
                "Your session expired. Let's start again. What would you like to do?",
                ["Book Appointment", "View Appointments", "Cancel Appointment"],
                STEP_CHOOSE_ACTION,
            ),
            session,
        )

    if session.current_flow != FLOW_APPOINTMENT:
        session = _reset_session(db, user.id, STEP_CHOOSE_ACTION, {})
        return (
            _base_response(
                "Let's start your appointment flow. What would you like to do?",
                ["Book Appointment", "View Appointments", "Cancel Appointment"],
                STEP_CHOOSE_ACTION,
            ),
            session,
        )

    context = dict(session.context or {})

    if step != session.current_step:
        response = _prompt_for_current_step(db, session, context)
        session.context = context
        _touch_session(db, session)
        return response, session

    if step == STEP_CHOOSE_ACTION:
        action = str(value).strip().lower()
        if context.get("cancel_mode") == "select" and action:
            if isinstance(value, dict):
                appointment_id = value.get("id") or value.get("value")
            else:
                appointment_id = str(value).strip()
            appointment, error = cancel_appointment(
                db=db,
                appointment_id=appointment_id,
                user=user,
                commit=False,
            )
            if error:
                upcoming = get_upcoming_for_user(db, user)
                options = [
                    {
                        "label": f"{a.department} - {a.appointment_date} - {a.time_slot}",
                        "value": str(a.id),
                    }
                    for a in upcoming
                ]
                _touch_session(db, session)
                return (
                    _base_response(
                        error,
                        options or ["Book Appointment", "View Appointments", "Cancel Appointment"],
                        STEP_CHOOSE_ACTION,
                    ),
                    session,
                )
            _clear_session(db, user.id)
            return (
                _base_response("Appointment cancelled successfully.", step=STEP_COMPLETED),
                None,
            )

        if action == "book appointment":
            context = {}
            session.current_step = STEP_SELECT_DEPARTMENT
            session.context = context
            _touch_session(db, session)
            return (
                _base_response(
                    "Select department",
                    _department_options(),
                    STEP_SELECT_DEPARTMENT,
                ),
                session,
            )

        if action == "view appointments":
            appointments = (
                db.query(Appointment)
                .filter(Appointment.user_id == user.id)
                .order_by(
                    Appointment.appointment_date.asc(),
                    Appointment.time_slot.asc(),
                )
                .all()
            )
            items = build_appointment_list_items(db, appointments)
            _clear_session(db, user.id)
            response = _base_response(
                "Here are your appointments:" if items else "No appointments found.",
                step=STEP_COMPLETED,
            )
            response["appointments"] = items
            return response, None

        if action == "cancel appointment":
            today = date.today()
            upcoming = (
                db.query(Appointment)
                .filter(
                    Appointment.user_id == user.id,
                    Appointment.status != "cancelled",
                    Appointment.appointment_date >= today,
                )
                .order_by(
                    Appointment.appointment_date.asc(),
                    Appointment.time_slot.asc(),
                )
                .all()
            )
            if not upcoming:
                _clear_session(db, user.id)
                return (
                    _base_response(
                        "You don't have any upcoming appointments to cancel.",
                        step=STEP_COMPLETED,
                    ),
                    None,
                )
            context = {"cancel_mode": "select"}
            session.current_step = STEP_CHOOSE_ACTION
            session.context = context
            _touch_session(db, session)
            options = [
                {
                    "label": f"{a.department} - {a.appointment_date} - {a.time_slot}",
                    "value": str(a.id),
                }
                for a in upcoming
            ]
            return (
                _base_response(
                    "Which appointment would you like to cancel?",
                    options,
                    STEP_CHOOSE_ACTION,
                ),
                session,
            )

        _touch_session(db, session)
        return (
            _base_response(
                "Please choose an option to continue.",
                ["Book Appointment", "View Appointments", "Cancel Appointment"],
                STEP_CHOOSE_ACTION,
            ),
            session,
        )

    if step == STEP_SELECT_DEPARTMENT:
        department = str(value).strip()
        if department not in DEPARTMENTS:
            _touch_session(db, session)
            return (
                _base_response(
                    "Select department",
                    _department_options(),
                    STEP_SELECT_DEPARTMENT,
                ),
                session,
            )
        context["department"] = department
        session.current_step = STEP_SELECT_DOCTOR
        session.context = context
        _touch_session(db, session)
        doctors = _doctor_options(db, department)
        if not doctors:
            session.current_step = STEP_SELECT_DEPARTMENT
            session.context = context
            _touch_session(db, session)
            return (
                _base_response(
                    f"No doctors are available for {department}. Please choose another department.",
                    _department_options(),
                    STEP_SELECT_DEPARTMENT,
                ),
                session,
            )
        return (
            _base_response("Choose doctor", doctors, STEP_SELECT_DOCTOR),
            session,
        )

    if step == STEP_SELECT_DOCTOR:
        department = context.get("department")
        doctor_name = str(value).strip()
        if not department:
            session.current_step = STEP_SELECT_DEPARTMENT
            return (
                _base_response(
                    "Select department",
                    _department_options(),
                    STEP_SELECT_DEPARTMENT,
                ),
                session,
            )

        doctor = (
            db.query(Doctor)
            .filter(
                Doctor.name == doctor_name,
                Doctor.department == department,
                Doctor.is_active.is_(True),
            )
            .first()
        )
        if not doctor:
            doctor_options = _doctor_options(db, department)
            if not doctor_options:
                session.current_step = STEP_SELECT_DEPARTMENT
                session.context = context
                _touch_session(db, session)
                return (
                    _base_response(
                        f"No doctors are available for {department}. Please choose another department.",
                        _department_options(),
                        STEP_SELECT_DEPARTMENT,
                    ),
                    session,
                )
            return (
                _base_response(
                    "Choose doctor",
                    doctor_options,
                    STEP_SELECT_DOCTOR,
                ),
                session,
            )

        context["doctor_id"] = str(doctor.id)
        context["doctor_name"] = doctor.name
        context["hospital_id"] = str(doctor.hospital_id)
        hospital = db.query(Hospital).filter(Hospital.id == doctor.hospital_id).first()
        if hospital:
            context["hospital_name"] = hospital.name
        session.current_step = STEP_CHOOSE_DAY_TYPE
        session.context = context
        _touch_session(db, session)
        return (
            _base_response(
                "Choose appointment type",
                ["Today", "Next Available"],
                STEP_CHOOSE_DAY_TYPE,
            ),
            session,
        )

    if step == STEP_CHOOSE_DAY_TYPE:
        selection = str(value).strip().lower()
        doctor_id = context.get("doctor_id")
        if not doctor_id:
            session.current_step = STEP_SELECT_DOCTOR
            session.context = context
            _touch_session(db, session)
            return (
                _base_response(
                    "Choose doctor",
                    _doctor_options(db, context.get("department", "")),
                    STEP_SELECT_DOCTOR,
                ),
                session,
            )

        if selection == "today":
            chosen_date = date.today()
            context["appointment_date"] = chosen_date.isoformat()
            session.context = context
            slots = _slot_options(db, doctor_id, chosen_date)
            if not slots:
                _touch_session(db, session)
                return (
                    _base_response(
                        f"No slots available on {_human_date(chosen_date)}. Please choose another.",
                        ["Today", "Next Available"],
                        STEP_CHOOSE_DAY_TYPE,
                    ),
                    session,
                )
            session.current_step = STEP_SELECT_SLOT
            _touch_session(db, session)
            return (
                _base_response("Select time slot", slots, STEP_SELECT_SLOT),
                session,
            )

        if selection == "next available":
            session.current_step = STEP_SELECT_DATE
            session.context = context
            _touch_session(db, session)
            return (
                _base_response("Select date", step=STEP_SELECT_DATE),
                session,
            )

        _touch_session(db, session)
        return (
            _base_response(
                "Please choose Today or Next Available.",
                ["Today", "Next Available"],
                STEP_CHOOSE_DAY_TYPE,
            ),
            session,
        )

    if step == STEP_SELECT_DATE:
        doctor_id = context.get("doctor_id")
        if not doctor_id:
            session.current_step = STEP_SELECT_DOCTOR
            session.context = context
            _touch_session(db, session)
            return (
                _base_response(
                    "Choose doctor",
                    _doctor_options(db, context.get("department", "")),
                    STEP_SELECT_DOCTOR,
                ),
                session,
            )

        parsed = _parse_date(str(value))
        if not parsed:
            _touch_session(db, session)
            return (
                _base_response("Please select a valid date.", step=STEP_SELECT_DATE),
                session,
            )

        context["appointment_date"] = parsed.isoformat()
        session.context = context
        slots = _slot_options(db, doctor_id, parsed)
        if not slots:
            _touch_session(db, session)
            return (
                _base_response(
                    f"No slots available on {_human_date(parsed)}. Please choose another date.",
                    step=STEP_SELECT_DATE,
                ),
                session,
            )

        session.current_step = STEP_SELECT_SLOT
        _touch_session(db, session)
        return (
            _base_response("Select time slot", slots, STEP_SELECT_SLOT),
            session,
        )

    if step == STEP_SELECT_SLOT:
        time_slot = str(value).strip()
        doctor_id = context.get("doctor_id")
        appointment_date_value = context.get("appointment_date")
        parsed_date = _parse_date(str(appointment_date_value)) if appointment_date_value else None

        if not doctor_id or not parsed_date:
            session.current_step = STEP_CHOOSE_DAY_TYPE
            session.context = context
            _touch_session(db, session)
            return (
                _base_response(
                    "Choose appointment type",
                    ["Today", "Next Available"],
                    STEP_CHOOSE_DAY_TYPE,
                ),
                session,
            )

        available = _slot_options(db, doctor_id, parsed_date)
        if time_slot not in available:
            if not available:
                _touch_session(db, session)
                return (
                    _base_response(
                        "No time slots are available for that date. Please pick another.",
                        ["Today", "Next Available"],
                        STEP_CHOOSE_DAY_TYPE,
                    ),
                    session,
                )
            return (
                _base_response(
                    "That time slot is no longer available. Please choose another.",
                    available,
                    STEP_SELECT_SLOT,
                ),
                session,
            )

        context["time_slot"] = time_slot
        session.current_step = STEP_ENTER_REASON
        session.context = context
        _touch_session(db, session)
        return (
            _base_response(
                "What is the reason for visit?",
                step=STEP_ENTER_REASON,
            ),
            session,
        )

    if step == STEP_ENTER_REASON:
        reason = str(value).strip()
        if not reason:
            _touch_session(db, session)
            return (
                _base_response(
                    "Please enter a reason for visit.",
                    step=STEP_ENTER_REASON,
                ),
                session,
            )
        context["reason"] = reason
        session.current_step = STEP_ENTER_DESCRIPTION
        session.context = context
        _touch_session(db, session)
        return (
            _base_response(
                "Add a brief description for the appointment.",
                step=STEP_ENTER_DESCRIPTION,
            ),
            session,
        )

    if step == STEP_ENTER_DESCRIPTION:
        description = str(value).strip()
        if not description:
            _touch_session(db, session)
            return (
                _base_response(
                    "Please add a short description.",
                    step=STEP_ENTER_DESCRIPTION,
                ),
                session,
            )
        context["description"] = description
        session.current_step = STEP_CONFIRM_BOOKING
        session.context = context
        _touch_session(db, session)
        summary = "\n".join(_format_summary(context))
        return (
            _base_response(
                f"Appointment Summary:\n{summary}",
                ["Yes Confirm Booking", "Cancel"],
                STEP_CONFIRM_BOOKING,
            ),
            session,
        )

    if step == STEP_CONFIRM_BOOKING:
        choice = str(value).strip().lower()
        if choice == "cancel":
            _clear_session(db, user.id)
            return (
                _base_response("No problem. I've cancelled this booking request.", step=STEP_COMPLETED),
                None,
            )
        if choice not in {"yes confirm booking", "confirm", "yes"}:
            _touch_session(db, session)
            return (
                _base_response(
                    "Please choose Yes Confirm Booking or Cancel.",
                    ["Yes Confirm Booking", "Cancel"],
                    STEP_CONFIRM_BOOKING,
                ),
                session,
            )

        appointment_date = _parse_date(str(context.get("appointment_date")))
        time_slot = str(context.get("time_slot", ""))
        doctor_id = context.get("doctor_id")

        if not appointment_date or not time_slot or not doctor_id:
            session = _reset_session(db, user.id, STEP_CHOOSE_ACTION, {})
            return (
                _base_response(
                    "I'm missing some details. Let's start again.",
                    ["Book Appointment", "View Appointments", "Cancel Appointment"],
                    STEP_CHOOSE_ACTION,
                ),
                session,
            )

        slot_taken = False
        try:
            slot_taken = is_doctor_slot_taken(db, doctor_id, appointment_date, time_slot)
        except Exception:
            slot_taken = False

        if slot_taken:
            session.current_step = STEP_SELECT_SLOT
            session.context = context
            _touch_session(db, session)
            return (
                _base_response(
                    "That time slot is no longer available. Please choose another.",
                    _slot_options(db, doctor_id, appointment_date),
                    STEP_SELECT_SLOT,
                ),
                session,
            )

        doctor = None
        for candidate in _doctor_id_variants(doctor_id):
            try:
                doctor = db.query(Doctor).filter(Doctor.id == candidate).first()
                if doctor:
                    break
            except Exception:
                continue
        if not doctor:
            session = _reset_session(db, user.id, STEP_CHOOSE_ACTION, {})
            return (
                _base_response(
                    "Doctor not found. Please restart the booking.",
                    ["Book Appointment", "View Appointments", "Cancel Appointment"],
                    STEP_CHOOSE_ACTION,
                ),
                session,
            )

        try:
            create_appointment(
                db=db,
                user_id=str(user.id),
                department=context.get("department"),
                doctor_id=str(doctor.id),
                hospital_id=str(context.get("hospital_id")),
                appointment_date=appointment_date,
                time_slot=time_slot,
                reason=context.get("reason"),
                symptoms=context.get("description"),
                commit=False,
            )
            mark_slot_unavailable(
                db=db,
                doctor_id=str(doctor.id),
                appointment_date=appointment_date,
                time_slot=time_slot,
                commit=False,
            )
            db.commit()
        except Exception:
            db.rollback()
            logger.exception("Booking transaction failed")
            session = _reset_session(db, user.id, STEP_CHOOSE_ACTION, {})
            return (
                _base_response(
                    "Something went wrong while booking. Let's start again.",
                    ["Book Appointment", "View Appointments", "Cancel Appointment"],
                    STEP_CHOOSE_ACTION,
                ),
                session,
            )
        _clear_session(db, user.id)
        success_lines = [
            f"✅ Appointment confirmed with Dr. {context.get('doctor_name', 'TBD')}",
            f"📅 {appointment_date.isoformat()}",
            f"🕒 {time_slot}",
            f"🏥 {context.get('hospital_name', 'TBD')}",
        ]
        return (_base_response("\n".join(success_lines), step=STEP_COMPLETED), None)

    return _base_response("Let's continue your appointment flow.", step=step), session
