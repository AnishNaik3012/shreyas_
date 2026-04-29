"use client";

import type { CSSProperties } from "react";

type ScrollButtonsProps = {
  showTop: boolean;
  showBottom: boolean;
  onScrollTop: () => void;
  onScrollBottom: () => void;
  rightOffset?: number;
  bottomOffset?: number;
  align?: "right" | "center";
  centerOffset?: number;
};

export default function ScrollButtons({
  showTop,
  showBottom,
  onScrollTop,
  onScrollBottom,
  rightOffset = 24,
  bottomOffset = 120,
  align = "right",
  centerOffset = 0,
}: ScrollButtonsProps) {
  if (!showTop && !showBottom) return null;

  const buttonStyle: CSSProperties = {
    width: 40,
    height: 40,
    borderRadius: 999,
    background: "#0b1220",
    border: "1px solid rgba(39,212,207,0.4)",
    color: "#27D4CF",
    display: "grid",
    placeItems: "center",
    cursor: "pointer",
    transition: "box-shadow 0.2s ease, transform 0.2s ease",
  };

  return (
    <div
      style={{
        position: "fixed",
        right: align === "right" ? rightOffset : undefined,
        left:
          align === "center"
            ? `calc(50% + ${centerOffset}px)`
            : undefined,
        transform: align === "center" ? "translateX(-50%)" : undefined,
        bottom: bottomOffset,
        display: "flex",
        flexDirection: "column",
        gap: 10,
        zIndex: 7,
      }}
    >
      {showTop ? (
        <button
          onClick={onScrollTop}
          style={buttonStyle}
          onMouseEnter={(e) => {
            e.currentTarget.style.boxShadow =
              "0 0 18px rgba(39,212,207,0.35)";
            e.currentTarget.style.transform = "translateY(-1px)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.boxShadow = "none";
            e.currentTarget.style.transform = "translateY(0)";
          }}
          aria-label="Scroll to top"
        >
          ⬆️
        </button>
      ) : null}
      {showBottom ? (
        <button
          onClick={onScrollBottom}
          style={buttonStyle}
          onMouseEnter={(e) => {
            e.currentTarget.style.boxShadow =
              "0 0 18px rgba(39,212,207,0.35)";
            e.currentTarget.style.transform = "translateY(-1px)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.boxShadow = "none";
            e.currentTarget.style.transform = "translateY(0)";
          }}
          aria-label="Scroll to bottom"
        >
          ⬇️
        </button>
      ) : null}
    </div>
  );
}
