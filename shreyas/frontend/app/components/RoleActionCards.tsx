"use client";

type Card = {
  title: string;
  description: string;
};

export default function RoleActionCards({
  cards,
  onCardClick,
}: {
  cards: Card[];
  onCardClick?: (title: string) => void;
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(2, 1fr)",
        gap: 20,
        maxWidth: 900,
        marginTop: 30,
      }}
    >
      {cards.map((card, index) => (
        <div
          key={index}
          style={{
            background: "#0b1220",
            border: "1px solid rgba(39,212,207,0.35)",
            borderRadius: 18,
            padding: 28,
            cursor: "pointer",
            transition: "all 0.2s ease",
          }}
          onClick={() => onCardClick?.(card.title)}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = "#27D4CF";
            e.currentTarget.style.boxShadow =
              "0 10px 30px rgba(39,212,207,0.25)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor =
              "rgba(39,212,207,0.35)";
            e.currentTarget.style.boxShadow = "none";
          }}
        >
          <h3
            style={{
              color: "#27D4CF",
              fontSize: 20,
              fontWeight: 600,
              marginBottom: 10,
            }}
          >
            {card.title}
          </h3>

          <p style={{ fontSize: 15, opacity: 0.85 }}>
            {card.description}
          </p>
        </div>
      ))}
    </div>
  );
}
