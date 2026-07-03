import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiSession } from "@/lib/api";

// Single recorded run — owner-only. GET returns seed + roster for replay.

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireApiSession();
  if (auth instanceof NextResponse) return auth;

  const run = await prisma.simulationRun.findFirst({
    where: { id: params.id, userId: auth.user.id },
  });
  if (!run) return NextResponse.json({ error: "Simulation not found." }, { status: 404 });

  try {
    return NextResponse.json({
      id: run.id,
      seed: run.seed,
      players: JSON.parse(run.roster),
      winner: run.winner,
      turns: run.turns,
      createdAt: run.createdAt,
    });
  } catch {
    return NextResponse.json({ error: "This run is corrupted and can't be replayed." }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireApiSession();
  if (auth instanceof NextResponse) return auth;

  const result = await prisma.simulationRun.deleteMany({
    where: { id: params.id, userId: auth.user.id },
  });
  if (result.count === 0) return NextResponse.json({ error: "Simulation not found." }, { status: 404 });
  return NextResponse.json({ ok: true });
}
