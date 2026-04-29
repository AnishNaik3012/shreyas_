from __future__ import annotations

import json
import os
from datetime import datetime
from pathlib import Path
from typing import Any, Dict
from uuid import uuid4

import google.generativeai as genai
from fastapi import UploadFile
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle
from tenacity import RetryError, retry, retry_if_exception_type, stop_after_attempt, wait_exponential

from app.services.prescription_models import PrescriptionData

try:
    from app.services.prescription_rag import MedicalRAGEngine
except Exception:
    MedicalRAGEngine = None


class PrescriptionAnalyzer:
    def __init__(self, api_key: str | None = None) -> None:
        self.api_key = api_key or os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
        if not self.api_key:
            raise ValueError("Gemini/Google API Key not found. Please set GEMINI_API_KEY or GOOGLE_API_KEY.")
        genai.configure(api_key=self.api_key)

        self.rag_engine = MedicalRAGEngine() if MedicalRAGEngine else None
        if self.rag_engine and not self.rag_engine.documents:
            dummy_text = "\n".join(
                [
                    "Amoxicillin is a penicillin antibiotic tailored to fight bacteria.",
                    "Common side effects of Amoxicillin include nausea and rash.",
                    "Paracetamol is used for pain relief and fever reduction.",
                    "Ibuprofen is a non-steroidal anti-inflammatory drug (NSAID).",
                    "Metformin is the first-line medication for the treatment of type 2 diabetes.",
                    "Lisinopril is used to treat high blood pressure and heart failure.",
                ]
            )
            self.rag_engine.ingest_text(dummy_text)

    @retry(
        retry=retry_if_exception_type(Exception),
        wait=wait_exponential(multiplier=2, min=4, max=60),
        stop=stop_after_attempt(5),
    )
    def _generate_with_retry(self, model_name: str, contents: list, system_instruction: str | None = None):
        try:
            model = genai.GenerativeModel(model_name=model_name, system_instruction=system_instruction)
            return model.generate_content(contents)
        except Exception as exc:
            print(f"DEBUG: Gemini API call failed: {exc}")
            raise exc

    def analyze_prescription_bytes(self, file_bytes: bytes, mime_type: str) -> Dict[str, Any]:
        if not mime_type.startswith("image/") and mime_type != "application/pdf":
            raise ValueError("Unsupported file format. Use JPG, PNG, or PDF.")

        system_prompt = """
You are a highly expert medical assistant specializing in analyzing prescriptions.
Your task is to extract structured data from the provided prescription image or text.

Return ONLY a valid JSON object matching this structure:
{
  "doctor_name": "string or null",
  "patient_name": "string or null",
  "hospital_name": "string or null",
  "diagnosis": ["string"],
  "tests": ["string"],
  "doctor_notes": "string or null",
  "ai_summary": "string or null",
  "date": "string or null",
  "medications": [
    {
      "name": "string",
      "dosage": "string or null",
      "frequency": "string or null",
      "timing": "string or null",
      "indication": "string or null",
      "instructions": "string or null",
      "side_effects": ["string"]
    }
  ],
  "additional_notes": "string or null"
}

Notes:
- If side effects are not listed on the prescription, LEAVE THE LIST EMPTY []. Do not hallucinate side effects yet.
- Be precise with dosage and frequency.
- If timing or indication is not explicit, return null (do not guess).
- If diagnosis or tests are not listed, return an empty list [].
""".strip()

        contents = [{"mime_type": mime_type, "data": file_bytes}]

        try:
            response = self._generate_with_retry(
                model_name="gemini-flash-latest",
                contents=contents,
                system_instruction=system_prompt,
            )
            text = response.text.replace("```json", "").replace("```", "").strip()
            data_dict = json.loads(text)

            if self.rag_engine:
                for med in data_dict.get("medications", []):
                    if not med.get("side_effects"):
                        rag_info = self.rag_engine.retrieve(f"side effects of {med.get('name', '')}")
                        if rag_info:
                            med["side_effects"] = [rag_info[0]]

            validated = PrescriptionData(**data_dict)
            return validated.dict()
        except json.JSONDecodeError:
            return PrescriptionData(additional_notes="Failed to parse prescription data.").dict()
        except RetryError as err:
            return PrescriptionData(
                additional_notes=(
                    "Error: Service is currently busy (Rate Limit Exceeded). "
                    "Please wait a minute and try again."
                )
            ).dict()
        except Exception as exc:
            print(f"DEBUG: Unexpected error in analyze_prescription: {exc}")
            return PrescriptionData(additional_notes=f"Error: {str(exc)}").dict()

    def generate_prescription_pdf(self, data: Dict[str, Any]) -> str | None:
        try:
            prescription_id = data.get("prescription_id") or uuid4().hex
            generated_at = datetime.utcnow().strftime("%Y-%m-%d %H:%M UTC")
            patient_name = data.get("patient_name") or "Not provided"
            doctor_name = data.get("doctor_name") or "Not provided"
            hospital_name = data.get("hospital_name") or "Not provided"
            diagnosis = data.get("diagnosis") or []
            tests = data.get("tests") or []
            doctor_notes = data.get("doctor_notes") or "Not provided."
            ai_summary = data.get("ai_summary") or "Summary not available."
            medications = data.get("medications") or []

            uploads_dir = Path(__file__).resolve().parents[2] / "uploads" / "generated_prescriptions"
            uploads_dir.mkdir(parents=True, exist_ok=True)
            file_name = f"{prescription_id}.pdf"
            output_path = uploads_dir / file_name

            styles = getSampleStyleSheet()
            title_style = styles["Title"]
            heading_style = styles["Heading3"]
            body_style = styles["BodyText"]
            body_style.leading = 14

            doc = SimpleDocTemplate(
                str(output_path),
                pagesize=A4,
                leftMargin=0.8 * inch,
                rightMargin=0.8 * inch,
                topMargin=0.75 * inch,
                bottomMargin=0.75 * inch,
            )

            story = []
            story.append(Paragraph("Savemom", title_style))
            story.append(Paragraph("AI Prescription Summary", styles["Heading2"]))
            story.append(Paragraph(f"Generated: {generated_at}", styles["Italic"]))
            story.append(Spacer(1, 0.2 * inch))

            info_table = Table(
                [
                    ["Prescription ID", prescription_id],
                    ["Patient Name", patient_name],
                    ["Doctor Name", doctor_name],
                    ["Hospital", hospital_name],
                ],
                colWidths=[1.6 * inch, 4.6 * inch],
            )
            info_table.setStyle(
                TableStyle(
                    [
                        ("BACKGROUND", (0, 0), (-1, 0), colors.whitesmoke),
                        ("TEXTCOLOR", (0, 0), (-1, -1), colors.black),
                        ("GRID", (0, 0), (-1, -1), 0.5, colors.lightgrey),
                        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                        ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
                        ("VALIGN", (0, 0), (-1, -1), "TOP"),
                    ]
                )
            )
            story.append(info_table)
            story.append(Spacer(1, 0.2 * inch))

            story.append(Paragraph("AI Summary", heading_style))
            story.append(Paragraph(ai_summary, body_style))
            story.append(Spacer(1, 0.2 * inch))

            story.append(Paragraph("Medications", heading_style))
            if medications:
                rows = [
                    [
                        "Name",
                        "Dosage",
                        "Frequency",
                        "Timing",
                        "Instructions",
                        "Indication",
                    ]
                ]
                for med in medications:
                    rows.append(
                        [
                            med.get("name") or "N/A",
                            med.get("dosage") or "N/A",
                            med.get("frequency") or "N/A",
                            med.get("timing") or "N/A",
                            med.get("instructions") or "N/A",
                            med.get("indication") or "N/A",
                        ]
                    )
                table = Table(rows, colWidths=[1.2 * inch] * 6, repeatRows=1)
                table.setStyle(
                    TableStyle(
                        [
                            ("BACKGROUND", (0, 0), (-1, 0), colors.lightgrey),
                            ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
                            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                            ("VALIGN", (0, 0), (-1, -1), "TOP"),
                        ]
                    )
                )
                story.append(table)
            else:
                story.append(Paragraph("No medications detected.", body_style))
            story.append(Spacer(1, 0.2 * inch))

            story.append(Paragraph("Diagnosis", heading_style))
            if diagnosis:
                for item in diagnosis:
                    story.append(Paragraph(f"• {item}", body_style))
            else:
                story.append(Paragraph("None listed.", body_style))
            story.append(Spacer(1, 0.2 * inch))

            story.append(Paragraph("Tests / Follow-ups", heading_style))
            if tests:
                for item in tests:
                    story.append(Paragraph(f"• {item}", body_style))
            else:
                story.append(Paragraph("None listed.", body_style))
            story.append(Spacer(1, 0.2 * inch))

            story.append(Paragraph("Doctor Notes", heading_style))
            story.append(Paragraph(doctor_notes, body_style))
            story.append(Spacer(1, 0.3 * inch))

            story.append(
                Paragraph(
                    "This report is AI-assisted and does not replace medical diagnosis.",
                    styles["Italic"],
                )
            )

            doc.build(story)
            return f"/uploads/generated_prescriptions/{file_name}"
        except Exception as exc:
            print(f"Prescription PDF generation error: {exc}")
            return None


_analyzer_instance: PrescriptionAnalyzer | None = None


def _get_analyzer() -> PrescriptionAnalyzer:
    global _analyzer_instance
    if _analyzer_instance is None:
        _analyzer_instance = PrescriptionAnalyzer()
    return _analyzer_instance


async def analyze_prescription(file: UploadFile) -> Dict[str, Any]:
    file_bytes = await file.read()
    mime_type = file.content_type or "application/octet-stream"
    analyzer = _get_analyzer()
    result = analyzer.analyze_prescription_bytes(file_bytes, mime_type)
    if isinstance(result, dict):
        pdf_url = analyzer.generate_prescription_pdf(result)
        if pdf_url:
            result["summary_file"] = pdf_url
    return result
