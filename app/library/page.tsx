import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { isStaff } from "@/lib/validation";
import Link from "next/link";
import BookSpine from "./_components/BookSpine";
import { Bookend, Decor, PottedPlant, TrailingPlant, Cactus } from "./_components/ShelfDecor";
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
const FALLBACK_DECOR = [PottedPlant, TrailingPlant, Cactus];

type ShelfThing =
  | { type: "book"; position: number; key: string; book: Parameters<typeof BookSpine>[0]["book"] }
  | { type: "decor"; position: number; key: string; kind: string };

export default async function LibraryPage({
  searchParams,
}: {
  searchParams?: { case?: string };
}) {
  const [books, decor, cases, session] = await Promise.all([
    prisma.book
      .findMany({
        where: { published: true },
        orderBy: [{ bookcase: "asc" }, { shelf: "asc" }, { position: "asc" }],
      })
      .catch(() => []),
    prisma.shelfDecorItem.findMany({ orderBy: { position: "asc" } }).catch(() => []),
    prisma.bookcase.findMany({ orderBy: { idx: "asc" } }).catch(() => []),
    getSession(),
  ]);

  // Pages = every case that exists as a row or holds content.
  const caseIndexes = [
    ...new Set([...cases.map((c) => c.idx), ...books.map((b) => b.bookcase), ...decor.map((d) => d.bookcase)]),
  ].sort((a, b) => a - b);
  const pages = caseIndexes.length ? caseIndexes : [0];

  const requested = Number(searchParams?.case);
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
    ].sort((a, b) => a.position - b.position);
    return { idx, things };
  });

  const noCustomDecor = decor.length === 0;

  return (
    <main style={{ maxWidth: 1080, margin: "0 auto", padding: "3.5rem 1.5rem" }}>
      <h1 style={{ fontFamily: "var(--font-display)", fontSize: "2.6rem", margin: "0 0 0.25rem" }}>
        Library
      </h1>
      <p style={{ color: "var(--ink-soft)", marginBottom: "1.5rem", maxWidth: "56ch" }}>
        What I&rsquo;ve been reading. Pull a spine off the shelf to read the review — and if
        you&rsquo;ve read it too, sign in and leave your own.
      </p>

      {/* --- Bookcase pager --- */}
      {pages.length > 1 && (
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

      {caseName && pages.length <= 1 && (
        <p className="margin-note" style={{ margin: "0 0 0.75rem" }}>
          {caseName}
        </p>
      )}

      {books.length === 0 ? (
        <div className="paper-card" style={{ padding: "2.5rem", textAlign: "center" }}>
          <p style={{ margin: 0, color: "var(--ink-soft)" }}>
            The shelves are still being stocked — check back soon.
          </p>
        </div>
      ) : (
        <div className={styles.case}>
          {shelves.length === 0 ? (
            <div className={styles.shelf}>
              <span className={styles.emptyShelfNote}>this bookcase is waiting for books…</span>
            </div>
          ) : (
            shelves.map(({ idx, things }, i) => {
              const Fallback = FALLBACK_DECOR[i % FALLBACK_DECOR.length];
              return (
                <div key={idx}>
                  <div className={styles.shelf}>
                    <Bookend side="left" />
                    {things.map((t) =>
                      t.type === "book" ? (
                        <BookSpine key={t.key} book={t.book} />
                      ) : (
                        <Decor key={t.key} kind={t.kind} />
                      ),
                    )}
                    <Bookend side="right" />
                    {noCustomDecor && <Fallback />}
                  </div>
                  <div className={styles.plank} />
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
