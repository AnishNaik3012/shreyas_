"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8001";

export default function VerifyOtpPage() {
  const router = useRouter();
  const [otp, setOtp] = useState("");
  const [role, setRole] = useState("parent");
  const [mode, setMode] = useState<"login" | "signup">("login");

  useEffect(() => {
    const m = localStorage.getItem("auth_mode") as
      | "login"
      | "signup"
      | null;
    if (m) setMode(m);
  }, []);

  const verifyOtp = async () => {
    const idType = localStorage.getItem("auth_id_type");
    const idValue = localStorage.getItem("auth_id_value");
    const fullName = localStorage.getItem("full_name");

    if (!idType || !idValue || !otp) {
      alert("Missing OTP");
      return;
    }

    const payload: any = {
      otp: otp.trim(),
    };
    if (idType === "email") {
      payload.email = idValue.trim();
    } else if (idType === "phone") {
      payload.phone = idValue.trim();
    }

    if (mode === "signup") {
      payload.role = role;
      if (fullName) payload.full_name = fullName.trim();
    }

    const res = await fetch(`${API_BASE}/auth/verify-otp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      alert("Invalid OTP");
      return;
    }

    const data = await res.json();

    localStorage.setItem("access_token", data.access_token);
    localStorage.setItem("role", data.role);

    localStorage.removeItem("auth_id_type");
    localStorage.removeItem("auth_id_value");
    localStorage.removeItem("full_name");

    router.push("/chat");
  };

  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center" }}>
      <div style={{ width: 320 }}>
        <h2>Verify OTP</h2>

        <input
          value={otp}
          onChange={(e) => setOtp(e.target.value)}
          placeholder="Enter OTP"
          style={{ width: "100%", padding: 12 }}
        />

        {mode === "signup" && (
          <select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            style={{ width: "100%", marginTop: 8 }}
          >
            <option value="parent">Parent</option>
            <option value="doctor">Doctor</option>
            <option value="nurse">Nurse</option>
          </select>
        )}

        <button
          onClick={verifyOtp}
          style={{ marginTop: 12, width: "100%" }}
        >
          Verify
        </button>
      </div>
    </main>
  );
}
