import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiSession } from "@/lib/api";
import { reviewProblems } from "@/lib/library";

// Visitor reviews for a book.
//   POST   /api/books/:id/reviews → post or update the caller's review
//   DELETE /api/books/:id/reviews → remove the caller's own review
// (Admins can also remove any review via ?reviewId=…)

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireApiSession();
  if (auth instanceof NextResponse) return auth;

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });

  const errors = reviewProblems(body.body, body.rating);
  if (errors.length) return NextResponse.json({ error: errors.join(" ") }, { status: 400 });

  const book = await prisma.book.findFirst({
    where: { id: params.id, published: true },
    select: { id: true },
  });
  if (!book) return NextResponse.json({ error: "Book not found." }, { status: 404 });

  const review = await prisma.bookReview.upsert({
    where: { bookId_userId: { bookId: book.id, userId: auth.user.id } },
    update: { body: body.body.trim(), rating: body.rating ?? null },
    create: {
      bookId: book.id,
      userId: auth.user.id,
      body: body.body.trim(),
      rating: body.rating ?? null,
    },
  });
  return NextResponse.json(review, { status: 201 });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireApiSession();
  if (auth instanceof NextResponse) return auth;

  // Admins may pass ?reviewId= to moderate someone else's review.
  const reviewId = req.nextUrl.searchParams.get("reviewId");
  if (reviewId && auth.user.role === "ADMIN") {
    await prisma.bookReview.deleteMany({ where: { id: reviewId, bookId: params.id } });
    return NextResponse.json({ ok: true });
  }

  const result = await prisma.bookReview.deleteMany({
    where: { bookId: params.id, userId: auth.user.id },
  });
  if (result.count === 0) return NextResponse.json({ error: "No review to delete." }, { status: 404 });
  return NextResponse.json({ ok: true });
}
