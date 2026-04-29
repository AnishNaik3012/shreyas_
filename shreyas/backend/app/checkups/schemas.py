from pydantic import BaseModel
from typing import List, Optional


class CheckupListItem(BaseModel):
    id: str
    checkup_type: str
    tests_selected: Optional[List[str]] = None
    appointment_date: str
    time_slot: str
    doctor_name: Optional[str] = None
    hospital_name: Optional[str] = None
    status: str
    priority: Optional[str] = None
    report_url: Optional[str] = None
    remarks: Optional[str] = None
    notes: Optional[str] = None


class CheckupDashboardItem(BaseModel):
    id: str
    patient_name: Optional[str] = None
    doctor_name: Optional[str] = None
    hospital_name: Optional[str] = None
    checkup_type: str
    tests_selected: Optional[List[str]] = None
    appointment_date: str
    time_slot: str
    status: str
    priority: Optional[str] = None
    report_url: Optional[str] = None
    remarks: Optional[str] = None
    notes: Optional[str] = None
