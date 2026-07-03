import Link from "next/link";
import { games } from "./registry";

// Arcade hub. Driven entirely by ./registry — to add a game, add an entry there
// and a folder at app/games/<slug>/. No edits needed here.
export const metadata = { title: "Games" };

export default function GamesPage() {
  return (
    <main style={{ maxWidth: 760, margin: "0 auto", padding: "3.5rem 1.5rem" }}>
      <Link href="/" style={{ fontSize: "0.9rem" }}>
        ← Home
      </Link>
      <h1 style={{ fontFamily: "var(--font-display)", fontSize: "2.6rem", margin: "0.5rem 0 0.5rem" }}>
        Arcade
      </h1>
      <p style={{ color: "var(--ink-soft)", marginBottom: "2rem" }}>
        A small, growing shelf of browser games.
      </p>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
          gap: "1.25rem",
        }}
      >
        {games.map((g) => (
          <Link
            key={g.slug}
            href={`/games/${g.slug}`}
            className="paper-card"
            style={{ padding: "1.5rem", color: "var(--ink)", display: "block" }}
          >
            <h2 style={{ fontFamily: "var(--font-display)", fontSize: "1.5rem", margin: 0 }}>
              {g.title}
            </h2>
            <p style={{ color: "var(--ink-soft)", margin: "0.4rem 0 0", fontSize: "0.92rem" }}>
              {g.blurb}
            </p>
          </Link>
        ))}
      </div>
    </main>
  );
}
