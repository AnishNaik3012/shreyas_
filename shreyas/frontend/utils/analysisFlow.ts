export type AnalysisKind = "report" | "prescription";

export type AnalysisOption = {
  label: string;
  value: string;
};

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

const allowedMimeByKind: Record<AnalysisKind, string[]> = {
  report: ["application/pdf", "image/jpeg", "image/png"],
  prescription: ["application/pdf", "image/jpeg", "image/png"],
};

export const getFlowIntro = (kind: AnalysisKind) => {
  if (kind === "report") {
    return {
      text:
        "I can analyze medical reports and help you understand:\n" +
        "• Key indicators\n" +
        "• Abnormal values\n" +
        "• Health insights\n\n" +
        "Supported formats:\nPDF, JPG, PNG (Max 10MB)\n\n" +
        "Would you like to upload your report?",
      options: [
        { label: "Upload Report", value: "upload_report" },
        { label: "What will you analyze?", value: "report_learn_more" },
      ],
    };
  }
  return {
    text:
      "I can analyze prescriptions and extract:\n" +
      "• Medicine names\n" +
      "• Dosage instructions\n" +
      "• Possible side effects\n" +
      "• Safety notes\n\n" +
      "Would you like to upload your prescription?",
    options: [
      { label: "Upload Prescription", value: "upload_prescription" },
      { label: "Learn More", value: "prescription_learn_more" },
    ],
  };
};

export const getLearnMoreText = (kind: AnalysisKind) => {
  if (kind === "report") {
    return (
      "I look for clinical markers (like hemoglobin, glucose, BP, ultrasound findings), " +
      "flag abnormal values when they appear, and summarize what they likely mean. " +
      "Only medical reports are supported."
    );
  }
  return (
    "I extract medicine names, dosage, frequency, and instructions. " +
    "If side effects or warnings are listed on the prescription, I’ll include them."
  );
};

export const validateAnalysisFile = (kind: AnalysisKind, file: File) => {
  if (!allowedMimeByKind[kind].includes(file.type)) {
    return "Unsupported file type. Please upload a PDF, JPG, or PNG.";
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return "File too large. Max size is 10MB.";
  }
  return null;
};

const normalizeString = (value: unknown) =>
  typeof value === "string" ? value.trim() : "";

export const formatAnalysisResult = (
  kind: AnalysisKind,
  payload: Record<string, any>
) => {
  const analysisPayload =
    payload.analysis && typeof payload.analysis === "object"
      ? payload.analysis
      : payload;
  const direct = normalizeString(payload.message ?? payload.reply);
  if (direct) return direct;

  if (kind === "report") {
    const summary = normalizeString(
      analysisPayload.summary ?? analysisPayload.report_summary
    );
    const highlights =
      analysisPayload.highlighted_values ??
      analysisPayload.metric_comparisons ??
      analysisPayload.extracted_fields;
    const warnings = analysisPayload.warnings ?? analysisPayload.health_status;

    const lines: string[] = [];
    if (summary) {
      lines.push(`Summary:\n${summary}`);
    }
    if (Array.isArray(highlights) && highlights.length) {
      const highlightLines = highlights.map((item: any) => {
        if (typeof item === "string") return `• ${item}`;
        const label = item.label ?? item.name ?? "Metric";
        const value = item.value ?? item.current ?? "";
        const unit = item.unit ? ` ${item.unit}` : "";
        return `• ${label}: ${value}${unit}`.trim();
      });
      lines.push(`Highlights:\n${highlightLines.join("\n")}`);
    }
    if (warnings) {
      lines.push(
        `Warnings:\n${
          typeof warnings === "string" ? warnings : JSON.stringify(warnings)
        }`
      );
    }
    return lines.length ? lines.join("\n\n") : "Analysis completed.";
  }

  const prescription =
    analysisPayload.prescription && typeof analysisPayload.prescription === "object"
      ? analysisPayload.prescription
      : analysisPayload;
  const doctor = normalizeString(prescription.doctor_name);
  const patient = normalizeString(prescription.patient_name);
  const hospital = normalizeString(prescription.hospital_name);
  const date = normalizeString(prescription.date);
  const diagnosisList = Array.isArray(prescription.diagnosis)
    ? prescription.diagnosis
    : [];
  const testsList = Array.isArray(prescription.tests) ? prescription.tests : [];
  const doctorNotes = normalizeString(prescription.doctor_notes);
  const aiSummary = normalizeString(prescription.ai_summary);
  const meds = Array.isArray(prescription.medications)
    ? prescription.medications
    : [];
  const notes = normalizeString(prescription.additional_notes ?? payload.notes);

  const lines: string[] = [];
  if (doctor || patient || hospital || date) {
    const headerLines = [
      doctor ? `Doctor: ${doctor}` : null,
      patient ? `Patient: ${patient}` : null,
      hospital ? `Hospital: ${hospital}` : null,
      date ? `Date: ${date}` : null,
    ].filter(Boolean);
    if (headerLines.length) {
      lines.push(headerLines.join("\n"));
    }
  }
  if (aiSummary) {
    lines.push(`AI Summary:\n${aiSummary}`);
  }
  if (diagnosisList.length) {
    lines.push(`Diagnosis:\n${diagnosisList.map((d: any) => `• ${d}`).join("\n")}`);
  }
  if (testsList.length) {
    lines.push(`Tests / Follow-ups:\n${testsList.map((t: any) => `• ${t}`).join("\n")}`);
  }
  if (meds.length) {
    const medLines = meds.map((med: any) => {
      const parts = [
        med.name ? `• ${med.name}` : "• Medicine",
        med.dosage ? `Dosage: ${med.dosage}` : null,
        med.frequency ? `Frequency: ${med.frequency}` : null,
        med.timing ? `Timing: ${med.timing}` : null,
        med.indication ? `Why: ${med.indication}` : null,
        med.instructions ? `Notes: ${med.instructions}` : null,
        med.side_effects?.length
          ? `Warnings: ${med.side_effects.join(", ")}` 
          : null,
      ].filter(Boolean);
      return parts.join(" | ");
    });
    lines.push(`Medicines:\n${medLines.join("\n")}`);
  }
  if (notes) {
    lines.push(`Notes:\n${notes}`);
  }
  if (doctorNotes) {
    lines.push(`Doctor Notes:\n${doctorNotes}`);
  }
  return lines.length ? lines.join("\n\n") : "Analysis completed.";
};
