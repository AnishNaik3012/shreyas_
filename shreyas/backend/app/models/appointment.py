from sqlalchemy import Column, String, Date, DateTime, ForeignKey, Index
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import uuid

from app.db.base import Base


class Appointment(Base):
    __tablename__ = "appointments"
    __table_args__ = (
        Index(
            "ix_appointments_doctor_slot",
            "doctor_id",
            "appointment_date",
            "time_slot",
        ),
        Index("ix_appointments_user_date", "user_id", "appointment_date"),
        Index("ix_appointments_hospital_id", "hospital_id"),
        Index("ix_appointments_doctor_id", "doctor_id"),
        Index("ix_appointments_status", "status"),
        Index("ix_appointments_priority", "priority"),
        {"implicit_returning": False},
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    hospital_id = Column(UUID(as_uuid=True), ForeignKey("hospitals.id"), nullable=False)
    doctor_id = Column(UUID(as_uuid=True), ForeignKey("doctors.id"), nullable=False)
    department = Column(String, nullable=False, index=True)
    appointment_date = Column(Date, nullable=False, index=True)
    time_slot = Column(String, nullable=False)
    reason = Column(String, nullable=True)
    symptoms = Column(String, nullable=True)
    status = Column(String, nullable=False, default="pending", index=True)
    priority = Column(String, nullable=False, default="normal", index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User")
    hospital = relationship("Hospital", back_populates="appointments")
    doctor = relationship("Doctor", back_populates="appointments")
