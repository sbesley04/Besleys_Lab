import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiStaff } from "@/lib/api";

// Single decor item (staff): move or remove.
//   PUT    /api/decor/:id → { bookcase?, shelf?, position? }
//   DELETE /api/decor/:id

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireApiStaff();
  if (auth instanceof NextResponse) return auth;

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });

  const existing = await prisma.shelfDecorItem.findUnique({ where: { id: params.id } });
  if (!existing) return NextResponse.json({ error: "Decor not found." }, { status: 404 });

  const item = await prisma.shelfDecorItem.update({
    where: { id: params.id },
    data: {
      bookcase: Number.isInteger(body.bookcase) ? body.bookcase : existing.bookcase,
      shelf: Number.isInteger(body.shelf) ? body.shelf : existing.shelf,
      position: Number.isInteger(body.position) ? body.position : existing.position,
    },
  });
  return NextResponse.json(item);
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireApiStaff();
  if (auth instanceof NextResponse) return auth;

  await prisma.shelfDecorItem.delete({ where: { id: params.id } }).catch(() => null);
  return NextResponse.json({ ok: true });
}
