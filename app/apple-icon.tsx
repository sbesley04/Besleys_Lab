import { ImageResponse } from "next/og";

// iOS home-screen icon. Same palette note as opengraph-image.tsx: Satori can't
// read CSS variables, so the two paper tokens are repeated here.
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#F5F0E8",
          color: "#1A1A1A",
          fontFamily: "serif",
          fontSize: 120,
          fontWeight: 700,
        }}
      >
        B
      </div>
    ),
    size,
  );
}
