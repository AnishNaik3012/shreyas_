"use client";

import { useRouter } from "next/navigation";
import React, { useState } from "react";
import { sendOtpForLogin } from "../../../lib/auth";

const THEME = "#27D4CF";

export default function LoginPage() {
  const router = useRouter();
  const [identifier, setIdentifier] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSendOtp = async () => {
    if (!identifier.trim()) {
      alert("Please enter email or phone");
      return;
    }

    setLoading(true);
    try {
      const value = identifier.trim();
      const isEmail = value.includes("@");
      await sendOtpForLogin(isEmail ? { email: value } : { phone: value });

      localStorage.setItem("auth_mode", "login");
      localStorage.setItem("auth_id_type", isEmail ? "email" : "phone");
      localStorage.setItem("auth_id_value", value);

      router.push("/auth/verify-otp");
    } catch (err: any) {
      alert(err.message || "OTP sending failed");
    } finally {
      setLoading(false);
    }
  };

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
          Login
        </h2>

        <input
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
          placeholder="Email or Phone"
          style={{
            width: "100%",
            height: 56,
            padding: 16,
            borderRadius: 12,
            border: `2px solid rgba(39,212,207,0.4)`,
            background: "#020617",
            color: "white",
            outline: "none",
            marginBottom: 20,
            fontSize: 15,
            lineHeight: "24px",
            boxSizing: "border-box",
          }}
        />

        <button
          onClick={handleSendOtp}
          disabled={loading}
          style={{
            width: "100%",
            height: 56,
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
            boxSizing: "border-box",
          }}
        >
          {loading ? "Sending..." : "Send OTP"}
        </button>

        <p
          style={{
            marginTop: 22,
            fontSize: 14,
            textAlign: "center",
            opacity: 0.9,
          }}
        >
          New user?{" "}
          <span
            onClick={() => router.push("/auth/signup")}
            style={{
              color: THEME,
              cursor: "pointer",
              fontWeight: 600,
            }}
          >
            Sign up
          </span>
        </p>
      </div>
    </main>
  );
}
