"use client";

import { Role } from "@/lib/types";
import { getModuleResponse } from "@/lib/moduleResponses";

export default function HowToUse({ role }: { role: Role }) {
  const response = getModuleResponse(role, "guide");
  const steps = response?.steps ?? [];
  const title = response?.title ?? "How to Use Savemom";
  const summary = response?.summary;

  return (
    <div
      style={{
        background: "#0b1220",
        border: "1px solid rgba(39,212,207,0.3)",
        borderRadius: 16,
        padding: 28,
        maxWidth: 700,
      }}
    >
      <h2
        style={{
          color: "#27D4CF",
          fontSize: 22,
          marginBottom: 16,
        }}
      >
        {title}
      </h2>

      {summary ? (
        <p style={{ opacity: 0.85, marginBottom: 16 }}>
          {summary}
        </p>
      ) : null}

      <ol style={{ lineHeight: 1.8, paddingLeft: 18 }}>
        {steps.map((item, index) => (
          <li key={index} style={{ marginBottom: 8 }}>
            {item}
          </li>
        ))}
      </ol>
    </div>
  );
}
