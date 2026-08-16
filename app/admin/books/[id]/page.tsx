import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import BookForm from "../_components/BookForm";
import styles from "../../_components/accountArea.module.css";

export const dynamic = "force-dynamic";
export const metadata = { title: "Edit book — Admin" };

export default async function EditBookPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireStaff();

  const book = await prisma.book.findUnique({ where: { id } });
  if (!book) notFound();

  return (
    <main className={`${styles.page} ${styles.pageWide} ${styles.accountPage}`}>
      <Link href="/admin/books" className={styles.backLink}>
        ← Library
      </Link>
      <h1 className={`${styles.pageTitle} ${styles.pageTitleAfterBack}`}>
        Edit book
      </h1>
      <BookForm
        book={{
          id: book.id,
          title: book.title,
          author: book.author,
          slug: book.slug,
          review: book.review,
          rating: book.rating ?? 0,
          color: book.color,
          height: book.height,
          thickness: book.thickness,
          design: book.design,
          bookcase: book.bookcase,
          shelf: book.shelf,
          published: book.published,
        }}
      />
    </main>
  );
}
