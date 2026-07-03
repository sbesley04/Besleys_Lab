import Link from "next/link";

// 404 for unknown routes and unpublished/missing content.
export const metadata = { title: "Page not found" };

export default function NotFound() {
  return (
    <main style={{ maxWidth: 560, margin: "0 auto", padding: "5rem 1.5rem", textAlign: "center" }}>
      <p className="margin-note" style={{ margin: 0 }}>
        404 — not in this notebook
      </p>
      <h1 style={{ fontFamily: "var(--font-display)", fontSize: "2.4rem", margin: "0.25rem 0 0.75rem" }}>
        Page not found
      </h1>
      <p style={{ color: "var(--ink-soft)", margin: "0 auto 1.5rem", maxWidth: "40ch" }}>
        Whatever was here has been filed somewhere else — or never existed. The desk has
        everything worth finding.
      </p>
      <p style={{ display: "flex", gap: "1.25rem", justifyContent: "center", fontSize: "0.95rem" }}>
        <Link href="/">Home</Link>
        <Link href="/blog">Blog</Link>
        <Link href="/projects">Projects</Link>
        <Link href="/games">Games</Link>
      </p>
    </main>
  );
}
