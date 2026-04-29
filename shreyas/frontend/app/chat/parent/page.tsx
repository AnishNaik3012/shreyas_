
"use client";

import { useEffect, useRef, useState } from "react";
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

type ChatResponse = {
  reply?: string;
  message?: string;
  options?: ChatOption[] | string[] | null;
  step?: string | null;
  appointments?: AppointmentListItem[] | null;
  checkups?: CheckupListItem[] | null;
  type?: string | null;
  actions?: ReportAction[] | null;
  summary?: string | null;
  analysis?: Record<string, any> | null;
};

type ChatItem = {
  id: string;
  sender: "user" | "bot";
  kind:
    | "text"
    | "options"
    | "typing"
    | "card"
    | "calendar"
    | "slots"
    | "form"
    | "report_result"
    | "prescription_result";
  text?: string;
  options?: ChatOption[];
  cardLines?: string[];
  actions?: ChatOption[];
  reportActions?: ReportAction[];
  summary?: string | null;
  details?: string | null;
  checkupId?: string;
  calendarMonth?: string;
  selectedDate?: string | null;
  slotDate?: string | null;
  placeholder?: string;
  fieldKey?: "reason" | "notes" | "description";
};

type AppointmentListItem = {
  id: string;
  appointment_date: string;
  time_slot: string;
  doctor_name: string;
  hospital_name: string;
  status: string;
};

type CheckupListItem = {
  id: string;
  checkup_type: string;
  tests_selected?: string[] | null;
  appointment_date: string;
  time_slot: string;
  status: string;
};

type ReportAction = {
  label: string;
  action: "view_report" | "view_prescription" | "download_summary";
  file_url?: string | null;
  summary_url?: string | null;
};

const nextStepMap: Record<string, string | null> = {
  choose_action: "select_department",
  select_department: "select_doctor",
  select_doctor: "choose_day_type",
  choose_day_type: "select_date",
  select_date: "select_slot",
  select_slot: "enter_reason",
  enter_reason: "enter_description",
  enter_description: "confirm_booking",
  confirm_booking: "confirm_booking",
  select_checkup_type: "select_tests",
  select_tests: "select_doctor",
  select_day_type: "select_date",
  select_time_slot: "enter_notes",
  enter_notes: "confirm_checkup",
  confirm_checkup: "confirm_checkup",
  completed: null,
};

const intentInitialStep: Record<string, string | null> = {
  appointments: "choose_action",
  book_appointment: "choose_action",
  cancel_appointment: "choose_action",
  view_appointments: "choose_action",
  checkups: "select_checkup_type",
};

export default function ParentChatPage() {
  const [message, setMessage] = useState("");
  const pageRole: Role = "parent";
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
  const [currentStep, setCurrentStep] = useState<string | null>(null);
  const [lastChosenDate, setLastChosenDate] = useState<string | null>(null);
  const [lastDayType, setLastDayType] = useState<"today" | "next" | null>(null);
  const [formValues, setFormValues] = useState<{
    reason: string;
    notes: string;
    description: string;
  }>({
    reason: "",
    notes: "",
    description: "",
  });
  const [isUploading, setIsUploading] = useState(false);
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerUrl, setViewerUrl] = useState<string | null>(null);
  const [viewerType, setViewerType] = useState<string | null>(null);
  const idCounterRef = useRef(0);
  const syncedCountRef = useRef(0);
  const lastModuleRef = useRef(activeModule);

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
    }, 380);
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

  const addBotOptions = (text: string, options: ChatOption[]) => {
    addBotBubble({ kind: "options", text, options });
  };
  const addCalendarBubble = (text: string) => {
    const now = new Date();
    const monthKey = new Date(now.getFullYear(), now.getMonth(), 1)
      .toISOString()
      .slice(0, 10);
    addBotBubble({
      kind: "calendar",
      text,
      calendarMonth: monthKey,
      selectedDate: null,
    });
  };

  const addSlotBubble = (text: string, options: ChatOption[]) => {
    addBotBubble({
      kind: "slots",
      text,
      options,
      slotDate: lastChosenDate,
    });
  };

  const addFormBubble = (
    text: string,
    placeholder: string,
    fieldKey: "reason" | "notes" | "description",
  ) => {
    addBotBubble({
      kind: "form",
      text,
      placeholder,
      fieldKey,
    });
  };

  const updateChatItem = (
    id: string,
    updater: (item: ChatItem) => ChatItem,
  ) => {
    setChatItems((prev) =>
      prev.map((item) => (item.id === id ? updater(item) : item)),
    );
  };

  const normalizeOptions = (
    options: ChatResponse["options"],
  ): ChatOption[] | null => {
    if (!options || !options.length) return null;
    if (typeof options[0] === "string") {
      return (options as string[]).map((item) => ({
        label: item,
        value: item,
      }));
    }
    return options as ChatOption[];
  };

  const renderChatResponse = (data: ChatResponse) => {
    const text = data.message ?? data.reply ?? "";
    const normalizedOptions = normalizeOptions(data.options);
    if (data.type === "report_result") {
      addBotReportResult(
        text || "Your report has been analyzed.",
        data.actions ?? [],
        data.summary ?? null,
      );
      return;
    }
    if (data.type === "prescription_result") {
      const detailsText = data.analysis
        ? formatAnalysisResult("prescription", { analysis: data.analysis })
        : null;
      addBotPrescriptionResult(
        text || "Your prescription has been analyzed.",
        data.actions ?? [],
        data.summary ?? null,
        detailsText,
      );
      return;
    }
    if (data.step === "select_date") {
      addCalendarBubble(text || "Select a date");
    } else if (data.step === "select_slot" || data.step === "select_time_slot") {
      if (normalizedOptions && normalizedOptions.length) {
        addSlotBubble(text || "Select a time slot", normalizedOptions);
      } else if (text) {
        addBotText(text);
      }
    } else if (data.step === "enter_reason") {
      addFormBubble(
        text || "What is the reason for visit?",
        "e.g., fever, check-up, vaccination",
        "reason",
      );
    } else if (data.step === "enter_notes") {
      addFormBubble(
        text || "What is reason or notes?",
        "e.g., routine checkup notes",
        "notes",
      );
    } else if (data.step === "enter_description") {
      addFormBubble(
        text || "Add a brief description for the appointment.",
        "e.g., symptoms summary or visit details",
        "description",
      );
    } else if (normalizedOptions && normalizedOptions.length) {
      addBotOptions(text, normalizedOptions);
    } else if (text) {
      addBotText(text);
    }
    if (data.appointments && data.appointments.length) {
      addAppointmentCards(data.appointments);
    }
    if (data.checkups && data.checkups.length) {
      addCheckupCards(data.checkups);
    }
    if (data.step !== undefined) {
      setCurrentStep(data.step ?? null);
    }
  };

  const addAppointmentCards = (items: AppointmentListItem[]) => {
    if (!items.length) {
      addBotText("No appointments found.");
      return;
    }
    items.forEach((item) => {
      addBotBubble({
        kind: "card",
        cardLines: [
          `Doctor: ${item.doctor_name}`,
          `Hospital: ${item.hospital_name}`,
          `Date: ${item.appointment_date}`,
          `Time: ${item.time_slot}`,
          `Status: ${item.status}`,
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
        checkupId: item.id,
        cardLines: [
          `Checkup: ${item.checkup_type}`,
          `Tests: ${(item.tests_selected || []).join(", ") || "N/A"}`,
          `Date: ${item.appointment_date}`,
          `Time: ${item.time_slot}`,
          `Status: ${item.status}`,
        ],
        actions:
          item.status === "cancelled"
            ? undefined
            : [{ label: "Cancel Checkup", value: "cancel_checkup" }],
      });
    });
  };

  const getAuthToken = () =>
    typeof window !== "undefined" ? localStorage.getItem("access_token") : null;

  const sendIntent = async (intent: string) => {
    try {
      const token = getAuthToken();
      const res = await fetch(`${API_BASE}/chat/intent`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ intent }),
      });
      if (!res.ok) {
        addBotText("I couldn't start that flow. Please try again.");
        return;
      }
      const data = (await res.json()) as ChatResponse;
      renderChatResponse(data);
      if (data.step === undefined) {
        setCurrentStep(intentInitialStep[intent] ?? null);
      }
    } catch (error) {
      addBotText("I couldn't reach the server. Please try again.");
    }
  };

  const sendStep = async (step: string, value: any) => {
    try {
      const token = getAuthToken();
      const res = await fetch(`${API_BASE}/chat/step`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ step, value }),
      });
      if (!res.ok) {
        addBotText("I couldn't continue that step. Please try again.");
        return;
      }
      const data = (await res.json()) as ChatResponse;
      renderChatResponse(data);
      if (data.step === undefined) {
        const nextStep = nextStepMap[step] ?? currentStep ?? null;
        setCurrentStep(nextStep);
      }
    } catch (error) {
      addBotText("I couldn't reach the server. Please try again.");
    }
  };

  const sendQuery = async (text: string) => {
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
        body: JSON.stringify({ message: text }),
      });
      setChatItems((prev) => prev.filter((entry) => entry.id !== typingId));
      if (!res.ok) {
        addBotText("I couldn't answer that right now. Please try again.");
        return;
      }
      const data = (await res.json()) as ChatResponse;
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

  const triggerAnalysisFlow = (kind: AnalysisKind) => {
    addUserBubble(
      kind === "report" ? "report_analysis_start" : "prescription_analysis_start",
    );
    const intro = getFlowIntro(kind);
    addBotOptions(intro.text, intro.options);
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
      const data = (await res.json()) as ChatResponse;
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


  const parentCards = [
    { title: "Check-Ups", description: "Schedule health checkups." },
    { title: "Appointments", description: "Book doctor appointments." },
    { title: "Reports", description: "Upload reports and get summaries." },
    { title: "Prescriptions", description: "View prescriptions." },
  ];
  useEffect(() => {
    setRole(pageRole);
  }, [pageRole, setRole]);

  useEffect(() => {
    if (activeModule === lastModuleRef.current) return;
    lastModuleRef.current = activeModule;
    if (activeModule === "appointments") {
      addUserBubble("Appointments");
      sendIntent("appointments");
    }
    if (activeModule === "checkups") {
      addUserBubble("Check-ups");
      pushBotMessage("Let's book a checkup...");
      sendIntent("checkups");
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
    if (currentStep === "choose_day_type" || currentStep === "select_day_type") {
      const normalized = option.value.toLowerCase();
      if (normalized === "today") {
        setLastDayType("today");
        const today = new Date();
        setLastChosenDate(today.toISOString().slice(0, 10));
      } else if (normalized === "next available") {
        setLastDayType("next");
        setLastChosenDate(null);
      }
    }
    if (currentStep) {
      sendStep(currentStep, option.value);
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

  const formatCalendarLabel = (date: Date) =>
    date.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });

  const isSameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();

  const parseSlotMinutes = (slot: string) => {
    const match = slot.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
    if (!match) return null;
    const hour = Number(match[1]);
    const minutes = Number(match[2]);
    const meridian = match[3].toUpperCase();
    const normalizedHour =
      meridian === "PM" && hour !== 12
        ? hour + 12
        : meridian === "AM" && hour === 12
        ? 0
        : hour;
    return normalizedHour * 60 + minutes;
  };

  const isSlotInPast = (slot: string, dateLabel: string | null) => {
    if (!dateLabel) return false;
    const today = new Date();
    const [year, month, day] = dateLabel.split("-").map(Number);
    if (!year || !month || !day) return false;
    const slotDate = new Date(year, month - 1, day);
    if (!isSameDay(slotDate, today)) return false;
    const slotMinutes = parseSlotMinutes(slot);
    if (slotMinutes === null) return false;
    const nowMinutes = today.getHours() * 60 + today.getMinutes();
    return slotMinutes <= nowMinutes;
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
    if (currentStep) {
      sendStep(currentStep, trimmed);
      return;
    }
    if (
      normalized.includes("book appointment") ||
      normalized.includes("appointments")
    ) {
      sendIntent("appointments");
      return;
    }
    if (normalized.includes("checkup") || normalized.includes("check-ups")) {
      sendIntent("checkups");
      return;
    }
    sendQuery(trimmed);
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
          Parent Dashboard
        </h1>
        <div style={{ textAlign: "right" }}>
          <div style={{ color: "white", fontWeight: 600 }}>
            Hello Parent
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
          cards={parentCards}
          onCardClick={(title) => {
            scrollToBottom();
            if (title === "Appointments") {
              addUserBubble("Appointments");
              sendIntent("appointments");
            }
            if (title === "Check-Ups") {
              addUserBubble("Check-ups");
              sendIntent("checkups");
            }
            if (title === "Reports") {
              triggerAnalysisFlow("report");
            }
            if (title === "Prescriptions") {
              triggerAnalysisFlow("prescription");
            }
          }}
        />

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
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 8,
                    }}
                  >
                    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                      {m.cardLines?.map((line) => (
                        <div key={line}>{line}</div>
                      ))}
                    </div>
                    {m.actions && m.checkupId ? (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                        {m.actions.map((action) => (
                          <button
                            key={action.value}
                            onClick={() => {
                              addUserBubble(action.label);
                              sendStep("choose_action", {
                                id: m.checkupId ?? "",
                                value: action.value,
                              });
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
                {m.kind === "calendar" ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    {m.text ? (
                      <div style={{ fontWeight: 500 }}>{m.text}</div>
                    ) : null}
                    <div
                      style={{
                        borderRadius: 18,
                        padding: "16px 16px 12px",
                        border: "1px solid rgba(39,212,207,0.6)",
                        background:
                          "linear-gradient(180deg, rgba(11,18,32,0.95) 0%, rgba(4,22,34,0.9) 100%)",
                        boxShadow:
                          "0 18px 40px rgba(0,0,0,0.45), 0 0 24px rgba(39,212,207,0.25)",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: 12,
                          marginBottom: 8,
                        }}
                      >
                        {(() => {
                          const [year, month] = (m.calendarMonth ?? "")
                            .split("-")
                            .map(Number);
                          const today = new Date();
                          const minMonth = new Date(
                            today.getFullYear(),
                            today.getMonth(),
                            1,
                          );
                          const rawMonth = new Date(
                            year || today.getFullYear(),
                            (month || today.getMonth() + 1) - 1,
                            1,
                          );
                          const currentMonth =
                            rawMonth < minMonth ? minMonth : rawMonth;
                          const prevMonth = new Date(
                            currentMonth.getFullYear(),
                            currentMonth.getMonth() - 1,
                            1,
                          );
                          const nextMonth = new Date(
                            currentMonth.getFullYear(),
                            currentMonth.getMonth() + 1,
                            1,
                          );
                          const prevDisabled = prevMonth < minMonth;
                          return (
                            <>
                              <button
                                onClick={() => {
                                  if (prevDisabled) return;
                                  updateChatItem(m.id, (item) => ({
                                    ...item,
                                    calendarMonth: prevMonth.toISOString().slice(0, 10),
                                  }));
                                  scrollToBottom();
                                }}
                                disabled={prevDisabled}
                                style={{
                                  width: 34,
                                  height: 34,
                                  borderRadius: 10,
                                  border: "1px solid rgba(39,212,207,0.55)",
                                  background: prevDisabled
                                    ? "rgba(4, 22, 34, 0.35)"
                                    : "rgba(4, 22, 34, 0.9)",
                                  color: prevDisabled
                                    ? "rgba(255,255,255,0.4)"
                                    : "#27D4CF",
                                  cursor: prevDisabled ? "not-allowed" : "pointer",
                                }}
                                aria-label="Previous month"
                              >
                                {"<"}
                              </button>
                              <div style={{ fontWeight: 700, fontSize: 16 }}>
                                {currentMonth.toLocaleDateString(undefined, {
                                  month: "long",
                                  year: "numeric",
                                })}
                              </div>
                              <button
                                onClick={() => {
                                  updateChatItem(m.id, (item) => ({
                                    ...item,
                                    calendarMonth: nextMonth.toISOString().slice(0, 10),
                                  }));
                                  scrollToBottom();
                                }}
                                style={{
                                  width: 34,
                                  height: 34,
                                  borderRadius: 10,
                                  border: "1px solid rgba(39,212,207,0.55)",
                                  background: "rgba(4, 22, 34, 0.9)",
                                  color: "#27D4CF",
                                  cursor: "pointer",
                                }}
                                aria-label="Next month"
                              >
                                {">"}
                              </button>
                            </>
                          );
                        })()}
                      </div>
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
                        gap: 8,
                        fontSize: 12,
                        opacity: 0.7,
                      }}
                    >
                      {["S", "M", "T", "W", "T", "F", "S"].map((day) => (
                        <div key={day} style={{ textAlign: "center" }}>
                          {day}
                        </div>
                      ))}
                    </div>
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
                        gap: 8,
                      }}
                    >
                      {(() => {
                        const today = new Date();
                        const [year, month] = (m.calendarMonth ?? "").split("-").map(Number);
                        const rawStart = new Date(
                          year || today.getFullYear(),
                          (month || today.getMonth() + 1) - 1,
                          1,
                        );
                        const minMonth = new Date(
                          today.getFullYear(),
                          today.getMonth(),
                          1,
                        );
                        const monthStart = rawStart < minMonth ? minMonth : rawStart;
                        const isPastMonth = monthStart < minMonth;
                        const daysInMonth = new Date(
                          monthStart.getFullYear(),
                          monthStart.getMonth() + 1,
                          0,
                        ).getDate();
                        const leading = monthStart.getDay();
                        const cells = [];
                        for (let i = 0; i < leading; i += 1) {
                          cells.push(
                            <div key={`empty-${i}`} style={{ height: 38 }} />,
                          );
                        }
                        for (let day = 1; day <= daysInMonth; day += 1) {
                          const date = new Date(
                            monthStart.getFullYear(),
                            monthStart.getMonth(),
                            day,
                          );
                          const isPast =
                            isPastMonth ||
                            date <
                              new Date(
                                today.getFullYear(),
                                today.getMonth(),
                                today.getDate(),
                              );
                          const iso = date.toISOString().slice(0, 10);
                          const isSelected = m.selectedDate === iso;
                          cells.push(
                            <button
                              key={iso}
                              disabled={isPast}
                              onClick={() => {
                                if (isPast) return;
                                updateChatItem(m.id, (item) => ({
                                  ...item,
                                  selectedDate: iso,
                                }));
                                setLastChosenDate(iso);
                                addUserBubble(formatCalendarLabel(date));
                                sendStep("select_date", iso);
                                scrollToBottom();
                              }}
                              style={{
                                height: 38,
                                borderRadius: 10,
                                border: isSelected
                                  ? "1px solid #27D4CF"
                                  : "1px solid rgba(39,212,207,0.3)",
                                background: isSelected
                                  ? "rgba(39,212,207,0.22)"
                                  : "rgba(4, 22, 34, 0.95)",
                                color: isPast ? "rgba(255,255,255,0.35)" : "white",
                                cursor: isPast ? "not-allowed" : "pointer",
                              }}
                            >
                              {day}
                            </button>,
                          );
                        }
                        return cells;
                      })()}
                    </div>
                    </div>
                  </div>
                ) : null}
                {m.kind === "slots" ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    {m.text ? (
                      <div style={{ fontWeight: 500 }}>{m.text}</div>
                    ) : null}
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))",
                        gap: 10,
                      }}
                    >
                      {m.options?.map((option) => {
                        const isPast = isSlotInPast(option.value, m.slotDate ?? null);
                        return (
                          <button
                            key={option.label}
                            onClick={() => {
                              if (isPast) return;
                              addUserBubble(option.label);
                              if (currentStep) {
                                sendStep(currentStep, option.value);
                              }
                              scrollToBottom();
                            }}
                            disabled={isPast}
                            style={{
                              padding: "8px 12px",
                              borderRadius: 12,
                              border: "1px solid rgba(39,212,207,0.65)",
                              background: isPast
                                ? "rgba(4, 22, 34, 0.45)"
                                : "rgba(4, 22, 34, 0.9)",
                              color: isPast ? "rgba(255,255,255,0.4)" : "#27D4CF",
                              fontSize: 13,
                              cursor: isPast ? "not-allowed" : "pointer",
                            }}
                          >
                            {option.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : null}

                {m.kind === "form" ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    {m.text ? (
                      <div style={{ fontWeight: 500 }}>{m.text}</div>
                    ) : null}
                    <input
                      value={formValues[m.fieldKey ?? "reason"]}
                      onChange={(e) =>
                        setFormValues((prev) => ({
                          ...prev,
                          [m.fieldKey ?? "reason"]: e.target.value,
                        }))
                      }
                      placeholder={m.placeholder}
                      style={{
                        padding: "10px 12px",
                        borderRadius: 12,
                        background: "#0b1220",
                        border: "1px solid rgba(39,212,207,0.35)",
                        color: "white",
                        outline: "none",
                      }}
                    />
                    <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                      <button
                        onClick={() => {
                          const key = m.fieldKey ?? "reason";
                          const value = formValues[key].trim();
                          if (!value) {
                            addBotText("Please enter a value to continue.");
                            return;
                          }
                          addUserBubble(value);
                          if (currentStep) {
                            sendStep(currentStep, value);
                          }
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
                        Continue
                      </button>
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
