"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000";

type DoctorItem = {
  doctor_id: string;
  name: string;
  department: string;
  is_active: boolean;
  status?: string | null;
  working_hours?: string | null;
  appointments_today?: number | null;
};

type AvailabilityForm = {
  date: string;
  start_time: string;
  end_time: string;
  slot_duration: string;
  status: string;
};

const initialForm: AvailabilityForm = {
  date: "",
  start_time: "",
  end_time: "",
  slot_duration: "30",
  status: "available",
};

const statusBadge = (status?: string | null) => {
  const normalized = (status || "unavailable").toLowerCase();
  if (normalized === "available") return { label: "Available", bg: "#14532d", color: "#86efac" };
  if (normalized === "leave") return { label: "Leave", bg: "#7f1d1d", color: "#fecaca" };
  if (normalized === "emergency") return { label: "Emergency", bg: "#7f1d1d", color: "#fecaca" };
  return { label: "Unavailable", bg: "#1f2937", color: "#cbd5f5" };
};

export default function NurseDoctorsDashboard() {
  const [doctors, setDoctors] = useState<DoctorItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [navigating, setNavigating] = useState(false);
  const [activeDoctor, setActiveDoctor] = useState<DoctorItem | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formState, setFormState] = useState<AvailabilityForm>(initialForm);

  const token = useMemo(() => {
    if (typeof window === "undefined") return null;
    return localStorage.getItem("access_token");
  }, []);

  const fetchDoctors = async () => {
    try {
      setLoading(true);
      setError(null);
      if (!token) {
        setError("Your session has expired. Please log in again.");
        setDoctors([]);
        return;
      }
      const today = new Date().toISOString().slice(0, 10);
      const res = await fetch(`${API_BASE}/nurse/doctors?date=${today}`, {
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      if (!res.ok) {
        setError("I couldn't load doctors right now.");
        setDoctors([]);
        return;
      }
      const data = (await res.json()) as DoctorItem[];
      setDoctors(data);
    } catch {
      setError("I couldn't reach the server. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDoctors();
  }, []);

  const openAvailabilityForm = (doctor: DoctorItem) => {
    const today = new Date().toISOString().slice(0, 10);
    setActiveDoctor(doctor);
    setFormState((prev) => ({ ...prev, date: today }));
    setShowForm(true);
  };

  const submitAvailability = async () => {
    if (!activeDoctor) return;
    try {
      const res = await fetch(
        `${API_BASE}/nurse/doctors/${activeDoctor.doctor_id}/availability`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            date: formState.date,
            start_time: formState.start_time,
            end_time: formState.end_time,
            slot_duration: Number(formState.slot_duration),
            status: formState.status,
          }),
        },
      );
      if (!res.ok) {
        setError("Unable to update availability.");
        return;
      }
      setShowForm(false);
      setActiveDoctor(null);
      fetchDoctors();
    } catch {
      setError("Unable to update availability.");
    }
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
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 16,
          }}
        >
          <div>
            <div style={{ fontSize: 24, fontWeight: 600, color: "#27D4CF" }}>
              Doctor Availability Management
            </div>
            <div style={{ fontSize: 13, opacity: 0.75 }}>
              Manage schedules, workload, and appointments per doctor.
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

      <div
        style={{
          padding: "24px 28px",
          display: "grid",
          gap: 16,
          gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
        }}
      >
        {error ? (
          <div style={{ color: "#fecaca" }}>{error}</div>
        ) : loading ? (
          <div>Loading doctors...</div>
        ) : doctors.length === 0 ? (
          <div>No doctors found.</div>
        ) : (
          doctors.map((doctor) => {
            const badge = statusBadge(doctor.status);
            return (
              <div
                key={doctor.doctor_id}
                style={{
                  background: "rgba(15, 23, 42, 0.6)",
                  border: "1px solid rgba(39,212,207,0.2)",
                  borderRadius: 16,
                  padding: 16,
                  display: "flex",
                  flexDirection: "column",
                  gap: 12,
                }}
              >
                <div style={{ fontSize: 18, fontWeight: 600 }}>{doctor.name}</div>
                <div style={{ opacity: 0.75 }}>{doctor.department}</div>
                <div>
                  <span
                    style={{
                      padding: "3px 10px",
                      borderRadius: 999,
                      background: badge.bg,
                      color: badge.color,
                      fontSize: 12,
                      fontWeight: 600,
                      display: "inline-block",
                    }}
                  >
                    {badge.label}
                  </span>
                </div>
                <div style={{ fontSize: 13, opacity: 0.8 }}>
                  Working Hours: {doctor.working_hours ?? "Not set"}
                </div>
                <div style={{ fontSize: 13, opacity: 0.8 }}>
                  Appointments Today: {doctor.appointments_today ?? 0}
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  <button
                    onClick={() => openAvailabilityForm(doctor)}
                    style={{
                      padding: "6px 10px",
                      borderRadius: 999,
                      border: "1px solid rgba(39,212,207,0.75)",
                      background: "rgba(4, 22, 34, 0.9)",
                      color: "#27D4CF",
                      fontSize: 12,
                      cursor: "pointer",
                    }}
                  >
                    Update Availability
                  </button>
                  <Link
                    href={`/nurse/doctors/${doctor.doctor_id}/schedule`}
                    style={{
                      padding: "6px 10px",
                      borderRadius: 999,
                      border: "1px solid rgba(39,212,207,0.75)",
                      background: "rgba(4, 22, 34, 0.9)",
                      color: "#27D4CF",
                      fontSize: 12,
                      textDecoration: "none",
                    }}
                  >
                    View Schedule
                  </Link>
                  <Link
                    href={`/nurse/doctors/${doctor.doctor_id}/schedule`}
                    style={{
                      padding: "6px 10px",
                      borderRadius: 999,
                      border: "1px solid rgba(39,212,207,0.75)",
                      background: "rgba(4, 22, 34, 0.9)",
                      color: "#27D4CF",
                      fontSize: 12,
                      textDecoration: "none",
                    }}
                  >
                    View Patients
                  </Link>
                </div>
              </div>
            );
          })
        )}
      </div>

      {showForm && activeDoctor ? (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(2, 6, 23, 0.7)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 24,
            zIndex: 20,
          }}
        >
          <div
            style={{
              background: "#0f172a",
              padding: 24,
              borderRadius: 18,
              border: "1px solid rgba(39,212,207,0.3)",
              width: "100%",
              maxWidth: 520,
            }}
          >
            <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 12 }}>
              Update Availability — {activeDoctor.name}
            </div>
            <div style={{ display: "grid", gap: 10 }}>
              {[
                { key: "date", label: "Date", type: "date" },
                { key: "start_time", label: "Start Time", type: "time" },
                { key: "end_time", label: "End Time", type: "time" },
                { key: "slot_duration", label: "Slot Duration (mins)", type: "number" },
              ].map((field) => (
                <label key={field.key} style={{ display: "grid", gap: 6 }}>
                  <span style={{ fontSize: 12, opacity: 0.7 }}>{field.label}</span>
                  <input
                    type={field.type}
                    value={formState[field.key as keyof AvailabilityForm]}
                    onChange={(event) =>
                      setFormState((prev) => ({
                        ...prev,
                        [field.key]: event.target.value,
                      }))
                    }
                    style={{
                      padding: "10px 12px",
                      borderRadius: 10,
                      border: "1px solid rgba(39,212,207,0.3)",
                      background: "rgba(2, 6, 23, 0.8)",
                      color: "white",
                    }}
                  />
                </label>
              ))}
              <label style={{ display: "grid", gap: 6 }}>
                <span style={{ fontSize: 12, opacity: 0.7 }}>Status</span>
                <select
                  value={formState.status}
                  onChange={(event) =>
                    setFormState((prev) => ({ ...prev, status: event.target.value }))
                  }
                  style={{
                    padding: "10px 12px",
                    borderRadius: 10,
                    border: "1px solid rgba(39,212,207,0.3)",
                    background: "rgba(2, 6, 23, 0.8)",
                    color: "white",
                  }}
                >
                  <option value="available">Available</option>
                  <option value="unavailable">Unavailable</option>
                  <option value="leave">Leave</option>
                  <option value="emergency">Emergency</option>
                </select>
              </label>
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: 10,
                marginTop: 16,
              }}
            >
              <button
                onClick={() => setShowForm(false)}
                style={{
                  padding: "8px 14px",
                  borderRadius: 999,
                  border: "1px solid rgba(148, 163, 184, 0.4)",
                  background: "transparent",
                  color: "white",
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                onClick={submitAvailability}
                style={{
                  padding: "8px 14px",
                  borderRadius: 999,
                  border: "1px solid rgba(39,212,207,0.6)",
                  background: "rgba(4, 22, 34, 0.9)",
                  color: "#27D4CF",
                  cursor: "pointer",
                }}
              >
                Save Availability
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
