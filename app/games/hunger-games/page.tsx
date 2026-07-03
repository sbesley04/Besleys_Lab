import Link from "next/link";
import HungerGames from "./HungerGames";

export const metadata = {
  title: "Hunger Games Simulator",
  description:
    "Build a roster of tributes, tune their traits, and watch a full arena simulation play out turn by turn — alliances, betrayals, hazards, and a final victor.",
};

// Wider than the standard GameFrame because of the roster table + map/feed
// split. `searchParams` powers dashboard deep links (?run= replays a recorded
// simulation, ?roster= preloads a saved roster).
export default function HungerGamesPage({
  searchParams,
}: {
  searchParams?: { run?: string; roster?: string };
}) {
  return (
    <main style={{ maxWidth: 1080, margin: "0 auto", padding: "3rem 1.5rem 4rem" }}>
      <Link href="/games" style={{ fontSize: "0.9rem" }}>
        ← Arcade
      </Link>
      <h1 style={{ fontFamily: "var(--font-display)", fontSize: "2.6rem", margin: "0.5rem 0 0.25rem" }}>
        Hunger Games Simulator
      </h1>
      <p style={{ color: "var(--ink-soft)", margin: "0 0 1.75rem", maxWidth: "60ch" }}>
        Enter your tributes, tune their traits, and let the arena decide. Every run generates a
        unique terrain, weather system, and shrinking border — watch it play out turn by turn.
      </p>
      <HungerGames initialRunId={searchParams?.run} initialRosterId={searchParams?.roster} />
    </main>
  );
}
