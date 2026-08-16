import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { primaryButton } from "../_components/formStyles";
import DeleteUserButton from "./_components/DeleteUserButton";
import styles from "../_components/accountArea.module.css";

// Account management list (ADMIN only). EDITOR users are bounced to the
// dashboard — only admins manage accounts.
export const dynamic = "force-dynamic";
export const metadata = { title: "Accounts — Admin" };

export default async function AdminUsersList() {
  const session = await requireAdmin();
  if (session.user.role !== "ADMIN") redirect("/admin");

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "asc" },
    select: { id: true, email: true, username: true, name: true, role: true },
  });

  return (
    <main className={`${styles.page} ${styles.accountPage}`}>
      <Link href="/admin" className={styles.backLink}>
        ← Dashboard
      </Link>
      <div className={styles.listHeader}>
        <h1 className={styles.pageTitle}>Accounts</h1>
        <Link href="/admin/users/new" className={styles.primaryLink} style={{ ...primaryButton, textDecoration: "none" }}>
          New account
        </Link>
      </div>

      <ul className={styles.recordList}>
        {users.map((u) => (
          <li
            key={u.id}
            className={`paper-card ${styles.userRow} ${styles.staticCard}`}
          >
            <div className={styles.userIdentity}>
              <span style={{ fontWeight: 500 }}>{u.username ? `@${u.username}` : u.name || u.email}</span>
              <span style={{ color: "var(--ink-soft)", fontSize: "0.85rem" }}> · {u.email}</span>
            </div>
            <div className={styles.userActions}>
              <span className={styles.statusBadge}>
                {u.role}
              </span>
              {u.id === session.user.id ? (
                <span style={{ fontSize: "0.8rem", color: "var(--ink-soft)" }}>you</span>
              ) : (
                <DeleteUserButton id={u.id} email={u.email} />
              )}
            </div>
          </li>
        ))}
      </ul>
    </main>
  );
}
