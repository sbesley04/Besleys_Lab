import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiStaff } from "@/lib/api";
import { fieldNoteProblems } from "@/lib/library";

// Single field-notebook entry (staff).
//   PUT    /api/field-notes/:id → edit, or {move: true, position} reorder
//   DELETE /api/field-notes/:id → remove

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireApiStaff();
  if (auth instanceof NextResponse) return auth;

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });

  const existing = await prisma.fieldNote.findUnique({ where: { id: params.id } });
  if (!existing) return NextResponse.json({ error: "Entry not found." }, { status: 404 });

  if (body.move === true) {
    const position = Number.isInteger(body.position) ? body.position : existing.position;
    const note = await prisma.fieldNote.update({ where: { id: params.id }, data: { position } });
    return NextResponse.json(note);
  }

  const errors = fieldNoteProblems(body);
  if (errors.length) return NextResponse.json({ error: errors.join(" ") }, { status: 400 });

  const note = await prisma.fieldNote.update({
    where: { id: params.id },
    data: {
      image: body.image.trim(),
      alt: body.alt.trim(),
      caption: body.caption.trim(),
      tilt: typeof body.tilt === "number" ? body.tilt : existing.tilt,
    },
  });
  return NextResponse.json(note);
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireApiStaff();
  if (auth instanceof NextResponse) return auth;

  await prisma.fieldNote.delete({ where: { id: params.id } }).catch(() => null);
  return NextResponse.json({ ok: true });
}
