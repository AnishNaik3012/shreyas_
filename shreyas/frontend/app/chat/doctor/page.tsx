"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import RoleActionCards from "../../components/RoleActionCards";
import ScrollButtons from "../components/ScrollButtons";
import ChatBar from "../components/ChatBar";
import ReportViewerModal from "../components/ReportViewerModal";
import ChatMessage from "../components/ChatMessage";
import { useModule } from "../context";
import { Role } from "@/lib/types";
import {
  formatModuleResponse,
  getGuideTopicResponse,
} from "@/lib/moduleResponses";
import {
  AnalysisKind,
  formatAnalysisResult,
  getFlowIntro,
  getLearnMoreText,
  validateAnalysisFile,
} from "../../../utils/analysisFlow";
import { buildSpeechText } from "../../../utils/chatSpeechText";
import { ttsService } from "../../../utils/ttsService";

const HEADER_HEIGHT = 84;
const INPUT_HEIGHT = 92;
const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000";

type ChatOption = {
  label: string;
  value: string;
};

type ChatItem = {
  id: string;
  sender: "user" | "bot";
  kind: "text" | "options" | "typing" | "card" | "report_result" | "prescription_result";
  text?: string;
  options?: ChatOption[];
  cardLines?: string[];
  actions?: ChatOption[];
  reportActions?: ReportAction[];
  summary?: string | null;
  details?: string | null;
  appointmentId?: string;
};

type AppointmentListItem = {
  id: string;
  appointment_date: string;
  time_slot: string;
  department: string;
  doctor_name: string;
  patient_name: string;
  reason?: string | null;
  status: string;
};

type CheckupListItem = {
  id: string;
  appointment_date: string;
  time_slot: string;
  checkup_type: string;
  tests_selected?: string[] | null;
  patient_name?: string | null;
  notes?: string | null;
  status: string;
};

type PatientSummary = {
  name: string;
  lastVisit?: string | null;
  nextVisit?: string | null;
  totalAppointments: number;
  latestStatus?: string | null;
};

type ReportAction = {
  label: string;
  action: "view_report" | "view_prescription" | "download_summary";
  file_url?: string | null;
  summary_url?: string | null;
};

type ReportResultPayload = {
  message?: string;
  reply?: string;
  type?: string | null;
  actions?: ReportAction[] | null;
  summary?: string | null;
  analysis?: Record<string, any> | null;
};

export default function DoctorChatPage() {
  const pageRole: Role = "doctor";
  const router = useRouter();
  const {
    activeModule,
    messages,
    pushBotMessage,
    pushUserMessage,
    setRole,
    guideTopic,
  } = useModule();
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const reportInputRef = useRef<HTMLInputElement | null>(null);
  const prescriptionInputRef = useRef<HTMLInputElement | null>(null);
  const isNearBottomRef = useRef(true);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [showScrollBottom, setShowScrollBottom] = useState(false);
  const [chatItems, setChatItems] = useState<ChatItem[]>([]);
  const [message, setMessage] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerUrl, setViewerUrl] = useState<string | null>(null);
  const [viewerType, setViewerType] = useState<string | null>(null);
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const [patientPanelOpen, setPatientPanelOpen] = useState(false);
  const [patientList, setPatientList] = useState<PatientSummary[]>([]);
  const [patientLoading, setPatientLoading] = useState(false);
  const [patientError, setPatientError] = useState<string | null>(null);
  const [selectedPatient, setSelectedPatient] = useState<PatientSummary | null>(
    null,
  );
  const [patientAction, setPatientAction] = useState<string | null>(null);
  const [patientRemark, setPatientRemark] = useState("");
  const idCounterRef = useRef(0);
  const syncedCountRef = useRef(0);

  const nextId = (prefix: string) => {
    idCounterRef.current += 1;
    return `${prefix}-${idCounterRef.current}`;
  };

  const addChatItem = (item: Omit<ChatItem, "id">) => {
    setChatItems((prev) => [...prev, { ...item, id: nextId("msg") }]);
  };

  const addUserBubble = (text: string) => {
    addChatItem({
      sender: "user",
      kind: "text",
      text,
    });
  };

  const addBotBubble = (item: Omit<ChatItem, "id" | "sender">) => {
    const typingId = nextId("typing");
    setChatItems((prev) => [
      ...prev,
      { id: typingId, sender: "bot", kind: "typing" },
    ]);
    window.setTimeout(() => {
      setChatItems((prev) => {
        const filtered = prev.filter((entry) => entry.id !== typingId);
        return [
          ...filtered,
          { ...item, id: nextId("msg"), sender: "bot" },
        ];
      });
    }, 360);
  };

  const addBotText = (text: string) => {
    addBotBubble({ kind: "text", text });
  };

  const addBotReportResult = (
    text: string,
    actions: ReportAction[],
    summary?: string | null,
  ) => {
    addBotBubble({ kind: "report_result", text, reportActions: actions, summary });
  };

  const addBotPrescriptionResult = (
    text: string,
    actions: ReportAction[],
    summary?: string | null,
    details?: string | null,
  ) => {
    addBotBubble({
      kind: "prescription_result",
      text,
      reportActions: actions,
      summary,
      details,
    });
  };

  const addAppointmentCards = (items: AppointmentListItem[]) => {
    if (!items.length) {
      addBotText("No appointments found for today.");
      return;
    }
    items.forEach((item) => {
      addBotBubble({
        kind: "card",
        appointmentId: item.id,
        cardLines: [
          `Patient: ${item.patient_name}`,
          `Department: ${item.department}`,
          `Date: ${item.appointment_date}`,
          `Time: ${item.time_slot}`,
          `Reason: ${item.reason ?? "N/A"}`,
          `Status: ${item.status}`,
        ],
        actions:
          item.status === "completed" || item.status === "missed"
            ? undefined
            : [
                { label: "Mark completed", value: "completed" },
                { label: "Mark missed", value: "missed" },
              ],
      });
    });
  };

  const addCheckupCards = (items: CheckupListItem[]) => {
    if (!items.length) {
      addBotText("No checkups found.");
      return;
    }
    items.forEach((item) => {
      addBotBubble({
        kind: "card",
        cardLines: [
          `Patient: ${item.patient_name ?? "Unknown"}`,
          `Type: ${item.checkup_type}`,
          `Tests: ${(item.tests_selected || []).join(", ") || "N/A"}`,
          `Date: ${item.appointment_date}`,
          `Time: ${item.time_slot}`,
          `Notes: ${item.notes ?? "N/A"}`,
          `Status: ${item.status}`,
        ],
      });
    });
  };

  const getAuthToken = () =>
    typeof window !== "undefined" ? localStorage.getItem("access_token") : null;

  const fetchDoctorAppointments = async () => {
    try {
      const token = getAuthToken();
      const res = await fetch(`${API_BASE}/appointments/doctor`, {
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      if (!res.ok) {
        addBotText("I couldn't load your appointments.");
        return;
      }
      const data = (await res.json()) as AppointmentListItem[];
      const today = new Date().toISOString().slice(0, 10);
      const todays = data.filter((appt) => appt.appointment_date === today);
      const upcoming = data.filter((appt) => appt.appointment_date > today);
      addBotText("Today's Appointments");
      addAppointmentCards(todays);
      if (upcoming.length) {
        addBotText("Upcoming Appointments");
        addAppointmentCards(upcoming);
      }
    } catch (error) {
      addBotText("I couldn't reach the server. Please try again.");
    }
  };

  const fetchDoctorCheckups = async () => {
    try {
      const token = getAuthToken();
      const res = await fetch(`${API_BASE}/checkups/doctor`, {
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      if (!res.ok) {
        addBotText("I couldn't load your checkups.");
        return;
      }
      const data = (await res.json()) as CheckupListItem[];
      const today = new Date().toISOString().slice(0, 10);
      const todays = data.filter((chk) => chk.appointment_date === today);
      const upcoming = data.filter((chk) => chk.appointment_date > today);
      addBotText("Today's Checkups");
      addCheckupCards(todays);
      if (upcoming.length) {
        addBotText("Upcoming Checkups");
        addCheckupCards(upcoming);
      }
    } catch (error) {
      addBotText("I couldn't reach the server. Please try again.");
    }
  };

  const buildPatientList = (items: AppointmentListItem[]): PatientSummary[] => {
    const map = new Map<string, AppointmentListItem[]>();
    items.forEach((item) => {
      const list = map.get(item.patient_name) ?? [];
      list.push(item);
      map.set(item.patient_name, list);
    });
    return Array.from(map.entries()).map(([name, appts]) => {
      const sorted = [...appts].sort((a, b) =>
        a.appointment_date.localeCompare(b.appointment_date),
      );
      const lastVisit = sorted[sorted.length - 1]?.appointment_date ?? null;
      const nextVisit = sorted.find(
        (appt) => appt.appointment_date >= new Date().toISOString().slice(0, 10),
      )?.appointment_date;
      return {
        name,
        lastVisit,
        nextVisit: nextVisit ?? null,
        totalAppointments: appts.length,
        latestStatus: sorted[sorted.length - 1]?.status ?? null,
      };
    });
  };

  const fetchDoctorPatients = async () => {
    try {
      setPatientLoading(true);
      setPatientError(null);
      const token = getAuthToken();
      const res = await fetch(`${API_BASE}/appointments/doctor`, {
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      if (!res.ok) {
        setPatientError("I couldn't load your patients.");
        setPatientList([]);
        return;
      }
      const data = (await res.json()) as AppointmentListItem[];
      const list = buildPatientList(data);
      setPatientList(list);
      if (list.length) {
        setSelectedPatient(list[0]);
      } else {
        setSelectedPatient(null);
      }
    } catch (error) {
      setPatientError("I couldn't reach the server. Please try again.");
      setPatientList([]);
      setSelectedPatient(null);
    } finally {
      setPatientLoading(false);
    }
  };

  const updateStatus = async (appointmentId: string, status: string) => {
    try {
      const token = getAuthToken();
      const res = await fetch(`${API_BASE}/appointments/${appointmentId}/status`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) {
        addBotText("I couldn't update that appointment status.");
        return;
      }
      addBotText(`Appointment marked as ${status}.`);
      fetchDoctorAppointments();
    } catch (error) {
      addBotText("I couldn't reach the server. Please try again.");
    }
  };

  const doctorCards = [
    {
      title: "Today's Appointments",
      description: "View today's schedule.",
    },
    {
      title: "Today's Checkups",
      description: "View assigned checkups.",
    },
    {
      title: "Patients",
      description: "Review patients, prescriptions, and next steps.",
    },
    {
      title: "Availability",
      description: "Manage availability.",
    },
  ];

  useEffect(() => {
    setRole(pageRole);
  }, [pageRole, setRole]);

  useEffect(() => {
    if (activeModule === "appointments") {
      addUserBubble("Today's appointments");
      fetchDoctorAppointments();
    }
    if (activeModule === "checkups") {
      addUserBubble("Today's checkups");
      fetchDoctorCheckups();
    }
  }, [activeModule]);

  useEffect(() => {
    if (activeModule !== "guide") return;
    const response = getGuideTopicResponse(pageRole, guideTopic);
    if (!response) return;
    const text = formatModuleResponse(response);
    const userPrompt =
      guideTopic === "How to Use"
        ? "How to use?"
        : guideTopic === "Privacy and Concern"
        ? "Privacy and concern?"
        : "Help?";
    const hasUserPrompt = messages.some(
      (m) => m.sender === "user" && m.text === userPrompt,
    );
    const hasBotResponse = messages.some(
      (m) => m.sender === "bot" && m.text === text,
    );
    if (!hasUserPrompt) {
      pushUserMessage(userPrompt);
    }
    if (!hasBotResponse) {
      pushBotMessage(text);
    }
  }, [
    activeModule,
    messages,
    pageRole,
    pushBotMessage,
    pushUserMessage,
    guideTopic,
  ]);

  useEffect(() => {
    if (messages.length <= syncedCountRef.current) return;
    const newItems = messages
      .slice(syncedCountRef.current)
      .map((m) => ({
        id: nextId("ctx"),
        sender: m.sender,
        kind: "text" as const,
        text: m.text,
      }));
    setChatItems((prev) => [...prev, ...newItems]);
    syncedCountRef.current = messages.length;
  }, [messages]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const shouldAutoScroll =
      el.scrollTop + el.clientHeight >= el.scrollHeight - 50;
    if (shouldAutoScroll) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [chatItems]);

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const threshold = 160;
    const distanceFromBottom =
      el.scrollHeight - el.scrollTop - el.clientHeight;
    isNearBottomRef.current = distanceFromBottom < threshold;
    setShowScrollTop(el.scrollTop > 120);
    setShowScrollBottom(
      el.scrollTop + el.clientHeight < el.scrollHeight - 120,
    );
  };

  useEffect(() => {
    handleScroll();
  }, [chatItems]);

  const scrollToBottom = () => {
    requestAnimationFrame(() => {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    });
  };

  useEffect(() => {
    const handler = () => scrollToBottom();
    window.addEventListener("chat-scroll-bottom", handler);
    return () => window.removeEventListener("chat-scroll-bottom", handler);
  }, []);

  const handleOptionSelect = (option: ChatOption) => {
    addUserBubble(option.label);
    scrollToBottom();
    if (option.value === "upload_report") {
      triggerReportUpload();
      return;
    }
    if (option.value === "upload_prescription") {
      triggerPrescriptionUpload();
      return;
    }
    if (option.value === "report_learn_more") {
      addBotText(getLearnMoreText("report"));
      return;
    }
    if (option.value === "prescription_learn_more") {
      addBotText(getLearnMoreText("prescription"));
      return;
    }
  };

  const handleAction = (action: ReportAction) => {
    if (
      (action.action === "view_report" || action.action === "view_prescription") &&
      action.file_url
    ) {
      setViewerUrl(action.file_url);
      setViewerType(
        action.file_url.startsWith("data:application/pdf")
          ? "application/pdf"
          : action.file_url.startsWith("data:image/")
            ? "image"
            : null,
      );
      setViewerOpen(true);
      return;
    }
    if (action.action === "download_summary" && action.summary_url) {
      const url = action.summary_url.startsWith("/")
        ? `${API_BASE}${action.summary_url}`
        : action.summary_url;
      window.open(url, "_blank", "noopener,noreferrer");
    }
    scrollToBottom();
  };

  const handleSpeak = (id: string, text: string) => {
    if (!ttsService.isSupported()) {
      alert("Text-to-Speech not supported in this browser.");
      return;
    }
    setSpeakingId(id);
    ttsService.speak(text, {
      onEnd: () => {
        setSpeakingId((current) => (current === id ? null : current));
      },
    });
  };

  const handleStop = (id?: string) => {
    ttsService.stop();
    if (id) {
      setSpeakingId((current) => (current === id ? null : current));
      return;
    }
    setSpeakingId(null);
  };

  const handleSend = () => {
    const trimmed = message.trim();
    if (isUploading) return;
    if (!trimmed) return;
    setMessage("");
    addUserBubble(trimmed);
    const normalized = trimmed.toLowerCase();
    if (normalized === "report_analysis_start") {
      triggerAnalysisFlow("report");
      return;
    }
    if (normalized === "prescription_analysis_start") {
      triggerAnalysisFlow("prescription");
      return;
    }
    const sendQuery = async () => {
      try {
        const token = getAuthToken();
        const typingId = nextId("typing");
        setChatItems((prev) => [
          ...prev,
          { id: typingId, sender: "bot", kind: "typing" },
        ]);
        const res = await fetch(`${API_BASE}/chat/message`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ message: trimmed }),
        });
        setChatItems((prev) => prev.filter((entry) => entry.id !== typingId));
        if (!res.ok) {
          addBotText("I couldn't answer that right now. Please try again.");
          return;
        }
        const data = (await res.json()) as ReportResultPayload;
        if (data.type === "report_result") {
          addBotReportResult(
            data.message ?? "Your report has been analyzed.",
            data.actions ?? [],
            data.summary ?? null,
          );
        } else if (data.type === "prescription_result") {
          const detailsText = data.analysis
            ? formatAnalysisResult("prescription", { analysis: data.analysis })
            : null;
          addBotPrescriptionResult(
            data.message ?? "Your prescription has been analyzed.",
            data.actions ?? [],
            data.summary ?? null,
            detailsText,
          );
        } else {
          addBotText(data.message ?? data.reply ?? "");
        }
      } catch (error) {
        addBotText("I couldn't reach the server. Please try again.");
      }
    };
    void sendQuery();
  };

  const triggerAnalysisFlow = (kind: AnalysisKind) => {
    addUserBubble(
      kind === "report" ? "report_analysis_start" : "prescription_analysis_start",
    );
    const intro = getFlowIntro(kind);
    addBotBubble({ kind: "options", text: intro.text, options: intro.options });
  };

  const triggerReportUpload = () => reportInputRef.current?.click();
  const triggerPrescriptionUpload = () => prescriptionInputRef.current?.click();

  const uploadFile = async (kind: AnalysisKind, file: File) => {
    const validationError = validateAnalysisFile(kind, file);
    if (validationError) {
      addBotText(validationError);
      return;
    }
    addUserBubble(`Uploaded ${kind}: ${file.name}`);
    addBotText(
      kind === "report" ? "Analyzing report..." : "Analyzing prescription...",
    );
    setIsUploading(true);
    try {
      const token = getAuthToken();
      const formData = new FormData();
      formData.append("file", file);
      const endpoint =
        kind === "report" ? "/chat/report/analyze" : "/chat/prescription/analyze";
      const res = await fetch(`${API_BASE}${endpoint}`, {
        method: "POST",
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: formData,
      });
      if (!res.ok) {
        addBotText("Unable to analyze file. Please try again.");
        return;
      }
      const data = (await res.json()) as ReportResultPayload;
      if (data.type === "report_result") {
        addBotReportResult(
          data.message ?? "Your report has been analyzed.",
          data.actions ?? [],
          data.summary ?? null,
        );
      } else if (data.type === "prescription_result") {
        const detailsText = data.analysis
          ? formatAnalysisResult("prescription", { analysis: data.analysis })
          : null;
        addBotPrescriptionResult(
          data.message ?? "Your prescription has been analyzed.",
          data.actions ?? [],
          data.summary ?? null,
          detailsText,
        );
      } else {
        addBotText(formatAnalysisResult(kind, data));
      }
    } catch (error) {
      addBotText("Unable to analyze file. Please try again.");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div
      style={{
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        background: "#020617",
        color: "white",
      }}
    >
      <header
        style={{
          height: HEADER_HEIGHT,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 24px",
          background: "#020617",
          borderBottom: "1px solid rgba(39,212,207,0.2)",
          position: "sticky",
          top: 0,
          zIndex: 5,
        }}
      >
        <h1
          style={{
            fontSize: 26,
            fontWeight: 600,
            color: "#27D4CF",
          }}
        >
          Doctor Dashboard
        </h1>
        <div style={{ textAlign: "right" }}>
          <div style={{ color: "white", fontWeight: 600 }}>
            Hello Doctor
          </div>
          <div style={{ color: "white", opacity: 0.7, fontSize: 12 }}>
            How can I help you?
          </div>
        </div>
      </header>

      <div
        ref={scrollRef}
        onScroll={handleScroll}
        style={{
          height: `calc(100vh - ${HEADER_HEIGHT}px - ${INPUT_HEIGHT}px)`,
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
          padding: "24px 24px",
          paddingBottom: INPUT_HEIGHT,
        }}
      >
        <RoleActionCards
          cards={doctorCards}
          onCardClick={(title) => {
            scrollToBottom();
            if (title === "Today's Appointments") {
              addUserBubble("Today's appointments");
              fetchDoctorAppointments();
            }
            if (title === "Today's Checkups") {
              addUserBubble("Today's checkups");
              fetchDoctorCheckups();
            }
            if (title === "Availability") {
              addUserBubble("Availability");
              router.push("/doctor/schedule");
            }
            if (title === "Patients") {
              setPatientPanelOpen(true);
              setPatientAction(null);
              setPatientRemark("");
              fetchDoctorPatients();
            }
          }}
        />

        {patientPanelOpen ? (
          <div
            style={{
              marginTop: 24,
              padding: 20,
              borderRadius: 18,
              border: "1px solid rgba(39,212,207,0.25)",
              background: "rgba(8, 18, 32, 0.9)",
              display: "flex",
              flexDirection: "column",
              gap: 16,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
              }}
            >
              <div>
                <div style={{ fontSize: 18, fontWeight: 600, color: "#9be7e5" }}>
                  Patient Hub
                </div>
                <div style={{ fontSize: 13, opacity: 0.7 }}>
                  Click a patient to review details, appointments, checkups, reports, and prescriptions.
                </div>
              </div>
              <button
                onClick={() => setPatientPanelOpen(false)}
                style={{
                  padding: "6px 12px",
                  borderRadius: 999,
                  border: "1px solid rgba(39,212,207,0.6)",
                  background: "transparent",
                  color: "#27D4CF",
                  cursor: "pointer",
                  fontSize: 12,
                }}
              >
                Close
              </button>
            </div>

            {patientError ? <div style={{ color: "#fecaca" }}>{patientError}</div> : null}
            {patientLoading ? <div>Loading patients...</div> : null}

            {!patientLoading && !patientError ? (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "minmax(220px, 1fr) minmax(280px, 2fr)",
                  gap: 16,
                }}
              >
                <div
                  style={{
                    borderRadius: 14,
                    border: "1px solid rgba(39,212,207,0.2)",
                    padding: 12,
                    minHeight: 240,
                  }}
                >
                  <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>
                    Patient List
                  </div>
                  {patientList.length === 0 ? (
                    <div style={{ fontSize: 13, opacity: 0.7 }}>
                      No patients scheduled yet.
                    </div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {patientList.map((patient) => {
                        const isActive = selectedPatient?.name === patient.name;
                        return (
                          <button
                            key={patient.name}
                            onClick={() => setSelectedPatient(patient)}
                            style={{
                              textAlign: "left",
                              padding: "10px 12px",
                              borderRadius: 12,
                              border: isActive
                                ? "1px solid rgba(39,212,207,0.8)"
                                : "1px solid rgba(148,163,184,0.2)",
                              background: isActive
                                ? "rgba(39,212,207,0.12)"
                                : "rgba(15, 23, 42, 0.4)",
                              color: "white",
                              cursor: "pointer",
                            }}
                          >
                            <div style={{ fontWeight: 600 }}>{patient.name}</div>
                            <div style={{ fontSize: 12, opacity: 0.7 }}>
                              Visits: {patient.totalAppointments}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div
                  style={{
                    borderRadius: 14,
                    border: "1px solid rgba(39,212,207,0.2)",
                    padding: 16,
                    minHeight: 240,
                    display: "flex",
                    flexDirection: "column",
                    gap: 12,
                  }}
                >
                  {selectedPatient ? (
                    <>
                      <div style={{ fontSize: 18, fontWeight: 600 }}>
                        {selectedPatient.name}
                      </div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 12, fontSize: 13 }}>
                        <span>Last visit: {selectedPatient.lastVisit ?? "N/A"}</span>
                        <span>Next visit: {selectedPatient.nextVisit ?? "N/A"}</span>
                        <span>Status: {selectedPatient.latestStatus ?? "N/A"}</span>
                      </div>
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
                          gap: 10,
                        }}
                      >
                        {[
                          "Book Appointment",
                          "Checkups",
                          "Reports",
                          "Prescriptions",
                        ].map((label) => (
                          <div
                            key={label}
                            style={{
                              borderRadius: 12,
                              border: "1px solid rgba(39,212,207,0.2)",
                              padding: 10,
                              fontSize: 12,
                              opacity: 0.85,
                            }}
                          >
                            {label}
                          </div>
                        ))}
                      </div>

                      <div
                        style={{
                          marginTop: 6,
                          padding: 12,
                          borderRadius: 12,
                          background: "rgba(15, 23, 42, 0.7)",
                          border: "1px solid rgba(39,212,207,0.25)",
                          display: "flex",
                          flexDirection: "column",
                          gap: 10,
                        }}
                      >
                        <div style={{ fontWeight: 600 }}>
                          What do you want to do next?
                        </div>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                          {[
                            "Write prescription",
                            "Suggest checkups",
                            "Add remarks",
                          ].map((label) => (
                            <button
                              key={label}
                              onClick={() => setPatientAction(label)}
                              style={{
                                padding: "6px 12px",
                                borderRadius: 999,
                                border: "1px solid rgba(39,212,207,0.6)",
                                background: "rgba(4, 22, 34, 0.9)",
                                color: "#27D4CF",
                                fontSize: 12,
                                cursor: "pointer",
                              }}
                            >
                              {label}
                            </button>
                          ))}
                        </div>
                        {patientAction ? (
                          <div style={{ fontSize: 12, opacity: 0.75 }}>
                            Action selected: {patientAction}
                          </div>
                        ) : null}
                        <textarea
                          value={patientRemark}
                          onChange={(event) => setPatientRemark(event.target.value)}
                          placeholder="Add remarks or notes for this patient..."
                          rows={3}
                          style={{
                            resize: "vertical",
                            borderRadius: 10,
                            padding: "8px 10px",
                            background: "rgba(15, 23, 42, 0.6)",
                            color: "white",
                            border: "1px solid rgba(39,212,207,0.25)",
                            fontSize: 12,
                          }}
                        />
                      </div>
                    </>
                  ) : (
                    <div style={{ opacity: 0.7 }}>Select a patient to view details.</div>
                  )}
                </div>
              </div>
            ) : null}
          </div>
        ) : null}

        <div
          style={{
            marginTop: 32,
            display: "flex",
            flexDirection: "column",
            gap: 12,
          }}
        >
          {chatItems.map((m, i) => {
            const speechText = m.sender === "bot" ? buildSpeechText(m) : "";
            return (
              <ChatMessage
                key={m.id}
                sender={m.sender}
                index={i}
                speechText={speechText}
                isSpeaking={speakingId === m.id}
                onSpeak={() => handleSpeak(m.id, speechText)}
                onStop={() => handleStop(m.id)}
              >
                {m.kind === "typing" ? (
                  <div
                    style={{
                      display: "flex",
                      gap: 6,
                      alignItems: "center",
                      minWidth: 48,
                    }}
                  >
                    {[0, 1, 2].map((dot) => (
                      <span
                        key={dot}
                        style={{
                          width: 6,
                          height: 6,
                          borderRadius: "50%",
                          background: "#27D4CF",
                          display: "inline-block",
                          animation: "pulse 1s ease-in-out infinite",
                          animationDelay: `${dot * 0.12}s`,
                        }}
                      />
                    ))}
                  </div>
                ) : null}

                {m.kind === "text" ? m.text : null}

                {m.kind === "report_result" ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    {m.text ? (
                      <div style={{ fontWeight: 500 }}>{m.text}</div>
                    ) : null}
                    {m.summary ? (
                      <div
                        style={{
                          padding: "10px 12px",
                          borderRadius: 12,
                          background: "rgba(15, 23, 42, 0.7)",
                          border: "1px solid rgba(39,212,207,0.25)",
                          fontSize: 14,
                          lineHeight: 1.6,
                        }}
                      >
                        <strong style={{ color: "#9be7e5" }}>Summary:</strong>{" "}
                        {m.summary}
                      </div>
                    ) : null}
                    <div
                      style={{
                        display: "flex",
                        flexWrap: "wrap",
                        gap: 10,
                      }}
                    >
                      {m.reportActions?.map((action) => (
                        <button
                          key={action.label}
                          onClick={() => handleAction(action)}
                          style={{
                            padding: "8px 14px",
                            borderRadius: 999,
                            border: "1px solid rgba(39,212,207,0.75)",
                            background: "rgba(4, 22, 34, 0.9)",
                            color: "#27D4CF",
                            fontSize: 13,
                            cursor: "pointer",
                          }}
                        >
                          {action.label}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}

                {m.kind === "prescription_result" ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    {m.text ? (
                      <div style={{ fontWeight: 500 }}>{m.text}</div>
                    ) : null}
                    {m.summary ? (
                      <div
                        style={{
                          padding: "10px 12px",
                          borderRadius: 12,
                          background: "rgba(15, 23, 42, 0.7)",
                          border: "1px solid rgba(39,212,207,0.25)",
                          fontSize: 14,
                          lineHeight: 1.6,
                        }}
                      >
                        <strong style={{ color: "#9be7e5" }}>Summary:</strong>{" "}
                        {m.summary}
                      </div>
                    ) : null}
                    {m.details ? (
                      <div style={{ fontSize: 13, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
                        {m.details}
                      </div>
                    ) : null}
                    <div
                      style={{
                        display: "flex",
                        flexWrap: "wrap",
                        gap: 10,
                      }}
                    >
                      {m.reportActions?.map((action) => (
                        <button
                          key={action.label}
                          onClick={() => handleAction(action)}
                          style={{
                            padding: "8px 14px",
                            borderRadius: 999,
                            border: "1px solid rgba(39,212,207,0.75)",
                            background: "rgba(4, 22, 34, 0.9)",
                            color: "#27D4CF",
                            fontSize: 13,
                            cursor: "pointer",
                          }}
                        >
                          {action.label}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}

                {m.kind === "card" ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                      {m.cardLines?.map((line) => (
                        <div key={line}>{line}</div>
                      ))}
                    </div>
                    {m.actions && m.appointmentId ? (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                        {m.actions.map((action) => (
                          <button
                            key={action.value}
                            onClick={() => {
                              addUserBubble(action.label);
                              updateStatus(m.appointmentId ?? "", action.value);
                              scrollToBottom();
                            }}
                            style={{
                              padding: "8px 14px",
                              borderRadius: 999,
                              border: "1px solid rgba(39,212,207,0.75)",
                              background: "rgba(4, 22, 34, 0.9)",
                              color: "#27D4CF",
                              fontSize: 13,
                              cursor: "pointer",
                            }}
                          >
                            {action.label}
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ) : null}

                {m.kind === "options" ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    {m.text ? (
                      <div style={{ fontWeight: 500 }}>{m.text}</div>
                    ) : null}
                    <div
                      style={{
                        display: "flex",
                        flexWrap: "wrap",
                        gap: 10,
                      }}
                    >
                      {m.options?.map((option) => (
                        <button
                          key={option.label}
                          onClick={() => handleOptionSelect(option)}
                          style={{
                            padding: "8px 14px",
                            borderRadius: 999,
                            border: "1px solid rgba(39,212,207,0.75)",
                            background: "rgba(4, 22, 34, 0.9)",
                            color: "#27D4CF",
                            fontSize: 13,
                            cursor: "pointer",
                          }}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}
              </ChatMessage>
            );
          })}
          <div ref={bottomRef} />
        </div>
      </div>

      <style>{`
        @keyframes chatInRight {
          from { opacity: 0; transform: translateX(16px) scale(0.98); }
          to { opacity: 1; transform: translateX(0) scale(1); }
        }
        @keyframes chatInLeft {
          from { opacity: 0; transform: translateX(-16px) scale(0.98); }
          to { opacity: 1; transform: translateX(0) scale(1); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 0.35; transform: translateY(0); }
          50% { opacity: 1; transform: translateY(-2px); }
        }
      `}</style>

      <ScrollButtons
        showTop={showScrollTop}
        showBottom={showScrollBottom}
        onScrollTop={() =>
          scrollRef.current?.scrollTo({ top: 0, behavior: "smooth" })
        }
        onScrollBottom={() =>
          scrollRef.current?.scrollTo({
            top: scrollRef.current?.scrollHeight ?? 0,
            behavior: "smooth",
          })
        }
        bottomOffset={INPUT_HEIGHT + 24}
        align="center"
        centerOffset={130}
      />

      <ChatBar
        value={message}
        onChange={setMessage}
        onSend={handleSend}
        disabled={isUploading}
        height={INPUT_HEIGHT}
      />
      <ReportViewerModal
        isOpen={viewerOpen}
        fileUrl={viewerUrl}
        fileType={viewerType}
        onClose={() => setViewerOpen(false)}
      />
      <input
        ref={reportInputRef}
        type="file"
        accept="application/pdf,image/jpeg,image/png"
        style={{ display: "none" }}
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) {
            uploadFile("report", file);
          }
          event.currentTarget.value = "";
        }}
      />
      <input
        ref={prescriptionInputRef}
        type="file"
        accept="application/pdf,image/jpeg,image/png"
        style={{ display: "none" }}
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) {
            uploadFile("prescription", file);
          }
          event.currentTarget.value = "";
        }}
      />
    </div>
  );
}
