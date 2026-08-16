"use client";

import Link from "next/link";
import GridText from "./_components/eggs/GridText";

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
    <main className="system-page">
      <p className="margin-note" style={{ margin: 0 }}>
        <GridText paper="well, that beaker cracked" grid="SYSTEM FAULT // EXECUTION HALTED" />
      </p>
      <h1 style={{ fontFamily: "var(--font-display)", fontSize: "2.4rem", margin: "0.25rem 0 0.75rem" }}>
        <GridText paper="Something went wrong" grid="Program fault" />
      </h1>
      <p style={{ color: "var(--ink-soft)", margin: "0 auto 1.5rem", maxWidth: "40ch" }}>
        <GridText
          paper="This page couldn’t load. Try again or return home."
          grid="This program could not execute. Retry the sequence or return to ROOT."
        />
      </p>
      {error.digest && (
        <p style={{ color: "var(--ink-soft)", fontSize: "0.75rem", margin: "0 0 1.5rem" }}>
          Error reference: {error.digest}
        </p>
      )}
      <div className="system-action-row">
        <button
          type="button"
          onClick={reset}
          className="button-primary"
        >
          Try again
        </button>
        <Link href="/" className="button-secondary">
          Back home
        </Link>
      </div>
    </main>
  );
}
