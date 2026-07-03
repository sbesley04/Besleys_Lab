import Link from "next/link";
import { requireStaff } from "@/lib/session";
import BookForm from "../_components/BookForm";

export const metadata = { title: "New book — Admin" };

export default async function NewBookPage() {
  await requireStaff();

  return (
    <main style={{ maxWidth: 880, margin: "0 auto", padding: "4rem 1.5rem" }}>
      <Link href="/admin/books" style={{ fontSize: "0.9rem" }}>
        ← Library
      </Link>
      <h1 style={{ fontFamily: "var(--font-display)", fontSize: "2.4rem", margin: "0.5rem 0 1.5rem" }}>
        Add a book
      </h1>
      <BookForm />
    </main>
  );
}
