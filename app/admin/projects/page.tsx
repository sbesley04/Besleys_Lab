import Link from "next/link";
import { requireStaff } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { primaryButton } from "../_components/formStyles";

// Admin projects index — every project (drafts included) with status + edit links.
export const dynamic = "force-dynamic";

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
    <main style={{ maxWidth: 760, margin: "0 auto", padding: "3.5rem 1.5rem" }}>
      <Link href="/admin" style={{ fontSize: "0.9rem" }}>
        ← Dashboard
      </Link>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          margin: "0.5rem 0 1.5rem",
          gap: "1rem",
        }}
      >
        <h1 style={{ fontFamily: "var(--font-display)", fontSize: "2.4rem", margin: 0 }}>
          Projects
        </h1>
        <Link href="/admin/projects/new" style={{ ...primaryButton, textDecoration: "none" }}>
          New project
        </Link>
      </div>

      {projects.length === 0 ? (
        <p style={{ color: "var(--ink-soft)" }}>No projects yet. Add your first one.</p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: "0.75rem" }}>
          {projects.map((p) => (
            <li key={p.id}>
              <Link
                href={`/admin/projects/${p.id}`}
                className="paper-card"
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "1rem",
                  padding: "0.9rem 1.1rem",
                  color: "var(--ink)",
                }}
              >
                <span style={{ fontWeight: 500 }}>
                  {p.title}
                  {isAdmin && (
                    <span style={{ color: "var(--ink-soft)", fontWeight: 400, fontSize: "0.82rem" }}>
                      {" "}· @{p.author.username || p.author.email}
                    </span>
                  )}
                </span>
                <span
                  style={{
                    fontSize: "0.72rem",
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                    padding: "0.15rem 0.5rem",
                    borderRadius: 999,
                    border: "1px solid var(--line)",
                    color: p.published ? "var(--accent)" : "var(--ink-soft)",
                  }}
                >
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
