import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/session";
import UserForm from "../_components/UserForm";

// Create a new account (ADMIN only).
export default async function NewUserPage() {
  const session = await requireAdmin();
  if (session.user.role !== "ADMIN") redirect("/admin");

  return (
    <main style={{ maxWidth: 560, margin: "0 auto", padding: "3.5rem 1.5rem" }}>
      <Link href="/admin/users" style={{ fontSize: "0.9rem" }}>
        ← Accounts
      </Link>
      <h1 style={{ fontFamily: "var(--font-display)", fontSize: "2.4rem", margin: "0.5rem 0 1.5rem" }}>
        New account
      </h1>
      <UserForm />
    </main>
  );
}
