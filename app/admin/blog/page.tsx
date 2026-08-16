import Link from "next/link";
import { requireStaff } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { primaryButton } from "../_components/formStyles";
import styles from "../_components/accountArea.module.css";

// Admin blog index — lists every post (drafts included) with status + edit links.
export const dynamic = "force-dynamic";
export const metadata = { title: "Posts — Admin" };

export default async function AdminBlogList() {
  const session = await requireStaff();
  const isAdmin = session.user.role === "ADMIN";

  // Admins see every post; editors see only their own.
  const posts = await prisma.post.findMany({
    where: isAdmin ? undefined : { authorId: session.user.id },
    orderBy: { updatedAt: "desc" },
    include: { author: { select: { username: true, email: true } } },
  });

  return (
    <main className={`${styles.page} ${styles.accountPage}`}>
      <Link href="/admin" className={styles.backLink}>
        ← Dashboard
      </Link>
      <div className={styles.listHeader}>
        <h1 className={styles.pageTitle}>Posts</h1>
        <Link href="/admin/blog/new" className={styles.primaryLink} style={{ ...primaryButton, textDecoration: "none" }}>
          New post
        </Link>
      </div>

      {posts.length === 0 ? (
        <p style={{ color: "var(--ink-soft)" }}>No posts yet. Create your first one.</p>
      ) : (
        <ul className={styles.recordList}>
          {posts.map((p) => (
            <li key={p.id}>
              <Link
                href={`/admin/blog/${p.id}`}
                className={`paper-card ${styles.recordLink}`}
              >
                <span className={styles.recordPrimary}>
                  {p.title}
                  {isAdmin && (
                    <span className={styles.recordSecondary}>
                      {" "}· @{p.author.username || p.author.email}
                    </span>
                  )}
                </span>
                <span className={styles.statusBadge} style={{ color: p.published ? "var(--accent)" : "var(--ink-soft)" }}>
                  {p.published ? "Published" : "Draft"}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
