import Link from "next/link";
import { requireStaff } from "@/lib/session";
import ShelfManager from "./_components/ShelfManager";

// Admin: arrange the library shelf and jump into book editors.
export const dynamic = "force-dynamic";
export const metadata = { title: "Library — Admin" };

export default async function AdminBooksPage() {
  await requireStaff();

  return (
    <main style={{ maxWidth: 880, margin: "0 auto", padding: "4rem 1.5rem" }}>
      <Link href="/admin" style={{ fontSize: "0.9rem" }}>
        ← Admin
      </Link>
      <header
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: "0.5rem 1rem",
          margin: "0.5rem 0 1.5rem",
        }}
      >
        <div>
          <h1 style={{ fontFamily: "var(--font-display)", fontSize: "2.4rem", margin: 0 }}>Library</h1>
          <p style={{ color: "var(--ink-soft)", margin: "0.25rem 0 0", fontSize: "0.92rem" }}>
            Arrange the shelf, tweak spines, and write reviews.{" "}
            <Link href="/library">View the public shelf →</Link>
          </p>
        </div>
        <Link
          href="/admin/books/new"
          style={{
            fontFamily: "var(--font-body)",
            fontWeight: 600,
            fontSize: "0.95rem",
            padding: "0.55rem 1.1rem",
            border: "1px solid var(--accent)",
            borderRadius: 4,
            background: "var(--accent)",
            color: "var(--paper)",
          }}
        >
          + Add book
        </Link>
      </header>

      <ShelfManager />
    </main>
  );
}
