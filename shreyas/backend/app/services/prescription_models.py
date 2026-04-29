from __future__ import annotations

from typing import List, Optional

from pydantic import BaseModel, Field


class Medication(BaseModel):
    name: str
    dosage: Optional[str] = None
    frequency: Optional[str] = None
    timing: Optional[str] = None
    indication: Optional[str] = None
    instructions: Optional[str] = None
    side_effects: List[str] = Field(default_factory=list)


class PrescriptionData(BaseModel):
    doctor_name: Optional[str] = None
    patient_name: Optional[str] = None
    hospital_name: Optional[str] = None
    diagnosis: List[str] = Field(default_factory=list)
    tests: List[str] = Field(default_factory=list)
    doctor_notes: Optional[str] = None
    ai_summary: Optional[str] = None
    date: Optional[str] = None
    medications: List[Medication] = Field(default_factory=list)
    additional_notes: Optional[str] = None
