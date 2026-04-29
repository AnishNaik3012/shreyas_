"use client";

import { createContext, useContext, useState } from "react";
import { Role, ActiveModule } from "@/lib/types";

type ChatMessage = {
  sender: "user" | "bot";
  text: string;
};

type ModuleContextType = {
  activeModule: ActiveModule;
  setActiveModule: (m: ActiveModule) => void;

  role: Role;
  setRole: (r: Role) => void;

  guideTopic: string;
  setGuideTopic: (t: string) => void;

  messages: ChatMessage[];
  pushUserMessage: (text: string) => void;
  pushBotMessage: (text: string) => void;
};

const ModuleContext = createContext<ModuleContextType | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [activeModule, setActiveModule] =
    useState<ActiveModule>("home");

  const [role, setRole] = useState<Role>("parent");
  const [guideTopic, setGuideTopic] = useState("How to Use");

  const [messages, setMessages] = useState<ChatMessage[]>([]);

  const pushUserMessage = (text: string) => {
    setMessages((prev) => [...prev, { sender: "user", text }]);
  };

  const pushBotMessage = (text: string) => {
    setMessages((prev) => [...prev, { sender: "bot", text }]);
  };

  return (
    <ModuleContext.Provider
      value={{
        activeModule,
        setActiveModule,
        role,
        setRole,
        guideTopic,
        setGuideTopic,
        messages,
        pushUserMessage,
        pushBotMessage,
      }}
    >
      {children}
    </ModuleContext.Provider>
  );
}

export function useModule() {
  const ctx = useContext(ModuleContext);
  if (!ctx) {
    throw new Error("useModule must be used inside AppProvider");
  }
  return ctx;
}
