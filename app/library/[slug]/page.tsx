import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { isStaff } from "@/lib/validation";
import { renderMarkdown } from "@/lib/markdown";
import { Spine } from "../_components/BookSpine";
import ReviewSection, { type ReviewItem } from "./ReviewSection";
import type { Metadata } from "next";
import { cache } from "react";
import { MAX_BOOKCASES } from "@/lib/library";
import styles from "./detail.module.css";

// A single book: the spine, the owner's review, and reader reviews below.
export const dynamic = "force-dynamic";

const getBook = cache((slug: string) =>
  prisma.book
    .findUnique({
      where: { slug },
      include: {
        reviews: {
          orderBy: { createdAt: "desc" },
          include: { user: { select: { username: true, name: true } } },
        },
      },
    }),
);

const getPublishedShelfOrder = cache(() =>
  prisma.book.findMany({
    where: { published: true },
    orderBy: [
      { bookcase: "asc" },
      { shelf: "asc" },
      { position: "asc" },
      { id: "asc" },
    ],
    select: { slug: true, title: true, bookcase: true },
  }),
);

function validCase(value: string | string[] | undefined) {
  if (typeof value !== "string" || !/^\d+$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= 0 && parsed < MAX_BOOKCASES
    ? parsed
    : null;
}

function detailHref(slug: string, bookcase: number) {
  return `/library/${slug}?case=${bookcase}`;
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const book = await getBook(slug);
  if (!book || !book.published) return { title: "Library" };
  return {
    title: `${book.title} — Library`,
    description: `A review of "${book.title}" by ${book.author}, from the Besley's Lab bookshelf.`,
  };
}

export default async function BookPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<{ case?: string | string[] }>;
}) {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const [book, session, shelfOrder] = await Promise.all([
    getBook(slug),
    getSession().catch(() => null),
    getPublishedShelfOrder(),
  ]);

  if (!book) notFound();
  const staff = isStaff(session?.user?.role);
  if (!book.published && !staff) notFound();

  const contextCase = validCase(query?.case) ?? book.bookcase;
  const currentIndex = shelfOrder.findIndex((item) => item.slug === book.slug);
  const previous = currentIndex > 0 ? shelfOrder[currentIndex - 1] : null;
  const next = currentIndex >= 0 && currentIndex < shelfOrder.length - 1
    ? shelfOrder[currentIndex + 1]
    : null;

  const reviewHtml = book.review.trim()
    ? renderMarkdown(book.review)
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
    <main className={styles.page}>
      <Link href={`/library?case=${contextCase}`} className={styles.backLink}>
        ← Back to the shelf
      </Link>

      <header className={styles.bookHeader}>
        <div className={styles.spinePreview} aria-hidden="true">
          <Spine book={book} scale={0.85} />
        </div>
        <div className={styles.bookInfo}>
          {!book.published && (
            <p className={styles.draftBadge}>
              Hidden from the shelf
            </p>
          )}
          <h1 className={styles.bookTitle}>{book.title}</h1>
          <p className={styles.author}>{book.author}</p>
          {book.rating && (
            <p
              role="img"
              aria-label={`Sam's rating: ${book.rating} out of 5 stars`}
              className={styles.ownerRating}
            >
              <span aria-hidden="true">{"★".repeat(book.rating)}</span>
              <span className={styles.mutedStars} aria-hidden="true">
                {"★".repeat(5 - book.rating)}
              </span>
            </p>
          )}
          {staff && (
            <Link href={`/admin/books/${book.id}`} className={styles.staffLink}>
              Edit this book →
            </Link>
          )}
        </div>
      </header>

      {(previous || next) && (
        <nav className={styles.bookNav} aria-label="Browse the bookshelf">
          {previous ? (
            <Link
              href={detailHref(previous.slug, previous.bookcase)}
              className={styles.bookNavLink}
              rel="prev"
            >
              <span className={styles.bookNavDirection}>← Previous</span>
              <span className={styles.bookNavTitle}>{previous.title}</span>
            </Link>
          ) : <span />}
          {next ? (
            <Link
              href={detailHref(next.slug, next.bookcase)}
              className={`${styles.bookNavLink} ${styles.bookNavNext}`}
              rel="next"
            >
              <span className={styles.bookNavDirection}>Next →</span>
              <span className={styles.bookNavTitle}>{next.title}</span>
            </Link>
          ) : <span />}
        </nav>
      )}

      <section className={styles.ownerReview} aria-labelledby="owner-review-title">
        <h2 id="owner-review-title" className={styles.ownerHeading}>
          Sam&rsquo;s notes
        </h2>
        {reviewHtml ? (
          <div className={`prose ${styles.prose}`} dangerouslySetInnerHTML={{ __html: reviewHtml }} />
        ) : (
          <p className={styles.ownerEmpty}>
            Review still brewing — shelved while the marginalia settles.
          </p>
        )}
      </section>

      <ReviewSection
        bookId={book.id}
        bookSlug={book.slug}
        reviews={reviews}
        currentUser={session?.user?.id ? { id: session.user.id, role: session.user.role } : null}
      />
    </main>
  );
}
