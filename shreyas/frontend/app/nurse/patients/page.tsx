"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000";

type PatientSummary = {
  patient_id: string;
  patient_name: string;
  age: number | null;
  last_appointment: string | null;
  last_checkup: string | null;
};

const formatDate = (value: string | null) => {
  if (!value) return "N/A";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
  }).format(date);
};

export default function NursePatientsDashboard() {
  const [patients, setPatients] = useState<PatientSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [navigating, setNavigating] = useState(false);

  const token = useMemo(() => {
    if (typeof window === "undefined") return null;
    return localStorage.getItem("access_token");
  }, []);

  const fetchPatients = async () => {
    try {
      setLoading(true);
      setError(null);
      if (!token) {
        setError("Your session has expired. Please log in again.");
        setPatients([]);
        return;
      }
      const res = await fetch(`${API_BASE}/nurse/patients`, {
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      if (!res.ok) {
        setError("I couldn't load patient records right now.");
        setPatients([]);
        return;
      }
      const data = (await res.json()) as PatientSummary[];
      setPatients(data);
    } catch {
      setError("I couldn't reach the server. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPatients();
  }, []);

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
              Patient Records
            </div>
            <div style={{ fontSize: 13, opacity: 0.75 }}>
              All patients in the system with recent activity.
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
          display: "flex",
          flexDirection: "column",
          gap: 16,
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
          {error ? (
            <div style={{ color: "#fecaca" }}>{error}</div>
          ) : loading ? (
            <div>Loading patients...</div>
          ) : patients.length === 0 ? (
            <div>No patients found.</div>
          ) : (
            <div style={{ width: "100%", overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 900 }}>
                <thead>
                  <tr style={{ textAlign: "left", fontSize: 12, opacity: 0.7 }}>
                    <th style={{ padding: "10px 8px" }}>Patient Name</th>
                    <th style={{ padding: "10px 8px" }}>Age</th>
                    <th style={{ padding: "10px 8px" }}>Last Appointment</th>
                    <th style={{ padding: "10px 8px" }}>Last Checkup</th>
                    <th style={{ padding: "10px 8px" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {patients.map((patient) => (
                    <tr
                      key={patient.patient_id}
                      style={{ borderTop: "1px solid rgba(148,163,184,0.2)" }}
                    >
                      <td style={{ padding: "12px 8px" }}>
                        {patient.patient_name}
                      </td>
                      <td style={{ padding: "12px 8px" }}>
                        {patient.age ?? "N/A"}
                      </td>
                      <td style={{ padding: "12px 8px" }}>
                        {formatDate(patient.last_appointment)}
                      </td>
                      <td style={{ padding: "12px 8px" }}>
                        {formatDate(patient.last_checkup)}
                      </td>
                      <td style={{ padding: "12px 8px" }}>
                        <Link
                          href={`/nurse/patients/${patient.patient_id}`}
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
                          View Details
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
