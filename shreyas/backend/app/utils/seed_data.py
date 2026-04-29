from sqlalchemy.orm import Session

from app.db.session import SessionLocal
from app.models.hospital import Hospital
from app.models.doctor import Doctor


HOSPITALS = [
    {"name": "Savemom General Hospital", "location": "Bengaluru"},
    {"name": "Savemom City Clinic", "location": "Hyderabad"},
]

DOCTORS = [
    {"name": "Dr. Ananya Rao", "department": "Gynecology"},
    {"name": "Dr. Meera Iyer", "department": "Gynecology"},
    {"name": "Dr. Kabir Sinha", "department": "Pediatrics"},
    {"name": "Dr. Nisha Malhotra", "department": "Pediatrics"},
    {"name": "Dr. Vikas Menon", "department": "General Medicine"},
    {"name": "Dr. Shreya Bose", "department": "General Medicine"},
    {"name": "Dr. Pooja Kulkarni", "department": "Nutrition"},
    {"name": "Dr. Tara Sen", "department": "Nutrition"},
    {"name": "Dr. Anjali Deshmukh", "department": "Mental Health"},
    {"name": "Dr. Omar Siddiqui", "department": "Mental Health"},
]


def seed_hospitals(db: Session):
    if db.query(Hospital).first():
        return
    for item in HOSPITALS:
        db.add(Hospital(name=item["name"], location=item["location"]))
    db.commit()


def seed_doctors(db: Session):
    if db.query(Doctor).first():
        return
    hospitals = db.query(Hospital).order_by(Hospital.name.asc()).all()
    if not hospitals:
        return
    hospital_cycle = hospitals * ((len(DOCTORS) // len(hospitals)) + 1)
    for doctor, hospital in zip(DOCTORS, hospital_cycle):
        db.add(
            Doctor(
                name=doctor["name"],
                department=doctor["department"],
                hospital_id=hospital.id,
                is_active=True,
            )
        )
    db.commit()


def run_seed():
    db = SessionLocal()
    try:
        seed_hospitals(db)
        seed_doctors(db)
    finally:
        db.close()


if __name__ == "__main__":
    run_seed()
