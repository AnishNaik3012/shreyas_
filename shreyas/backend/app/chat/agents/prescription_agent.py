from __future__ import annotations

from typing import Any, Dict


def prescription_summary_tool(state: Dict[str, Any] | None = None) -> Dict[str, Any]:
    prescription = (state or {}).get("prescription_analysis")
    if not prescription:
        return {
            "message": (
                "To analyze a prescription, please upload a prescription image or PDF. "
                "Use the upload button and I will extract the medicines and instructions."
            ),
            "source": "prescription_tool",
        }

    prescription_ctx = (state or {}).get("prescription") or {}
    file_url = prescription_ctx.get("file_url")
    summary_file = prescription.get("summary_file") or prescription_ctx.get("summary_file")
    ai_summary = prescription.get("ai_summary") or prescription.get("additional_notes")
    return {
        "type": "prescription_result",
        "message": "Your prescription has been analyzed successfully.",
        "summary": ai_summary,
        "actions": [
            {
                "label": "View Prescription",
                "action": "view_prescription",
                "file_url": file_url,
            },
            {
                "label": "Download Summary",
                "action": "download_summary",
                "summary_url": summary_file,
            },
        ],
        "source": "prescription_tool",
    }
