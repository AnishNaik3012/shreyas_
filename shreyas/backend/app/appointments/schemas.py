from pydantic import BaseModel
from datetime import date, datetime
from typing import Optional


class AppointmentOut(BaseModel):
    id: str
    user_id: str
    hospital_id: str
    doctor_id: str
    department: str
    appointment_date: date
    time_slot: str
    reason: Optional[str] = None
    symptoms: Optional[str] = None
    status: str
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class AppointmentCancelRequest(BaseModel):
    appointment_id: str


class AppointmentStatusUpdate(BaseModel):
    status: str


class AppointmentListItem(BaseModel):
    id: str
    appointment_date: date
    time_slot: str
    department: str
    doctor_name: str
    hospital_name: str
    status: str


class AppointmentDashboardItem(BaseModel):
    id: str
    patient_name: str
    doctor_name: str
    department: str
    appointment_date: date
    time_slot: str
    reason: Optional[str] = None
    status: str
