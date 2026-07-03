import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiSession } from "@/lib/api";
import { GAME_SLUGS, savePayloadProblem, slotNameProblem } from "@/lib/saves";

// Per-user game save slots.
//   GET  /api/saves            → list my saves (no payloads)
//   GET  /api/saves?game=tetris&name=autosave → single save WITH payload
//   POST /api/saves            → upsert { game, name?, data }
//
// Every query is scoped to the session user — saves are private.

export async function GET(req: NextRequest) {
  const auth = await requireApiSession();
  if (auth instanceof NextResponse) return auth;

  const game = req.nextUrl.searchParams.get("game");
  const name = req.nextUrl.searchParams.get("name");

  if (game && name) {
    const save = await prisma.gameSave.findUnique({
      where: { userId_game_name: { userId: auth.user.id, game, name } },
    });
    if (!save) return NextResponse.json({ error: "No save found." }, { status: 404 });
    return NextResponse.json(save);
  }

  const saves = await prisma.gameSave.findMany({
    where: { userId: auth.user.id, ...(game ? { game } : {}) },
    select: { id: true, game: true, name: true, createdAt: true, updatedAt: true },
    orderBy: { updatedAt: "desc" },
  });
  return NextResponse.json(saves);
}

export async function POST(req: NextRequest) {
  const auth = await requireApiSession();
  if (auth instanceof NextResponse) return auth;

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });

  const game = typeof body.game === "string" ? body.game : "";
  if (!GAME_SLUGS.has(game))
    return NextResponse.json({ error: "Unknown game." }, { status: 400 });

  const name = typeof body.name === "string" && body.name.trim() ? body.name.trim() : "autosave";
  const nameErr = slotNameProblem(name);
  if (nameErr) return NextResponse.json({ error: nameErr }, { status: 400 });

  const dataErr = savePayloadProblem(body.data);
  if (dataErr) return NextResponse.json({ error: dataErr }, { status: 400 });

  const save = await prisma.gameSave.upsert({
    where: { userId_game_name: { userId: auth.user.id, game, name } },
    update: { data: body.data },
    create: { userId: auth.user.id, game, name, data: body.data },
  });
  return NextResponse.json({ id: save.id, game: save.game, name: save.name, updatedAt: save.updatedAt });
}
