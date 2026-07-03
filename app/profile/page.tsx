import Link from "next/link";
import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { games } from "@/app/games/registry";
import { isStaff } from "@/lib/validation";

// The signed-in dashboard: profile settings, saved game states, saved
// Hunger Games rosters, and recent simulation runs — everything a user has
// persisted, in one place. Server-rendered; every query is scoped to the
// session user.
export const dynamic = "force-dynamic";

export const metadata = { title: "Dashboard" };

const GAME_TITLES = new Map(games.map((g) => [g.slug, g.title]));

function fmt(d: Date): string {
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

const card: React.CSSProperties = { padding: "1.4rem" };
const cardTitle: React.CSSProperties = {
  fontFamily: "var(--font-display)",
  fontSize: "1.3rem",
  margin: "0 0 0.2rem",
};
const cardHint: React.CSSProperties = {
  color: "var(--ink-soft)",
  fontSize: "0.85rem",
  margin: "0 0 0.9rem",
};
const list: React.CSSProperties = {
  listStyle: "none",
  margin: 0,
  padding: 0,
  display: "flex",
  flexDirection: "column",
  gap: "0.55rem",
};
const row: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "baseline",
  gap: "0.75rem",
  fontSize: "0.92rem",
};
const meta: React.CSSProperties = {
  color: "var(--ink-soft)",
  fontSize: "0.8rem",
  whiteSpace: "nowrap",
};
const empty: React.CSSProperties = {
  color: "var(--ink-soft)",
  fontSize: "0.9rem",
  margin: 0,
};

export default async function DashboardPage() {
  const session = await requireUser();
  const userId = session.user.id;

  // One round of parallel queries; if any fail Next's error boundary catches it.
  const [user, saves, rosters, runs] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, username: true, name: true, role: true, createdAt: true },
    }),
    prisma.gameSave.findMany({
      where: { userId },
      select: { id: true, game: true, name: true, updatedAt: true },
      orderBy: { updatedAt: "desc" },
      take: 10,
    }),
    prisma.roster.findMany({
      where: { userId },
      orderBy: { updatedAt: "desc" },
      take: 10,
    }),
    prisma.simulationRun.findMany({
      where: { userId },
      select: { id: true, seed: true, winner: true, turns: true, players: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: 8,
    }),
  ]);

  if (!user) {
    return (
      <main style={{ maxWidth: 560, margin: "0 auto", padding: "3.5rem 1.5rem" }}>
        <p>Account not found. <Link href="/login">Sign in again</Link>.</p>
      </main>
    );
  }

  const staff = isStaff(user.role);

  return (
    <main style={{ maxWidth: 960, margin: "0 auto", padding: "3.5rem 1.5rem" }}>
      <Link href="/" style={{ fontSize: "0.9rem" }}>
        ← Home
      </Link>
      <header
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: "0.5rem 1rem",
          margin: "0.5rem 0 0.35rem",
        }}
      >
        <h1 style={{ fontFamily: "var(--font-display)", fontSize: "2.6rem", margin: 0 }}>
          {user.name ? `Welcome back, ${user.name.split(" ")[0]}` : "Your dashboard"}
        </h1>
        <span style={{ color: "var(--ink-soft)", fontSize: "0.9rem" }}>
          {user.username ? `@${user.username}` : user.email}
        </span>
      </header>
      <p style={{ color: "var(--ink-soft)", margin: "0 0 2rem" }}>
        Saved games, rosters, and simulation history — everything lives here.
      </p>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 300px), 1fr))",
          gap: "1.25rem",
          alignItems: "start",
        }}
      >
        {/* --- Saved game states --- */}
        <section className="paper-card" style={card} aria-label="Saved games">
          <h2 style={cardTitle}>Saved games</h2>
          <p style={cardHint}>Autosaves from the arcade — open a game and hit Load.</p>
          {saves.length === 0 ? (
            <p style={empty}>
              Nothing saved yet. Any game in the <Link href="/games">arcade</Link> has a Save
              button once you&rsquo;re signed in.
            </p>
          ) : (
            <ul style={list}>
              {saves.map((s) => (
                <li key={s.id} style={row}>
                  <Link href={`/games/${s.game}`}>{GAME_TITLES.get(s.game) ?? s.game}</Link>
                  <span style={meta}>{fmt(s.updatedAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* --- Rosters --- */}
        <section className="paper-card" style={card} aria-label="Saved rosters">
          <h2 style={cardTitle}>Hunger Games rosters</h2>
          <p style={cardHint}>Your saved casts of tributes. Load one straight into the arena.</p>
          {rosters.length === 0 ? (
            <p style={empty}>
              No rosters yet — build one in the{" "}
              <Link href="/games/hunger-games">simulator</Link> and save it.
            </p>
          ) : (
            <ul style={list}>
              {rosters.map((r) => {
                let count = 0;
                try {
                  count = (JSON.parse(r.data) as unknown[]).length;
                } catch {
                  /* corrupted roster row — still listed, just without a count */
                }
                return (
                  <li key={r.id} style={row}>
                    <Link href={`/games/hunger-games?roster=${r.id}`}>{r.name}</Link>
                    <span style={meta}>
                      {count ? `${count} tributes · ` : ""}
                      {fmt(r.updatedAt)}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* --- Recent simulations --- */}
        <section className="paper-card" style={card} aria-label="Recent simulations">
          <h2 style={cardTitle}>Recent simulations</h2>
          <p style={cardHint}>Deterministic replays — same seed, same fate.</p>
          {runs.length === 0 ? (
            <p style={empty}>
              Run the <Link href="/games/hunger-games">Hunger Games simulator</Link> and your
              results will collect here.
            </p>
          ) : (
            <ul style={list}>
              {runs.map((r) => (
                <li key={r.id} style={row}>
                  <Link href={`/games/hunger-games?run=${r.id}`}>
                    {r.winner ? `🏆 ${r.winner}` : "No survivors"}
                  </Link>
                  <span style={meta}>
                    {r.players} tributes · {r.turns} turns · {fmt(r.createdAt)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* --- Profile settings --- */}
        <section className="paper-card" style={card} aria-label="Profile settings">
          <h2 style={cardTitle}>Profile</h2>
          <p style={cardHint}>Account details and settings.</p>
          <dl
            style={{
              margin: 0,
              display: "grid",
              gridTemplateColumns: "auto 1fr",
              rowGap: "0.6rem",
              columnGap: "1.25rem",
              fontSize: "0.92rem",
            }}
          >
            {(
              [
                ["Username", user.username ? `@${user.username}` : "—"],
                ["Name", user.name || "—"],
                ["Email", user.email],
                ["Role", user.role],
                ["Member since", fmt(user.createdAt)],
              ] as [string, string][]
            ).map(([label, value]) => (
              <div key={label} style={{ display: "contents" }}>
                <dt
                  style={{
                    color: "var(--ink-soft)",
                    fontSize: "0.75rem",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                  }}
                >
                  {label}
                </dt>
                <dd style={{ margin: 0 }}>{value}</dd>
              </div>
            ))}
          </dl>
          <p style={{ margin: "1rem 0 0" }}>
            <Link href="/profile/edit">Edit profile →</Link>
          </p>
          {staff && (
            <p style={{ margin: "0.4rem 0 0" }}>
              <Link href="/admin">Admin dashboard →</Link>
            </p>
          )}
        </section>
      </div>
    </main>
  );
}
