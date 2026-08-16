import Link from "next/link";
import { requireStaff } from "@/lib/session";
import PostForm from "../_components/PostForm";
import styles from "../../_components/accountArea.module.css";

export const metadata = { title: "New post — Admin" };

// Create a new post. Guarded server-side; the form itself is a client island.
export default async function NewPostPage() {
  await requireStaff();

  return (
    <main className={`${styles.page} ${styles.pageEditor} ${styles.accountPage}`}>
      <Link href="/admin/blog" className={styles.backLink}>
        ← Posts
      </Link>
      <h1 className={`${styles.pageTitle} ${styles.pageTitleAfterBack}`}>
        New post
      </h1>
      <PostForm />
    </main>
  );
}
