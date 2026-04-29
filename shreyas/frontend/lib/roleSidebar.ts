import { ActiveModule, Role } from "./types";

export const roleSidebarItems: Record<
  Role,
  { label: string; value: ActiveModule }[]
> = {
  parent: [
    { label: "Home", value: "home" },
    { label: "Appointments", value: "appointments" },
    { label: "Checkups", value: "checkups" },
    { label: "Reports", value: "reports" },
    { label: "Prescriptions", value: "prescriptions" },
    { label: "Help", value: "guide" },
  ],

  doctor: [
    { label: "Home", value: "home" },
    { label: "Today's Appointments", value: "appointments" },
    { label: "Patients", value: "patients" },
    { label: "Prescriptions", value: "prescriptions" },
    { label: "Availability", value: "checkups" },
    { label: "Help", value: "guide" },
  ],

  nurse: [
    { label: "Home", value: "home" },
    { label: "Update Vitals", value: "checkups" },
    { label: "Patients", value: "patients" },
    { label: "Doctors on Duty", value: "appointments" },
    { label: "Book Appointments", value: "appointments" },
    { label: "Help", value: "guide" },
  ],
};
