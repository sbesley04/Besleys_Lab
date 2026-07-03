import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiSession } from "@/lib/api";
import { MAX_SIM_RUNS } from "@/lib/saves";
import { rosterProblems, type RosterPlayer } from "@/app/games/hunger-games/roster";

// Recorded Hunger Games runs. The engine is deterministic, so a run is just
// (seed, roster) plus a summary — replaying re-simulates the identical game.
//   GET  /api/simulations → my recent runs (summaries)
//   POST /api/simulations → record a run { seed, players, winner, turns }

export async function GET() {
  const auth = await requireApiSession();
  if (auth instanceof NextResponse) return auth;

  const runs = await prisma.simulationRun.findMany({
    where: { userId: auth.user.id },
    select: { id: true, seed: true, winner: true, turns: true, players: true, createdAt: true },
    orderBy: { createdAt: "desc" },
    take: MAX_SIM_RUNS,
  });
  return NextResponse.json(runs);
}

export async function POST(req: NextRequest) {
  const auth = await requireApiSession();
  if (auth instanceof NextResponse) return auth;

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });

  const seed = Number(body.seed);
  if (!Number.isInteger(seed) || seed < 0 || seed > 2 ** 31)
    return NextResponse.json({ error: "Invalid seed." }, { status: 400 });

  const players = body.players as RosterPlayer[];
  const errors = rosterProblems(players);
  if (errors.length)
    return NextResponse.json({ error: errors.slice(0, 3).join(" ") }, { status: 400 });

  const winner = typeof body.winner === "string" ? body.winner.slice(0, 60) : null;
  const turns = Number.isInteger(body.turns) ? Math.max(0, body.turns as number) : 0;

  const run = await prisma.simulationRun.create({
    data: {
      userId: auth.user.id,
      seed,
      roster: JSON.stringify(players),
      winner,
      turns,
      players: players.length,
    },
  });

  // Prune old runs beyond the cap so the table can't grow unbounded.
  const excess = await prisma.simulationRun.findMany({
    where: { userId: auth.user.id },
    orderBy: { createdAt: "desc" },
    skip: MAX_SIM_RUNS,
    select: { id: true },
  });
  if (excess.length) {
    await prisma.simulationRun.deleteMany({ where: { id: { in: excess.map((r) => r.id) } } });
  }

  return NextResponse.json({ id: run.id, createdAt: run.createdAt });
}
