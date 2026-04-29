from __future__ import annotations

from typing import Any, Dict


def report_summary_tool(state: Dict[str, Any] | None = None) -> Dict[str, Any]:
    report = (state or {}).get("report_analysis")
    if not report:
        return {
            "message": (
                "To see a report summary, please upload a medical report (PDF or image). "
                "Use the upload button and I will analyze it for you."
            ),
            "source": "report_tool",
        }

    report_ctx = (state or {}).get("report") or {}
    file_url = report_ctx.get("file_url")
    summary_file = report.get("summary_file") or report_ctx.get("summary_file")
    summary = report.get("summary") or "Summary not available."
    return {
        "type": "report_result",
        "message": "Your report has been analyzed successfully.",
        "summary": summary,
        "actions": [
            {
                "label": "View Report",
                "action": "view_report",
                "file_url": file_url,
            },
            {
                "label": "Download Summary",
                "action": "download_summary",
                "summary_url": summary_file,
            },
        ],
        "source": "report_tool",
    }
