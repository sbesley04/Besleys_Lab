import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireApiStaff } from "@/lib/api";
import { slugify } from "@/lib/slug";
import { bookProblems, SPINE_HEIGHT, SPINE_THICKNESS } from "@/lib/library";

// Collection endpoints for library books.
//   GET  /api/books → all books incl. unpublished (staff; the shelf manager)
//   POST /api/books → create a book (staff)
// Public reads happen in the /library server components via Prisma directly.

export async function GET() {
  const auth = await requireApiStaff();
  if (auth instanceof NextResponse) return auth;

  const books = await prisma.book.findMany({
    orderBy: [{ bookcase: "asc" }, { shelf: "asc" }, { position: "asc" }],
  });
  return NextResponse.json(books);
}

export async function POST(req: NextRequest) {
  const auth = await requireApiStaff();
  if (auth instanceof NextResponse) return auth;

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });

  const errors = bookProblems(body);
  if (errors.length) return NextResponse.json({ error: errors.join(" ") }, { status: 400 });

  const slug = body.slug?.trim() ? slugify(body.slug) : slugify(`${body.title} ${body.author}`);

  // New books land at the end of their shelf (in their bookcase).
  const bookcase = Number.isInteger(body.bookcase) ? body.bookcase : 0;
  const shelf = Number.isInteger(body.shelf) ? body.shelf : 0;
  const last = await prisma.book.findFirst({
    where: { bookcase, shelf },
    orderBy: { position: "desc" },
    select: { position: true },
  });

  try {
    const book = await prisma.book.create({
      data: {
        slug,
        title: body.title.trim(),
        author: body.author.trim(),
        review: body.review ?? "",
        rating: body.rating ?? null,
        color: body.color ?? "#7a6a52",
        height: body.height ?? SPINE_HEIGHT.default,
        thickness: body.thickness ?? SPINE_THICKNESS.default,
        design: body.design ?? "plain",
        bookcase,
        shelf,
        position: (last?.position ?? -1) + 1,
        published: body.published ?? true,
      },
    });
    return NextResponse.json(book, { status: 201 });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return NextResponse.json({ error: "A book with that slug already exists." }, { status: 409 });
    }
    throw err;
  }
}
