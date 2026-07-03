import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiStaff } from "@/lib/api";
import { decorProblems } from "@/lib/library";

// Shelf decor (plants etc.), staff-managed.
//   GET  /api/decor → all decor items in shelf order
//   POST /api/decor → add one { kind, bookcase, shelf } (appends to the shelf)

export async function GET() {
  const auth = await requireApiStaff();
  if (auth instanceof NextResponse) return auth;

  const items = await prisma.shelfDecorItem.findMany({
    orderBy: [{ bookcase: "asc" }, { shelf: "asc" }, { position: "asc" }],
  });
  return NextResponse.json(items);
}

export async function POST(req: NextRequest) {
  const auth = await requireApiStaff();
  if (auth instanceof NextResponse) return auth;

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });

  const errors = decorProblems(body);
  if (errors.length) return NextResponse.json({ error: errors.join(" ") }, { status: 400 });

  const bookcase = Number.isInteger(body.bookcase) ? body.bookcase : 0;
  const shelf = Number.isInteger(body.shelf) ? body.shelf : 0;

  // Land after everything currently on the shelf (books share this space).
  const [lastDecor, lastBook] = await Promise.all([
    prisma.shelfDecorItem.findFirst({
      where: { bookcase, shelf },
      orderBy: { position: "desc" },
      select: { position: true },
    }),
    prisma.book.findFirst({
      where: { bookcase, shelf },
      orderBy: { position: "desc" },
      select: { position: true },
    }),
  ]);
  const position = Math.max(lastDecor?.position ?? -1, lastBook?.position ?? -1) + 1;

  const item = await prisma.shelfDecorItem.create({
    data: { kind: body.kind, bookcase, shelf, position },
  });
  return NextResponse.json(item, { status: 201 });
}
