from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from app.core.dependencies import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.models.doctor import Doctor
from app.checkups.schemas import CheckupListItem, CheckupDashboardItem
from app.checkups.service import (
    get_checkups_for_parent,
    get_checkups_for_doctor,
    get_checkups_for_nurse,
    get_active_for_user,
    build_checkup_list_items,
    build_checkup_dashboard_items,
)

router = APIRouter(prefix="/checkups", tags=["Checkups"])


@router.get("/parent", response_model=List[CheckupListItem])
def parent_checkups(
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if not user.is_verified:
        raise HTTPException(status_code=403, detail="User not verified")
    if user.role != "parent":
        raise HTTPException(status_code=403, detail="Only parents can access this list")

    checkups = get_checkups_for_parent(db, user)
    return build_checkup_list_items(db, checkups)


@router.get("/doctor", response_model=List[CheckupDashboardItem])
def doctor_checkups(
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

    checkups = get_checkups_for_doctor(db, doctor)
    return build_checkup_dashboard_items(db, checkups)


@router.get("/nurse", response_model=List[CheckupDashboardItem])
def nurse_checkups(
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
    if not user.hospital_id:
        raise HTTPException(status_code=400, detail="Nurse hospital not set")

    checkups = get_checkups_for_nurse(db, user.hospital_id)
    return build_checkup_dashboard_items(db, checkups)


@router.get("/active", response_model=List[CheckupListItem])
def active_checkups(
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

    checkups = get_active_for_user(db, user)
    return build_checkup_list_items(db, checkups)
