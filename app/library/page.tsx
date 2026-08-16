import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { isStaff } from "@/lib/validation";
import Link from "next/link";
import BookSpine from "./_components/BookSpine";
import { Bookend, Decor, PottedPlant, Monstera, Fern, Armillary, PenMug } from "./_components/ShelfDecor";
import styles from "./library.module.css";

// The library: bookcases of clickable spines with plants between the books.
// Multiple bookcases render as pages — tabs above the case switch between
// them (?case=N). Books, spine designs, decor, and arrangement are all
// managed from /admin/books.
export const metadata = {
  title: "Library",
  description:
    "A digital bookshelf — what Sam's been reading, with reviews you can add to.",
};
export const dynamic = "force-dynamic";

// Until the admin places their own decor, each shelf gets a default plant so
// a fresh install still looks lived-in (same pattern as the field notebook).
const FALLBACK_DECOR = [PottedPlant, Monstera, Fern, Armillary, PenMug];
const WIDE_DECOR = new Set([
  "monstera",
  "fern",
  "hanging-philodendron",
  "armillary",
  "pen-mug",
  "lantern-stems",
  "calvin-hobbes-bookends",
]);

type ShelfThing =
  | { type: "book"; position: number; key: string; book: Parameters<typeof BookSpine>[0]["book"] }
  | { type: "decor"; position: number; key: string; kind: string };

export default async function LibraryPage({
  searchParams,
}: {
  searchParams?: Promise<{ case?: string }>;
}) {
  const query = await searchParams;
  const [loadedBooks, decor, cases, session] = await Promise.all([
    prisma.book
      .findMany({
        where: { published: true },
        orderBy: [{ bookcase: "asc" }, { shelf: "asc" }, { position: "asc" }],
      })
      .catch(() => null),
    prisma.shelfDecorItem.findMany({ orderBy: { position: "asc" } }).catch(() => []),
    prisma.bookcase.findMany({ orderBy: { idx: "asc" } }).catch(() => []),
    getSession().catch(() => null),
  ]);
  const booksUnavailable = loadedBooks === null;
  const books = loadedBooks ?? [];

  // Pages = every case that exists as a row or holds content.
  const caseIndexes = [
    ...new Set([...cases.map((c) => c.idx), ...books.map((b) => b.bookcase), ...decor.map((d) => d.bookcase)]),
  ].sort((a, b) => a - b);
  const pages = caseIndexes.length ? caseIndexes : [0];

  const requested = Number(query?.case);
  const activeCase = pages.includes(requested) ? requested : pages[0];
  const caseName = cases.find((c) => c.idx === activeCase)?.name || "";

  const caseBooks = books.filter((b) => b.bookcase === activeCase);
  const caseDecor = decor.filter((d) => d.bookcase === activeCase);

  const shelfIndexes = [
    ...new Set([...caseBooks.map((b) => b.shelf), ...caseDecor.map((d) => d.shelf)]),
  ].sort((a, b) => a - b);

  const shelves = shelfIndexes.map((idx) => {
    const things: ShelfThing[] = [
      ...caseBooks
        .filter((b) => b.shelf === idx)
        .map((b): ShelfThing => ({ type: "book", position: b.position, key: b.id, book: b })),
      ...caseDecor
        .filter((d) => d.shelf === idx)
        .map((d): ShelfThing => ({ type: "decor", position: d.position, key: d.id, kind: d.kind })),
    ].sort(
      (a, b) =>
        a.position - b.position ||
        a.type.localeCompare(b.type) ||
        a.key.localeCompare(b.key),
    );
    return { idx, things };
  });
  const shelfMayScroll = shelves.some(
    ({ things }) =>
      things.length >= 4 ||
      things.some((thing) => thing.type === "decor" && WIDE_DECOR.has(thing.kind)),
  );

  return (
    <main className={styles.page}>
      <h1 className={styles.pageTitle}>Library</h1>
      <p className={styles.intro}>
        What I&rsquo;ve been reading. Pull a spine off the shelf to read the review — and if
        you&rsquo;ve read it too, sign in and leave your own.
      </p>

      {/* --- Bookcase pager --- */}
      {!booksUnavailable && pages.length > 1 && (
        <nav className={styles.pager} aria-label="Bookcases">
          {pages.map((idx) => {
            const name = cases.find((c) => c.idx === idx)?.name;
            const label = name || `Bookcase ${idx + 1}`;
            const active = idx === activeCase;
            return (
              <Link
                key={idx}
                href={idx === pages[0] ? "/library" : `/library?case=${idx}`}
                className={active ? styles.pagerTabActive : styles.pagerTab}
                aria-current={active ? "page" : undefined}
              >
                {label}
              </Link>
            );
          })}
        </nav>
      )}

      {!booksUnavailable && caseName && pages.length <= 1 && (
        <p className={`margin-note ${styles.caseName}`}>
          {caseName}
        </p>
      )}

      {!booksUnavailable && books.length > 0 && (
        <div className={styles.caseSummary}>
          <span>{caseBooks.length} {caseBooks.length === 1 ? "title" : "titles"}</span>
          <span aria-hidden="true">·</span>
          <span>{shelves.length} {shelves.length === 1 ? "shelf" : "shelves"}</span>
          {shelfMayScroll && (
            <span className={styles.swipeHint}>
              Swipe a shelf to browse <span aria-hidden="true">→</span>
            </span>
          )}
        </div>
      )}

      {booksUnavailable ? (
        <div className={`paper-card ${styles.statusCard}`} role="status">
          <p>The card catalog is temporarily unavailable. Please try the shelf again in a moment.</p>
        </div>
      ) : books.length === 0 ? (
        <div className={`paper-card ${styles.statusCard}`}>
          <p>
            The shelves are still being stocked — check back soon.
          </p>
        </div>
      ) : (
        <div className={styles.case} role="region" aria-label={caseName || `Bookcase ${activeCase + 1}`}>
          {shelves.length === 0 ? (
            <div className={styles.shelfUnit}>
              <div className={styles.shelf}>
                <span className={styles.emptyShelfNote}>this bookcase is waiting for books…</span>
              </div>
              <div className={styles.plank} aria-hidden="true">
                <span className={styles.shelfPlate}>Shelf 1</span>
              </div>
            </div>
          ) : (
            shelves.map(({ idx, things }, i) => {
              const Fallback = FALLBACK_DECOR[i % FALLBACK_DECOR.length];
              const hasDecor = things.some((thing) => thing.type === "decor");
              const shelfBookCount = things.filter((thing) => thing.type === "book").length;
              return (
                <div key={idx} className={styles.shelfUnit}>
                  <div
                    className={styles.shelf}
                    role="group"
                    aria-label={`Shelf ${idx + 1}: ${shelfBookCount} ${shelfBookCount === 1 ? "book" : "books"}`}
                  >
                    <Bookend side="left" />
                    {things.map((t) =>
                      t.type === "book" ? (
                        <BookSpine key={t.key} book={t.book} caseIndex={activeCase} />
                      ) : (
                        <Decor key={t.key} kind={t.kind} />
                      ),
                    )}
                    {!hasDecor && <Fallback />}
                    <Bookend side="right" />
                  </div>
                  <div className={styles.plank} aria-hidden="true">
                    <span className={styles.shelfPlate}>Shelf {idx + 1}</span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      <div className={styles.legendRow}>
        <span className="margin-note">borrowing not available — reviews are, though</span>
        {isStaff(session?.user?.role) && <Link href="/admin/books">Manage the shelf →</Link>}
      </div>
    </main>
  );
}
