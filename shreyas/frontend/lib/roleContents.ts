import { Role, ActiveModule } from "@/lib/types";

type RoleContentMap = {
  [key in Role]: {
    [module in ActiveModule]?: {
      title: string;
      description: string;
      emptyText?: string;
    };
  };
};

export const roleContent: RoleContentMap = {
  parent: {
    home: {
      title: "Welcome",
      description: "Manage your child’s healthcare with Savemom.",
    },
    appointments: {
      title: "Appointments",
      description: "Book, view, or manage doctor appointments.",
    },
    checkups: {
      title: "Check-Ups",
      description: "Schedule routine or pregnancy checkups.",
    },
    reports: {
      title: "Medical Reports",
      description: "Upload reports and get AI summaries.",
    },
    prescriptions: {
      title: "Prescriptions",
      description: "View and download prescriptions.",
    },
    guide: {
      title: "How to Use",
      description: "Learn how to use Savemom effectively.",
    },
  },

  doctor: {
    home: {
      title: "Doctor Dashboard",
      description: "Overview of your daily medical activities.",
    },
    appointments: {
      title: "Today’s Appointments",
      description: "View and manage today’s patient schedule.",
    },
    patients: {
      title: "Patients",
      description: "Access patient history and details.",
    },
    prescriptions: {
      title: "Prescriptions",
      description: "Create and manage prescriptions.",
    },
    guide: {
      title: "Doctor Guide",
      description: "Best practices and workflow tips.",
    },
  },

  nurse: {
    home: {
      title: "Nurse Dashboard",
      description: "Daily nursing operations overview.",
    },
    appointments: {
      title: "Appointments",
      description: "Assist in scheduling appointments.",
    },
    checkups: {
      title: "Check-Ups",
      description: "Prepare patients for checkups.",
    },
    patients: {
      title: "Patients",
      description: "View patient vitals and details.",
    },
    guide: {
      title: "Nurse Guide",
      description: "Operational guidelines and help.",
    },
  },
};
