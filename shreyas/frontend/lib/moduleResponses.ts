import { ActiveModule, Role } from "./types";

export type ModuleResponse = {
  title: string;
  summary: string;
  steps?: string[];
  quickActions?: string[];
  prompts?: string[];
};

type ModuleResponseMap = Record<
  Role,
  Partial<Record<ActiveModule, ModuleResponse>>
>;

export const moduleResponses: ModuleResponseMap = {
  parent: {
    home: {
      title: "Welcome to Savemom",
      summary:
        "Start with appointments, checkups, and reports to keep care on track.",
      quickActions: [
        "Book an appointment",
        "Schedule a checkup",
        "Upload a report",
      ],
      prompts: [
        "Show available appointments this week",
        "What is due for the next checkup?",
      ],
    },
    appointments: {
      title: "Appointments",
      summary:
        "Book, reschedule, or cancel appointments with trusted doctors.",
      steps: [
        "Pick a child profile",
        "Choose a doctor or specialty",
        "Select a time slot and confirm",
      ],
      quickActions: ["Book an appointment", "Reschedule", "Cancel"],
      prompts: [
        "Find pediatricians available this week",
        "Reschedule my next appointment",
      ],
    },
    checkups: {
      title: "Checkups",
      summary:
        "Plan routine or pregnancy checkups and track upcoming visits.",
      steps: [
        "Review recommended schedule",
        "Pick a date that works",
        "Confirm reminders and notes",
      ],
      quickActions: ["Schedule a checkup", "Set reminders"],
      prompts: [
        "When is the next routine checkup due?",
        "Schedule a checkup next month",
      ],
    },
    reports: {
      title: "Medical Reports",
      summary:
        "Upload reports to keep records centralized and easy to review.",
      steps: [
        "Upload report files or scans",
        "Add notes or tags",
        "Review AI summaries",
      ],
      quickActions: ["Upload a report", "View recent summaries"],
      prompts: [
        "Summarize the latest lab report",
        "Show reports from the last 6 months",
      ],
    },
    prescriptions: {
      title: "Prescriptions",
      summary:
        "View, download, or share prescriptions any time you need them.",
      steps: [
        "Open the latest prescription",
        "Review dosage instructions",
        "Download or share as needed",
      ],
      quickActions: ["Download prescription", "Request a refill"],
      prompts: [
        "Show active prescriptions",
        "How do I request a refill?",
      ],
    },
    guide: {
      title: "How to Use Savemom",
      summary:
        "Navigate the app, manage appointments, and keep care organized.",
      steps: [
        "Use the sidebar to switch modules",
        "Book appointments and schedule checkups",
        "Upload reports and review summaries",
        "Check prescriptions any time",
      ],
      prompts: [
        "Where do I book an appointment?",
        "How do I upload a report?",
      ],
    },
  },
  doctor: {
    home: {
      title: "Doctor Dashboard",
      summary:
        "Monitor your day at a glance and jump into appointments quickly.",
      quickActions: [
        "Review today's schedule",
        "Open a patient chart",
      ],
      prompts: [
        "Show me today's appointments",
        "Open my next patient chart",
      ],
    },
    appointments: {
      title: "Today's Appointments",
      summary:
        "View the schedule, open charts, and mark visits complete.",
      steps: [
        "Review upcoming visits",
        "Open the patient chart",
        "Add notes and mark complete",
      ],
      quickActions: ["Open next appointment", "Send a follow-up"],
      prompts: [
        "What is my next appointment?",
        "Show notes from the last visit",
      ],
    },
    patients: {
      title: "Patients",
      summary:
        "Access patient history, notes, and key clinical details.",
      steps: [
        "Search or filter the patient list",
        "Open a patient chart",
        "Review history and add notes",
      ],
      quickActions: ["Search patients", "Open recent chart"],
      prompts: [
        "Find patients with follow-ups today",
        "Show recent patient notes",
      ],
    },
    prescriptions: {
      title: "Prescriptions",
      summary:
        "Create, update, and manage prescriptions securely.",
      steps: [
        "Select a patient",
        "Choose medication and dosage",
        "Send or save the prescription",
      ],
      quickActions: ["Write a prescription", "Review active meds"],
      prompts: [
        "Create a new prescription",
        "Show active prescriptions for my last patient",
      ],
    },
    guide: {
      title: "Doctor Guide",
      summary:
        "Quick workflow tips for managing appointments and records.",
      steps: [
        "Start with the appointments module",
        "Open charts directly from the schedule",
        "Document notes and prescriptions in one flow",
      ],
      prompts: [
        "How do I document an appointment?",
        "Where can I update availability?",
      ],
    },
  },
  nurse: {
    home: {
      title: "Nurse Dashboard",
      summary:
        "Track daily tasks, vitals, and patient prep in one place.",
      quickActions: [
        "Update patient vitals",
        "Check doctors on duty",
      ],
      prompts: [
        "Show patients assigned to me",
        "Who is on duty today?",
      ],
    },
    appointments: {
      title: "Appointments Support",
      summary:
        "Assist with scheduling and preparation for doctor visits.",
      steps: [
        "Confirm patient details",
        "Coordinate with doctor availability",
        "Update appointment notes",
      ],
      quickActions: ["Book an appointment", "Confirm availability"],
      prompts: [
        "Find a slot for a follow-up visit",
        "Check if Dr. Patel is available today",
      ],
    },
    checkups: {
      title: "Checkups and Vitals",
      summary:
        "Record vitals, prep patients, and update clinical notes.",
      steps: [
        "Record vitals and measurements",
        "Attach notes or observations",
        "Notify the assigned doctor",
      ],
      quickActions: ["Update vitals", "Add nursing notes"],
      prompts: [
        "Start a vitals update",
        "Show today's checkups",
      ],
    },
    patients: {
      title: "Patients",
      summary:
        "View patient details and update nursing notes.",
      steps: [
        "Open the patient list",
        "Select a patient record",
        "Review vitals history and notes",
      ],
      quickActions: ["Search patients", "Open recent record"],
      prompts: [
        "Find patients with pending vitals",
        "Show recent nursing notes",
      ],
    },
    guide: {
      title: "Nurse Guide",
      summary:
        "Operational guidelines for daily nursing tasks.",
      steps: [
        "Use the sidebar to navigate tasks",
        "Update vitals during checkups",
        "Coordinate appointments with doctors",
      ],
      prompts: [
        "How do I update vitals?",
        "Where can I check doctor availability?",
      ],
    },
  },
};

const privacyContent: ModuleResponse = {
  title: "Privacy and Concern",
  summary:
    "Your data is protected. Here’s how we keep things safe and how you can get help.",
  steps: [
    "Your health details are stored securely",
    "Only authorized staff can access records",
    "You can request updates or deletions anytime",
  ],
  prompts: [
    "How is my data stored?",
    "I have a concern about my account",
  ],
};

const helpContent: ModuleResponse = {
  title: "Help",
  summary:
    "Need assistance? Reach out anytime and we’ll guide you through the next steps.",
  steps: [
    "Call us at +1 (555) 010-2020",
    "Email support at support@savemom.example",
    "Share your issue and we’ll follow up",
  ],
  prompts: [
    "I’m unable to book an appointment",
    "I can’t see my reports",
  ],
};

export function getGuideTopicResponse(
  role: Role,
  topic: string,
): ModuleResponse | null {
  if (topic === "How to Use") {
    return moduleResponses[role]?.guide ?? null;
  }
  if (topic === "Privacy and Concern") {
    return privacyContent;
  }
  if (topic === "Help") {
    return helpContent;
  }
  return null;
}

export function getModuleResponse(
  role: Role,
  module: ActiveModule,
): ModuleResponse | null {
  return moduleResponses[role]?.[module] ?? null;
}

export function formatModuleResponse(response: ModuleResponse): string {
  const sections: string[] = [response.title, response.summary];

  const addList = (label: string, items?: string[]) => {
    if (!items || items.length === 0) return;
    sections.push(`${label}:`);
    items.forEach((item) => sections.push(`- ${item}`));
  };

  addList("Steps", response.steps);
  addList("Quick actions", response.quickActions);
  addList("Try asking", response.prompts);

  return sections.join("\n");
}
