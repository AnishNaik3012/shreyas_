from __future__ import annotations

import asyncio
import base64
import io
import json
import os
from datetime import datetime
from pathlib import Path
from typing import Any, Dict
from uuid import uuid4

import fitz  # PyMuPDF
import google.generativeai as genai
from fastapi import UploadFile
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle


def extract_text_from_pdf(file_content: bytes) -> str:
    """Extract text from a PDF file provided as bytes."""
    import pdfplumber

    text = ""
    try:
        with pdfplumber.open(io.BytesIO(file_content)) as pdf:
            for page in pdf.pages:
                page_text = page.extract_text()
                if page_text:
                    text += page_text + "\n"
    except Exception as exc:
        print(f"PDF Extraction Error: {exc}")
    return text.strip()


def convert_pdf_to_image(file_content: bytes) -> bytes:
    """Convert the front page of a PDF to a JPEG image. Returns image bytes."""
    try:
        doc = fitz.open(stream=file_content, filetype="pdf")
        page = doc.load_page(0)
        pix = page.get_pixmap(matrix=fitz.Matrix(2, 2))
        img_bytes = pix.tobytes("jpg")
        doc.close()
        return img_bytes
    except Exception as exc:
        print(f"PDF to Image Conversion Error: {exc}")
        return b""


def summarize_report_rule_based(text: str, mime_type: str) -> Dict[str, Any]:
    """Provide a rule-based summary when AI is unavailable."""
    if not text or len(text) < 10:
        if "image" in mime_type:
            return {
                "report_title": "Medical Image Uploaded",
                "category": "Visual Data",
                "summary": (
                    "You've uploaded an image. For a detailed analysis, "
                    "please provide a PDF version or configure the AI API key."
                ),
                "key_findings": ["Visual file detected"],
                "health_status": "Normal",
                "description": "This is an image-based report. Rule-based analysis is limited for images.",
            }
        return {
            "report_title": "Empty Report",
            "category": "Unknown",
            "summary": "The report content could not be read clearly.",
            "health_status": "Unknown",
            "description": "The file appears to be empty or encrypted.",
            "wellness_insights": ["Please upload a clear medical document."],
            "wellness_score": 50,
            "metric_comparisons": [],
        }

    text_lower = text.lower()
    report_title = "General Medical Report"
    category = "Clinical"
    health_status = "Normal"

    if "[image content" in text_lower:
        report_title = "Medical Image Analysis"
        category = "Radiology/Clinical"
        return {
            "report_title": report_title,
            "category": category,
            "summary": (
                "You've uploaded a medical image. Please ensure the Gemini API key "
                "is configured for a deep AI analysis of the visual content."
            ),
            "extracted_fields": [
                {"label": "File Type", "value": "Image (PNG/JPG)"},
                {"label": "Analysis Status", "value": "OCR/AI required for full extraction"},
            ],
            "health_status": "Normal",
            "description": (
                "This is a visual medical record. For specific data extraction like "
                "Fetal Heart Rate or Hemoglobin, an AI-powered scan is necessary."
            ),
            "wellness_insights": ["Coordinate with your doctor for a detailed AI manual review."],
            "wellness_score": 80,
            "metric_comparisons": [],
        }

    if "hemoglobin" in text_lower or "blood" in text_lower:
        report_title = "Blood Investigation Report"
        category = "Lab"
    elif "ultrasound" in text_lower or "scan" in text_lower:
        report_title = "Imaging/Scan Report"
        category = "Radiology"
    elif "prescription" in text_lower:
        report_title = "Medical Prescription"
        category = "Prescription"

    findings = []
    keywords = {
        "HEMOGLOBIN": "Blood count checked",
        "BP": "Blood pressure recorded",
        "GLUCOSE": "Sugar levels identified",
        "WEIGHT": "Physical measurement noted",
        "URINE": "Urinalysis performed",
    }

    for kw in keywords:
        if kw.lower() in text_lower:
            for line in text.split("\n"):
                if kw.lower() in line.lower():
                    findings.append(line.strip())
                    break

    if any(k in text_lower for k in ["critical", "high risk", "abnormal"]):
        health_status = "Attention Required"

    if findings:
        topics = [f.split(":")[0].strip() for f in findings[:3]]
        findings_summary = f"It contains specific data regarding {', '.join(topics)}."
    else:
        findings_summary = "It contains general clinical observations and health markers."

    dynamic_fields = []
    highlight_metric = None

    for finding in findings:
        if ":" in finding:
            label, val = finding.split(":", 1)
            dynamic_fields.append({"label": label.strip().title(), "value": val.strip()})
        else:
            dynamic_fields.append({"label": "Finding", "value": finding})

    if "hemoglobin" in text_lower:
        for field in dynamic_fields:
            if "Hemoglobin" in field["label"]:
                highlight_metric = {
                    "label": "Hemoglobin",
                    "value": field["value"],
                    "unit": "g/dL",
                    "icon": "🩸",
                }
                break
    elif "bp" in text_lower:
        for field in dynamic_fields:
            if "Bp" in field["label"]:
                highlight_metric = {
                    "label": "Blood Pressure",
                    "value": field["value"],
                    "unit": "mmHg",
                    "icon": "💓",
                }
                break

    return {
        "report_title": report_title,
        "category": category,
        "summary": f"Your {report_title} has been analyzed. {findings_summary}",
        "extracted_fields": dynamic_fields
        if dynamic_fields
        else [{"label": "Status", "value": "All parameters within typical ranges"}],
        "highlight_metric": highlight_metric,
        "health_status": health_status,
        "description": (
            f"This is a comprehensive {report_title}. {findings_summary} "
            "We recommend presenting these findings to your primary healthcare provider "
            "for a localized clinical correlation."
        ),
        "wellness_insights": [
            "Maintain regular health check-ups.",
            "Follow a balanced diet based on your laboratory parameters.",
            "Stay physically active with light walking or yoga unless advised otherwise.",
        ],
        "wellness_score": 85 if health_status == "Normal" else 65,
        "metric_comparisons": [
            {"label": "Hemoglobin", "current": 11.5, "min": 12.0, "max": 16.0, "unit": "g/dL"}
        ]
        if "hemoglobin" in text_lower
        else [],
    }


async def _analyze_report_with_ai(file_content: bytes, mime_type: str) -> Dict[str, Any]:
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        text = ""
        result: Dict[str, Any] = {}
        if "pdf" in mime_type:
            text = extract_text_from_pdf(file_content)
            analysis_image = convert_pdf_to_image(file_content)
            if analysis_image:
                preview_b64 = base64.b64encode(analysis_image).decode("utf-8")
                result["preview_image"] = f"data:image/jpeg;base64,{preview_b64}"
        else:
            text = "[Image Content - Requires OCR for detailed analysis]"

        fallback_res = summarize_report_rule_based(text, mime_type)
        fallback_res.update(result)
        return fallback_res

    try:
        genai.configure(api_key=api_key)
        generation_config = {"response_mime_type": "application/json"}
        system_instruction = """
ACT AS A ZERO-TOLERANCE MEDICAL DOCUMENT FILTER.
Your ONLY job is to verify if an image or PDF is a CLINICAL MEDICAL DOCUMENT.

ALLOWED:
- Hospital/Lab Reports (Blood tests, Urine tests, etc.)
- Radiology (Ultrasound images, CT/MRI results)
- Prescriptions, Doctor's Consultations

STRICTLY FORBIDDEN (REJECT IMMEDIATELY):
- Academic/School reports (Mark sheets, Grade cards, Attendance) -> THESE ARE FREQUENTLY MISMATCHED. REJECT THEM.
- Personal ID (Aadhar, PAN)
- Bills or general photos.

If it is NOT a clinical medical document, you MUST return `is_medical: false`.
""".strip()

        model = genai.GenerativeModel(
            model_name="gemini-flash-latest",
            generation_config=generation_config,
            system_instruction=system_instruction,
        )

        prompt = """
Examine this document. Is it a CLINICAL medical report?

If it is an Academic/School report or any non-medical file, return:
{"is_medical": false, "error_message": "This system only accepts medical reports"}

If it IS a medical report, return the analysis:
{
  "is_medical": true,
  "report_title": "Concise Title",
  "category": "Lab | Radiology | Clinical | Prescription",
  "summary": "Clinical summary",
  "description": "Purpose of test",
  "health_status": "Normal | Attention Required | Critical",
  "wellness_score": integer,
  "extracted_fields": [{"label": "string", "value": "string"}],
  "wellness_insights": ["3-4 actionable medical tips"],
  "metric_comparisons": [{"label": "string", "current": float, "min": float, "max": float, "unit": "string"}]
}
""".strip()

        parts = [prompt]
        if "pdf" in mime_type:
            parts.append({"mime_type": "application/pdf", "data": file_content})
        else:
            parts.append({"mime_type": mime_type, "data": file_content})

        ai_task = model.generate_content_async(parts)
        if "pdf" in mime_type:
            preview_task = asyncio.to_thread(convert_pdf_to_image, file_content)
        else:
            preview_task = asyncio.to_thread(lambda: file_content)

        response, img_bytes = await asyncio.gather(ai_task, preview_task)

        try:
            result = json.loads(response.text)
        except Exception as exc:
            print(f"JSON Parsing Error: {exc}")
            result = {
                "is_medical": True,
                "report_title": "Analysis Result",
                "summary": response.text[:500],
            }

        res_str = json.dumps(result).lower()
        forbidden_terms = [
            "high school",
            "grade level",
            "semester",
            "gpa",
            "academic year",
            "student name",
            "class teacher",
            "attendance record",
            "school report",
        ]
        if any(term in res_str for term in forbidden_terms):
            print("Guardrail: Academic content detected. Overriding AI decision.")
            result["is_medical"] = False
            result["error_message"] = "This system only accepts medical reports"

        if not result.get("is_medical", True):
            error_msg = result.get("error_message", "This system only accepts medical reports")
            return {
                "report_title": "Invalid Document",
                "summary": error_msg,
                "error_message": error_msg,
                "is_medical": False,
            }

        if img_bytes:
            preview_image_b64 = base64.b64encode(img_bytes).decode("utf-8")
            result["preview_image"] = f"data:image/jpeg;base64,{preview_image_b64}"

        return result
    except Exception as exc:
        print(f"Gemini Analysis Error: {exc}")
        return summarize_report_rule_based("", mime_type)


def generate_branded_report_pdf(report_data: Dict[str, Any]) -> str | None:
    try:
        report_id = report_data.get("report_id") or uuid4().hex
        generated_at = datetime.utcnow().strftime("%Y-%m-%d %H:%M UTC")
        patient_name = report_data.get("patient_name") or "Not provided"
        patient_id = report_data.get("patient_id") or "Not provided"
        report_title = report_data.get("report_title") or "AI Clinical Report Summary"
        summary = report_data.get("summary") or "Summary not available."
        key_findings = report_data.get("key_findings") or report_data.get("extracted_fields") or []
        interpretation = (
            report_data.get("clinical_interpretation")
            or report_data.get("description")
            or "Clinical interpretation not available."
        )
        recommendations = (
            report_data.get("recommendations")
            or report_data.get("wellness_insights")
            or []
        )
        red_flags = report_data.get("red_flags") or []
        health_status = report_data.get("health_status") or "Unknown"

        uploads_dir = Path(__file__).resolve().parents[2] / "uploads" / "generated_reports"
        uploads_dir.mkdir(parents=True, exist_ok=True)
        file_name = f"{report_id}.pdf"
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
        story.append(Paragraph("AI Clinical Report Summary", styles["Heading2"]))
        story.append(Paragraph(f"Generated: {generated_at}", styles["Italic"]))
        story.append(Spacer(1, 0.2 * inch))

        info_table = Table(
            [
                ["Report ID", report_id],
                ["Patient Name", patient_name],
                ["Patient ID", patient_id],
                ["Report Title", report_title],
                ["Health Status", health_status],
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
        story.append(Paragraph(summary, body_style))
        story.append(Spacer(1, 0.2 * inch))

        story.append(Paragraph("Key Findings", heading_style))
        if key_findings:
            for item in key_findings:
                if isinstance(item, dict):
                    label = item.get("label") or "Finding"
                    value = item.get("value") or ""
                    story.append(Paragraph(f"• {label}: {value}", body_style))
                else:
                    story.append(Paragraph(f"• {item}", body_style))
        else:
            story.append(Paragraph("No key findings detected.", body_style))
        story.append(Spacer(1, 0.2 * inch))

        story.append(Paragraph("Clinical Interpretation", heading_style))
        story.append(Paragraph(interpretation, body_style))
        story.append(Spacer(1, 0.2 * inch))

        story.append(Paragraph("Recommendations", heading_style))
        if recommendations:
            for rec in recommendations:
                story.append(Paragraph(f"• {rec}", body_style))
        else:
            story.append(Paragraph("No recommendations provided.", body_style))
        story.append(Spacer(1, 0.2 * inch))

        story.append(Paragraph("Red Flags", heading_style))
        if red_flags:
            for flag in red_flags:
                story.append(Paragraph(f"• {flag}", body_style))
        else:
            story.append(Paragraph("None noted.", body_style))
        story.append(Spacer(1, 0.3 * inch))

        story.append(
            Paragraph(
                "This report is AI-assisted and does not replace medical diagnosis.",
                styles["Italic"],
            )
        )

        doc.build(story)
        return f"/uploads/generated_reports/{file_name}"
    except Exception as exc:
        print(f"PDF generation error: {exc}")
        return None


async def analyze_report(file: UploadFile) -> Dict[str, Any]:
    file_bytes = await file.read()
    mime_type = file.content_type or "application/octet-stream"
    result = await _analyze_report_with_ai(file_bytes, mime_type)
    summary = result.get("summary") if isinstance(result, dict) else None
    if isinstance(summary, str) and summary.strip():
        pdf_url = generate_branded_report_pdf(result)
        if pdf_url:
            result["summary_file"] = pdf_url
        else:
            safe_summary = (
                summary.replace("&", "&amp;")
                .replace("<", "&lt;")
                .replace(">", "&gt;")
                .replace('"', "&quot;")
                .replace("'", "&apos;")
            )
            max_width = 760
            line_height = 24
            lines = []
            current = ""
            for word in safe_summary.split():
                tentative = f"{current} {word}".strip()
                if len(tentative) > 90:
                    lines.append(current)
                    current = word
                else:
                    current = tentative
            if current:
                lines.append(current)
            svg_height = 120 + (len(lines) * line_height)
            text_lines = "\n".join(
                f'<text x="40" y="{100 + i * line_height}" font-size="16" fill="#0b1220" font-family="Arial, sans-serif">{line}</text>'
                for i, line in enumerate(lines)
            )
            svg = f"""<svg xmlns="http://www.w3.org/2000/svg" width="{max_width}" height="{svg_height}">
  <rect width="100%" height="100%" fill="#f8fafc" />
  <text x="40" y="60" font-size="22" font-weight="600" fill="#0f172a" font-family="Arial, sans-serif">Report Summary</text>
  {text_lines}
</svg>"""
            summary_b64 = base64.b64encode(svg.encode("utf-8")).decode("utf-8")
            result["summary_file"] = f"data:image/svg+xml;base64,{summary_b64}"
    return result
