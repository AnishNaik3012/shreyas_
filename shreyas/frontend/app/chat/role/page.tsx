"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { getAuthUser, logout } from "@/lib/authStore";
import DashboardCards from "../components/DashboardCards";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8001";

/* ================= TYPES ================= */

type ChatMessage = {
  sender: "user" | "bot";
  type: "text" | "buttons";
  content: string;
  buttons?: { label: string; action: string }[];
};

type ActiveForm = "none" | "appointment" | "checkup";

export default function RoleChatPage() {
  const router = useRouter();
  const params = useParams();
  const role = params.role as string;

  const [mounted, setMounted] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [activeForm, setActiveForm] = useState<ActiveForm>("none");

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;

    const user = getAuthUser();

    if (!user) {
      router.replace("/auth/login");
      return;
    }

    if (user.roleId !== role) {
      router.replace(`/chat/${user.roleId}`);
      return;
    }

    setMessages([
      {
        sender: "bot",
        type: "text",
        content:
          role === "doctor"
            ? "👋 Welcome Doctor! What would you like to do today?"
            : role === "nurse"
            ? "👋 Hello! Ready to assist with patient care?"
            : "👋 Hi! How can I help you today?",
      },
    ]);
  }, [mounted, role, router]);

  const sendMessage = async (text: string) => {
    if (!text.trim()) return;

    setMessages((p) => [...p, { sender: "user", type: "text", content: text }]);
    setInput("");

    try {
      const res = await fetch(`${API_BASE}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, role }),
      });

      if (res.status === 401) {
        logout();
        router.replace("/auth/login");
        return;
      }

      const data = await res.json();

      setMessages((p) => [
        ...p,
        {
          sender: "bot",
          type: data.buttons ? "buttons" : "text",
          content: data.message ?? data.reply ?? "",
          buttons: data.buttons,
        },
      ]);
    } catch {
      setMessages((p) => [
        ...p,
        {
          sender: "bot",
          type: "text",
          content: "⚠️ Something went wrong. Please try again.",
        },
      ]);
    }
  };

  if (!mounted) return null;

  return (
    <div style={{ minHeight: "100vh", background: "#0b1220", color: "white" }}>
      {/* HEADER */}
      <div style={{ padding: 24 }}>
        <h2>Savemom Hospital Assistant</h2>
        <p>
          Hi 👋 <strong>{role}</strong>, how can I help you today?
        </p>
      </div>

      {/* DASHBOARD */}
      {messages.length === 1 && (
        <DashboardCards
          role={role as "parent" | "doctor" | "nurse"}
          onSelect={sendMessage}
        />
      )}

      {/* CHAT */}
      <div style={{ padding: 24 }}>
        {messages.map((m, i) => (
          <div key={i}>{m.content}</div>
        ))}
      </div>

      {/* INPUT */}
      <div style={{ padding: 16 }}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && sendMessage(input)}
        />
        <button onClick={() => sendMessage(input)}>Send</button>
      </div>
    </div>
  );
}
