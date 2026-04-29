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
import { buildSpeechText } from "../../../utils/chatSpeechText";
import { ttsService } from "../../../utils/ttsService";
import { formatAnalysisResult } from "../../../utils/analysisFlow";

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
  kind: "text" | "options" | "typing" | "card" | "report_view";
  text?: string;
  options?: ChatOption[];
  cardLines?: string[];
  actions?: ChatOption[];
  appointmentId?: string;
  checkupId?: string;
  patientId?: string;
  priority?: string;
  reportUrl?: string | null;
  reportFileType?: string | null;
};

type DepartmentItem = {
  department: string;
};

type DoctorItem = {
  doctor_id: string;
  name: string;
  department: string;
};

type NurseAppointmentItem = {
  appointment_id: string;
  patient_name: string;
  date: string;
  time: string;
  status: string;
  priority: string;
};

type CheckupListItem = {
  checkup_id: string;
  date: string;
  time: string;
  patient_name: string;
  doctor_name: string;
  checkup_type?: string | null;
  reason?: string | null;
  status: string;
  priority?: string | null;
  report_url?: string | null;
  remarks?: string | null;
};

type CheckupTypeItem = {
  checkup_type: string;
};

type NursePatientSummary = {
  patient_id: string;
  patient_name: string;
  age: number | null;
  last_appointment: string | null;
  last_checkup: string | null;
};

export default function NurseChatPage() {
  const pageRole: Role = "nurse";
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
  const isNearBottomRef = useRef(true);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [showScrollBottom, setShowScrollBottom] = useState(false);
  const [chatItems, setChatItems] = useState<ChatItem[]>([]);
  const [message, setMessage] = useState("");
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const idCounterRef = useRef(0);
  const syncedCountRef = useRef(0);
  const [departments, setDepartments] = useState<DepartmentItem[]>([]);
  const [doctors, setDoctors] = useState<DoctorItem[]>([]);
  const [activeDoctor, setActiveDoctor] = useState<DoctorItem | null>(null);
  const [checkupDepartments, setCheckupDepartments] = useState<DepartmentItem[]>([]);
  const [checkupTypes, setCheckupTypes] = useState<CheckupTypeItem[]>([]);
  const [activeCheckupDepartment, setActiveCheckupDepartment] = useState<DepartmentItem | null>(null);
  const [activeCheckupType, setActiveCheckupType] = useState<CheckupTypeItem | null>(null);
  const [pendingRemarkCheckupId, setPendingRemarkCheckupId] = useState<string | null>(null);
  const [pendingReportCheckupId, setPendingReportCheckupId] = useState<string | null>(null);
  const reportInputRef = useRef<HTMLInputElement | null>(null);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerUrl, setViewerUrl] = useState<string | null>(null);
  const [viewerType, setViewerType] = useState<string | null>(null);

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

  const addReportViewer = (reportUrl: string, fileType?: string | null) => {
    addBotBubble({
      kind: "report_view",
      reportUrl,
      reportFileType: fileType ?? null,
    });
    addBotBubble({
      kind: "options",
      text: "What would you like to do next?",
      options: [
        { label: "Download Report", value: `download_report:${reportUrl}` },
        { label: "Summarize Report", value: `summarize_report:${reportUrl}` },
      ],
    });
  };

  const formatDateDisplay = (value: string) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return new Intl.DateTimeFormat("en-US", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    }).format(date);
  };

  const getPriorityBadge = (priority: string) => {
    const normalized = priority.toLowerCase();
    if (normalized === "high") {
      return { label: "High", color: "#fca5a5", bg: "rgba(220, 38, 38, 0.18)" };
    }
    if (normalized === "low") {
      return { label: "Low", color: "#93c5fd", bg: "rgba(37, 99, 235, 0.18)" };
    }
    return { label: "Normal", color: "#cbd5f5", bg: "rgba(148, 163, 184, 0.2)" };
  };

  const addAppointmentCards = (items: NurseAppointmentItem[]) => {
    if (!items.length) {
      addBotText("No appointments found for this doctor.");
      return;
    }
    items.forEach((item) => {
      addBotBubble({
        kind: "card",
        appointmentId: item.appointment_id,
        cardLines: [
          `Patient: ${item.patient_name}`,
          `Date: ${formatDateDisplay(item.date)}`,
          `Time: ${item.time}`,
          `Status: ${item.status}`,
        ],
        actions: [
          { label: "Set High Priority", value: "priority:high" },
          { label: "Set Normal Priority", value: "priority:normal" },
          { label: "Set Low Priority", value: "priority:low" },
          { label: "Mark Pending", value: "status:pending" },
          { label: "Mark Completed", value: "status:completed" },
          { label: "Next Appointment", value: "status:confirmed" },
        ],
        priority: item.priority,
      });
    });
  };

  const addCheckupCards = (items: CheckupListItem[]) => {
    if (!items.length) {
      addBotText("No checkups scheduled.");
      return;
    }
    items.forEach((item) => {
      const actions: ChatOption[] = [
        { label: "Add Report", value: "checkup:report" },
        { label: "Add Remark", value: "checkup:remark" },
        { label: "Complete Checkup", value: "checkup:complete" },
        { label: "Cancel Checkup", value: "checkup:cancel" },
        { label: "Priority High", value: "checkup:priority:high" },
        { label: "Priority Normal", value: "checkup:priority:normal" },
        { label: "Priority Low", value: "checkup:priority:low" },
      ];
      if (item.report_url) {
        actions.unshift({ label: "View Report", value: "checkup:view_report" });
      }
      addBotBubble({
        kind: "card",
        checkupId: item.checkup_id,
        cardLines: [
          `Patient: ${item.patient_name}`,
          `Doctor: ${item.doctor_name}`,
          `Type: ${item.checkup_type ?? "N/A"}`,
          `Date: ${formatDateDisplay(item.date)}`,
          `Time: ${item.time}`,
          `Reason: ${item.reason ?? "N/A"}`,
          `Status: ${item.status}`,
          item.report_url ? "Report: Available" : "Report: Not uploaded",
          item.remarks ? `Remarks: ${item.remarks}` : "Remarks: N/A",
        ],
        actions,
        priority: item.priority ?? undefined,
        reportUrl: item.report_url ? `${API_BASE}${item.report_url}` : null,
      });
    });
  };

  const getAuthToken = () =>
    typeof window !== "undefined" ? localStorage.getItem("access_token") : null;

  const addPatientCards = (items: NursePatientSummary[]) => {
    if (!items.length) {
      addBotText("No patient records found for this hospital.");
      return;
    }
    items.forEach((item) => {
      addBotBubble({
        kind: "card",
        patientId: item.patient_id,
        cardLines: [
          `Patient: ${item.patient_name}`,
          `Age: ${item.age ?? "N/A"}`,
          `Last Appointment: ${item.last_appointment ? formatDateDisplay(item.last_appointment) : "N/A"}`,
          `Last Checkup: ${item.last_checkup ? formatDateDisplay(item.last_checkup) : "N/A"}`,
        ],
        actions: [{ label: "View Records", value: "patient:view" }],
      });
    });
  };

  const fetchDepartments = async () => {
    try {
      const token = getAuthToken();
      if (!token) {
        addBotText("Your session has expired. Please log in again.");
        return;
      }
      addBotText("Loading departments...");
      const res = await fetch(`${API_BASE}/nurse/departments`, {
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      if (res.status === 401) {
        addBotText("Your session has expired. Please log in again.");
        return;
      }
      if (!res.ok) {
        addBotText("I couldn't load departments right now.");
        return;
      }
      const data = (await res.json()) as DepartmentItem[];
      setDepartments(data);
      if (!data.length) {
        addBotText("No departments available right now.");
        return;
      }
      addBotBubble({
        kind: "options",
        text: "Select a department:",
        options: data.map((dept) => ({
          label: dept.department,
          value: `dept:${dept.department}`,
        })),
      });
    } catch (error) {
      addBotText("I couldn't reach the server. Please try again.");
    }
  };

  const fetchDoctors = async (department: DepartmentItem) => {
    try {
      const token = getAuthToken();
      if (!token) {
        addBotText("Your session has expired. Please log in again.");
        return;
      }
      addBotText(`Loading doctors in ${department.department}...`);
      const res = await fetch(
        `${API_BASE}/nurse/doctors?department=${encodeURIComponent(
          department.department,
        )}`,
        {
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        },
      );
      if (res.status === 401) {
        addBotText("Your session has expired. Please log in again.");
        return;
      }
      if (!res.ok) {
        addBotText("I couldn't load doctors right now.");
        return;
      }
      const data = (await res.json()) as DoctorItem[];
      setDoctors(data);
      if (!data.length) {
        addBotText("No doctors available for this department.");
        return;
      }
      addBotBubble({
        kind: "options",
        text: "Select a doctor:",
        options: data.map((doctor) => ({
          label: doctor.name,
          value: `doc:${doctor.doctor_id}`,
        })),
      });
    } catch (error) {
      addBotText("I couldn't reach the server. Please try again.");
    }
  };

  const fetchAppointmentsForDoctor = async (doctor: DoctorItem) => {
    try {
      const token = getAuthToken();
      if (!token) {
        addBotText("Your session has expired. Please log in again.");
        return;
      }
      setActiveDoctor(doctor);
      addBotText(`Loading appointments for ${doctor.name}...`);
      const res = await fetch(
        `${API_BASE}/nurse/appointments/doctor?doctor_id=${encodeURIComponent(
          doctor.doctor_id,
        )}`,
        {
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        },
      );
      if (res.status === 401) {
        addBotText("Your session has expired. Please log in again.");
        return;
      }
      if (!res.ok) {
        addBotText("I couldn't load appointments right now.");
        return;
      }
      const data = (await res.json()) as NurseAppointmentItem[];
      if (!data.length) {
        addBotText("No appointments found for this doctor.");
        return;
      }
      addBotText(`Appointments for ${doctor.name}`);
      addAppointmentCards(data);
    } catch (error) {
      addBotText("I couldn't reach the server. Please try again.");
    }
  };

  const updateAppointmentStatus = async (
    appointmentId: string,
    status: "pending" | "completed" | "confirmed",
  ) => {
    try {
      const token = getAuthToken();
      if (!token) {
        addBotText("Your session has expired. Please log in again.");
        return;
      }
      const res = await fetch(`${API_BASE}/appointments/${appointmentId}/status`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) {
        addBotText("I couldn't update that appointment.");
        return;
      }
      const label =
        status === "confirmed"
          ? "Appointment set to next appointment."
          : `Appointment marked as ${status}.`;
      addBotText(label);
      if (activeDoctor) {
        fetchAppointmentsForDoctor(activeDoctor);
      }
    } catch (error) {
      addBotText("I couldn't reach the server. Please try again.");
    }
  };

  const updateAppointmentPriority = async (
    appointmentId: string,
    priority: "high" | "normal" | "low",
  ) => {
    try {
      const token = getAuthToken();
      if (!token) {
        addBotText("Your session has expired. Please log in again.");
        return;
      }
      const res = await fetch(
        `${API_BASE}/nurse/appointments/${appointmentId}/priority`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ priority }),
        },
      );
      if (!res.ok) {
        addBotText("I couldn't update that appointment priority.");
        return;
      }
      addBotText(`Priority updated to ${priority}.`);
      if (activeDoctor) {
        fetchAppointmentsForDoctor(activeDoctor);
      }
    } catch (error) {
      addBotText("I couldn't reach the server. Please try again.");
    }
  };

  const handleAppointmentAction = async (
    appointmentId: string,
    actionValue: string,
  ) => {
    if (actionValue.startsWith("status:")) {
      const status = actionValue.replace("status:", "") as
        | "pending"
        | "completed"
        | "confirmed";
      await updateAppointmentStatus(appointmentId, status);
      return;
    }
    if (actionValue.startsWith("priority:")) {
      const priority = actionValue.replace("priority:", "") as
        | "high"
        | "normal"
        | "low";
      await updateAppointmentPriority(appointmentId, priority);
    }
  };

  const updateCheckupStatus = async (
    checkupId: string,
    action: "complete" | "cancel",
  ) => {
    try {
      const token = getAuthToken();
      if (!token) {
        addBotText("Your session has expired. Please log in again.");
        return;
      }
      const endpoint =
        action === "complete"
          ? `/nurse/checkups/${checkupId}/complete`
          : `/nurse/checkups/${checkupId}/cancel`;
      const res = await fetch(`${API_BASE}${endpoint}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      if (!res.ok) {
        addBotText("I couldn't update that checkup.");
        return;
      }
      addBotText(
        action === "complete"
          ? "Checkup marked as completed."
          : "Checkup cancelled.",
      );
    } catch {
      addBotText("I couldn't reach the server. Please try again.");
    }
  };

  const updateCheckupPriority = async (
    checkupId: string,
    priority: "high" | "normal" | "low",
  ) => {
    try {
      const token = getAuthToken();
      if (!token) {
        addBotText("Your session has expired. Please log in again.");
        return;
      }
      const res = await fetch(
        `${API_BASE}/nurse/checkups/${checkupId}/priority`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ priority }),
        },
      );
      if (!res.ok) {
        addBotText("I couldn't update that checkup priority.");
        return;
      }
      addBotText(`Priority updated to ${priority}.`);
    } catch {
      addBotText("I couldn't reach the server. Please try again.");
    }
  };

  const updateCheckupRemarks = async (
    checkupId: string,
    remarks: string,
  ) => {
    try {
      const token = getAuthToken();
      if (!token) {
        addBotText("Your session has expired. Please log in again.");
        return;
      }
      const res = await fetch(
        `${API_BASE}/nurse/checkups/${checkupId}/remarks`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ remarks }),
        },
      );
      if (!res.ok) {
        addBotText("I couldn't save that remark.");
        return;
      }
      addBotText("Remark saved.");
    } catch {
      addBotText("I couldn't reach the server. Please try again.");
    }
  };

  const uploadCheckupReport = async (checkupId: string, file: File) => {
    try {
      const token = getAuthToken();
      if (!token) {
        addBotText("Your session has expired. Please log in again.");
        return;
      }
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(
        `${API_BASE}/nurse/checkups/${checkupId}/report`,
        {
          method: "POST",
          headers: {
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: formData,
        },
      );
      if (!res.ok) {
        addBotText("I couldn't upload that report.");
        return;
      }
      const data = (await res.json()) as { report_url?: string | null };
      const reportUrl = data.report_url ? `${API_BASE}${data.report_url}` : null;
      addBotText("Report uploaded successfully.");
      if (reportUrl) {
        setViewerUrl(reportUrl);
        setViewerType(null);
        addBotBubble({
          kind: "options",
          text: "View the uploaded report?",
          options: [{ label: "View Report", value: `view_report:${reportUrl}` }],
        });
      }
      try {
        const analysisForm = new FormData();
        analysisForm.append("file", file);
        const analysisRes = await fetch(`${API_BASE}/chat/report/analyze`, {
          method: "POST",
          headers: {
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: analysisForm,
        });
        if (analysisRes.ok) {
          const analysisData = (await analysisRes.json()) as Record<string, any>;
          const summaryText = formatAnalysisResult("report", analysisData);
          addBotText(summaryText);
        } else {
          addBotText("Report uploaded, but summary is unavailable right now.");
        }
      } catch {
        addBotText("Report uploaded, but summary is unavailable right now.");
      }
      if (activeCheckupType && activeCheckupDepartment) {
        fetchCheckupsForType(activeCheckupType);
      }
    } catch {
      addBotText("I couldn't reach the server. Please try again.");
    }
  };

  const fetchPatients = async () => {
    try {
      const token = getAuthToken();
      if (!token) {
        addBotText("Your session has expired. Please log in again.");
        return;
      }
      addBotText("Loading patient records...");
      const res = await fetch(`${API_BASE}/nurse/patients`, {
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      if (res.status === 401) {
        addBotText("Your session has expired. Please log in again.");
        return;
      }
      if (!res.ok) {
        addBotText("I couldn't load patient records right now.");
        return;
      }
      const data = (await res.json()) as NursePatientSummary[];
      addBotText("Here are the latest patient records.");
      addPatientCards(data);
    } catch {
      addBotText("I couldn't reach the server. Please try again.");
    }
  };

  const handleCheckupAction = async (
    checkupId: string,
    actionValue: string,
  ) => {
    if (actionValue === "checkup:report") {
      setPendingReportCheckupId(checkupId);
      reportInputRef.current?.click();
      return;
    }
    if (actionValue === "checkup:view_report") {
      const item = chatItems.find(
        (entry) => entry.checkupId === checkupId && entry.kind === "card",
      );
      const url = item?.reportUrl ?? viewerUrl;
      if (url) {
        addReportViewer(url, null);
      } else {
        addBotText("No report is available for this checkup yet.");
      }
      return;
    }
    if (actionValue === "checkup:remark") {
      setPendingRemarkCheckupId(checkupId);
      addBotText("Please type your remark for this checkup.");
      return;
    }
    if (actionValue === "checkup:complete") {
      await updateCheckupStatus(checkupId, "complete");
      return;
    }
    if (actionValue === "checkup:cancel") {
      await updateCheckupStatus(checkupId, "cancel");
      return;
    }
    if (actionValue.startsWith("checkup:priority:")) {
      const priority = actionValue.replace("checkup:priority:", "") as
        | "high"
        | "normal"
        | "low";
      await updateCheckupPriority(checkupId, priority);
    }
  };

  const fetchCheckupDepartments = async () => {
    try {
      const token = getAuthToken();
      if (!token) {
        addBotText("Your session has expired. Please log in again.");
        return;
      }
      addBotText("Loading checkup departments...");
      let res = await fetch(`${API_BASE}/nurse/checkups/departments`, {
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      if (!res.ok) {
        res = await fetch(`${API_BASE}/nurse/departments`, {
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        });
      }
      if (res.status === 401) {
        addBotText("Your session has expired. Please log in again.");
        return;
      }
      if (!res.ok) {
        addBotText("I couldn't load checkup departments right now.");
        return;
      }
      const data = (await res.json()) as DepartmentItem[];
      setCheckupDepartments(data);
      if (!data.length) {
        addBotText("No checkups scheduled.");
        return;
      }
      addBotBubble({
        kind: "options",
        text: "Select a department:",
        options: data.map((dept) => ({
          label: dept.department,
          value: `chk_dept:${dept.department}`,
        })),
      });
    } catch (error) {
      addBotText("I couldn't reach the server. Please try again.");
    }
  };

  const fetchCheckupTypes = async (department: DepartmentItem) => {
    try {
      const token = getAuthToken();
      if (!token) {
        addBotText("Your session has expired. Please log in again.");
        return;
      }
      addBotText(`Loading checkup types in ${department.department}...`);
      setActiveCheckupDepartment(department);
      let res = await fetch(
        `${API_BASE}/nurse/checkups/types?department=${encodeURIComponent(
          department.department,
        )}`,
        {
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        },
      );
      if (res.status === 401) {
        addBotText("Your session has expired. Please log in again.");
        return;
      }
      if (!res.ok) {
        res = await fetch(
          `${API_BASE}/nurse/checkups?department=${encodeURIComponent(
            department.department,
          )}&status=pending`,
          {
            headers: {
              "Content-Type": "application/json",
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
          },
        );
      }
      if (!res.ok) {
        addBotText("I couldn't load checkup types right now.");
        return;
      }
      let data = (await res.json()) as CheckupTypeItem[];
      if (data.length && "checkup_id" in (data[0] as Record<string, unknown>)) {
        const typed = data as unknown as { checkup_type?: string }[];
        const names = Array.from(
          new Set(typed.map((item) => item.checkup_type).filter(Boolean)),
        ) as string[];
        data = names.map((name) => ({ checkup_type: name }));
      }
      setCheckupTypes(data);
      if (!data.length) {
        addBotText("No checkups scheduled.");
        return;
      }
      addBotBubble({
        kind: "options",
        text: "Select a checkup type:",
        options: data.map((type) => ({
          label: type.checkup_type,
          value: `chk_type:${type.checkup_type}`,
        })),
      });
    } catch (error) {
      addBotText("I couldn't reach the server. Please try again.");
    }
  };

  const fetchCheckupsForType = async (type: CheckupTypeItem) => {
    try {
      const token = getAuthToken();
      if (!token) {
        addBotText("Your session has expired. Please log in again.");
        return;
      }
      const department = activeCheckupDepartment?.department;
      if (!department) {
        addBotText("Please select a department first.");
        return;
      }
      addBotText(`Loading ${type.checkup_type} checkups...`);
      const res = await fetch(
        `${API_BASE}/nurse/checkups?department=${encodeURIComponent(
          department,
        )}&checkup_type=${encodeURIComponent(type.checkup_type)}&status=pending`,
        {
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        },
      );
      if (res.status === 401) {
        addBotText("Your session has expired. Please log in again.");
        return;
      }
      if (!res.ok) {
        addBotText("I couldn't load checkups right now.");
        return;
      }
      const data = (await res.json()) as CheckupListItem[];
      if (!data.length) {
        addBotText("No checkups scheduled.");
        return;
      }
      addBotText(`Pending ${type.checkup_type} checkups`);
      addCheckupCards(data);
    } catch (error) {
      addBotText("I couldn't reach the server. Please try again.");
    }
  };

  const startHospitalAppointmentsFlow = () => {
    setDepartments([]);
    setDoctors([]);
    fetchDepartments();
  };

  const startHospitalCheckupsFlow = () => {
    setCheckupDepartments([]);
    setCheckupTypes([]);
    setActiveCheckupDepartment(null);
    setActiveCheckupType(null);
    fetchCheckupDepartments();
  };

  const nurseCards = [
    { title: "Hospital Appointments", description: "View all appointments." },
    { title: "Hospital Checkups", description: "View all checkups." },
    { title: "Patient Records", description: "Review patients and vitals." },
    { title: "Doctors on Duty", description: "Check doctor availability." },
  ];

  useEffect(() => {
    setRole(pageRole);
  }, [pageRole, setRole]);

  useEffect(() => {
    if (activeModule === "appointments") {
      addUserBubble("Hospital appointments");
      startHospitalAppointmentsFlow();
    }
    if (activeModule === "checkups") {
      addUserBubble("Hospital checkups");
      startHospitalCheckupsFlow();
    }
    if (activeModule === "patients") {
      addUserBubble("Patient records");
      fetchPatients();
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
    if (option.value.startsWith("view_report:")) {
      const url = option.value.replace("view_report:", "");
      addReportViewer(url, null);
      return;
    }
    if (option.value.startsWith("download_report:")) {
      const url = option.value.replace("download_report:", "");
      window.open(url, "_blank", "noopener,noreferrer");
      return;
    }
    if (option.value.startsWith("summarize_report:")) {
      const url = option.value.replace("summarize_report:", "");
      void (async () => {
        try {
          addBotText("Summarizing report...");
          const token = getAuthToken();
          if (!token) {
            addBotText("Your session has expired. Please log in again.");
            return;
          }
          const fileRes = await fetch(url);
          if (!fileRes.ok) {
            addBotText("Unable to load the report file.");
            return;
          }
          const blob = await fileRes.blob();
          const urlName = url.split("/").pop() || "report";
          const fileName = urlName.includes(".")
            ? urlName
            : blob.type === "application/pdf"
            ? "report.pdf"
            : blob.type === "image/png"
            ? "report.png"
            : "report.jpg";
          const file = new File([blob], fileName, { type: blob.type || "application/octet-stream" });
          const formData = new FormData();
          formData.append("file", file);
          const analysisRes = await fetch(`${API_BASE}/chat/report/analyze`, {
            method: "POST",
            headers: {
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            body: formData,
          });
          if (!analysisRes.ok) {
            addBotText("Summary is unavailable right now.");
            return;
          }
          const analysisData = (await analysisRes.json()) as Record<string, any>;
          if (analysisData.summary) {
            addBotText(`Summary:\n${analysisData.summary}`);
          } else {
            const summaryText = formatAnalysisResult("report", analysisData);
            addBotText(summaryText);
          }
        } catch {
          addBotText("Summary is unavailable right now.");
        }
      })();
      return;
    }
    if (option.value.startsWith("dept:")) {
      const deptValue = option.value.replace("dept:", "");
      const dept = departments.find(
        (entry) => entry.department === deptValue,
      );
      if (!dept) {
        addBotText("That department is no longer available.");
        return;
      }
      fetchDoctors(dept);
      return;
    }
    if (option.value.startsWith("chk_dept:")) {
      const deptValue = option.value.replace("chk_dept:", "");
      const dept = checkupDepartments.find(
        (entry) => entry.department === deptValue,
      );
      if (!dept) {
        addBotText("That department is no longer available.");
        return;
      }
      fetchCheckupTypes(dept);
      return;
    }
    if (option.value.startsWith("doc:")) {
      const doctorId = option.value.replace("doc:", "");
      const doctor = doctors.find((entry) => entry.doctor_id === doctorId);
      if (!doctor) {
        addBotText("That doctor is no longer available.");
        return;
      }
      fetchAppointmentsForDoctor(doctor);
      return;
    }
    if (option.value.startsWith("chk_type:")) {
      const typeValue = option.value.replace("chk_type:", "");
      const type = checkupTypes.find(
        (entry) => entry.checkup_type === typeValue,
      );
      if (!type) {
        addBotText("That checkup type is no longer available.");
        return;
      }
      setActiveCheckupType(type);
      fetchCheckupsForType(type);
    }
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
    if (!trimmed) return;
    setMessage("");
    addUserBubble(trimmed);
    if (pendingRemarkCheckupId) {
      const targetId = pendingRemarkCheckupId;
      setPendingRemarkCheckupId(null);
      updateCheckupRemarks(targetId, trimmed);
      return;
    }
    const normalized = trimmed.toLowerCase();
    if (normalized.includes("checkup")) {
      startHospitalCheckupsFlow();
      return;
    }
    if (normalized.includes("appointments")) {
      startHospitalAppointmentsFlow();
      return;
    }
    if (normalized.includes("patient")) {
      fetchPatients();
      return;
    }
    addBotText(
      "Try 'appointments', 'checkups', or 'patients' to view nurse dashboards.",
    );
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
          Nurse Dashboard
        </h1>
        <div style={{ textAlign: "right" }}>
          <div style={{ color: "white", fontWeight: 600 }}>
            Hello Nurse
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
          cards={nurseCards}
          onCardClick={(title) => {
            scrollToBottom();
            if (title === "Hospital Appointments") {
              addUserBubble("Hospital appointments");
              startHospitalAppointmentsFlow();
            }
            if (title === "Hospital Checkups") {
              addUserBubble("Hospital checkups");
              startHospitalCheckupsFlow();
            }
            if (title === "Patient Records") {
              addUserBubble("Patient records");
              router.push("/nurse/patients");
            }
            if (title === "Doctors on Duty") {
              addUserBubble("Doctors on duty");
              router.push("/nurse/doctors");
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
                    {m.actions && m.appointmentId ? (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                        {m.actions.map((action) => (
                          <button
                            key={action.value}
                            onClick={() => {
                              addUserBubble(action.label);
                              handleAppointmentAction(
                                m.appointmentId ?? "",
                                action.value,
                              );
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
                    {m.actions && m.checkupId ? (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                        {m.actions.map((action) => (
                          <button
                            key={action.value}
                            onClick={() => {
                              addUserBubble(action.label);
                              handleCheckupAction(
                                m.checkupId ?? "",
                                action.value,
                              );
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
                    {m.actions && m.patientId ? (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                        {m.actions.map((action) => (
                          <button
                            key={action.value}
                            onClick={() => {
                              addUserBubble(action.label);
                              if (action.value === "patient:view") {
                                router.push(`/nurse/patients/${m.patientId}`);
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
                            {action.label}
                          </button>
                        ))}
                      </div>
                    ) : null}
                    {m.priority ? (() => {
                      const badge = getPriorityBadge(m.priority);
                      return (
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span>Priority:</span>
                          <span
                            style={{
                              padding: "2px 10px",
                              borderRadius: 999,
                              fontSize: 12,
                              fontWeight: 600,
                              color: badge.color,
                              background: badge.bg,
                              border: `1px solid ${badge.color}`,
                            }}
                          >
                            {badge.label}
                          </span>
                        </div>
                      );
                    })() : null}
                  </div>
                ) : null}

                {m.kind === "report_view" && m.reportUrl ? (
                  <div
                    style={{
                      borderRadius: 14,
                      border: "1px solid rgba(39,212,207,0.4)",
                      background: "rgba(4, 22, 34, 0.9)",
                      padding: 12,
                    }}
                  >
                    {m.reportUrl.toLowerCase().endsWith(".pdf") ? (
                      <iframe
                        src={m.reportUrl}
                        title="Report"
                        style={{
                          width: "100%",
                          height: 360,
                          border: "none",
                          borderRadius: 10,
                          background: "white",
                        }}
                      />
                    ) : (
                      <img
                        src={m.reportUrl}
                        alt="Report"
                        style={{
                          width: "100%",
                          borderRadius: 10,
                          display: "block",
                        }}
                      />
                    )}
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

      <ReportViewerModal
        isOpen={viewerOpen}
        fileUrl={viewerUrl}
        fileType={viewerType}
        onClose={() => setViewerOpen(false)}
      />

      <input
        ref={reportInputRef}
        type="file"
        accept=".pdf,image/png,image/jpeg"
        style={{ display: "none" }}
        onChange={(event) => {
          const file = event.target.files?.[0];
          const targetId = pendingReportCheckupId;
          if (file && targetId) {
            addUserBubble(`Uploaded report: ${file.name}`);
            uploadCheckupReport(targetId, file);
          }
          setPendingReportCheckupId(null);
          if (reportInputRef.current) {
            reportInputRef.current.value = "";
          }
        }}
      />

      <ChatBar
        value={message}
        onChange={setMessage}
        onSend={handleSend}
        height={INPUT_HEIGHT}
      />
    </div>
  );
}
