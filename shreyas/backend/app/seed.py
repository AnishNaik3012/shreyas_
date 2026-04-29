from sqlalchemy.orm import Session

from datetime import date, timedelta

from app.models.doctor import Doctor
from app.models.hospital import Hospital
from app.models.doctor_availability import DoctorAvailability


SEED_DOCTORS = [
    ("Dr. Aisha Sharma", "Gynecology"),
    ("Dr. Meera Nair", "Gynecology"),
    ("Dr. Arjun Patel", "Pediatrics"),
    ("Dr. Kavya Iyer", "Pediatrics"),
    ("Dr. Rahul Verma", "General Medicine"),
    ("Dr. Sneha Rao", "General Medicine"),
    ("Dr. Pooja Kulkarni", "Nutrition"),
    ("Dr. Tara Sen", "Nutrition"),
    ("Dr. Anjali Deshmukh", "Mental Health"),
    ("Dr. Omar Siddiqui", "Mental Health"),
]


def seed_doctors(db: Session) -> None:
    existing = db.query(Doctor).first()

    doctors = []
    if not existing:
        hospital = db.query(Hospital).first()
        if not hospital:
            hospital = Hospital(name="Savemom General Hospital", location="Main Campus")
            db.add(hospital)
            db.flush()

        doctors = [
            Doctor(
                name=name,
                department=department,
                hospital_id=hospital.id,
                is_active=True,
            )
            for name, department in SEED_DOCTORS
        ]

        db.add_all(doctors)
        db.flush()
    else:
        doctors = db.query(Doctor).all()

    existing_slots = db.query(DoctorAvailability).first()
    if existing_slots:
        return

    time_slots = ["10:00 AM", "01:00 PM", "05:00 PM"]
    start_date = date.today()
    availability = []
    for doctor in doctors:
        for offset in range(0, 7):
            target_date = start_date + timedelta(days=offset)
            for slot in time_slots:
                availability.append(
                    DoctorAvailability(
                        doctor_id=doctor.id,
                        date=target_date,
                        time_slot=slot,
                        is_available=True,
                    )
                )
    db.add_all(availability)
    db.flush()
