import Link from "next/link";
import ArcadeHub from "./ArcadeHub";

// Arcade hub. The card grid itself lives in ArcadeHub (a client component,
// because the hub has… residents). Driven entirely by ./registry — to add a
// game, add an entry there and a folder at app/games/<slug>/.
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

      <ArcadeHub />
    </main>
  );
}
