import { ImageResponse } from "next/og";

// Social-share card for every route that doesn't define its own. Rendered by
// Satori at request time, so CSS variables from globals.css aren't available —
// the Paper Lab palette is repeated here on purpose (same reason as
// global-error.tsx).
export const alt = "Besley's Lab — data science, full-stack, and fun experiments";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const PAPER = "#F5F0E8";
const INK = "#1A1A1A";
const INK_SOFT = "#4A463E";
const ACCENT = "#74644F";
const LINE = "rgba(0, 0, 0, 0.12)";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 72,
          background: PAPER,
          color: INK,
          fontFamily: "sans-serif",
          backgroundImage: `linear-gradient(${LINE} 1px, transparent 1px), linear-gradient(90deg, ${LINE} 1px, transparent 1px)`,
          backgroundSize: "40px 40px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 18, color: ACCENT, fontSize: 26, letterSpacing: 4 }}>
          <div style={{ width: 14, height: 14, borderRadius: 999, background: ACCENT }} />
          SAMUEL BESLEY
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ fontSize: 108, fontWeight: 700, letterSpacing: -4, lineHeight: 1 }}>Besley&rsquo;s Lab</div>
          <div style={{ fontSize: 36, color: INK_SOFT, lineHeight: 1.3, maxWidth: 900 }}>
            Data science &amp; machine learning projects, interactive ML demos, and a small arcade.
          </div>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", borderTop: `2px solid ${LINE}`, paddingTop: 24, fontSize: 24, color: INK_SOFT }}>
          <span>Projects · Lab · Blog · Games · Library</span>
          <span>Data scientist &amp; full-stack developer</span>
        </div>
      </div>
    ),
    size,
  );
}
