import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiSession } from "@/lib/api";
import { GAME_SLUGS } from "@/lib/saves";

// Completed-game records — the raw rows behind high scores and stats.
//   GET  /api/results?game=solitaire            → summary aggregates for a game
//   POST /api/results                           → { game, mode?, event?, score?, timeMs?, moves?, meta? }
//
// The GET summary is what game pages render: per-mode wins/deals, best time,
// fewest moves, plus recent rows (for streak math client-side). Everything is
// scoped to the session user.

const MAX_META = 2_000;
const MAX_DB_INT = 2_147_483_647;
const EVENTS = new Set(["deal", "win"]);

function boundedCount(value: unknown): number | null {
  return Number.isFinite(value)
    ? Math.min(MAX_DB_INT, Math.max(0, Math.floor(value as number)))
    : null;
}

export async function GET(req: NextRequest) {
  const auth = await requireApiSession();
  if (auth instanceof NextResponse) return auth;

  const game = req.nextUrl.searchParams.get("game") ?? "";
  if (!GAME_SLUGS.has(game)) {
    return NextResponse.json({ error: "Unknown game." }, { status: 400 });
  }

  // Aggregate in the database rather than over a page of rows — a personal
  // best must survive however many games get played after it.
  const [wins, deals, recent] = await Promise.all([
    prisma.gameResult.groupBy({
      by: ["mode"],
      where: { userId: auth.user.id, game, event: "win" },
      _count: { _all: true },
      _min: { timeMs: true, moves: true },
      _max: { score: true },
    }),
    prisma.gameResult.groupBy({
      by: ["mode"],
      where: { userId: auth.user.id, game, event: "deal" },
      _count: { _all: true },
    }),
    // Recent rows are only for client-side streak math (sudoku dailies).
    prisma.gameResult.findMany({
      where: { userId: auth.user.id, game },
      select: { mode: true, event: true, score: true, timeMs: true, moves: true, meta: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: 60,
    }),
  ]);

  const byMode: Record<
    string,
    { deals: number; wins: number; bestTimeMs: number | null; fewestMoves: number | null; bestScore: number }
  > = {};
  const slot = (mode: string) =>
    (byMode[mode] ??= { deals: 0, wins: 0, bestTimeMs: null, fewestMoves: null, bestScore: 0 });

  for (const w of wins) {
    const m = slot(w.mode);
    m.wins = w._count._all;
    m.bestTimeMs = w._min.timeMs;
    m.fewestMoves = w._min.moves;
    m.bestScore = w._max.score ?? 0;
  }
  for (const d of deals) slot(d.mode).deals = d._count._all;

  return NextResponse.json({ byMode, recent });
}

export async function POST(req: NextRequest) {
  const auth = await requireApiSession();
  if (auth instanceof NextResponse) return auth;

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });

  const game = typeof body.game === "string" ? body.game : "";
  if (!GAME_SLUGS.has(game)) return NextResponse.json({ error: "Unknown game." }, { status: 400 });

  const event = typeof body.event === "string" && EVENTS.has(body.event) ? body.event : "win";
  const mode = typeof body.mode === "string" ? body.mode.slice(0, 40) : "";
  const score = boundedCount(body.score) ?? 0;
  const timeMs = boundedCount(body.timeMs);
  const moves = boundedCount(body.moves);

  let meta = "{}";
  if (body.meta !== undefined) {
    try {
      meta = JSON.stringify(body.meta).slice(0, MAX_META);
      JSON.parse(meta); // still valid after the length cap?
    } catch {
      return NextResponse.json({ error: "meta must be JSON-serializable and small." }, { status: 400 });
    }
  }

  const row = await prisma.gameResult.create({
    data: { userId: auth.user.id, game, mode, event, score, timeMs, moves, meta },
  });
  return NextResponse.json({ id: row.id, createdAt: row.createdAt });
}
