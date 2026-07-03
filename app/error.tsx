"use client";

import Link from "next/link";

// Route-level error boundary: catches render/data errors anywhere below the
// root layout (database unavailable, corrupt content, etc.) and offers a
// retry instead of a blank screen.
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main style={{ maxWidth: 560, margin: "0 auto", padding: "5rem 1.5rem", textAlign: "center" }}>
      <p className="margin-note" style={{ margin: 0 }}>
        well, that beaker cracked
      </p>
      <h1 style={{ fontFamily: "var(--font-display)", fontSize: "2.4rem", margin: "0.25rem 0 0.75rem" }}>
        Something went wrong
      </h1>
      <p style={{ color: "var(--ink-soft)", margin: "0 auto 1.5rem", maxWidth: "40ch" }}>
        This page hit an unexpected error. Your data is fine — try again, or head back to the
        desk.
      </p>
      {error.digest && (
        <p style={{ color: "var(--ink-soft)", fontSize: "0.75rem", margin: "0 0 1.5rem" }}>
          Error reference: {error.digest}
        </p>
      )}
      <div style={{ display: "flex", gap: "0.75rem", justifyContent: "center" }}>
        <button
          type="button"
          onClick={reset}
          style={{
            fontFamily: "var(--font-body)",
            fontSize: "0.95rem",
            fontWeight: 600,
            padding: "0.6rem 1.2rem",
            border: "1px solid var(--accent)",
            borderRadius: 4,
            background: "var(--accent)",
            color: "var(--paper)",
            cursor: "pointer",
          }}
        >
          Try again
        </button>
        <Link
          href="/"
          style={{
            fontFamily: "var(--font-body)",
            fontSize: "0.95rem",
            padding: "0.6rem 1.2rem",
            border: "1px solid var(--line)",
            borderRadius: 4,
            color: "var(--ink)",
          }}
        >
          Back home
        </Link>
      </div>
    </main>
  );
}
