import Link from "next/link";
import { requireStaff } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { primaryButton } from "../_components/formStyles";
import styles from "../_components/accountArea.module.css";

// Admin projects index — every project (drafts included) with status + edit links.
export const dynamic = "force-dynamic";
export const metadata = { title: "Projects — Admin" };

export default async function AdminProjectsList() {
  const session = await requireStaff();
  const isAdmin = session.user.role === "ADMIN";

  // Admins see every project; editors see only their own.
  const projects = await prisma.project.findMany({
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
        <h1 className={styles.pageTitle}>Projects</h1>
        <Link href="/admin/projects/new" className={styles.primaryLink} style={{ ...primaryButton, textDecoration: "none" }}>
          New project
        </Link>
      </div>

      {projects.length === 0 ? (
        <p style={{ color: "var(--ink-soft)" }}>No projects yet. Add your first one.</p>
      ) : (
        <ul className={styles.recordList}>
          {projects.map((p) => (
            <li key={p.id}>
              <Link
                href={`/admin/projects/${p.id}`}
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
