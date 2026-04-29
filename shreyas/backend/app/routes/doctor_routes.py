from __future__ import annotations

from datetime import date as date_type
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List

from app.core.dependencies import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.models.doctor import Doctor
from app.appointments.service import get_available_slots_for_date
from app.services import nurse_service


router = APIRouter(tags=["Doctor"])


@router.get("/doctors/{doctor_id}/slots", response_model=List[str])
async def get_doctor_slots(
    doctor_id: str,
    date: str = Query(..., min_length=1),
    db: Session = Depends(get_db),
    user_id=Depends(get_current_user),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.role != "parent":
        raise HTTPException(status_code=403, detail="Only parents can access slots")
    try:
        target_date = date_type.fromisoformat(date.strip())
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date value.")
    return get_available_slots_for_date(db, doctor_id, target_date)


@router.get("/doctor/my-schedule")
async def my_schedule(
    date: str | None = Query(default=None),
    db: Session = Depends(get_db),
    user_id=Depends(get_current_user),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.role != "doctor":
        raise HTTPException(status_code=403, detail="Only doctors can access this schedule")
    doctor = db.query(Doctor).filter(Doctor.user_id == user.id).first()
    if not doctor:
        raise HTTPException(status_code=404, detail="Doctor profile not found")
    target_date = date_type.today()
    if date:
        try:
            target_date = date_type.fromisoformat(date.strip())
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid date value.")
    return nurse_service.get_doctor_schedule(db, doctor.id, target_date)
