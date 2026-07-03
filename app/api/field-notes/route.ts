import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiStaff } from "@/lib/api";
import { fieldNoteProblems } from "@/lib/library";

// Field notebook entries (the home-page photo strip). Staff-managed.
//   GET  /api/field-notes → all entries in order
//   POST /api/field-notes → add one (appends to the end)

export async function GET() {
  const auth = await requireApiStaff();
  if (auth instanceof NextResponse) return auth;

  const notes = await prisma.fieldNote.findMany({ orderBy: { position: "asc" } });
  return NextResponse.json(notes);
}

export async function POST(req: NextRequest) {
  const auth = await requireApiStaff();
  if (auth instanceof NextResponse) return auth;

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });

  const errors = fieldNoteProblems(body);
  if (errors.length) return NextResponse.json({ error: errors.join(" ") }, { status: 400 });

  const last = await prisma.fieldNote.findFirst({
    orderBy: { position: "desc" },
    select: { position: true },
  });

  const note = await prisma.fieldNote.create({
    data: {
      image: body.image.trim(),
      alt: body.alt.trim(),
      caption: body.caption.trim(),
      tilt: typeof body.tilt === "number" ? body.tilt : 0,
      position: (last?.position ?? -1) + 1,
    },
  });
  return NextResponse.json(note, { status: 201 });
}
