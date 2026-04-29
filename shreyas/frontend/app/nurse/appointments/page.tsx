"use client";

import { useEffect, useMemo, useState } from "react";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000";

type DepartmentItem = {
  department: string;
};

type DoctorItem = {
  doctor_id: string;
  name: string;
  department: string;
};

type AppointmentItem = {
  appointment_id: string;
  patient_name: string;
  doctor_name: string;
  department: string;
  date: string;
  time: string;
  status: string;
  priority: string;
};

type FilterState = {
  department: string;
  doctor_id: string;
  status: string;
  priority: string;
  date: string;
};

const STATUS_OPTIONS = ["pending", "scheduled", "completed", "cancelled", "missed"];
const PRIORITY_OPTIONS = ["normal", "high", "low"];

export default function NurseAppointmentsDashboard() {
  const [appointments, setAppointments] = useState<AppointmentItem[]>([]);
  const [departments, setDepartments] = useState<DepartmentItem[]>([]);
  const [doctors, setDoctors] = useState<DoctorItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [navigating, setNavigating] = useState(false);
  const [filters, setFilters] = useState<FilterState>({
    department: "",
    doctor_id: "",
    status: "",
    priority: "",
    date: "",
  });

  const hasFilters = useMemo(
    () =>
      Boolean(
        filters.department ||
          filters.doctor_id ||
          filters.status ||
          filters.priority ||
          filters.date,
      ),
    [filters],
  );

  const getAuthToken = () =>
    typeof window !== "undefined" ? localStorage.getItem("access_token") : null;

  const fetchDepartments = async () => {
    try {
      const token = getAuthToken();
      if (!token) return;
      const res = await fetch(`${API_BASE}/nurse/departments`, {
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      if (!res.ok) return;
      const data = (await res.json()) as DepartmentItem[];
      setDepartments(data);
    } catch {
      // silent
    }
  };

  const fetchDoctors = async (department: string) => {
    if (!department) {
      setDoctors([]);
      return;
    }
    try {
      const token = getAuthToken();
      if (!token) return;
      const res = await fetch(
        `${API_BASE}/nurse/doctors?department=${encodeURIComponent(department)}`,
        {
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        },
      );
      if (!res.ok) return;
      const data = (await res.json()) as DoctorItem[];
      setDoctors(data);
    } catch {
      // silent
    }
  };

  const fetchAppointments = async (state: FilterState) => {
    try {
      setLoading(true);
      setError(null);
      const token = getAuthToken();
      if (!token) {
        setError("Your session has expired. Please log in again.");
        setAppointments([]);
        return;
      }
      const params = new URLSearchParams();
      if (state.department) params.set("department", state.department);
      if (state.doctor_id) params.set("doctor_id", state.doctor_id);
      if (state.status) params.set("status", state.status);
      if (state.priority) params.set("priority", state.priority);
      if (state.date) params.set("date", state.date);
      const url = params.toString()
        ? `${API_BASE}/nurse/appointments?${params.toString()}`
        : `${API_BASE}/nurse/appointments`;
      const res = await fetch(url, {
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      if (!res.ok) {
        setError("I couldn't load appointments right now.");
        setAppointments([]);
        return;
      }
      const data = (await res.json()) as AppointmentItem[];
      setAppointments(data);
    } catch {
      setError("I couldn't reach the server. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const updateAppointment = async (
    appointmentId: string,
    action: "complete" | "cancel" | "priority_high",
  ) => {
    try {
      const token = getAuthToken();
      if (!token) {
        setError("Your session has expired. Please log in again.");
        return;
      }
      const endpoint =
        action === "complete"
          ? `/nurse/appointments/${appointmentId}/complete`
          : action === "cancel"
            ? `/nurse/appointments/${appointmentId}/cancel`
            : `/nurse/appointments/${appointmentId}/priority`;
      const res = await fetch(`${API_BASE}${endpoint}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body:
          action === "priority_high"
            ? JSON.stringify({ priority: "high" })
            : undefined,
      });
      if (!res.ok) {
        setError("I couldn't update that appointment.");
        return;
      }
      fetchAppointments(filters);
    } catch {
      setError("I couldn't reach the server. Please try again.");
    }
  };

  useEffect(() => {
    fetchDepartments();
  }, []);

  useEffect(() => {
    fetchDoctors(filters.department);
    if (!filters.department) {
      setFilters((prev) => ({ ...prev, doctor_id: "" }));
    }
  }, [filters.department]);

  useEffect(() => {
    fetchAppointments(filters);
  }, [filters]);

  const statusBadge = (value: string) => {
    const normalized = value.toLowerCase();
    if (normalized === "completed") return { label: "Completed", bg: "#14532d", color: "#86efac" };
    if (normalized === "cancelled") return { label: "Cancelled", bg: "#7f1d1d", color: "#fecaca" };
    if (normalized === "missed") return { label: "Missed", bg: "#1f2937", color: "#cbd5f5" };
    return { label: normalized === "scheduled" ? "Scheduled" : "Pending", bg: "#78350f", color: "#fde68a" };
  };

  const priorityBadge = (value: string) => {
    const normalized = value.toLowerCase();
    if (normalized === "high") return { label: "High", bg: "#7f1d1d", color: "#fecaca" };
    if (normalized === "low") return { label: "Low", bg: "#1e3a8a", color: "#bfdbfe" };
    return { label: "Normal", bg: "#1f2937", color: "#cbd5f5" };
  };

  return (
    <div style={{ minHeight: "100vh", background: "#020617", color: "white" }}>
      <header
        style={{
          padding: "20px 28px",
          borderBottom: "1px solid rgba(39,212,207,0.2)",
          background: "#020617",
          position: "sticky",
          top: 0,
          zIndex: 5,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
          <div>
            <div style={{ fontSize: 24, fontWeight: 600, color: "#27D4CF" }}>
              Appointment Management
            </div>
            <div style={{ fontSize: 13, opacity: 0.75 }}>
              All hospital appointments with filters and actions.
            </div>
          </div>
          <a
            href="/chat/nurse"
            onClick={() => setNavigating(true)}
            style={{
              padding: "8px 14px",
              borderRadius: 999,
              border: "1px solid rgba(39,212,207,0.75)",
              background: "rgba(4, 22, 34, 0.9)",
              color: "#27D4CF",
              fontSize: 13,
              textDecoration: "none",
              opacity: navigating ? 0.7 : 1,
            }}
          >
            Go back to chatbot
          </a>
        </div>
      </header>

      <div style={{ padding: "24px 28px", display: "flex", flexDirection: "column", gap: 16 }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: 12,
            background: "rgba(15, 23, 42, 0.6)",
            border: "1px solid rgba(39,212,207,0.2)",
            borderRadius: 16,
            padding: 16,
          }}
        >
          <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span style={{ fontSize: 12, opacity: 0.7 }}>Department</span>
            <select
              value={filters.department}
              onChange={(event) =>
                setFilters((prev) => ({ ...prev, department: event.target.value }))
              }
              style={{ padding: "8px 10px", borderRadius: 10, background: "#0f172a", color: "white" }}
            >
              <option value="">All</option>
              {departments.map((dept) => (
                <option key={dept.department} value={dept.department}>
                  {dept.department}
                </option>
              ))}
            </select>
          </label>

          <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span style={{ fontSize: 12, opacity: 0.7 }}>Doctor</span>
            <select
              value={filters.doctor_id}
              onChange={(event) =>
                setFilters((prev) => ({ ...prev, doctor_id: event.target.value }))
              }
              disabled={!filters.department}
              style={{ padding: "8px 10px", borderRadius: 10, background: "#0f172a", color: "white" }}
            >
              <option value="">All</option>
              {doctors.map((doc) => (
                <option key={doc.doctor_id} value={doc.doctor_id}>
                  {doc.name}
                </option>
              ))}
            </select>
          </label>

          <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span style={{ fontSize: 12, opacity: 0.7 }}>Status</span>
            <select
              value={filters.status}
              onChange={(event) =>
                setFilters((prev) => ({ ...prev, status: event.target.value }))
              }
              style={{ padding: "8px 10px", borderRadius: 10, background: "#0f172a", color: "white" }}
            >
              <option value="">All</option>
              {STATUS_OPTIONS.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </label>

          <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span style={{ fontSize: 12, opacity: 0.7 }}>Priority</span>
            <select
              value={filters.priority}
              onChange={(event) =>
                setFilters((prev) => ({ ...prev, priority: event.target.value }))
              }
              style={{ padding: "8px 10px", borderRadius: 10, background: "#0f172a", color: "white" }}
            >
              <option value="">All</option>
              {PRIORITY_OPTIONS.map((priority) => (
                <option key={priority} value={priority}>
                  {priority}
                </option>
              ))}
            </select>
          </label>

          <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span style={{ fontSize: 12, opacity: 0.7 }}>Date</span>
            <input
              type="date"
              value={filters.date}
              onChange={(event) =>
                setFilters((prev) => ({ ...prev, date: event.target.value }))
              }
              style={{ padding: "8px 10px", borderRadius: 10, background: "#0f172a", color: "white" }}
            />
          </label>
        </div>

        <div
          style={{
            background: "rgba(15, 23, 42, 0.6)",
            border: "1px solid rgba(39,212,207,0.2)",
            borderRadius: 16,
            padding: 16,
          }}
        >
          {error ? (
            <div style={{ color: "#fecaca" }}>{error}</div>
          ) : loading ? (
            <div>Loading appointments...</div>
          ) : appointments.length === 0 ? (
            <div>
              {hasFilters ? "No appointments match selected filters." : "No appointments found."}
            </div>
          ) : (
            <div style={{ width: "100%", overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 900 }}>
                <thead>
                  <tr style={{ textAlign: "left", fontSize: 12, opacity: 0.7 }}>
                    <th style={{ padding: "10px 8px" }}>Patient Name</th>
                    <th style={{ padding: "10px 8px" }}>Doctor</th>
                    <th style={{ padding: "10px 8px" }}>Department</th>
                    <th style={{ padding: "10px 8px" }}>Date</th>
                    <th style={{ padding: "10px 8px" }}>Time</th>
                    <th style={{ padding: "10px 8px" }}>Status</th>
                    <th style={{ padding: "10px 8px" }}>Priority</th>
                    <th style={{ padding: "10px 8px" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {appointments.map((appt) => {
                    const status = statusBadge(appt.status);
                    const priority = priorityBadge(appt.priority);
                    const actionsDisabled =
                      appt.status === "completed" || appt.status === "cancelled";
                    return (
                      <tr key={appt.appointment_id} style={{ borderTop: "1px solid rgba(148,163,184,0.2)" }}>
                        <td style={{ padding: "12px 8px" }}>{appt.patient_name}</td>
                        <td style={{ padding: "12px 8px" }}>{appt.doctor_name}</td>
                        <td style={{ padding: "12px 8px" }}>{appt.department}</td>
                        <td style={{ padding: "12px 8px" }}>{appt.date}</td>
                        <td style={{ padding: "12px 8px" }}>{appt.time}</td>
                        <td style={{ padding: "12px 8px" }}>
                          <span
                            style={{
                              padding: "3px 10px",
                              borderRadius: 999,
                              background: status.bg,
                              color: status.color,
                              fontSize: 12,
                              fontWeight: 600,
                              display: "inline-block",
                            }}
                          >
                            {status.label}
                          </span>
                        </td>
                        <td style={{ padding: "12px 8px" }}>
                          <span
                            style={{
                              padding: "3px 10px",
                              borderRadius: 999,
                              background: priority.bg,
                              color: priority.color,
                              fontSize: 12,
                              fontWeight: 600,
                              display: "inline-block",
                            }}
                          >
                            {priority.label}
                          </span>
                        </td>
                        <td style={{ padding: "12px 8px" }}>
                          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                            <button
                              onClick={() => updateAppointment(appt.appointment_id, "complete")}
                              disabled={actionsDisabled}
                              style={{
                                padding: "6px 10px",
                                borderRadius: 999,
                                border: "1px solid rgba(39,212,207,0.75)",
                                background: "rgba(4, 22, 34, 0.9)",
                                color: "#27D4CF",
                                fontSize: 12,
                                cursor: actionsDisabled ? "not-allowed" : "pointer",
                                opacity: actionsDisabled ? 0.5 : 1,
                              }}
                            >
                              Complete
                            </button>
                            <button
                              onClick={() => updateAppointment(appt.appointment_id, "cancel")}
                              disabled={actionsDisabled}
                              style={{
                                padding: "6px 10px",
                                borderRadius: 999,
                                border: "1px solid rgba(239, 68, 68, 0.75)",
                                background: "rgba(34, 8, 8, 0.9)",
                                color: "#fca5a5",
                                fontSize: 12,
                                cursor: actionsDisabled ? "not-allowed" : "pointer",
                                opacity: actionsDisabled ? 0.5 : 1,
                              }}
                            >
                              Cancel
                            </button>
                            <button
                              onClick={() => updateAppointment(appt.appointment_id, "priority_high")}
                              style={{
                                padding: "6px 10px",
                                borderRadius: 999,
                                border: "1px solid rgba(248, 113, 113, 0.8)",
                                background: "rgba(127, 29, 29, 0.5)",
                                color: "#fecaca",
                                fontSize: 12,
                                cursor: "pointer",
                              }}
                            >
                              Set High Priority
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
