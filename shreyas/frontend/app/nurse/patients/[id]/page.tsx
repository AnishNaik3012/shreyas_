"use client";

import { use, useEffect, useMemo, useState } from "react";
import Link from "next/link";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000";

type PatientProfile = {
  patient_id: string;
  patient_name: string;
  age: number | null;
  blood_group: string | null;
  phone: string | null;
  medical_history: string | null;
};

type PatientAppointment = {
  appointment_id: string;
  doctor_name: string;
  department: string;
  date: string;
  time: string;
  status: string;
  priority: string;
};

type PatientCheckup = {
  checkup_id: string;
  doctor_name: string;
  checkup_type: string | null;
  date: string;
  time: string;
  status: string;
  priority: string;
  report_url: string | null;
  remarks: string | null;
};

type PatientDetailResponse = {
  patient: PatientProfile;
  appointments: PatientAppointment[];
  checkups: PatientCheckup[];
};

type PatientVital = {
  vital_id: string;
  blood_pressure: string | null;
  heart_rate: string | null;
  temperature: string | null;
  respiratory_rate: string | null;
  oxygen_saturation: string | null;
  weight: string | null;
  notes: string | null;
  recorded_at: string | null;
};

type PatientReport = {
  checkup_id: string;
  checkup_type: string | null;
  date: string;
  report_url: string;
};

type PatientPrescription = {
  prescription_id: string;
  title: string | null;
  date: string | null;
};

type VitalFormState = {
  blood_pressure: string;
  heart_rate: string;
  temperature: string;
  respiratory_rate: string;
  oxygen_saturation: string;
  weight: string;
  notes: string;
};

const emptyForm: VitalFormState = {
  blood_pressure: "",
  heart_rate: "",
  temperature: "",
  respiratory_rate: "",
  oxygen_saturation: "",
  weight: "",
  notes: "",
};

const formatDateTime = (value: string | null) => {
  if (!value) return "N/A";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
};

const formatDate = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
  }).format(date);
};

export default function NursePatientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: patientId } = use(params);
  const [patient, setPatient] = useState<PatientProfile | null>(null);
  const [appointments, setAppointments] = useState<PatientAppointment[]>([]);
  const [checkups, setCheckups] = useState<PatientCheckup[]>([]);
  const [vitals, setVitals] = useState<PatientVital[]>([]);
  const [reports, setReports] = useState<PatientReport[]>([]);
  const [prescriptions, setPrescriptions] = useState<PatientPrescription[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showVitalsForm, setShowVitalsForm] = useState(false);
  const [formState, setFormState] = useState<VitalFormState>(emptyForm);

  const token = useMemo(() => {
    if (typeof window === "undefined") return null;
    return localStorage.getItem("access_token");
  }, []);

  const fetchPatientDetail = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`${API_BASE}/nurse/patients/${patientId}`, {
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      if (!res.ok) {
        setError("Unable to load patient details.");
        return;
      }
      const data = (await res.json()) as PatientDetailResponse;
      setPatient(data.patient);
      setAppointments(data.appointments ?? []);
      setCheckups(data.checkups ?? []);
    } catch {
      setError("Unable to load patient details.");
    } finally {
      setLoading(false);
    }
  };

  const fetchVitals = async () => {
    try {
      const res = await fetch(`${API_BASE}/nurse/patients/${patientId}/vitals`, {
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      if (!res.ok) {
        return;
      }
      const data = (await res.json()) as PatientVital[];
      setVitals(data);
    } catch {}
  };

  const fetchReports = async () => {
    try {
      const res = await fetch(`${API_BASE}/nurse/patients/${patientId}/reports`, {
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      if (!res.ok) {
        return;
      }
      const data = (await res.json()) as PatientReport[];
      setReports(data);
    } catch {}
  };

  const fetchPrescriptions = async () => {
    try {
      const res = await fetch(
        `${API_BASE}/nurse/patients/${patientId}/prescriptions`,
        {
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        },
      );
      if (!res.ok) {
        return;
      }
      const data = (await res.json()) as PatientPrescription[];
      setPrescriptions(data);
    } catch {}
  };

  useEffect(() => {
    void fetchPatientDetail();
    void fetchVitals();
    void fetchReports();
    void fetchPrescriptions();
  }, [patientId]);

  const handleSubmitVitals = async () => {
    try {
      const res = await fetch(`${API_BASE}/nurse/patients/${patientId}/vitals`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(formState),
      });
      if (!res.ok) {
        return;
      }
      setFormState(emptyForm);
      setShowVitalsForm(false);
      await fetchVitals();
    } catch {}
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#020617",
        color: "white",
        padding: "32px 24px 48px",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 24,
        }}
      >
        <div>
          <div style={{ fontSize: 26, fontWeight: 600, color: "#27D4CF" }}>
            Patient Records
          </div>
          <div style={{ opacity: 0.7 }}>Nurse dashboard profile</div>
        </div>
        <Link
          href="/chat/nurse"
          style={{
            color: "#27D4CF",
            textDecoration: "none",
            border: "1px solid rgba(39,212,207,0.5)",
            padding: "8px 14px",
            borderRadius: 999,
            fontSize: 13,
          }}
        >
          Back to Nurse Chat
        </Link>
      </div>

      {loading ? (
        <div style={{ opacity: 0.7 }}>Loading patient profile...</div>
      ) : error ? (
        <div style={{ color: "#fca5a5" }}>{error}</div>
      ) : (
        <>
          <section
            style={{
              background: "rgba(15, 23, 42, 0.9)",
              borderRadius: 18,
              padding: 24,
              border: "1px solid rgba(39,212,207,0.2)",
              marginBottom: 24,
            }}
          >
            <div style={{ fontSize: 20, fontWeight: 600, marginBottom: 12 }}>
              Patient Information
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                gap: 12,
              }}
            >
              <div>
                <div style={{ opacity: 0.7, fontSize: 12 }}>Patient Name</div>
                <div style={{ fontSize: 16 }}>{patient?.patient_name ?? "N/A"}</div>
              </div>
              <div>
                <div style={{ opacity: 0.7, fontSize: 12 }}>Age</div>
                <div style={{ fontSize: 16 }}>{patient?.age ?? "N/A"}</div>
              </div>
              <div>
                <div style={{ opacity: 0.7, fontSize: 12 }}>Blood Group</div>
                <div style={{ fontSize: 16 }}>{patient?.blood_group ?? "N/A"}</div>
              </div>
              <div>
                <div style={{ opacity: 0.7, fontSize: 12 }}>Phone</div>
                <div style={{ fontSize: 16 }}>{patient?.phone ?? "N/A"}</div>
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <div style={{ opacity: 0.7, fontSize: 12 }}>Medical History</div>
                <div style={{ fontSize: 16 }}>
                  {patient?.medical_history ?? "N/A"}
                </div>
              </div>
            </div>
          </section>

          <section
            style={{
              background: "rgba(15, 23, 42, 0.9)",
              borderRadius: 18,
              padding: 24,
              border: "1px solid rgba(39,212,207,0.2)",
              marginBottom: 24,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 16,
              }}
            >
              <div style={{ fontSize: 20, fontWeight: 600 }}>Vitals</div>
              <button
                onClick={() => setShowVitalsForm(true)}
                style={{
                  padding: "8px 16px",
                  borderRadius: 999,
                  border: "1px solid rgba(39,212,207,0.6)",
                  background: "rgba(4, 22, 34, 0.9)",
                  color: "#27D4CF",
                  fontSize: 13,
                  cursor: "pointer",
                }}
              >
                Update Vitals
              </button>
            </div>
            {vitals.length === 0 ? (
              <div style={{ opacity: 0.7 }}>No vitals recorded yet.</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {vitals.map((vital) => (
                  <div
                    key={vital.vital_id}
                    style={{
                      border: "1px solid rgba(39,212,207,0.2)",
                      borderRadius: 14,
                      padding: 14,
                      background: "rgba(4, 22, 34, 0.8)",
                    }}
                  >
                    <div style={{ fontWeight: 600, marginBottom: 6 }}>
                      Recorded: {formatDateTime(vital.recorded_at)}
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
                      <div>BP: {vital.blood_pressure ?? "N/A"}</div>
                      <div>Pulse: {vital.heart_rate ?? "N/A"}</div>
                      <div>Temp: {vital.temperature ?? "N/A"}</div>
                      <div>Resp: {vital.respiratory_rate ?? "N/A"}</div>
                      <div>O2: {vital.oxygen_saturation ?? "N/A"}</div>
                      <div>Weight: {vital.weight ?? "N/A"}</div>
                    </div>
                    {vital.notes ? (
                      <div style={{ marginTop: 6, opacity: 0.8 }}>
                        Notes: {vital.notes}
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </section>

          <section
            style={{
              background: "rgba(15, 23, 42, 0.9)",
              borderRadius: 18,
              padding: 24,
              border: "1px solid rgba(39,212,207,0.2)",
              marginBottom: 24,
            }}
          >
            <div style={{ fontSize: 20, fontWeight: 600, marginBottom: 12 }}>
              Reports
            </div>
            {reports.length === 0 ? (
              <div style={{ opacity: 0.7 }}>No reports uploaded yet.</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {reports.map((report) => (
                  <div key={report.checkup_id}>
                    <div style={{ fontWeight: 600 }}>
                      {report.checkup_type ?? "Checkup"} • {formatDate(report.date)}
                    </div>
                    <a
                      href={`${API_BASE}${report.report_url}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: "#27D4CF", textDecoration: "none" }}
                    >
                      View Report
                    </a>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section
            style={{
              background: "rgba(15, 23, 42, 0.9)",
              borderRadius: 18,
              padding: 24,
              border: "1px solid rgba(39,212,207,0.2)",
              marginBottom: 24,
            }}
          >
            <div style={{ fontSize: 20, fontWeight: 600, marginBottom: 12 }}>
              Prescriptions
            </div>
            {prescriptions.length === 0 ? (
              <div style={{ opacity: 0.7 }}>No prescriptions available.</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {prescriptions.map((prescription) => (
                  <div key={prescription.prescription_id}>
                    <div style={{ fontWeight: 600 }}>
                      {prescription.title ?? "Prescription"}
                    </div>
                    <div style={{ opacity: 0.7 }}>
                      {prescription.date ? formatDate(prescription.date) : "N/A"}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section
            style={{
              background: "rgba(15, 23, 42, 0.9)",
              borderRadius: 18,
              padding: 24,
              border: "1px solid rgba(39,212,207,0.2)",
              marginBottom: 24,
            }}
          >
            <div style={{ fontSize: 20, fontWeight: 600, marginBottom: 12 }}>
              Appointment History
            </div>
            {appointments.length === 0 ? (
              <div style={{ opacity: 0.7 }}>No appointments recorded.</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {appointments.map((appointment) => (
                  <div key={appointment.appointment_id}>
                    <div style={{ fontWeight: 600 }}>
                      {appointment.department} • Dr. {appointment.doctor_name}
                    </div>
                    <div style={{ opacity: 0.7 }}>
                      {formatDate(appointment.date)} at {appointment.time} •{" "}
                      {appointment.status}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section
            style={{
              background: "rgba(15, 23, 42, 0.9)",
              borderRadius: 18,
              padding: 24,
              border: "1px solid rgba(39,212,207,0.2)",
            }}
          >
            <div style={{ fontSize: 20, fontWeight: 600, marginBottom: 12 }}>
              Checkup History
            </div>
            {checkups.length === 0 ? (
              <div style={{ opacity: 0.7 }}>No checkups recorded.</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {checkups.map((checkup) => (
                  <div key={checkup.checkup_id}>
                    <div style={{ fontWeight: 600 }}>
                      {checkup.checkup_type ?? "Checkup"} • Dr. {checkup.doctor_name}
                    </div>
                    <div style={{ opacity: 0.7 }}>
                      {formatDate(checkup.date)} at {checkup.time} •{" "}
                      {checkup.status}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}

      {showVitalsForm ? (
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
              Update Vitals
            </div>
            <div style={{ display: "grid", gap: 10 }}>
              {[
                { key: "blood_pressure", label: "Blood Pressure" },
                { key: "heart_rate", label: "Heart Rate" },
                { key: "temperature", label: "Temperature" },
                { key: "respiratory_rate", label: "Respiratory Rate" },
                { key: "oxygen_saturation", label: "Oxygen Saturation" },
                { key: "weight", label: "Weight" },
                { key: "notes", label: "Notes" },
              ].map((field) => (
                <label key={field.key} style={{ display: "grid", gap: 6 }}>
                  <span style={{ fontSize: 12, opacity: 0.7 }}>{field.label}</span>
                  <input
                    value={formState[field.key as keyof VitalFormState]}
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
                onClick={() => setShowVitalsForm(false)}
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
                onClick={handleSubmitVitals}
                style={{
                  padding: "8px 14px",
                  borderRadius: 999,
                  border: "1px solid rgba(39,212,207,0.6)",
                  background: "rgba(4, 22, 34, 0.9)",
                  color: "#27D4CF",
                  cursor: "pointer",
                }}
              >
                Save Vitals
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
