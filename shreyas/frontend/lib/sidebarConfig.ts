import { ActiveModule, Role } from "./types";

export const sidebarConfig: Record<Role, ActiveModule[]> = {
  parent: [
    "home",
    "appointments",
    "checkups",
    "reports",
    "prescriptions",
    "guide",
  ],

  doctor: [
    "home",
    "appointments",
    "checkups",
    "patients",
    "prescriptions",
    "guide",
  ],

  nurse: [
    "home",
    "appointments",
    "checkups",
    "patients",
    "guide",
  ],
};
