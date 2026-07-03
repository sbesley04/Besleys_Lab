import Link from "next/link";
import { spineInk, shade } from "@/lib/library";
import styles from "../library.module.css";

// A single book spine, styled from the book's stored design fields. Pure
// presentation — used on the public shelf (wrapped in a link), in the admin
// shelf manager, and as the live preview inside the book editor.

export interface SpineBook {
  slug: string;
  title: string;
  author: string;
  color: string;
  height: number;
  thickness: number;
  design: string;
}

const DESIGN_CLASS: Record<string, string | undefined> = {
  bands: styles.designBands,
  ornate: styles.designOrnate,
  split: styles.designSplit,
  dots: styles.designDots,
};

export function Spine({ book, scale = 1 }: { book: SpineBook; scale?: number }) {
  const ink = spineInk(book.color);
  const designClass = DESIGN_CLASS[book.design] ?? "";
  return (
    <span
      className={`${styles.spine} ${designClass}`}
      style={{
        width: book.thickness * scale,
        height: book.height * scale,
        color: ink,
        background: `linear-gradient(90deg, ${shade(book.color, -0.25)} 0%, ${book.color} 30%, ${book.color} 70%, ${shade(book.color, -0.35)} 100%)`,
      }}
    >
      <span className={styles.spineTitle}>{book.title}</span>
      <span className={styles.spineAuthor}>{book.author}</span>
    </span>
  );
}

export default function BookSpine({ book }: { book: SpineBook }) {
  return (
    <Link
      href={`/library/${book.slug}`}
      className={styles.spineLink}
      aria-label={`${book.title} by ${book.author} — read the review`}
    >
      <Spine book={book} />
    </Link>
  );
}
