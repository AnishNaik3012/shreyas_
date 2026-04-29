"use client";

import { useEffect } from "react";
import Sidebar from "./components/sidebar";
import { AppProvider, useModule } from "./context";
import { Role } from "@/lib/types";

function ChatShell({ children }: { children: React.ReactNode }) {
  const { role, setRole } = useModule();

  useEffect(() => {
    const storedRole = localStorage.getItem("role") as Role | null;
    if (storedRole) setRole(storedRole);
  }, [setRole]);

  return (
    <div
      style={{
        display: "flex",
        height: "100vh",
        background: "#020617",
        color: "white",
      }}
    >
      <Sidebar />

      <div
        style={{
          flex: 1,
          padding: 24,
          overflow: "hidden",
        }}
      >
        {children}
      </div>
    </div>
  );
}

export default function ChatLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AppProvider>
      <ChatShell>{children}</ChatShell>
    </AppProvider>
  );
}
