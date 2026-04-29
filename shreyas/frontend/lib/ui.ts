// frontend/lib/ui.ts
import { THEME } from "./theme";

export const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "14px 16px",
  borderRadius: 12,
  border: `1px solid ${THEME.border}`,
  background: THEME.bg,
  color: "white",
  outline: "none",
  fontSize: 15,
};

export const inputFocusStyle: React.CSSProperties = {
  border: `1px solid ${THEME.primary}`,
  boxShadow: `0 0 0 2px rgba(${THEME.primaryRgb}, 0.25)`,
};

export const buttonStyle: React.CSSProperties = {
  width: "100%",
  padding: "14px",
  borderRadius: 12,
  border: "none",
  background: THEME.primary,
  color: "#020617",
  fontSize: 16,
  fontWeight: 600,
  cursor: "pointer",
};

export const buttonDisabledStyle: React.CSSProperties = {
  opacity: 0.6,
  cursor: "not-allowed",
};
