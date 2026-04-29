"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { sendOtpForSignup } from "@/lib/auth";

const THEME = "#27D4CF";

export default function SignupPage() {
  const router = useRouter();
  const [identifier, setIdentifier] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState("parent");
  const [loading, setLoading] = useState(false);

  async function handleSendOtp() {
    if (!identifier.trim() || !fullName.trim()) {
      alert("Please fill all fields");
      return;
    }

    setLoading(true);
    try {
      const value = identifier.trim();
      const isEmail = value.includes("@");
      await sendOtpForSignup(isEmail ? { email: value } : { phone: value });

      localStorage.setItem("auth_mode", "signup");
      localStorage.setItem("auth_id_type", isEmail ? "email" : "phone");
      localStorage.setItem("auth_id_value", value);
      localStorage.setItem("full_name", fullName.trim());
      localStorage.setItem("selected_role", role);

      router.push("/auth/verify-otp");
    } catch (e: any) {
      alert(e.message || "Failed to send OTP");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        background: "radial-gradient(circle at top, #020617, #020617)",
        color: "white",
      }}
    >
      <div
        style={{
          width: 420,
          padding: 36,
          borderRadius: 18,
          background: "rgba(11,18,32,0.9)",
          boxShadow: `0 0 40px rgba(39,212,207,0.15)`,
          border: `1px solid rgba(39,212,207,0.25)`,
          backdropFilter: "blur(10px)",
        }}
      >
        <h2
          style={{
            fontSize: 30,
            textAlign: "center",
            marginBottom: 24,
            color: THEME,
            fontWeight: 600,
          }}
        >
          Sign Up
        </h2>

        {/* FULL NAME */}
        <input
          placeholder="Full Name"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          style={{
            width: "100%",
            height: 56,
            padding: 16,
            borderRadius: 12,
            border: `2px solid rgba(39,212,207,0.4)`,
            background: "#020617",
            color: "white",
            outline: "none",
            marginBottom: 16,
            fontSize: 15,
            lineHeight: "24px",
            boxSizing: "border-box",
          }}
        />

        {/* EMAIL / PHONE */}
        <input
          placeholder="Email or Phone"
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
          style={{
            width: "100%",
            height: 56,
            padding: 16,
            borderRadius: 12,
            border: `2px solid rgba(39,212,207,0.4)`,
            background: "#020617",
            color: "white",
            outline: "none",
            marginBottom: 16,
            fontSize: 15,
            lineHeight: "24px",
            boxSizing: "border-box",
          }}
        />

        {/* ROLE */}
        <select
          value={role}
          onChange={(e) => setRole(e.target.value)}
          style={{
            width: "100%",
            height: 56,
            padding: 16,
            borderRadius: 12,
            border: `2px solid rgba(39,212,207,0.4)`,
            background: "#020617",
            color: "white",
            outline: "none",
            marginBottom: 22,
            fontSize: 15,
            cursor: "pointer",
            lineHeight: "24px",
            boxSizing: "border-box",
          }}
        >
          <option value="parent">Parent</option>
          <option value="doctor">Doctor</option>
          <option value="nurse">Nurse</option>
        </select>

        {/* BUTTON */}
        <button
          onClick={handleSendOtp}
          disabled={loading}
          style={{
            width: "100%",
            padding: 16,
            borderRadius: 14,
            border: "none",
            background: THEME,
            color: "#001014",
            fontSize: 16,
            fontWeight: 600,
            cursor: loading ? "not-allowed" : "pointer",
            opacity: loading ? 0.7 : 1,
            boxShadow: `0 8px 24px rgba(39,212,207,0.35)`,
          }}
        >
          {loading ? "Sending..." : "Send OTP"}
        </button>
      </div>
    </main>
  );
}
