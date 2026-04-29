from sqlalchemy import Column, String, Date, DateTime, ForeignKey, JSON, Text, Index
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
import uuid

from app.db.base import Base


class Checkup(Base):
    __tablename__ = "checkups"
    __table_args__ = (
        Index("ix_checkups_user_date", "user_id", "appointment_date"),
        Index("ix_checkups_doctor_date", "doctor_id", "appointment_date"),
        {"implicit_returning": False},
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    hospital_id = Column(UUID(as_uuid=True), ForeignKey("hospitals.id"), nullable=True, index=True)
    doctor_id = Column(UUID(as_uuid=True), ForeignKey("doctors.id"), nullable=True, index=True)
    checkup_type = Column(String, nullable=False, index=True)
    tests_selected = Column(JSON, nullable=True)
    appointment_date = Column(Date, nullable=False, index=True)
    time_slot = Column(String, nullable=False)
    notes = Column(Text, nullable=True)
    status = Column(String, nullable=False, default="pending", index=True)
    priority = Column(String, nullable=False, default="normal", index=True)
    report_url = Column(String, nullable=True)
    remarks = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
