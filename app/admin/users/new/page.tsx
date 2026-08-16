import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/session";
import UserForm from "../_components/UserForm";
import styles from "../../_components/accountArea.module.css";

export const metadata = { title: "New account — Admin" };

// Create a new account (ADMIN only).
export default async function NewUserPage() {
  const session = await requireAdmin();
  if (session.user.role !== "ADMIN") redirect("/admin");

  return (
    <main className={`${styles.page} ${styles.pageNarrow} ${styles.accountPage}`}>
      <Link href="/admin/users" className={styles.backLink}>
        ← Accounts
      </Link>
      <h1 className={`${styles.pageTitle} ${styles.pageTitleAfterBack}`}>
        New account
      </h1>
      <UserForm />
    </main>
  );
}
