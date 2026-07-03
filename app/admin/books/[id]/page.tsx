import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import BookForm from "../_components/BookForm";

export const dynamic = "force-dynamic";
export const metadata = { title: "Edit book — Admin" };

export default async function EditBookPage({ params }: { params: { id: string } }) {
  await requireStaff();

  const book = await prisma.book.findUnique({ where: { id: params.id } });
  if (!book) notFound();

  return (
    <main style={{ maxWidth: 880, margin: "0 auto", padding: "4rem 1.5rem" }}>
      <Link href="/admin/books" style={{ fontSize: "0.9rem" }}>
        ← Library
      </Link>
      <h1 style={{ fontFamily: "var(--font-display)", fontSize: "2.4rem", margin: "0.5rem 0 1.5rem" }}>
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
