// Shared inline styles for admin forms — keeps the paper aesthetic consistent
// across the post and project editors without a CSS module per form.
import type { CSSProperties } from "react";

export const field: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "0.35rem",
  fontSize: "0.85rem",
  fontWeight: 500,
  color: "var(--ink-soft)",
};

export const input: CSSProperties = {
  fontFamily: "var(--font-body)",
  fontSize: "1rem",
  padding: "0.55rem 0.7rem",
  border: "1px solid var(--line)",
  borderRadius: 4,
  background: "var(--paper)",
  color: "var(--ink)",
  width: "100%",
};

export const textarea: CSSProperties = {
  ...input,
  minHeight: 240,
  resize: "vertical",
  fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
  fontSize: "0.9rem",
  lineHeight: 1.6,
};

export const primaryButton: CSSProperties = {
  fontFamily: "var(--font-body)",
  fontSize: "1rem",
  fontWeight: 600,
  padding: "0.6rem 1.2rem",
  border: "1px solid var(--accent)",
  borderRadius: 4,
  background: "var(--accent)",
  color: "var(--paper)",
  cursor: "pointer",
};

export const ghostButton: CSSProperties = {
  fontFamily: "var(--font-body)",
  fontSize: "0.95rem",
  fontWeight: 500,
  padding: "0.6rem 1rem",
  border: "1px solid var(--line)",
  borderRadius: 4,
  background: "transparent",
  color: "var(--ink-soft)",
  cursor: "pointer",
};

export const dangerButton: CSSProperties = {
  ...ghostButton,
  color: "#9b3a2f",
  borderColor: "rgba(155, 58, 47, 0.4)",
};
