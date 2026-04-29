"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8001";

export default function VerifyOtpPage() {
  const router = useRouter();

  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);

  const [idType, setIdType] = useState<string | null>(null);
  const [idValue, setIdValue] = useState<string | null>(null);
  const [authMode, setAuthMode] = useState<string | null>(null);
  const [fullName, setFullName] = useState<string | null>(null);
  const [role, setRole] = useState<string | null>(null);

  // Fix hydration
  useEffect(() => {
    setMounted(true);

    setIdType(localStorage.getItem("auth_id_type"));
    setIdValue(localStorage.getItem("auth_id_value"));
    setAuthMode(localStorage.getItem("auth_mode"));
    setFullName(localStorage.getItem("full_name"));
    setRole(localStorage.getItem("selected_role"));
  }, []);

  useEffect(() => {
    if (mounted && (!idType || !idValue)) {
      router.replace("/auth/login");
    }
  }, [mounted, idType, idValue, router]);

  if (!mounted) return null;

  const verifyOtp = async () => {
    if (!otp.trim()) {
      alert("Please enter OTP");
      return;
    }

    setLoading(true);

    try {
      const payload: any = {
        otp,
      };
      if (idType === "email") {
        payload.email = idValue;
      } else if (idType === "phone") {
        payload.phone = idValue;
      }

      // signup only
      if (authMode === "signup") {
        payload.full_name = fullName;
        payload.role = role;
      }

      const res = await fetch(`${API_BASE}/auth/verify-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.detail || "OTP verification failed");
      }

      // save session
      localStorage.setItem("access_token", data.access_token);
      localStorage.setItem("role", data.role);

      // cleanup
      localStorage.removeItem("auth_mode");
      localStorage.removeItem("auth_id_type");
      localStorage.removeItem("auth_id_value");
      localStorage.removeItem("full_name");
      localStorage.removeItem("selected_role");

      if (data.role === "doctor") {
          router.replace("/chat/doctor");
          } else if (data.role === "nurse") {
  router.replace("/chat/nurse");
          } else {
          router.replace("/chat/parent");
          }
    } catch (err: any) {
      alert(err.message || "Invalid OTP");
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
        background: "#020617",
        color: "white",
      }}
    >
      <div
        style={{
          width: 360,
          padding: 32,
          borderRadius: 16,
          background: "#0b1220",
          boxShadow: "0 0 0 1px rgba(39,212,207,0.15), 0 20px 40px rgba(0,0,0,0.5)",
        }}
      >
        <h2
          style={{
            fontSize: 26,
            textAlign: "center",
            marginBottom: 24,
            color: "#27D4CF",
          }}
        >
          Verify OTP
        </h2>

        <input
          value={otp}
          onChange={(e) => setOtp(e.target.value)}
          placeholder="Enter OTP"
          style={{
            width: "100%",
            height: 56,
            padding: 14,
            borderRadius: 10,
            border: "1px solid #1e293b",
            background: "#020617",
            color: "white",
            outline: "none",
            marginBottom: 18,
            transition: "0.2s",
            lineHeight: "24px",
            boxSizing: "border-box",
          }}
          onFocus={(e) =>
            (e.currentTarget.style.boxShadow =
              "0 0 0 2px rgba(39,212,207,0.5)")
          }
          onBlur={(e) => (e.currentTarget.style.boxShadow = "none")}
        />

        <button
          onClick={verifyOtp}
          disabled={loading}
          style={{
            width: "100%",
            height: 56,
            padding: 14,
            borderRadius: 10,
            border: "none",
            background: "#27D4CF",
            color: "#020617",
            fontSize: 16,
            fontWeight: 600,
            cursor: loading ? "not-allowed" : "pointer",
            opacity: loading ? 0.7 : 1,
            transition: "0.2s",
            boxSizing: "border-box",
          }}
        >
          {loading ? "Verifying..." : "Verify OTP"}
        </button>
      </div>
    </main>
  );
}
