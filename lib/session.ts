import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { isStaff } from "@/lib/validation";

// Server-side session helpers for pages/Server Components. Three privilege
// tiers, redirecting when the requirement isn't met:
//
//   requireUser()  → any signed-in account        (USER, EDITOR, ADMIN)
//   requireStaff() → content management            (EDITOR, ADMIN)
//   requireAdmin() → account & settings management (ADMIN only)
//
// API route equivalents live in lib/api.ts.

export function getSession() {
  return getServerSession(authOptions);
}

/** Any authenticated account. Redirects guests to the login page. */
export async function requireUser() {
  const session = await getSession();
  if (!session?.user) redirect("/login");
  return session;
}

/** EDITOR or ADMIN. Guests → login; signed-in USERs → home. */
export async function requireStaff() {
  const session = await getSession();
  if (!session?.user) redirect("/login");
  if (!isStaff(session.user.role)) redirect("/");
  return session;
}

/** ADMIN only. Guests → login; non-admins → home. */
export async function requireAdmin() {
  const session = await getSession();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "ADMIN") redirect("/");
  return session;
}
