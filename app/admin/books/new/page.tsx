import Link from "next/link";
import { requireStaff } from "@/lib/session";
import BookForm from "../_components/BookForm";
import styles from "../../_components/accountArea.module.css";

export const metadata = { title: "New book — Admin" };

export default async function NewBookPage() {
  await requireStaff();

  return (
    <main className={`${styles.page} ${styles.pageWide} ${styles.accountPage}`}>
      <Link href="/admin/books" className={styles.backLink}>
        ← Library
      </Link>
      <h1 className={`${styles.pageTitle} ${styles.pageTitleAfterBack}`}>
        Add a book
      </h1>
      <BookForm />
    </main>
  );
}
