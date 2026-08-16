import Link from "next/link";
import { requireStaff } from "@/lib/session";
import ShelfManager from "./_components/ShelfManager";
import styles from "../_components/accountArea.module.css";

// Admin: arrange the library shelf and jump into book editors.
export const dynamic = "force-dynamic";
export const metadata = { title: "Library — Admin" };

export default async function AdminBooksPage() {
  await requireStaff();

  return (
    <main className={`${styles.page} ${styles.pageWide} ${styles.accountPage}`}>
      <Link href="/admin" className={styles.backLink}>
        ← Admin
      </Link>
      <header className={styles.listHeader}>
        <div className={styles.breakable}>
          <h1 className={styles.pageTitle}>Library</h1>
          <p style={{ color: "var(--ink-soft)", margin: "0.25rem 0 0", fontSize: "0.92rem" }}>
            Arrange the shelf, tweak spines, and write reviews.{" "}
            <Link href="/library">View the public shelf →</Link>
          </p>
        </div>
        <Link href="/admin/books/new" className={styles.primaryLink}>
          + Add book
        </Link>
      </header>

      <ShelfManager />
    </main>
  );
}
