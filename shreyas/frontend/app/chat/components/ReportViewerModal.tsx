"use client";

import { useMemo } from "react";

type ReportViewerModalProps = {
  isOpen: boolean;
  fileUrl: string | null;
  fileType?: string | null;
  onClose: () => void;
};

const detectFileType = (fileUrl: string, fallback?: string | null) => {
  if (fallback) return fallback;
  if (fileUrl.startsWith("data:application/pdf")) return "application/pdf";
  if (fileUrl.startsWith("data:image/")) return "image";
  if (fileUrl.toLowerCase().endsWith(".pdf")) return "application/pdf";
  if (/\.(png|jpg|jpeg)$/i.test(fileUrl)) return "image";
  return "application/octet-stream";
};

export default function ReportViewerModal({
  isOpen,
  fileUrl,
  fileType,
  onClose,
}: ReportViewerModalProps) {
  const resolvedType = useMemo(() => {
    if (!fileUrl) return "application/octet-stream";
    return detectFileType(fileUrl, fileType ?? null);
  }, [fileUrl, fileType]);

  if (!isOpen || !fileUrl) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(2, 6, 23, 0.72)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        zIndex: 50,
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: "min(960px, 94vw)",
          maxHeight: "86vh",
          background: "rgba(7, 17, 33, 0.96)",
          border: "1px solid rgba(39,212,207,0.4)",
          borderRadius: 18,
          boxShadow:
            "0 24px 60px rgba(0,0,0,0.45), 0 0 28px rgba(39,212,207,0.25)",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
        }}
        onClick={(event) => event.stopPropagation()}
      >
        <div
          style={{
            padding: "14px 18px",
            borderBottom: "1px solid rgba(39,212,207,0.25)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            color: "white",
          }}
        >
          <div style={{ fontWeight: 600 }}>Report Viewer</div>
          <button
            onClick={onClose}
            style={{
              border: "1px solid rgba(39,212,207,0.6)",
              background: "rgba(4, 22, 34, 0.9)",
              color: "#27D4CF",
              padding: "6px 12px",
              borderRadius: 999,
              cursor: "pointer",
            }}
          >
            Close
          </button>
        </div>
        <div
          style={{
            flex: 1,
            overflow: "auto",
            background: "#0b1220",
            padding: 16,
          }}
        >
          {resolvedType === "application/pdf" ? (
            <iframe
              src={fileUrl}
              title="Report PDF"
              style={{
                width: "100%",
                height: "70vh",
                border: "none",
                borderRadius: 12,
                background: "white",
              }}
            />
          ) : (
            <img
              src={fileUrl}
              alt="Report preview"
              style={{
                width: "100%",
                height: "auto",
                borderRadius: 12,
                display: "block",
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
}
