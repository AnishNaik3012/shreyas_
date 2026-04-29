"use client";

import { ActiveModule, Role } from "@/lib/types";
import { sidebarConfig } from "@/lib/sidebarConfig";

export default function Sidebar({
  role,
  activeModule,
  setActiveModule,
}: {
  role: Role;
  activeModule: ActiveModule;
  setActiveModule: (m: ActiveModule) => void;
}) {
  const items = sidebarConfig[role];

  return (
    <aside
      style={{
        width: 260,
        background: "#020617",
        borderRight: "1px solid rgba(39,212,207,0.25)",
        padding: 16,
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Logo / App name */}
      <h2
        style={{
          color: "#27D4CF",
          fontSize: 20,
          fontWeight: 600,
          marginBottom: 24,
        }}
      >
        Savemom
      </h2>

      {/* Role badge */}
      <div
        style={{
          fontSize: 12,
          opacity: 0.8,
          marginBottom: 16,
        }}
      >
        Role: <b style={{ color: "#27D4CF" }}>{role}</b>
      </div>

      {/* Sidebar items */}
      {items.map((item) => {
        const isActive = activeModule === item;

        return (
          <button
            key={item}
            onClick={() => setActiveModule(item)}
            style={{
              textAlign: "left",
              padding: "10px 14px",
              marginBottom: 8,
              borderRadius: 10,
              border: "none",
              cursor: "pointer",
              background: isActive
                ? "rgba(39,212,207,0.2)"
                : "transparent",
              color: isActive ? "#27D4CF" : "white",
              fontSize: 14,
            }}
          >
            {item.charAt(0).toUpperCase() + item.slice(1)}
          </button>
        );
      })}

      {/* Footer links */}
      <div style={{ marginTop: "auto", fontSize: 12, opacity: 0.6 }}>
        <p style={{ cursor: "pointer" }}>Help</p>
        <p style={{ cursor: "pointer" }}>Privacy Policy</p>
      </div>
    </aside>
  );
}
