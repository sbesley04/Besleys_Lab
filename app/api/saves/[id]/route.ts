import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiSession } from "@/lib/api";

// Single save slot — owner-only read/delete.

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireApiSession();
  if (auth instanceof NextResponse) return auth;

  const save = await prisma.gameSave.findFirst({
    where: { id: params.id, userId: auth.user.id },
  });
  if (!save) return NextResponse.json({ error: "Save not found." }, { status: 404 });
  return NextResponse.json(save);
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireApiSession();
  if (auth instanceof NextResponse) return auth;

  // deleteMany so a wrong id (or someone else's save) is a no-op, not a crash.
  const result = await prisma.gameSave.deleteMany({
    where: { id: params.id, userId: auth.user.id },
  });
  if (result.count === 0) return NextResponse.json({ error: "Save not found." }, { status: 404 });
  return NextResponse.json({ ok: true });
}
