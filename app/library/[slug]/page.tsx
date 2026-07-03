import Link from "next/link";
import { notFound } from "next/navigation";
import { marked } from "marked";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { isStaff } from "@/lib/validation";
import { Spine } from "../_components/BookSpine";
import ReviewSection, { type ReviewItem } from "./ReviewSection";
import type { Metadata } from "next";

// A single book: the spine, the owner's review, and reader reviews below.
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const book = await prisma.book.findUnique({
    where: { slug: params.slug },
    select: { title: true, author: true, published: true },
  });
  if (!book || !book.published) return { title: "Library" };
  return {
    title: `${book.title} — Library`,
    description: `A review of "${book.title}" by ${book.author}, from the Besley's Lab bookshelf.`,
  };
}

export default async function BookPage({ params }: { params: { slug: string } }) {
  const [book, session] = await Promise.all([
    prisma.book.findUnique({
      where: { slug: params.slug },
      include: {
        reviews: {
          orderBy: { createdAt: "desc" },
          include: { user: { select: { username: true, name: true } } },
        },
      },
    }),
    getSession(),
  ]);

  if (!book) notFound();
  const staff = isStaff(session?.user?.role);
  if (!book.published && !staff) notFound();

  const reviewHtml = book.review.trim()
    ? (marked.parse(book.review, { async: false }) as string)
    : null;

  const reviews: ReviewItem[] = book.reviews.map((r) => ({
    id: r.id,
    body: r.body,
    rating: r.rating,
    userId: r.userId,
    userName: r.user.username ? `@${r.user.username}` : (r.user.name ?? "reader"),
    createdAt: r.createdAt.toISOString(),
  }));

  return (
    <main style={{ maxWidth: 760, margin: "0 auto", padding: "3.5rem 1.5rem" }}>
      <Link href="/library" style={{ fontSize: "0.9rem" }}>
        ← Back to the shelf
      </Link>

      <header
        style={{
          display: "flex",
          gap: "clamp(1.25rem, 4vw, 2.25rem)",
          alignItems: "flex-end",
          margin: "1.5rem 0 0",
          flexWrap: "wrap",
        }}
      >
        <Spine book={book} scale={0.85} />
        <div style={{ minWidth: "min(100%, 320px)", flex: 1 }}>
          {!book.published && (
            <p
              style={{
                display: "inline-block",
                fontSize: "0.72rem",
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                border: "1px solid rgba(155,58,47,0.4)",
                color: "#7c2d23",
                borderRadius: 999,
                padding: "0.12rem 0.6rem",
                margin: "0 0 0.5rem",
              }}
            >
              Hidden from the shelf
            </p>
          )}
          <h1 style={{ fontFamily: "var(--font-display)", fontSize: "2.4rem", margin: 0, lineHeight: 1.1 }}>
            {book.title}
          </h1>
          <p style={{ color: "var(--ink-soft)", margin: "0.35rem 0 0", fontSize: "1.05rem" }}>
            {book.author}
          </p>
          {book.rating && (
            <p aria-label={`Sam's rating: ${book.rating} out of 5`} style={{ margin: "0.5rem 0 0", color: "var(--accent)", letterSpacing: "0.12em", fontSize: "1.1rem" }}>
              {"★".repeat(book.rating)}
              <span style={{ opacity: 0.3 }}>{"★".repeat(5 - book.rating)}</span>
            </p>
          )}
          {staff && (
            <p style={{ margin: "0.6rem 0 0", fontSize: "0.85rem" }}>
              <Link href={`/admin/books/${book.id}`}>Edit this book →</Link>
            </p>
          )}
        </div>
      </header>

      {reviewHtml ? (
        <div className="prose" style={{ marginTop: "2rem" }} dangerouslySetInnerHTML={{ __html: reviewHtml }} />
      ) : (
        <p style={{ marginTop: "2rem", color: "var(--ink-soft)", fontStyle: "italic" }}>
          Review still brewing — shelved while the marginalia settles.
        </p>
      )}

      <ReviewSection bookId={book.id} reviews={reviews} />
    </main>
  );
}
