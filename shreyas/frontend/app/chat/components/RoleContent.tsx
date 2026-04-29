"use client";

import { roleContent } from "@/lib/roleContents";
import { ActiveModule } from "@/lib/types";

export default function RoleContent({
  role,
  activeModule,
}: {
  role: "parent" | "doctor" | "nurse";
  activeModule: ActiveModule;
}) {
  const content = roleContent[role]?.[activeModule];

  if (!content) {
    return (
      <p style={{ opacity: 0.7 }}>
        No content available for this section.
      </p>
    );
  }

  return (
    <div>
      <h2 style={{ color: "#27D4CF", marginBottom: 8 }}>
        {content.title}
      </h2>
      <p style={{ opacity: 0.85 }}>{content.description}</p>
    </div>
  );
}
