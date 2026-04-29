from sqlalchemy import Column, Date, String, Boolean, ForeignKey, DateTime, Index, Integer
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import uuid

from app.db.base import Base


class DoctorAvailability(Base):
    __tablename__ = "doctor_availability"
    __table_args__ = (
        Index(
            "ix_doctor_availability_unique_slot",
            "doctor_id",
            "date",
            "time_slot",
            unique=True,
        ),
        Index("ix_doctor_availability_doctor_id", "doctor_id"),
        Index("ix_doctor_availability_date", "date"),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    doctor_id = Column(UUID(as_uuid=True), ForeignKey("doctors.id"), nullable=False)
    hospital_id = Column(UUID(as_uuid=True), ForeignKey("hospitals.id"), nullable=True, index=True)
    date = Column(Date, nullable=False, index=True)
    time_slot = Column(String, nullable=False)
    start_time = Column(String, nullable=True)
    end_time = Column(String, nullable=True)
    slot_duration = Column(Integer, nullable=True)
    status = Column(String, nullable=False, default="available", index=True)
    is_available = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    doctor = relationship("Doctor", back_populates="availability")
