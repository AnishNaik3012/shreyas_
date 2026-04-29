"use client";

import { ReactNode, useEffect } from "react";
import { ttsService } from "@/utils/ttsService";

type ChatMessageProps = {
  sender: "user" | "bot";
  index: number;
  speechText?: string;
  isSpeaking?: boolean;
  onSpeak?: () => void;
  onStop?: () => void;
  children: ReactNode;
};

export default function ChatMessage({
  sender,
  index,
  speechText,
  isSpeaking = false,
  onSpeak,
  onStop,
  children,
}: ChatMessageProps) {
  const isBot = sender === "bot";
  const showControls = isBot && speechText;

  useEffect(() => {
    return () => {
      ttsService.stop();
    };
  }, []);

  return (
    <div
      style={{
        display: "flex",
        justifyContent: sender === "user" ? "flex-end" : "flex-start",
        animation:
          sender === "user"
            ? "chatInRight 240ms cubic-bezier(0.22, 1, 0.36, 1) both"
            : "chatInLeft 240ms cubic-bezier(0.22, 1, 0.36, 1) both",
        animationDelay: `${index * 40}ms`,
        willChange: "transform, opacity",
      }}
    >
      <div
        style={{
          position: "relative",
          maxWidth: sender === "user" ? "70%" : "75%",
          padding:
            sender === "user"
              ? "14px 18px"
              : "16px 52px 16px 18px",
          borderRadius: 18,
          background: sender === "user" ? "#27D4CF" : "rgba(11, 18, 32, 0.85)",
          color: sender === "user" ? "#020617" : "white",
          border:
            sender === "user" ? "none" : "1px solid rgba(39, 212, 207, 0.45)",
          boxShadow:
            sender === "user"
              ? "0 6px 18px rgba(39, 212, 207, 0.35)"
              : "0 8px 24px rgba(0, 0, 0, 0.35), 0 0 18px rgba(39, 212, 207, 0.25)",
          backdropFilter: sender === "user" ? "none" : "blur(8px)",
          WebkitBackdropFilter: sender === "user" ? "none" : "blur(8px)",
          whiteSpace: "pre-wrap",
          lineHeight: 1.6,
        }}
      >
        {showControls ? (
          <div
            style={{
              position: "absolute",
              top: 6,
              right: 8,
              display: "flex",
              gap: 6,
              alignItems: "center",
            }}
          >
            <button
              onClick={onSpeak}
              disabled={isSpeaking}
              aria-label="Speak message"
              title="Speak"
              style={{
                border: "none",
                background: "transparent",
                color: "inherit",
                cursor: isSpeaking ? "default" : "pointer",
                padding: 2,
                fontSize: 14,
                lineHeight: 1,
                opacity: isSpeaking ? 1 : 0.75,
                animation: isSpeaking ? "pulse 1s ease-in-out infinite" : "none",
              }}
            >
              🔊
            </button>
            <button
              onClick={onStop}
              disabled={!isSpeaking}
              aria-label="Stop speaking"
              title="Stop"
              style={{
                border: "none",
                background: "transparent",
                color: "inherit",
                cursor: isSpeaking ? "pointer" : "default",
                padding: 2,
                fontSize: 14,
                lineHeight: 1,
                opacity: isSpeaking ? 0.9 : 0.4,
              }}
            >
              ⏹
            </button>
          </div>
        ) : null}

        {children}
      </div>
    </div>
  );
}
