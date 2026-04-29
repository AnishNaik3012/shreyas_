from sqlalchemy import Column, DateTime, ForeignKey, String, Text, Index
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
import uuid

from app.db.base import Base


class PatientVital(Base):
    __tablename__ = "patient_vitals"
    __table_args__ = (
        Index("ix_patient_vitals_user_recorded", "user_id", "recorded_at"),
        Index("ix_patient_vitals_hospital", "hospital_id"),
        {"implicit_returning": False},
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    hospital_id = Column(UUID(as_uuid=True), ForeignKey("hospitals.id"), nullable=False, index=True)
    blood_pressure = Column(String, nullable=True)
    heart_rate = Column(String, nullable=True)
    temperature = Column(String, nullable=True)
    respiratory_rate = Column(String, nullable=True)
    oxygen_saturation = Column(String, nullable=True)
    weight = Column(String, nullable=True)
    notes = Column(Text, nullable=True)
    recorded_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)
