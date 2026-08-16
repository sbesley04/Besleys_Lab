import Link from "next/link";
import { requireStaff } from "@/lib/session";
import FieldNotesManager from "./_components/FieldNotesManager";
import styles from "../_components/accountArea.module.css";

// Admin: manage the home page's "From the field notebook" photo strip.
export const dynamic = "force-dynamic";
export const metadata = { title: "Field notebook — Admin" };

export default async function AdminFieldNotesPage() {
  await requireStaff();

  return (
    <main className={`${styles.page} ${styles.accountPage}`}>
      <Link href="/admin" className={styles.backLink}>
        ← Admin
      </Link>
      <h1 className={styles.pageTitle} style={{ margin: "0.15rem 0 0.25rem" }}>
        Field notebook
      </h1>
      <p style={{ color: "var(--ink-soft)", margin: "0 0 1.75rem", fontSize: "0.92rem" }}>
        The photo strip on the <Link href="/">home page</Link>. Photos expand full-screen when
        visitors click them — captions become the handwritten lines under each print.
      </p>
      <FieldNotesManager />
    </main>
  );
}
