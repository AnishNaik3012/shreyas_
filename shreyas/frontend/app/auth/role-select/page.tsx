"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Role = "parent" | "doctor" | "nurse";

export default function RoleSelectPage() {
  const router = useRouter();
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);

  const roles = [
    {
      id: "parent" as Role,
      title: "Parent",
      subtitle: "Mother / Father",
      description:
        "Access maternal care guidance, appointments, reports, and prescriptions.",
      icon: "👩‍👦",
    },
    {
      id: "doctor" as Role,
      title: "Doctor",
      subtitle: "Healthcare Professional",
      description:
        "Review patient reports, appointments, and provide medical guidance.",
      icon: "🩺",
    },
    {
      id: "nurse" as Role,
      title: "Nurse",
      subtitle: "Clinical Support",
      description:
        "Assist doctors, manage checkups, and support patient care.",
      icon: "💉",
    },
  ];

  const handleContinue = () => {
    if (!selectedRole) return;

    // Store TEMP signup state
    localStorage.setItem("selected_role", selectedRole);
    localStorage.setItem("auth_mode", "signup");

    // Move to signup flow (details / OTP)
    router.push("/auth/signup");
  };

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#0b1220",
        color: "white",
        padding: "24px",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
      }}
    >
      <div style={{ textAlign: "center", marginBottom: "32px" }}>
        <h1 style={{ color: "#4dabf7", fontSize: "32px" }}>
          Choose Your Role
        </h1>
        <p style={{ marginTop: "8px", opacity: 0.85 }}>
          This helps us personalize your experience and ensure safe care.
        </p>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
          gap: "20px",
          maxWidth: "900px",
          margin: "0 auto",
        }}
      >
        {roles.map((role) => {
          const isActive = selectedRole === role.id;

          return (
            <div
              key={role.id}
              onClick={() => setSelectedRole(role.id)}
              style={{
                background: isActive ? "#2f9e9e" : "#1e293b",
                borderRadius: "18px",
                padding: "24px",
                cursor: "pointer",
                border: isActive
                  ? "2px solid #4dabf7"
                  : "2px solid transparent",
                transform: isActive ? "scale(1.03)" : "scale(1)",
                transition: "all 0.25s ease",
              }}
            >
              <div style={{ fontSize: "36px", marginBottom: "12px" }}>
                {role.icon}
              </div>

              <h2>{role.title}</h2>
              <p style={{ fontSize: "14px", opacity: 0.8 }}>
                {role.subtitle}
              </p>

              <p
                style={{
                  marginTop: "12px",
                  fontSize: "14px",
                  lineHeight: 1.5,
                  opacity: 0.9,
                }}
              >
                {role.description}
              </p>
            </div>
          );
        })}
      </div>

      <div style={{ textAlign: "center", marginTop: "40px" }}>
        <button
          onClick={handleContinue}
          disabled={!selectedRole}
          style={{
            padding: "14px 32px",
            fontSize: "16px",
            borderRadius: "10px",
            border: "none",
            background: selectedRole ? "#2563eb" : "#334155",
            color: "white",
            cursor: selectedRole ? "pointer" : "not-allowed",
          }}
        >
          Continue
        </button>
      </div>
    </main>
  );
}
