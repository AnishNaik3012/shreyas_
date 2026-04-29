"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { sidebarConfig } from "@/lib/sidebarConfig";
import { ActiveModule } from "@/lib/types";
import { useModule } from "../context";

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
  const {
    role,
    activeModule,
    setActiveModule,
    guideTopic,
    setGuideTopic,
  } = useModule();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {}, []);

  const extraGuideItems = ["Privacy and Concern", "Help"];
  const items = [
    ...sidebarConfig[role].map((key) => ({
      key,
      label: LABELS[key],
      isGuideAlias: key === "guide",
    })),
    ...extraGuideItems.map((label) => ({
      key: "guide" as ActiveModule,
      label,
      isGuideAlias: true,
    })),
  ];

  return (
    <aside
      style={{
        width: 260,
        height: "100vh",
        display: "flex",
        flexDirection: "column",
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

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-evenly",
          flex: 1,
          paddingBottom: 8,
        }}
      >
        {items.map((item) => {
          const isActive =
            activeModule === item.key &&
            (!item.isGuideAlias || guideTopic === item.label);
          return (
            <button
              key={item.label}
              onClick={() => {
                if (role === "nurse" && item.key === "appointments") {
                  if (pathname !== "/nurse/appointments") {
                    router.push("/nurse/appointments");
                  }
                  return;
                }
                if (role === "nurse" && item.key === "checkups") {
                  if (pathname !== "/nurse/checkups") {
                    router.push("/nurse/checkups");
                  }
                  return;
                }
                if (role === "nurse" && item.key === "patients") {
                  if (pathname !== "/nurse/patients") {
                    router.push("/nurse/patients");
                  }
                  return;
                }
                if (item.isGuideAlias) {
                  setGuideTopic(item.label);
                  setActiveModule("guide");
                  window.dispatchEvent(new Event("chat-scroll-bottom"));
                  return;
                }
                setActiveModule(item.key);
                window.dispatchEvent(new Event("chat-scroll-bottom"));
              }}
              style={{
                width: "100%",
                padding: "12px 14px",
                textAlign: "left",
                borderRadius: 10,
                background: isActive ? "#0b1220" : "transparent",
                color: isActive ? "#27D4CF" : "white",
                border: isActive
                  ? "1px solid rgba(39,212,207,.4)"
                  : "1px solid transparent",
                cursor: "pointer",
              }}
            >
              {item.label}
            </button>
          );
        })}
      </div>
    </aside>
  );
}
