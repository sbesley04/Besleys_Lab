import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { primaryButton } from "../_components/formStyles";
import DeleteUserButton from "./_components/DeleteUserButton";

// Account management list (ADMIN only). EDITOR users are bounced to the
// dashboard — only admins manage accounts.
export const dynamic = "force-dynamic";

export default async function AdminUsersList() {
  const session = await requireAdmin();
  if (session.user.role !== "ADMIN") redirect("/admin");

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "asc" },
    select: { id: true, email: true, username: true, name: true, role: true },
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
          Accounts
        </h1>
        <Link href="/admin/users/new" style={{ ...primaryButton, textDecoration: "none" }}>
          New account
        </Link>
      </div>

      <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: "0.75rem" }}>
        {users.map((u) => (
          <li
            key={u.id}
            className="paper-card"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "1rem",
              padding: "0.9rem 1.1rem",
            }}
          >
            <div>
              <span style={{ fontWeight: 500 }}>{u.username ? `@${u.username}` : u.name || u.email}</span>
              <span style={{ color: "var(--ink-soft)", fontSize: "0.85rem" }}> · {u.email}</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
              <span
                style={{
                  fontSize: "0.72rem",
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  padding: "0.15rem 0.5rem",
                  borderRadius: 999,
                  border: "1px solid var(--line)",
                  color: "var(--ink-soft)",
                }}
              >
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
