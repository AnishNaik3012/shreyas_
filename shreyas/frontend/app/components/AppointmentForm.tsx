"use client";

import { useState } from "react";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8001";

type AppointmentFormProps = {
  onClose: () => void;
  onSuccess: () => void;
};

export default function AppointmentForm({
  onClose,
  onSuccess,
}: AppointmentFormProps) {
  const [doctorName, setDoctorName] = useState("");
  const [reason, setReason] = useState("");
  const [dateTime, setDateTime] = useState("");

  const token =
    typeof window !== "undefined" ? localStorage.getItem("token") : null;

  const submit = async () => {
    const res = await fetch(`${API_BASE}/appointments/book`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        doctor_name: doctorName,
        reason,
        appointment_time: dateTime,
      }),
    });

    if (res.ok) {
      onSuccess();
      onClose();
    } else {
      alert("Failed to book appointment");
    }
  };

  return (
    <div style={overlayStyle}>
      <div style={modalStyle}>
        <h2>Book Appointment</h2>

        <input
          placeholder="Doctor name"
          value={doctorName}
          onChange={(e) => setDoctorName(e.target.value)}
        />

        <input
          placeholder="Reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />

        <input
          type="datetime-local"
          value={dateTime}
          onChange={(e) => setDateTime(e.target.value)}
        />

        <div style={{ marginTop: 12 }}>
          <button onClick={submit}>Book</button>
          <button onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

/* ================= STYLES ================= */

const overlayStyle = {
  position: "fixed" as const,
  inset: 0,
  background: "rgba(0,0,0,0.6)",
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
};

const modalStyle = {
  background: "#0b1220",
  padding: 20,
  borderRadius: 12,
  color: "white",
  width: 320,
  display: "flex",
  flexDirection: "column" as const,
  gap: 10,
};
