"use client";

import { useState } from "react";
import { startVoiceRecognition } from "../../../utils/speechRecognition";

type ChatBarProps = {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  disabled?: boolean;
  height?: number;
  placeholder?: string;
};

export default function ChatBar({
  value,
  onChange,
  onSend,
  disabled = false,
  height = 92,
  placeholder = "Ask Savemom...",
}: ChatBarProps) {
  const [isListening, setIsListening] = useState(false);

  const handleVoiceClick = () => {
    if (disabled) return;
    if (typeof window !== "undefined") {
      const isLocalhost =
        window.location.protocol === "http:" &&
        window.location.hostname === "localhost";
      const isSecureContext = window.location.protocol === "https:";
      if (!isLocalhost && !isSecureContext) {
        alert("Voice input requires https or http://localhost.");
        return;
      }
      const ua = navigator.userAgent || "";
      const isChromium = /Chrome\//.test(ua) || /Edg\//.test(ua);
      if (!isChromium) {
        alert("Voice input works best in Chrome or Edge.");
        return;
      }
    }
    setIsListening(true);
    startVoiceRecognition(
      (text: string) => {
        onChange(text);
        setIsListening(false);
      },
      () => {
        setIsListening(false);
      }
    );
  };

  return (
    <div className="chat-input-container" style={{ height }}>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        style={{
          flex: 1,
          padding: 14,
          borderRadius: 12,
          background: "#0b1220",
          border: "1px solid rgba(39,212,207,0.35)",
          color: "white",
          outline: "none",
          opacity: disabled ? 0.6 : 1,
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            onSend();
          }
        }}
      />
      <button
        onClick={handleVoiceClick}
        disabled={disabled}
        aria-label="Voice input"
        className={`voice-btn ${isListening ? "listening" : ""}`}
      >
        <svg
          viewBox="0 0 24 24"
          width="20"
          height="20"
          aria-hidden="true"
          focusable="false"
          style={{ display: "block" }}
        >
          <path
            d="M12 14a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v5a3 3 0 0 0 3 3Zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V20h2v-2.08A7 7 0 0 0 19 11h-2Z"
            fill="currentColor"
          />
        </svg>
      </button>
      <button
        onClick={onSend}
        disabled={disabled}
        style={{
          padding: "14px 22px",
          borderRadius: 12,
          background: "#27D4CF",
          color: "#020617",
          fontWeight: 600,
          border: "none",
          cursor: disabled ? "not-allowed" : "pointer",
          opacity: disabled ? 0.7 : 1,
        }}
      >
        Send
      </button>
      <style jsx>{`
        .chat-input-container {
          background: #020617;
          padding: 16px;
          border-top: 1px solid rgba(39, 212, 207, 0.2);
          display: flex;
          align-items: center;
          gap: 10px;
          position: sticky;
          bottom: 0;
          z-index: 6;
        }
        .voice-btn {
          background: transparent;
          border: none;
          font-size: 20px;
          cursor: pointer;
          transition: 0.2s ease;
          color: #27d4cf;
          min-width: 40px;
        }
        .voice-btn.listening {
          color: red;
          animation: pulse 1s infinite;
        }
        @keyframes pulse {
          0% {
            transform: scale(1);
          }
          50% {
            transform: scale(1.2);
          }
          100% {
            transform: scale(1);
          }
        }
      `}</style>
    </div>
  );
}

