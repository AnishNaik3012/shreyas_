// app/lib/types.ts

export type ActiveModule =
  | "home"
  | "appointments"
  | "checkups"
  | "reports"
  | "prescriptions"
  | "patients"
  | "guide";

export type Role = "parent" | "doctor" | "nurse";
