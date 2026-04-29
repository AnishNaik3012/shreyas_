"use client";

type Role = "parent" | "doctor" | "nurse";

type Card = {
  title: string;
  description: string;
  action: string;
};

const CARDS_BY_ROLE: Record<Role, Card[]> = {
  parent: [
    {
      title: "Check-Up",
      description: "Get a check-up with a doctor.",
      action: "BOOK_CHECKUP",
    },
    {
      title: "Appointments",
      description: "Book or manage appointments.",
      action: "BOOK_APPOINTMENT",
    },
    {
      title: "Reports",
      description: "View medical reports.",
      action: "VIEW_REPORTS",
    },
    {
      title: "Prescriptions",
      description: "View prescriptions.",
      action: "VIEW_PRESCRIPTIONS",
    },
  ],

  doctor: [
    {
      title: "Today's Appointments",
      description: "See your schedule for today.",
      action: "VIEW_TODAYS_APPOINTMENTS",
    },
    {
      title: "My Patients",
      description: "Access assigned patients.",
      action: "VIEW_PATIENTS",
    },
    {
      title: "Reports",
      description: "Review patient medical reports.",
      action: "VIEW_REPORTS",
    },
    {
      title: "Prescriptions",
      description: "Write & manage prescriptions.",
      action: "MANAGE_PRESCRIPTIONS",
    },
  ],

  nurse: [
    {
      title: "Check-Ups",
      description: "Assist with scheduled checkups.",
      action: "BOOK_CHECKUP",
    },
    {
      title: "Appointments",
      description: "View today’s appointments.",
      action: "VIEW_TODAYS_APPOINTMENTS",
    },
  ],
};

export default function DashboardCards({
  role,
  onSelect,
}: {
  role: Role;
  onSelect: (action: string) => void;
}) {
  const cards = CARDS_BY_ROLE[role] ?? [];

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(2, minmax(260px, 1fr))",
        gap: 24,
        maxWidth: 900,
        marginTop: 16,
      }}
    >
      {cards.map((card) => (
        <div
          key={card.title}
          onClick={() => onSelect(card.action)}
          style={{
            background: "#2f9e9e",
            borderRadius: 20,
            padding: 28,
            cursor: "pointer",
            transition: "transform 0.15s ease, box-shadow 0.15s ease",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = "translateY(-4px)";
            e.currentTarget.style.boxShadow =
              "0 10px 30px rgba(0,0,0,0.35)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = "translateY(0)";
            e.currentTarget.style.boxShadow = "none";
          }}
        >
          <h3 style={{ fontSize: 22, marginBottom: 8 }}>{card.title}</h3>
          <p style={{ opacity: 0.9 }}>{card.description}</p>
        </div>
      ))}
    </div>
  );
}
