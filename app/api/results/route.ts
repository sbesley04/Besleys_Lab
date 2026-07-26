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
const EVENTS = new Set(["deal", "win"]);

export async function GET(req: NextRequest) {
  const auth = await requireApiSession();
  if (auth instanceof NextResponse) return auth;

  const game = req.nextUrl.searchParams.get("game") ?? "";
  if (!GAME_SLUGS.has(game)) {
    return NextResponse.json({ error: "Unknown game." }, { status: 400 });
  }

  const rows = await prisma.gameResult.findMany({
    where: { userId: auth.user.id, game },
    select: { mode: true, event: true, score: true, timeMs: true, moves: true, meta: true, createdAt: true },
    orderBy: { createdAt: "desc" },
    take: 500,
  });

  // Per-mode aggregate: deals, wins, best (lowest) time, fewest moves, best score.
  const byMode: Record<
    string,
    { deals: number; wins: number; bestTimeMs: number | null; fewestMoves: number | null; bestScore: number }
  > = {};
  for (const r of rows) {
    const m = (byMode[r.mode] ??= { deals: 0, wins: 0, bestTimeMs: null, fewestMoves: null, bestScore: 0 });
    if (r.event === "deal") m.deals++;
    if (r.event === "win") {
      m.wins++;
      if (r.timeMs != null && (m.bestTimeMs == null || r.timeMs < m.bestTimeMs)) m.bestTimeMs = r.timeMs;
      if (r.moves != null && (m.fewestMoves == null || r.moves < m.fewestMoves)) m.fewestMoves = r.moves;
      if (r.score > m.bestScore) m.bestScore = r.score;
    }
  }

  return NextResponse.json({ byMode, recent: rows.slice(0, 60) });
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
  const score = Number.isFinite(body.score) ? Math.max(0, Math.floor(body.score)) : 0;
  const timeMs = Number.isFinite(body.timeMs) ? Math.max(0, Math.floor(body.timeMs)) : null;
  const moves = Number.isFinite(body.moves) ? Math.max(0, Math.floor(body.moves)) : null;

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
