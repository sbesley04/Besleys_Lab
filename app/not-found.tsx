import Link from "next/link";
import GridText from "./_components/eggs/GridText";

// 404 for unknown routes and unpublished/missing content.
export const metadata = { title: "Page not found" };

export default function NotFound() {
  return (
    <main className="system-page">
      <p className="margin-note" style={{ margin: 0 }}>
        <GridText paper="404 — not in this notebook" grid="ERROR 404 // SECTOR NOT MAPPED" />
      </p>
      <h1 style={{ fontFamily: "var(--font-display)", fontSize: "2.4rem", margin: "0.25rem 0 0.75rem" }}>
        <GridText paper="Page not found" grid="Program not found" />
      </h1>
      <p style={{ color: "var(--ink-soft)", margin: "0 auto 1.5rem", maxWidth: "40ch" }}>
        <GridText
          paper="Whatever was here has been filed somewhere else — or never existed. The desk has everything worth finding."
          grid="The requested sector is outside the mapped Grid. Return to a stable program."
        />
      </p>
      <nav className="system-link-row" aria-label="Useful destinations" style={{ fontSize: "0.95rem" }}>
        <Link href="/">Home</Link>
        <Link href="/blog">Blog</Link>
        <Link href="/projects">Projects</Link>
        <Link href="/games">Games</Link>
      </nav>
    </main>
  );
}
