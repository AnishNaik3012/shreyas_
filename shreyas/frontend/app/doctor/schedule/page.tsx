"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000";

type ScheduleResponse = {
  availability: Array<{
    date: string;
    start_time: string | null;
    end_time: string | null;
    slot_duration: number | null;
    status: string;
  }>;
  slots: Array<{ time: string; status: "booked" | "free" }>;
  appointments: Array<{
    appointment_id: string;
    patient_name: string;
    time_slot: string;
    status: string;
    priority: string;
  }>;
  workload: {
    total: number;
    pending: number;
    completed: number;
  };
  patient_count: number;
};

export default function DoctorSchedulePage() {
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [schedule, setSchedule] = useState<ScheduleResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const token = useMemo(() => {
    if (typeof window === "undefined") return null;
    return localStorage.getItem("access_token");
  }, []);

  const fetchSchedule = async (dateValue: string) => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`${API_BASE}/doctor/my-schedule?date=${dateValue}`, {
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      if (!res.ok) {
        setError("Unable to load schedule.");
        setSchedule(null);
        return;
      }
      const data = (await res.json()) as ScheduleResponse;
      setSchedule(data);
    } catch {
      setError("Unable to load schedule.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSchedule(date);
  }, [date]);

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
              My Schedule
            </div>
            <div style={{ fontSize: 13, opacity: 0.75 }}>
              Today’s availability, patients, and upcoming appointments.
            </div>
          </div>
          <Link
            href="/chat/doctor"
            style={{
              padding: "8px 14px",
              borderRadius: 999,
              border: "1px solid rgba(39,212,207,0.75)",
              background: "rgba(4, 22, 34, 0.9)",
              color: "#27D4CF",
              fontSize: 13,
              textDecoration: "none",
            }}
          >
            Go back to chatbot
          </Link>
        </div>
      </header>

      <div style={{ padding: "24px 28px", display: "flex", flexDirection: "column", gap: 16 }}>
        <label style={{ display: "flex", flexDirection: "column", gap: 6, maxWidth: 220 }}>
          <span style={{ fontSize: 12, opacity: 0.7 }}>Schedule Date</span>
          <input
            type="date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
            style={{
              padding: "8px 10px",
              borderRadius: 10,
              background: "#0f172a",
              color: "white",
            }}
          />
        </label>

        {error ? (
          <div style={{ color: "#fecaca" }}>{error}</div>
        ) : loading ? (
          <div>Loading schedule...</div>
        ) : !schedule ? (
          <div>No schedule available.</div>
        ) : (
          <>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                gap: 12,
              }}
            >
              <div
                style={{
                  background: "rgba(15, 23, 42, 0.6)",
                  border: "1px solid rgba(39,212,207,0.2)",
                  borderRadius: 16,
                  padding: 16,
                }}
              >
                <div style={{ fontSize: 12, opacity: 0.7 }}>Total Appointments</div>
                <div style={{ fontSize: 20, fontWeight: 600 }}>{schedule.workload.total}</div>
              </div>
              <div
                style={{
                  background: "rgba(15, 23, 42, 0.6)",
                  border: "1px solid rgba(39,212,207,0.2)",
                  borderRadius: 16,
                  padding: 16,
                }}
              >
                <div style={{ fontSize: 12, opacity: 0.7 }}>Pending</div>
                <div style={{ fontSize: 20, fontWeight: 600 }}>{schedule.workload.pending}</div>
              </div>
              <div
                style={{
                  background: "rgba(15, 23, 42, 0.6)",
                  border: "1px solid rgba(39,212,207,0.2)",
                  borderRadius: 16,
                  padding: 16,
                }}
              >
                <div style={{ fontSize: 12, opacity: 0.7 }}>Completed</div>
                <div style={{ fontSize: 20, fontWeight: 600 }}>{schedule.workload.completed}</div>
              </div>
              <div
                style={{
                  background: "rgba(15, 23, 42, 0.6)",
                  border: "1px solid rgba(39,212,207,0.2)",
                  borderRadius: 16,
                  padding: 16,
                }}
              >
                <div style={{ fontSize: 12, opacity: 0.7 }}>Patients Today</div>
                <div style={{ fontSize: 20, fontWeight: 600 }}>{schedule.patient_count}</div>
              </div>
            </div>

            <div
              style={{
                background: "rgba(15, 23, 42, 0.6)",
                border: "1px solid rgba(39,212,207,0.2)",
                borderRadius: 16,
                padding: 16,
              }}
            >
              <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 12 }}>
                Slot Timeline
              </div>
              {schedule.slots.length === 0 ? (
                <div>No slots configured.</div>
              ) : (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {schedule.slots.map((slot) => (
                    <span
                      key={slot.time}
                      style={{
                        padding: "6px 10px",
                        borderRadius: 999,
                        background: slot.status === "booked" ? "#7f1d1d" : "#14532d",
                        color: slot.status === "booked" ? "#fecaca" : "#86efac",
                        fontSize: 12,
                        fontWeight: 600,
                      }}
                    >
                      {slot.time} {slot.status}
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div
              style={{
                background: "rgba(15, 23, 42, 0.6)",
                border: "1px solid rgba(39,212,207,0.2)",
                borderRadius: 16,
                padding: 16,
              }}
            >
              <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 12 }}>
                Patient List
              </div>
              {schedule.appointments.length === 0 ? (
                <div>No appointments scheduled.</div>
              ) : (
                <div style={{ width: "100%", overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 600 }}>
                    <thead>
                      <tr style={{ textAlign: "left", fontSize: 12, opacity: 0.7 }}>
                        <th style={{ padding: "10px 8px" }}>Patient</th>
                        <th style={{ padding: "10px 8px" }}>Time</th>
                        <th style={{ padding: "10px 8px" }}>Status</th>
                        <th style={{ padding: "10px 8px" }}>Priority</th>
                      </tr>
                    </thead>
                    <tbody>
                      {schedule.appointments.map((appt) => (
                        <tr key={appt.appointment_id} style={{ borderTop: "1px solid rgba(148,163,184,0.2)" }}>
                          <td style={{ padding: "12px 8px" }}>{appt.patient_name}</td>
                          <td style={{ padding: "12px 8px" }}>{appt.time_slot}</td>
                          <td style={{ padding: "12px 8px" }}>{appt.status}</td>
                          <td style={{ padding: "12px 8px" }}>{appt.priority}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
