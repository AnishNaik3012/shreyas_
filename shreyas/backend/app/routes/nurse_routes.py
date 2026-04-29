from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File
from pydantic import BaseModel
from sqlalchemy.orm import Session
from typing import List, Optional
import logging
from pathlib import Path
import uuid
from datetime import date as date_type

from app.core.dependencies import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.services import nurse_service


router = APIRouter(prefix="/nurse", tags=["Nurse"])
logger = logging.getLogger("app.nurse_routes")


class DepartmentOut(BaseModel):
    department: str


class DoctorOut(BaseModel):
    doctor_id: str
    name: str
    department: str
    is_active: bool
    status: Optional[str] = None
    working_hours: Optional[str] = None
    appointments_today: Optional[int] = None


class NurseAppointmentOut(BaseModel):
    appointment_id: str
    patient_name: str
    date: str
    time: str
    status: str
    priority: str


class NurseAppointmentDashboardOut(BaseModel):
    appointment_id: str
    patient_name: str
    doctor_name: str
    department: str
    date: str
    time: str
    status: str
    priority: str


class NurseCheckupOut(BaseModel):
    checkup_id: str
    patient_name: str
    date: str
    time: str
    status: str
    priority: str


class NurseCheckupDashboardOut(BaseModel):
    checkup_id: str
    patient_name: str
    doctor_name: str
    department: str
    checkup_type: Optional[str] = None
    date: str
    time: str
    status: str
    priority: str
    reason: Optional[str] = None
    report_url: Optional[str] = None
    remarks: Optional[str] = None


class PriorityUpdateIn(BaseModel):
    priority: str


class RemarksUpdateIn(BaseModel):
    remarks: str


class CheckupTypeOut(BaseModel):
    checkup_type: str


class DoctorAvailabilityIn(BaseModel):
    date: str
    start_time: str
    end_time: str
    slot_duration: int
    status: str


class DoctorStatusUpdateIn(BaseModel):
    date: str
    status: str


class DoctorScheduleOut(BaseModel):
    availability: List[dict]
    slots: List[dict]
    appointments: List[dict]
    workload: dict
    patient_count: int


class DoctorAppointmentOut(BaseModel):
    patient_name: str
    time_slot: str
    status: str
    priority: str

class NursePatientOut(BaseModel):
    patient_id: str
    patient_name: str
    age: Optional[int] = None
    last_appointment: Optional[str] = None
    last_checkup: Optional[str] = None


class PatientProfileOut(BaseModel):
    patient_id: str
    patient_name: str
    age: Optional[int] = None
    blood_group: Optional[str] = None
    phone: Optional[str] = None
    medical_history: Optional[str] = None


class PatientAppointmentOut(BaseModel):
    appointment_id: str
    doctor_name: str
    department: str
    date: str
    time: str
    status: str
    priority: str


class PatientCheckupOut(BaseModel):
    checkup_id: str
    doctor_name: str
    checkup_type: Optional[str] = None
    date: str
    time: str
    status: str
    priority: str
    report_url: Optional[str] = None
    remarks: Optional[str] = None


class PatientDetailOut(BaseModel):
    patient: PatientProfileOut
    appointments: List[PatientAppointmentOut]
    checkups: List[PatientCheckupOut]


class PatientVitalIn(BaseModel):
    blood_pressure: Optional[str] = None
    heart_rate: Optional[str] = None
    temperature: Optional[str] = None
    respiratory_rate: Optional[str] = None
    oxygen_saturation: Optional[str] = None
    weight: Optional[str] = None
    notes: Optional[str] = None


class PatientVitalOut(BaseModel):
    vital_id: str
    blood_pressure: Optional[str] = None
    heart_rate: Optional[str] = None
    temperature: Optional[str] = None
    respiratory_rate: Optional[str] = None
    oxygen_saturation: Optional[str] = None
    weight: Optional[str] = None
    notes: Optional[str] = None
    recorded_at: Optional[str] = None


class PatientReportOut(BaseModel):
    checkup_id: str
    checkup_type: Optional[str] = None
    date: str
    report_url: str


class PatientPrescriptionOut(BaseModel):
    prescription_id: str
    title: Optional[str] = None
    date: Optional[str] = None


def _get_current_nurse(db: Session, user_id) -> User:
    user = db.query(User).filter(User.id == user_id).first()

    if not user:
        logger.warning("Nurse access denied: user not found (user_id=%s)", user_id)
        raise HTTPException(status_code=404, detail="User not found")

    if not user.is_verified:
        logger.warning("Nurse access denied: user not verified (user_id=%s)", user.id)
        raise HTTPException(status_code=403, detail="User not verified")

    if user.role != "nurse":
        logger.warning(
            "Nurse access denied: invalid role (user_id=%s role=%s)",
            user.id,
            user.role,
        )
        raise HTTPException(status_code=403, detail="Only nurses can access this list")

    if not user.hospital_id:
        logger.warning(
            "Nurse access denied: hospital not set (user_id=%s)", user.id
        )
        raise HTTPException(status_code=400, detail="Nurse hospital not set")

    return user


@router.get("/departments", response_model=List[DepartmentOut])
async def list_departments(
    db: Session = Depends(get_db),
    user_id=Depends(get_current_user),
):
    user = _get_current_nurse(db, user_id)
    return nurse_service.get_departments(db, user.hospital_id)


@router.get("/checkups/departments", response_model=List[DepartmentOut])
async def list_checkup_departments(
    db: Session = Depends(get_db),
    user_id=Depends(get_current_user),
):
    user = _get_current_nurse(db, user_id)
    return nurse_service.get_departments(db, user.hospital_id)


@router.get("/checkups/types", response_model=List[CheckupTypeOut])
async def list_checkup_types(
    department: str = Query(..., min_length=1),
    db: Session = Depends(get_db),
    user_id=Depends(get_current_user),
):
    user = _get_current_nurse(db, user_id)
    return nurse_service.get_checkup_types_for_department(
        db, user.hospital_id, department.strip()
    )


@router.get("/doctors", response_model=List[DoctorOut])
async def list_doctors(
    department: Optional[str] = Query(default=None),
    date: Optional[str] = Query(default=None),
    db: Session = Depends(get_db),
    user_id=Depends(get_current_user),
):
    user = _get_current_nurse(db, user_id)
    target_date = None
    if date:
        try:
            target_date = date_type.fromisoformat(date.strip())
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid date value.")
    return nurse_service.get_doctors_for_hospital(
        db,
        user.hospital_id,
        department.strip() if department else None,
        target_date,
    )


@router.get("/checkups/doctors", response_model=List[DoctorOut])
async def list_checkup_doctors(
    department: str = Query(..., min_length=1),
    db: Session = Depends(get_db),
    user_id=Depends(get_current_user),
):
    user = _get_current_nurse(db, user_id)
    doctors = nurse_service.get_doctors_for_department(
        db, user.hospital_id, department.strip()
    )
    return [
        {
            "doctor_id": str(doctor.id),
            "name": doctor.name,
            "department": doctor.department,
        }
        for doctor in doctors
    ]


@router.get("/appointments/doctor", response_model=List[NurseAppointmentOut])
async def list_appointments_for_doctor(
    doctor_id: str = Query(..., min_length=1),
    db: Session = Depends(get_db),
    user_id=Depends(get_current_user),
):
    user = _get_current_nurse(db, user_id)
    doctor = nurse_service.get_doctor_for_hospital(db, user.hospital_id, doctor_id)
    if not doctor:
        raise HTTPException(status_code=404, detail="Doctor not found")

    items = nurse_service.get_appointments_for_doctor(
        db, user.hospital_id, doctor_id
    )
    if items is None:
        raise HTTPException(status_code=400, detail="Invalid doctor id")
    return items


@router.get("/appointments", response_model=List[NurseAppointmentDashboardOut])
async def list_hospital_appointments(
    department: Optional[str] = Query(default=None),
    doctor_id: Optional[str] = Query(default=None),
    status: Optional[str] = Query(default=None),
    priority: Optional[str] = Query(default=None),
    date: Optional[str] = Query(default=None),
    db: Session = Depends(get_db),
    user_id=Depends(get_current_user),
):
    user = _get_current_nurse(db, user_id)
    items, error = nurse_service.get_hospital_appointments(
        db=db,
        hospital_id=user.hospital_id,
        department=department,
        doctor_id=doctor_id,
        status=status,
        priority=priority,
        date=date,
    )
    if error:
        raise HTTPException(status_code=400, detail=error)
    return items


@router.patch("/appointments/{appointment_id}/complete")
async def complete_appointment(
    appointment_id: str,
    db: Session = Depends(get_db),
    user_id=Depends(get_current_user),
):
    user = _get_current_nurse(db, user_id)
    appointment, error = nurse_service.complete_appointment(
        db, user.hospital_id, appointment_id
    )
    if error:
        status_code = 404 if error == "Appointment not found." else 400
        raise HTTPException(status_code=status_code, detail=error)
    return {
        "appointment_id": str(appointment.id),
        "status": appointment.status,
    }


@router.patch("/appointments/{appointment_id}/cancel")
async def cancel_appointment(
    appointment_id: str,
    db: Session = Depends(get_db),
    user_id=Depends(get_current_user),
):
    user = _get_current_nurse(db, user_id)
    appointment, error = nurse_service.cancel_appointment(
        db, user.hospital_id, appointment_id
    )
    if error:
        status_code = 404 if error == "Appointment not found." else 400
        raise HTTPException(status_code=status_code, detail=error)
    return {
        "appointment_id": str(appointment.id),
        "status": appointment.status,
    }


@router.patch("/appointments/{appointment_id}/priority")
async def set_priority(
    appointment_id: str,
    payload: PriorityUpdateIn,
    db: Session = Depends(get_db),
    user_id=Depends(get_current_user),
):
    user = _get_current_nurse(db, user_id)
    appointment, error = nurse_service.set_appointment_priority(
        db, user.hospital_id, appointment_id, payload.priority
    )
    if error:
        status_code = 404 if error == "Appointment not found." else 400
        raise HTTPException(status_code=status_code, detail=error)
    return {
        "appointment_id": str(appointment.id),
        "priority": appointment.priority,
    }


@router.get("/checkups", response_model=List[NurseCheckupDashboardOut])
async def list_hospital_checkups(
    department: Optional[str] = Query(default=None),
    doctor_id: Optional[str] = Query(default=None),
    checkup_type: Optional[str] = Query(default=None),
    status: Optional[str] = Query(default=None),
    priority: Optional[str] = Query(default=None),
    date: Optional[str] = Query(default=None),
    db: Session = Depends(get_db),
    user_id=Depends(get_current_user),
):
    user = _get_current_nurse(db, user_id)
    items, error = nurse_service.get_hospital_checkups(
        db=db,
        hospital_id=user.hospital_id,
        department=department,
        doctor_id=doctor_id,
        checkup_type=checkup_type,
        status=status,
        priority=priority,
        date=date,
    )
    if error:
        raise HTTPException(status_code=400, detail=error)
    return items


@router.patch("/checkups/{checkup_id}/complete")
async def complete_checkup(
    checkup_id: str,
    db: Session = Depends(get_db),
    user_id=Depends(get_current_user),
):
    user = _get_current_nurse(db, user_id)
    checkup, error = nurse_service.complete_checkup(
        db, user.hospital_id, checkup_id
    )
    if error:
        status_code = 404 if error == "Checkup not found." else 400
        raise HTTPException(status_code=status_code, detail=error)
    return {
        "checkup_id": str(checkup.id),
        "status": checkup.status,
    }


@router.patch("/checkups/{checkup_id}/cancel")
async def cancel_checkup(
    checkup_id: str,
    db: Session = Depends(get_db),
    user_id=Depends(get_current_user),
):
    user = _get_current_nurse(db, user_id)
    checkup, error = nurse_service.cancel_checkup(
        db, user.hospital_id, checkup_id
    )
    if error:
        status_code = 404 if error == "Checkup not found." else 400
        raise HTTPException(status_code=status_code, detail=error)
    return {
        "checkup_id": str(checkup.id),
        "status": checkup.status,
    }


@router.patch("/checkups/{checkup_id}/priority")
async def set_checkup_priority(
    checkup_id: str,
    payload: PriorityUpdateIn,
    db: Session = Depends(get_db),
    user_id=Depends(get_current_user),
):
    user = _get_current_nurse(db, user_id)
    checkup, error = nurse_service.set_checkup_priority(
        db, user.hospital_id, checkup_id, payload.priority
    )
    if error:
        status_code = 404 if error == "Checkup not found." else 400
        raise HTTPException(status_code=status_code, detail=error)
    return {
        "checkup_id": str(checkup.id),
        "priority": checkup.priority,
    }


@router.patch("/checkups/{checkup_id}/remarks")
async def set_checkup_remarks(
    checkup_id: str,
    payload: RemarksUpdateIn,
    db: Session = Depends(get_db),
    user_id=Depends(get_current_user),
):
    user = _get_current_nurse(db, user_id)
    checkup, error = nurse_service.set_checkup_remarks(
        db, user.hospital_id, checkup_id, payload.remarks
    )
    if error:
        status_code = 404 if error == "Checkup not found." else 400
        raise HTTPException(status_code=status_code, detail=error)
    return {
        "checkup_id": str(checkup.id),
        "remarks": checkup.remarks,
    }


@router.post("/checkups/{checkup_id}/report")
async def upload_checkup_report(
    checkup_id: str,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user_id=Depends(get_current_user),
):
    user = _get_current_nurse(db, user_id)
    if not file:
        raise HTTPException(status_code=400, detail="Report file is required.")

    content_type = (file.content_type or "").lower()
    allowed = {"application/pdf", "image/png", "image/jpeg"}
    if content_type not in allowed:
        raise HTTPException(
            status_code=400,
            detail="Invalid report type. Upload PDF, PNG, or JPEG.",
        )

    ext = ".pdf" if content_type == "application/pdf" else ".png"
    if content_type == "image/jpeg":
        ext = ".jpg"

    uploads_dir = Path(__file__).resolve().parents[2] / "uploads" / "checkup_reports"
    uploads_dir.mkdir(parents=True, exist_ok=True)
    file_name = f"{uuid.uuid4().hex}{ext}"
    file_path = uploads_dir / file_name
    file_path.write_bytes(await file.read())

    report_url = f"/uploads/checkup_reports/{file_name}"
    checkup, error = nurse_service.set_checkup_report_url(
        db, user.hospital_id, checkup_id, report_url
    )
    if error:
        status_code = 404 if error == "Checkup not found." else 400
        raise HTTPException(status_code=status_code, detail=error)
    return {
        "checkup_id": str(checkup.id),
        "report_url": checkup.report_url,
    }


@router.get("/doctors/{doctor_id}/schedule", response_model=DoctorScheduleOut)
async def get_doctor_schedule(
    doctor_id: str,
    date: Optional[str] = Query(default=None),
    db: Session = Depends(get_db),
    user_id=Depends(get_current_user),
):
    user = _get_current_nurse(db, user_id)
    doctor = nurse_service.get_doctor_for_hospital(db, user.hospital_id, doctor_id)
    if not doctor:
        raise HTTPException(status_code=404, detail="Doctor not found")
    target_date = date_type.today()
    if date:
        try:
            target_date = date_type.fromisoformat(date.strip())
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid date value.")
    return nurse_service.get_doctor_schedule(db, doctor.id, target_date)


@router.post("/doctors/{doctor_id}/availability")
async def create_doctor_availability(
    doctor_id: str,
    payload: DoctorAvailabilityIn,
    db: Session = Depends(get_db),
    user_id=Depends(get_current_user),
):
    user = _get_current_nurse(db, user_id)
    doctor = nurse_service.get_doctor_for_hospital(db, user.hospital_id, doctor_id)
    if not doctor:
        raise HTTPException(status_code=404, detail="Doctor not found")
    try:
        date_value = date_type.fromisoformat(payload.date.strip())
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date value.")
    status_value = (payload.status or "").strip().lower()
    if status_value not in {"available", "unavailable", "leave", "emergency"}:
        raise HTTPException(status_code=400, detail="Invalid status value.")
    rows = nurse_service.set_doctor_availability(
        db,
        user.hospital_id,
        doctor.id,
        date_value,
        payload.start_time,
        payload.end_time,
        payload.slot_duration,
        status_value,
    )
    if not rows:
        raise HTTPException(status_code=400, detail="Invalid time range or slot duration.")
    return {"message": "Availability updated", "slots": len(rows)}


@router.patch("/doctors/{doctor_id}/status")
async def update_doctor_status(
    doctor_id: str,
    payload: DoctorStatusUpdateIn,
    db: Session = Depends(get_db),
    user_id=Depends(get_current_user),
):
    user = _get_current_nurse(db, user_id)
    doctor = nurse_service.get_doctor_for_hospital(db, user.hospital_id, doctor_id)
    if not doctor:
        raise HTTPException(status_code=404, detail="Doctor not found")
    try:
        date_value = date_type.fromisoformat(payload.date.strip())
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date value.")
    status_value = (payload.status or "").strip().lower()
    if status_value not in {"available", "unavailable", "leave", "emergency"}:
        raise HTTPException(status_code=400, detail="Invalid status value.")
    updated = nurse_service.update_doctor_availability_status(
        db, doctor.id, date_value, status_value
    )
    if updated == 0:
        raise HTTPException(status_code=404, detail="No availability rows found.")
    return {"message": "Status updated", "updated": updated}


@router.get("/doctors/{doctor_id}/appointments", response_model=List[DoctorAppointmentOut])
async def list_doctor_appointments(
    doctor_id: str,
    date: Optional[str] = Query(default=None),
    db: Session = Depends(get_db),
    user_id=Depends(get_current_user),
):
    user = _get_current_nurse(db, user_id)
    doctor = nurse_service.get_doctor_for_hospital(db, user.hospital_id, doctor_id)
    if not doctor:
        raise HTTPException(status_code=404, detail="Doctor not found")
    target_date = date_type.today()
    if date:
        try:
            target_date = date_type.fromisoformat(date.strip())
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid date value.")
    return nurse_service.get_doctor_appointments(db, doctor.id, target_date)


@router.get("/patients", response_model=List[NursePatientOut])
async def list_patients(
    db: Session = Depends(get_db),
    user_id=Depends(get_current_user),
):
    user = _get_current_nurse(db, user_id)
    return nurse_service.get_patient_summaries(db, user.hospital_id)


@router.get("/patients/{patient_id}", response_model=PatientDetailOut)
async def get_patient_detail(
    patient_id: str,
    db: Session = Depends(get_db),
    user_id=Depends(get_current_user),
):
    user = _get_current_nurse(db, user_id)
    patient, error = nurse_service.get_patient_profile(
        db, user.hospital_id, patient_id
    )
    if error:
        raise HTTPException(status_code=404, detail=error)
    patient_uuid = nurse_service._coerce_uuid(patient_id)
    if not patient_uuid:
        raise HTTPException(status_code=400, detail="Invalid patient id.")
    appointments = nurse_service.get_patient_appointments(
        db, user.hospital_id, patient_uuid
    )
    checkups = nurse_service.get_patient_checkups(
        db, user.hospital_id, patient_uuid
    )
    return {
        "patient": {
            "patient_id": str(patient.id),
            "patient_name": patient.full_name or "Unknown",
            "age": None,
            "blood_group": None,
            "phone": patient.phone,
            "medical_history": None,
        },
        "appointments": appointments,
        "checkups": checkups,
    }


@router.get("/patients/{patient_id}/vitals", response_model=List[PatientVitalOut])
async def list_patient_vitals(
    patient_id: str,
    db: Session = Depends(get_db),
    user_id=Depends(get_current_user),
):
    user = _get_current_nurse(db, user_id)
    patient_uuid = nurse_service._coerce_uuid(patient_id)
    if not patient_uuid:
        raise HTTPException(status_code=400, detail="Invalid patient id.")
    patient, error = nurse_service.get_patient_profile(
        db, user.hospital_id, patient_id
    )
    if error or not patient:
        raise HTTPException(status_code=404, detail="Patient not found.")
    return nurse_service.get_patient_vitals(db, user.hospital_id, patient_uuid)


@router.post("/patients/{patient_id}/vitals", response_model=PatientVitalOut)
async def create_patient_vitals(
    patient_id: str,
    payload: PatientVitalIn,
    db: Session = Depends(get_db),
    user_id=Depends(get_current_user),
):
    user = _get_current_nurse(db, user_id)
    patient_uuid = nurse_service._coerce_uuid(patient_id)
    if not patient_uuid:
        raise HTTPException(status_code=400, detail="Invalid patient id.")
    patient, error = nurse_service.get_patient_profile(
        db, user.hospital_id, patient_id
    )
    if error or not patient:
        raise HTTPException(status_code=404, detail="Patient not found.")
    vital = nurse_service.create_patient_vital(
        db,
        user.hospital_id,
        patient_uuid,
        payload.model_dump(),
    )
    return {
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


@router.get("/patients/{patient_id}/reports", response_model=List[PatientReportOut])
async def list_patient_reports(
    patient_id: str,
    db: Session = Depends(get_db),
    user_id=Depends(get_current_user),
):
    user = _get_current_nurse(db, user_id)
    patient_uuid = nurse_service._coerce_uuid(patient_id)
    if not patient_uuid:
        raise HTTPException(status_code=400, detail="Invalid patient id.")
    patient, error = nurse_service.get_patient_profile(
        db, user.hospital_id, patient_id
    )
    if error or not patient:
        raise HTTPException(status_code=404, detail="Patient not found.")
    return nurse_service.get_patient_reports(db, user.hospital_id, patient_uuid)


@router.get(
    "/patients/{patient_id}/prescriptions",
    response_model=List[PatientPrescriptionOut],
)
async def list_patient_prescriptions(
    patient_id: str,
    db: Session = Depends(get_db),
    user_id=Depends(get_current_user),
):
    user = _get_current_nurse(db, user_id)
    patient_uuid = nurse_service._coerce_uuid(patient_id)
    if not patient_uuid:
        raise HTTPException(status_code=400, detail="Invalid patient id.")
    patient, error = nurse_service.get_patient_profile(
        db, user.hospital_id, patient_id
    )
    if error or not patient:
        raise HTTPException(status_code=404, detail="Patient not found.")
    return []
