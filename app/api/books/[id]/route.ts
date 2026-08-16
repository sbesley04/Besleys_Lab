import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireApiStaff } from "@/lib/api";
import { slugify } from "@/lib/slug";
import { bookProblems, nextShelfPosition } from "@/lib/library";

// Item endpoints for a single book (staff).
//   PUT    /api/books/:id → full edit, or partial {shelf, position} moves from
//          the shelf manager (send `move: true` to skip full validation)
//   DELETE /api/books/:id → remove the book (reviews cascade)

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await requireApiStaff();
  if (auth instanceof NextResponse) return auth;

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });

  const existing = await prisma.book.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Book not found." }, { status: 404 });

  // Shelf-manager moves: only bookcase/shelf/position change, no other validation.
  if (body.move === true) {
    const errors = bookProblems({ ...existing, ...body });
    if (errors.length) return NextResponse.json({ error: errors.join(" ") }, { status: 400 });
    const bookcase = Number.isInteger(body.bookcase) ? body.bookcase : existing.bookcase;
    const shelf = Number.isInteger(body.shelf) ? body.shelf : existing.shelf;
    const position = Number.isInteger(body.position) ? body.position : existing.position;
    const book = await prisma.book.update({
      where: { id },
      data: { bookcase, shelf, position },
    });
    return NextResponse.json(book);
  }

  const errors = bookProblems(body);
  if (errors.length) return NextResponse.json({ error: errors.join(" ") }, { status: 400 });

  const slug = body.slug?.trim() ? slugify(body.slug) : existing.slug;
  const bookcase = Number.isInteger(body.bookcase) ? body.bookcase : existing.bookcase;
  const shelf = Number.isInteger(body.shelf) ? body.shelf : existing.shelf;
  let position = existing.position;

  // Moving from the editor appends to the destination shelf's shared
  // book/decor order instead of carrying over a colliding old position.
  if (bookcase !== existing.bookcase || shelf !== existing.shelf) {
    const [lastBook, lastDecor] = await Promise.all([
      prisma.book.findFirst({
        where: { bookcase, shelf },
        orderBy: { position: "desc" },
        select: { position: true },
      }),
      prisma.shelfDecorItem.findFirst({
        where: { bookcase, shelf },
        orderBy: { position: "desc" },
        select: { position: true },
      }),
    ]);
    position = nextShelfPosition(lastBook?.position, lastDecor?.position);
  }

  try {
    const book = await prisma.book.update({
      where: { id },
      data: {
        slug,
        title: body.title.trim(),
        author: body.author.trim(),
        review: body.review ?? existing.review,
        rating: body.rating ?? null,
        color: body.color ?? existing.color,
        height: body.height ?? existing.height,
        thickness: body.thickness ?? existing.thickness,
        design: body.design ?? existing.design,
        bookcase,
        shelf,
        position,
        published: body.published ?? existing.published,
      },
    });
    return NextResponse.json(book);
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return NextResponse.json({ error: "A book with that slug already exists." }, { status: 409 });
    }
    throw err;
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await requireApiStaff();
  if (auth instanceof NextResponse) return auth;

  await prisma.book.delete({ where: { id } }).catch(() => null);
  return NextResponse.json({ ok: true });
}
