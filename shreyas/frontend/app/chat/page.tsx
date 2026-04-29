"use client";

import { useEffect } from "react";
import { sidebarConfig } from "@/lib/sidebarConfig";
import { ActiveModule } from "@/lib/types";
import { useModule } from "./context";


const LABELS: Record<ActiveModule, string> = {
  home: "Home",
  appointments: "Appointments",
  checkups: "Check-ups",
  reports: "Reports",
  prescriptions: "Prescriptions",
  patients: "Patients",
  guide: "How to Use",
};

export default function Sidebar() {
  const { role, activeModule, setActiveModule } = useModule();

  useEffect(() => {}, []);

  return (
    <aside
      style={{
        width: 260,
        background: "#020617",
        padding: 16,
        borderRight: "1px solid #1e293b",
      }}
    >
      <h2
        style={{
          color: "#27D4CF",
          textAlign: "center",
          marginBottom: 24,
        }}
      >
        Savemom
      </h2>

      {sidebarConfig[role].map((key) => (
        <button
          key={key}
          onClick={() => setActiveModule(key)}
          style={{
            width: "100%",
            padding: "12px 14px",
            marginBottom: 8,
            textAlign: "left",
            borderRadius: 10,
            background: activeModule === key ? "#0b1220" : "transparent",
            color: activeModule === key ? "#27D4CF" : "white",
            border:
              activeModule === key
                ? "1px solid rgba(39,212,207,.4)"
                : "1px solid transparent",
            cursor: "pointer",
          }}
        >
          {LABELS[key]}
        </button>
      ))}
    </aside>
  );
}
