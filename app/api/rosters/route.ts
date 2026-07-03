import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiSession } from "@/lib/api";
import { slotNameProblem } from "@/lib/saves";
import { rosterProblems, type RosterPlayer } from "@/app/games/hunger-games/roster";

// Saved Hunger Games rosters, scoped to the session user.
//   GET  /api/rosters → list my rosters (with player counts)
//   POST /api/rosters → upsert by name { name, players: RosterPlayer[] }

export async function GET() {
  const auth = await requireApiSession();
  if (auth instanceof NextResponse) return auth;

  const rosters = await prisma.roster.findMany({
    where: { userId: auth.user.id },
    orderBy: { updatedAt: "desc" },
  });
  return NextResponse.json(
    rosters.map((r) => {
      let playerCount = 0;
      try {
        playerCount = (JSON.parse(r.data) as unknown[]).length;
      } catch {
        // corrupted row — surface it with count 0 rather than failing the list
      }
      return { id: r.id, name: r.name, playerCount, updatedAt: r.updatedAt };
    }),
  );
}

export async function POST(req: NextRequest) {
  const auth = await requireApiSession();
  if (auth instanceof NextResponse) return auth;

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });

  const name = typeof body.name === "string" ? body.name.trim() : "";
  const nameErr = slotNameProblem(name);
  if (nameErr) return NextResponse.json({ error: nameErr }, { status: 400 });

  const players = body.players as RosterPlayer[];
  const errors = rosterProblems(players);
  if (errors.length)
    return NextResponse.json({ error: errors.slice(0, 3).join(" ") }, { status: 400 });

  const roster = await prisma.roster.upsert({
    where: { userId_name: { userId: auth.user.id, name } },
    update: { data: JSON.stringify(players) },
    create: { userId: auth.user.id, name, data: JSON.stringify(players) },
  });
  return NextResponse.json({ id: roster.id, name: roster.name, playerCount: players.length, updatedAt: roster.updatedAt });
}
