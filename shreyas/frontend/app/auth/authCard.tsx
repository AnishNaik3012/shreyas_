"use client";

import { THEME } from "@/lib/theme";

export default function AuthCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        width: 380,
        padding: 32,
        borderRadius: 16,
        background: THEME.card,
        border: `1px solid rgba(${THEME.primaryRgb}, 0.25)`,
        boxShadow: `
          0 0 0 1px rgba(${THEME.primaryRgb}, 0.15),
          0 20px 40px rgba(0,0,0,0.5)
        `,
      }}
    >
      <h2
        style={{
          fontSize: 28,
          textAlign: "center",
          marginBottom: 22,
          fontWeight: 600,
          color: THEME.primary,
        }}
      >
        {title}
      </h2>

      {children}
    </div>
  );
}
