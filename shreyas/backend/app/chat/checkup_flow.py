from datetime import datetime, date, timedelta
from typing import Any
import uuid

from sqlalchemy.orm import Session
from sqlalchemy import inspect

import logging
from app.models.chat_session import ChatSession
from app.models.user import User
from app.models.doctor import Doctor
from app.models.hospital import Hospital
from app.checkups.service import (
    create_checkup,
    build_checkup_list_items,
    get_upcoming_checkups_for_user,
    cancel_checkup,
)
from app.appointments.service import get_available_slots_for_date, mark_slot_unavailable

SESSION_TIMEOUT = timedelta(minutes=15)
logger = logging.getLogger(__name__)

FLOW_CHECKUP = "checkup"

STEP_CHOOSE_ACTION = "choose_action"
STEP_SELECT_DEPARTMENT = "select_department"
STEP_SELECT_CHECKUP_TYPE = "select_checkup_type"
STEP_SELECT_TESTS = "select_tests"
STEP_SELECT_DOCTOR = "select_doctor"
STEP_SELECT_DAY_TYPE = "select_day_type"
STEP_SELECT_DATE = "select_date"
STEP_SELECT_TIME_SLOT = "select_time_slot"
STEP_ENTER_NOTES = "enter_notes"
STEP_CONFIRM_CHECKUP = "confirm_checkup"
STEP_COMPLETED = "completed"

CHECKUP_TYPES = ["Pregnancy", "Routine", "Blood Test", "Custom"]
TEST_OPTIONS = ["Blood Sugar", "BP", "Ultrasound", "Thyroid"]
DEPARTMENTS = [
    "Gynecology",
    "Pediatrics",
    "General Medicine",
    "Nutrition",
    "Mental Health",
]
CHECKUP_TYPES_BY_DEPARTMENT = {
    "Gynecology": ["Pregnancy", "Routine", "Custom"],
    "Pediatrics": ["Routine", "Blood Test", "Custom"],
    "General Medicine": ["Routine", "Blood Test", "Custom"],
    "Nutrition": ["Routine", "Custom"],
    "Mental Health": ["Routine", "Custom"],
}

VALID_STEPS = {
    STEP_CHOOSE_ACTION,
    STEP_SELECT_DEPARTMENT,
    STEP_SELECT_CHECKUP_TYPE,
    STEP_SELECT_TESTS,
    STEP_SELECT_DOCTOR,
    STEP_SELECT_DAY_TYPE,
    STEP_SELECT_DATE,
    STEP_SELECT_TIME_SLOT,
    STEP_ENTER_NOTES,
    STEP_CONFIRM_CHECKUP,
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
            current_flow=FLOW_CHECKUP,
            current_step=step,
            context=context or {},
        )
        session.updated_at = _now_utc()
        db.add(session)
    else:
        session.current_flow = FLOW_CHECKUP
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


def _base_response(message: str, options: list[str] | list[dict[str, str]] | None = None, step: str | None = None):
    return {"message": message, "options": options, "step": step}


def _department_options() -> list[str]:
    return list(DEPARTMENTS)


def _doctor_options(db: Session, department: str | None = None) -> list[str]:
    query = db.query(Doctor).filter(Doctor.is_active.is_(True))
    if department:
        query = query.filter(Doctor.department == department)
    doctors = query.order_by(Doctor.name.asc()).all()
    return [doc.name for doc in doctors]


def _get_default_doctor(db: Session, department: str | None = None):
    query = db.query(Doctor).filter(Doctor.is_active.is_(True))
    if department:
        query = query.filter(Doctor.department == department)
    return query.order_by(Doctor.name.asc()).first()


def _slot_options(db: Session, doctor_id: str, target_date: date) -> list[str]:
    return get_available_slots_for_date(db, doctor_id, target_date)


def _format_summary(context: dict[str, Any]) -> list[str]:
    return [
        f"Department: {context.get('department', 'TBD')}",
        f"Type: {context.get('checkup_type', 'TBD')}",
        f"Tests: {', '.join(context.get('tests_selected') or []) or 'TBD'}",
        f"Doctor: {context.get('doctor_name', 'TBD')}",
        f"Date: {context.get('appointment_date', 'TBD')}",
        f"Time: {context.get('time_slot', 'TBD')}",
    ]


def _prompt_for_current_step(
    db: Session,
    session: ChatSession,
    context: dict[str, Any],
):
    step = session.current_step
    if step == STEP_CHOOSE_ACTION:
        return _base_response(
            "What would you like to do?",
            ["Book Checkup", "View Checkups", "Cancel Checkup"],
            STEP_CHOOSE_ACTION,
        )
    if step == STEP_SELECT_DEPARTMENT:
        return _base_response(
            "Select department",
            _department_options(),
            STEP_SELECT_DEPARTMENT,
        )
    if step == STEP_SELECT_CHECKUP_TYPE:
        department = context.get("department")
        options = CHECKUP_TYPES_BY_DEPARTMENT.get(department, CHECKUP_TYPES)
        return _base_response(
            "What type of checkup do you want?",
            options,
            STEP_SELECT_CHECKUP_TYPE,
        )
    if step == STEP_SELECT_TESTS:
        return _base_response(
            "Select tests",
            TEST_OPTIONS + ["Done"],
            STEP_SELECT_TESTS,
        )
    if step == STEP_SELECT_DOCTOR:
        doctors = _doctor_options(db, context.get("department"))
        return _base_response(
            "Select doctor (optional)",
            doctors + ["No preference"],
            STEP_SELECT_DOCTOR,
        )
    if step == STEP_SELECT_DAY_TYPE:
        return _base_response(
            "Choose appointment type",
            ["Today", "Next Available"],
            STEP_SELECT_DAY_TYPE,
        )
    if step == STEP_SELECT_DATE:
        return _base_response("Select date", step=STEP_SELECT_DATE)
    if step == STEP_SELECT_TIME_SLOT:
        doctor_id = context.get("doctor_id")
        appointment_date = context.get("appointment_date")
        parsed = _parse_date(str(appointment_date)) if appointment_date else None
        if doctor_id and parsed:
            slots = _slot_options(db, doctor_id, parsed)
            if slots:
                return _base_response("Select time slot", slots, STEP_SELECT_TIME_SLOT)
        return _base_response(
            "Choose appointment type",
            ["Today", "Next Available"],
            STEP_SELECT_DAY_TYPE,
        )
    if step == STEP_ENTER_NOTES:
        return _base_response("What is reason or notes?", step=STEP_ENTER_NOTES)
    if step == STEP_CONFIRM_CHECKUP:
        summary = "\n".join(_format_summary(context))
        return _base_response(
            f"Checkup Summary:\n{summary}",
            ["Confirm", "Cancel"],
            STEP_CONFIRM_CHECKUP,
        )
    return _base_response(
        "Select department",
        _department_options(),
        STEP_SELECT_DEPARTMENT,
    )


def start_checkup_flow(db: Session, user: User):
    session = _reset_session(db, user.id, STEP_CHOOSE_ACTION, {})
    response = _base_response(
        "What would you like to do?",
        ["Book Checkup", "View Checkups", "Cancel Checkup"],
        STEP_CHOOSE_ACTION,
    )
    return response, session


def handle_step(db: Session, user: User, step: str, value: Any):
    step = str(step).strip().lower()
    if step not in VALID_STEPS:
        step = STEP_SELECT_DEPARTMENT

    session = _get_session(db, user.id)
    if not session:
        session = _reset_session(db, user.id, STEP_CHOOSE_ACTION, {})
        return (
            _base_response(
                "Your session expired. Let's start again. What would you like to do?",
                ["Book Checkup", "View Checkups", "Cancel Checkup"],
                STEP_CHOOSE_ACTION,
            ),
            session,
        )

    if session.current_flow != FLOW_CHECKUP:
        session = _reset_session(db, user.id, STEP_CHOOSE_ACTION, {})
        return (
            _base_response(
                "Let's start your checkup flow. What would you like to do?",
                ["Book Checkup", "View Checkups", "Cancel Checkup"],
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
        if isinstance(value, dict) and (value.get("id") or value.get("value")):
            checkup_id = value.get("id") or value.get("value")
            checkup, error = cancel_checkup(
                db=db,
                checkup_id=checkup_id,
                user=user,
                commit=False,
            )
            if error:
                _touch_session(db, session)
                return (
                    _base_response(
                        error,
                        ["Book Checkup", "View Checkups", "Cancel Checkup"],
                        STEP_CHOOSE_ACTION,
                    ),
                    session,
                )
            _clear_session(db, user.id)
            return (
                _base_response("Checkup cancelled successfully.", step=STEP_COMPLETED),
                None,
            )
        if context.get("cancel_mode") == "select" and action:
            if isinstance(value, dict):
                checkup_id = value.get("id") or value.get("value")
            else:
                checkup_id = str(value).strip()
            checkup, error = cancel_checkup(
                db=db,
                checkup_id=checkup_id,
                user=user,
                commit=False,
            )
            if error:
                upcoming = get_upcoming_checkups_for_user(db, user)
                options = [
                    {
                        "label": f"{c.checkup_type} - {c.appointment_date} - {c.time_slot}",
                        "value": str(c.id),
                    }
                    for c in upcoming
                ]
                _touch_session(db, session)
                return (
                    _base_response(
                        error,
                        options or ["Book Checkup", "View Checkups", "Cancel Checkup"],
                        STEP_CHOOSE_ACTION,
                    ),
                    session,
                )
            _clear_session(db, user.id)
            return (
                _base_response("Checkup cancelled successfully.", step=STEP_COMPLETED),
                None,
            )

        if action == "book checkup":
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

        if action == "view checkups":
            checkups = get_upcoming_checkups_for_user(db, user)
            items = build_checkup_list_items(db, checkups)
            _clear_session(db, user.id)
            response = _base_response(
                "Here are your checkups:" if items else "No checkups found.",
                step=STEP_COMPLETED,
            )
            response["checkups"] = items
            return response, None

        if action == "cancel checkup":
            upcoming = get_upcoming_checkups_for_user(db, user)
            if not upcoming:
                _clear_session(db, user.id)
                return (
                    _base_response(
                        "You don't have any upcoming checkups to cancel.",
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
                    "label": f"{c.checkup_type} - {c.appointment_date} - {c.time_slot}",
                    "value": str(c.id),
                }
                for c in upcoming
            ]
            return (
                _base_response(
                    "Which checkup would you like to cancel?",
                    options,
                    STEP_CHOOSE_ACTION,
                ),
                session,
            )

        _touch_session(db, session)
        return (
            _base_response(
                "Please choose an option to continue.",
                ["Book Checkup", "View Checkups", "Cancel Checkup"],
                STEP_CHOOSE_ACTION,
            ),
            session,
        )

    if step == STEP_SELECT_DEPARTMENT:
        department = str(value).strip()
        if department not in DEPARTMENTS:
            _touch_session(db, session)
            return _base_response(
                "Select department",
                _department_options(),
                STEP_SELECT_DEPARTMENT,
            ), session
        context["department"] = department
        session.current_step = STEP_SELECT_CHECKUP_TYPE
        session.context = context
        _touch_session(db, session)
        options = CHECKUP_TYPES_BY_DEPARTMENT.get(department, CHECKUP_TYPES)
        return _base_response(
            "What type of checkup do you want?",
            options,
            STEP_SELECT_CHECKUP_TYPE,
        ), session

    if step == STEP_SELECT_CHECKUP_TYPE:
        selection = str(value).strip()
        department = context.get("department")
        allowed = CHECKUP_TYPES_BY_DEPARTMENT.get(department, CHECKUP_TYPES)
        if selection not in allowed:
            _touch_session(db, session)
            return _base_response(
                "Please choose a checkup type.",
                allowed,
                STEP_SELECT_CHECKUP_TYPE,
            ), session
        context["checkup_type"] = selection
        context["tests_selected"] = []
        session.current_step = STEP_SELECT_TESTS
        session.context = context
        _touch_session(db, session)
        options = TEST_OPTIONS + ["Done"]
        return _base_response("Select tests", options, STEP_SELECT_TESTS), session

    if step == STEP_SELECT_TESTS:
        selection = str(value).strip()
        selected = list(context.get("tests_selected") or [])
        if selection.lower() == "done":
            if not selected:
                _touch_session(db, session)
                return _base_response(
                    "Please select at least one test.",
                    TEST_OPTIONS + ["Done"],
                    STEP_SELECT_TESTS,
                ), session
            session.current_step = STEP_SELECT_DOCTOR
            session.context = context
            _touch_session(db, session)
            doctors = _doctor_options(db)
            return _base_response(
                "Select doctor (optional)",
                doctors + ["No preference"],
                STEP_SELECT_DOCTOR,
            ), session
        if selection in TEST_OPTIONS and selection not in selected:
            selected.append(selection)
        context["tests_selected"] = selected
        session.context = context
        _touch_session(db, session)
        return _base_response(
            "Select tests (choose more or Done)",
            TEST_OPTIONS + ["Done"],
            STEP_SELECT_TESTS,
        ), session

    if step == STEP_SELECT_DOCTOR:
        doctor_name = str(value).strip()
        department = context.get("department")
        if doctor_name.lower() == "no preference":
            doctor = _get_default_doctor(db, department)
        else:
            doctor = (
                db.query(Doctor)
                .filter(
                    Doctor.name == doctor_name,
                    Doctor.is_active.is_(True),
                    Doctor.department == department,
                )
                .first()
            )
        if not doctor:
            doctors = _doctor_options(db, department)
            _touch_session(db, session)
            return _base_response(
                "Please choose a valid doctor or No preference.",
                doctors + ["No preference"],
                STEP_SELECT_DOCTOR,
            ), session
        context["doctor_id"] = str(doctor.id)
        context["doctor_name"] = doctor.name
        context["hospital_id"] = str(doctor.hospital_id) if doctor.hospital_id else None
        hospital = db.query(Hospital).filter(Hospital.id == doctor.hospital_id).first()
        if hospital:
            context["hospital_name"] = hospital.name
        session.current_step = STEP_SELECT_DAY_TYPE
        session.context = context
        _touch_session(db, session)
        return _base_response(
            "Choose appointment type",
            ["Today", "Next Available"],
            STEP_SELECT_DAY_TYPE,
        ), session

    if step == STEP_SELECT_DAY_TYPE:
        selection = str(value).strip().lower()
        doctor_id = context.get("doctor_id")
        if not doctor_id:
            session.current_step = STEP_SELECT_DOCTOR
            session.context = context
            _touch_session(db, session)
            return _base_response(
                "Select doctor",
                _doctor_options(db, context.get("department")) + ["No preference"],
                STEP_SELECT_DOCTOR,
            ), session
        if selection == "today":
            chosen_date = date.today()
            context["appointment_date"] = chosen_date.isoformat()
            session.context = context
            slots = _slot_options(db, doctor_id, chosen_date)
            if not slots:
                _touch_session(db, session)
                return _base_response(
                    f"No slots available on {_human_date(chosen_date)}. Please choose another.",
                    ["Today", "Next Available"],
                    STEP_SELECT_DAY_TYPE,
                ), session
            session.current_step = STEP_SELECT_TIME_SLOT
            _touch_session(db, session)
            return _base_response("Select time slot", slots, STEP_SELECT_TIME_SLOT), session
        if selection == "next available":
            session.current_step = STEP_SELECT_DATE
            session.context = context
            _touch_session(db, session)
            return _base_response("Select date", step=STEP_SELECT_DATE), session
        _touch_session(db, session)
        return _base_response(
            "Please choose Today or Next Available.",
            ["Today", "Next Available"],
            STEP_SELECT_DAY_TYPE,
        ), session

    if step == STEP_SELECT_DATE:
        doctor_id = context.get("doctor_id")
        if not doctor_id:
            session.current_step = STEP_SELECT_DOCTOR
            session.context = context
            _touch_session(db, session)
            return _base_response(
                "Select doctor",
                _doctor_options(db, context.get("department")) + ["No preference"],
                STEP_SELECT_DOCTOR,
            ), session

        parsed = _parse_date(str(value))
        if not parsed:
            _touch_session(db, session)
            return _base_response("Please select a valid date.", step=STEP_SELECT_DATE), session

        context["appointment_date"] = parsed.isoformat()
        session.context = context
        slots = _slot_options(db, doctor_id, parsed)
        if not slots:
            _touch_session(db, session)
            return _base_response(
                f"No slots available on {_human_date(parsed)}. Please choose another date.",
                step=STEP_SELECT_DATE,
            ), session

        session.current_step = STEP_SELECT_TIME_SLOT
        _touch_session(db, session)
        return _base_response("Select time slot", slots, STEP_SELECT_TIME_SLOT), session

    if step == STEP_SELECT_TIME_SLOT:
        time_slot = str(value).strip()
        doctor_id = context.get("doctor_id")
        appointment_date_value = context.get("appointment_date")
        parsed_date = _parse_date(str(appointment_date_value)) if appointment_date_value else None

        if not doctor_id or not parsed_date:
            session.current_step = STEP_SELECT_DAY_TYPE
            session.context = context
            _touch_session(db, session)
            return _base_response(
                "Choose appointment type",
                ["Today", "Next Available"],
                STEP_SELECT_DAY_TYPE,
            ), session

        available = _slot_options(db, doctor_id, parsed_date)
        if time_slot not in available:
            if not available:
                _touch_session(db, session)
                return _base_response(
                    "No time slots are available for that date. Please pick another.",
                    ["Today", "Next Available"],
                    STEP_SELECT_DAY_TYPE,
                ), session
            return _base_response(
                "That time slot is no longer available. Please choose another.",
                available,
                STEP_SELECT_TIME_SLOT,
            ), session

        context["time_slot"] = time_slot
        session.current_step = STEP_ENTER_NOTES
        session.context = context
        _touch_session(db, session)
        return _base_response(
            "What is reason or notes?",
            step=STEP_ENTER_NOTES,
        ), session

    if step == STEP_ENTER_NOTES:
        notes = str(value).strip()
        context["notes"] = notes
        session.current_step = STEP_CONFIRM_CHECKUP
        session.context = context
        _touch_session(db, session)
        summary = "\n".join(_format_summary(context))
        return _base_response(
            f"Checkup Summary:\n{summary}",
            ["Confirm", "Cancel"],
            STEP_CONFIRM_CHECKUP,
        ), session

    if step == STEP_CONFIRM_CHECKUP:
        choice = str(value).strip().lower()
        if choice == "cancel":
            _clear_session(db, user.id)
            return _base_response("No problem. I've cancelled this checkup request.", step=STEP_COMPLETED), None
        if choice not in {"confirm", "yes", "yes confirm"}:
            _touch_session(db, session)
            return _base_response(
                "Please choose Confirm or Cancel.",
                ["Confirm", "Cancel"],
                STEP_CONFIRM_CHECKUP,
            ), session

        appointment_date = _parse_date(str(context.get("appointment_date")))
        time_slot = str(context.get("time_slot", ""))
        doctor_id = context.get("doctor_id")
        hospital_id = context.get("hospital_id") or (str(user.hospital_id) if user.hospital_id else None)

        if not appointment_date or not time_slot or not doctor_id:
            session = _reset_session(db, user.id, STEP_SELECT_DEPARTMENT, {})
            return _base_response(
                "I'm missing some details. Let's start again.",
                _department_options(),
                STEP_SELECT_DEPARTMENT,
            ), session

        if not hospital_id:
            session = _reset_session(db, user.id, STEP_SELECT_DEPARTMENT, {})
            return _base_response(
                "Hospital not found. Let's start again.",
                _department_options(),
                STEP_SELECT_DEPARTMENT,
            ), session

        doctor = None
        for candidate in _doctor_id_variants(doctor_id):
            try:
                doctor = db.query(Doctor).filter(Doctor.id == candidate).first()
                if doctor:
                    break
            except Exception:
                continue
        if not doctor:
            session = _reset_session(db, user.id, STEP_SELECT_DEPARTMENT, {})
            return _base_response(
                "Doctor not found. Please restart the booking.",
                _department_options(),
                STEP_SELECT_DEPARTMENT,
            ), session

        try:
            create_checkup(
                db=db,
                user_id=str(user.id),
                hospital_id=str(hospital_id),
                doctor_id=str(doctor.id),
                checkup_type=context.get("checkup_type"),
                tests_selected=context.get("tests_selected") or [],
                appointment_date=appointment_date,
                time_slot=time_slot,
                notes=context.get("notes"),
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
            logger.exception("Checkup booking transaction failed")
            session = _reset_session(db, user.id, STEP_SELECT_DEPARTMENT, {})
            return _base_response(
                "Something went wrong while booking. Let's start again.",
                _department_options(),
                STEP_SELECT_DEPARTMENT,
            ), session

        _clear_session(db, user.id)
        return _base_response("✅ Your checkup is booked successfully", step=STEP_COMPLETED), None

    return _base_response("Let's continue your checkup flow.", step=step), session
