"use client";

// Last-resort boundary: catches errors in the root layout itself. Must render
// its own <html>/<body> because the layout failed. Styles are inline since
// globals.css may not have loaded.
export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          background: "#F5F0E8",
          color: "#1A1A1A",
          fontFamily: "Georgia, serif",
          textAlign: "center",
          padding: "2rem",
        }}
      >
        <div>
          <h1 style={{ fontSize: "2rem", margin: "0 0 0.5rem" }}>Besley&rsquo;s Lab hit a snag</h1>
          <p style={{ color: "#4A463E", margin: "0 0 1.5rem" }}>
            Something broke at the very top of the app. A refresh usually fixes it.
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              fontSize: "1rem",
              padding: "0.6rem 1.4rem",
              border: "1px solid #7A6A52",
              borderRadius: 4,
              background: "#7A6A52",
              color: "#F5F0E8",
              cursor: "pointer",
            }}
          >
            Reload
          </button>
        </div>
      </body>
    </html>
  );
}
