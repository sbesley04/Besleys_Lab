import Link from "next/link";
import { spineInk, shade, isPeriodical, coverWidth, coverEdge } from "@/lib/library";
import styles from "../library.module.css";

// One item on the shelf, styled from the book's stored design fields. Pure
// presentation — used on the public shelf (wrapped in a link), in the admin
// shelf manager, and as the live preview inside the book editor.
//
// Two silhouettes: a spine (the default, standing with its title vertical) and
// a cover-forward face (`faceOut`), which is how a shop displays a magazine and
// how the periodical designs — journal, magazine, preprint — look best.

export interface SpineBook {
  slug: string;
  title: string;
  author: string;
  color: string;
  height: number;
  thickness: number;
  design: string;
  label?: string | null;
  faceOut?: boolean;
}

const DESIGN_CLASS: Record<string, string | undefined> = {
  bands: styles.designBands,
  ornate: styles.designOrnate,
  split: styles.designSplit,
  dots: styles.designDots,
  hubs: styles.designHubs,
  marbled: styles.designMarbled,
  tricolor: styles.designTricolor,
  worn: styles.designWorn,
  journal: styles.designJournal,
  magazine: styles.designMagazine,
  preprint: styles.designPreprint,
};

const COVER_DESIGN_CLASS: Record<string, string | undefined> = {
  ornate: styles.coverOrnate,
  hubs: styles.coverOrnate,
  marbled: styles.coverMarbled,
  tricolor: styles.coverTricolor,
  worn: styles.coverWorn,
  journal: styles.coverJournal,
  magazine: styles.coverMagazine,
  preprint: styles.coverPreprint,
};

/** The cloth/paper gradient that gives an item its rounded, lit look. */
function body(color: string) {
  return `linear-gradient(90deg, ${shade(color, -0.25)} 0%, ${color} 30%, ${color} 70%, ${shade(color, -0.35)} 100%)`;
}

export function Spine({ book, scale = 1 }: { book: SpineBook; scale?: number }) {
  const ink = spineInk(book.color);
  const designClass = DESIGN_CLASS[book.design] ?? "";
  const label = book.label?.trim();
  return (
    <span
      className={`${styles.spine} ${designClass}`}
      style={{
        "--bl-scale": scale,
        width: book.thickness * scale,
        height: book.height * scale,
        color: ink,
        background: body(book.color),
      } as React.CSSProperties}
    >
      <span className={styles.spineTitle}>{book.title}</span>
      <span className={styles.spineAuthor}>{book.author}</span>
      {label && <span className={styles.spineLabel}>{label}</span>}
    </span>
  );
}

/** Cover-forward: the front of the book, or a journal/magazine front page. */
export function Cover({ book, scale = 1 }: { book: SpineBook; scale?: number }) {
  const ink = spineInk(book.color);
  const designClass = COVER_DESIGN_CLASS[book.design] ?? "";
  const label = book.label?.trim();
  return (
    <span
      className={[
        styles.cover,
        designClass,
        isPeriodical(book.design) ? styles.coverPeriodical : "",
      ].join(" ")}
      style={{
        "--bl-scale": scale,
        width: coverWidth(book.height, book.design) * scale,
        height: book.height * scale,
        color: ink,
        background: body(book.color),
      } as React.CSSProperties}
    >
      <span
        className={styles.coverEdge}
        style={{ width: coverEdge(book.thickness) * scale }}
        aria-hidden="true"
      />
      <span className={styles.coverMast}>{book.author}</span>
      <span className={styles.coverTitle}>{book.title}</span>
      {label && <span className={styles.coverLabel}>{label}</span>}
    </span>
  );
}

/** Whichever silhouette this book is set to stand in. */
export function ShelfItem({ book, scale = 1 }: { book: SpineBook; scale?: number }) {
  return book.faceOut ? <Cover book={book} scale={scale} /> : <Spine book={book} scale={scale} />;
}

export default function BookSpine({
  book,
  caseIndex,
}: {
  book: SpineBook;
  caseIndex: number;
}) {
  return (
    <Link
      href={`/library/${book.slug}?case=${caseIndex}`}
      className={`${styles.spineLink} ${book.faceOut ? styles.coverLink : ""}`}
      aria-label={`${book.title} by ${book.author} — read the review`}
    >
      <ShelfItem book={book} />
    </Link>
  );
}
