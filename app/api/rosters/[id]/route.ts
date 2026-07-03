import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiSession } from "@/lib/api";

// Single saved roster — owner-only. GET returns the parsed players.

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireApiSession();
  if (auth instanceof NextResponse) return auth;

  const roster = await prisma.roster.findFirst({
    where: { id: params.id, userId: auth.user.id },
  });
  if (!roster) return NextResponse.json({ error: "Roster not found." }, { status: 404 });

  try {
    return NextResponse.json({ id: roster.id, name: roster.name, players: JSON.parse(roster.data) });
  } catch {
    return NextResponse.json({ error: "This roster is corrupted and can't be loaded." }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireApiSession();
  if (auth instanceof NextResponse) return auth;

  const result = await prisma.roster.deleteMany({
    where: { id: params.id, userId: auth.user.id },
  });
  if (result.count === 0) return NextResponse.json({ error: "Roster not found." }, { status: 404 });
  return NextResponse.json({ ok: true });
}
