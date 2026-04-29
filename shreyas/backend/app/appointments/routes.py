from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from app.appointments.schemas import (
    AppointmentOut,
    AppointmentCancelRequest,
    AppointmentStatusUpdate,
    AppointmentListItem,
    AppointmentDashboardItem,
)
from app.appointments.service import (
    get_upcoming_for_user,
    get_past_for_user,
    get_current_for_user,
    cancel_appointment,
    update_appointment_status,
    build_appointment_list_items,
    build_dashboard_items,
)
from app.core.dependencies import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.models.doctor import Doctor
from app.models.appointment import Appointment

router = APIRouter(prefix="/appointments", tags=["Appointments"])


# ================= ROUTES =================

@router.get("/upcoming", response_model=List[AppointmentListItem])
def upcoming_appointments(
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user),
):
    user = db.query(User).filter(User.id == user_id).first()

    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if not user.is_verified:
        raise HTTPException(status_code=403, detail="User not verified")

    if user.role not in {"parent", "doctor", "nurse"}:
        raise HTTPException(status_code=403, detail="Invalid user role")

    if user.role == "nurse" and not user.hospital_id:
        raise HTTPException(status_code=400, detail="Nurse hospital not set")

    appointments = get_upcoming_for_user(db, user)
    return build_appointment_list_items(db, appointments)


@router.get("/past", response_model=List[AppointmentListItem])
def past_appointments(
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user),
):
    user = db.query(User).filter(User.id == user_id).first()

    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if not user.is_verified:
        raise HTTPException(status_code=403, detail="User not verified")

    if user.role not in {"parent", "doctor", "nurse"}:
        raise HTTPException(status_code=403, detail="Invalid user role")

    if user.role == "nurse" and not user.hospital_id:
        raise HTTPException(status_code=400, detail="Nurse hospital not set")

    appointments = get_past_for_user(db, user)
    return build_appointment_list_items(db, appointments)


@router.post("/cancel")
def cancel(
    data: AppointmentCancelRequest,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user),
):
    user = db.query(User).filter(User.id == user_id).first()

    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if not user.is_verified:
        raise HTTPException(status_code=403, detail="User not verified")

    if user.role not in {"parent", "doctor", "nurse"}:
        raise HTTPException(status_code=403, detail="Invalid user role")

    appointment, error = cancel_appointment(db, data.appointment_id, user)

    if error:
        raise HTTPException(status_code=400, detail=error)

    return {"message": "Appointment cancelled successfully"}


@router.patch("/{appointment_id}/status", response_model=AppointmentOut)
def update_status(
    appointment_id: str,
    data: AppointmentStatusUpdate,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user),
):
    user = db.query(User).filter(User.id == user_id).first()

    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if not user.is_verified:
        raise HTTPException(status_code=403, detail="User not verified")

    if user.role not in {"parent", "doctor", "nurse"}:
        raise HTTPException(status_code=403, detail="Invalid user role")

    appointment, error = update_appointment_status(
        db, appointment_id, user, data.status
    )

    if error:
        raise HTTPException(status_code=400, detail=error)

    return appointment


@router.get("/doctor", response_model=List[AppointmentDashboardItem])
def doctor_appointments(
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user),
):
    user = db.query(User).filter(User.id == user_id).first()

    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if not user.is_verified:
        raise HTTPException(status_code=403, detail="User not verified")

    if user.role != "doctor":
        raise HTTPException(status_code=403, detail="Only doctors can access this list")

    doctor = db.query(Doctor).filter(Doctor.user_id == user.id).first()
    if not doctor:
        raise HTTPException(status_code=404, detail="Doctor profile not found")

    appointments = (
        db.query(Appointment)
        .filter(Appointment.doctor_id == doctor.id)
        .order_by(Appointment.appointment_date.asc(), Appointment.time_slot.asc())
        .all()
    )

    return build_dashboard_items(db, appointments)


@router.get("/nurse", response_model=List[AppointmentDashboardItem])
def nurse_appointments(
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user),
):
    user = db.query(User).filter(User.id == user_id).first()

    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if not user.is_verified:
        raise HTTPException(status_code=403, detail="User not verified")

    if user.role != "nurse":
        raise HTTPException(status_code=403, detail="Only nurses can access this list")

    appointments = (
        db.query(Appointment)
        .order_by(Appointment.appointment_date.asc(), Appointment.time_slot.asc())
        .all()
    )

    return build_dashboard_items(db, appointments)


@router.get("/current", response_model=List[AppointmentListItem])
def current_appointments(
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user),
):
    user = db.query(User).filter(User.id == user_id).first()

    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if not user.is_verified:
        raise HTTPException(status_code=403, detail="User not verified")

    if user.role not in {"parent", "doctor", "nurse"}:
        raise HTTPException(status_code=403, detail="Invalid user role")

    if user.role == "nurse" and not user.hospital_id:
        raise HTTPException(status_code=400, detail="Nurse hospital not set")

    appointments = get_current_for_user(db, user)
    return build_appointment_list_items(db, appointments)
