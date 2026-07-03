import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiStaff } from "@/lib/api";
import { MAX_BOOKCASES } from "@/lib/library";

// Bookcase pages (staff).
//   GET  /api/bookcases → all cases (idx + name)
//   POST /api/bookcases → add the next case, or rename one { idx, name }

export async function GET() {
  const auth = await requireApiStaff();
  if (auth instanceof NextResponse) return auth;

  const cases = await prisma.bookcase.findMany({ orderBy: { idx: "asc" } });
  return NextResponse.json(cases);
}

export async function POST(req: NextRequest) {
  const auth = await requireApiStaff();
  if (auth instanceof NextResponse) return auth;

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });

  const name = typeof body.name === "string" ? body.name.trim().slice(0, 40) : "";

  // Rename an existing case.
  if (Number.isInteger(body.idx)) {
    const bookcase = await prisma.bookcase.upsert({
      where: { idx: body.idx },
      update: { name },
      create: { idx: body.idx, name },
    });
    return NextResponse.json(bookcase);
  }

  // Create the next case.
  const last = await prisma.bookcase.findFirst({ orderBy: { idx: "desc" } });
  const idx = (last?.idx ?? -1) + 1;
  if (idx >= MAX_BOOKCASES)
    return NextResponse.json({ error: `At most ${MAX_BOOKCASES} bookcases.` }, { status: 400 });

  const bookcase = await prisma.bookcase.create({ data: { idx, name } });
  return NextResponse.json(bookcase, { status: 201 });
}
