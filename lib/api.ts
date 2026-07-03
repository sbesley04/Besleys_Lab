import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isStaff } from "@/lib/validation";

// Guard for API route handlers. Returns the session, or a 401 Response to
// return early from the handler. Usage:
//
//   const auth = await requireApiSession();
//   if (auth instanceof NextResponse) return auth;
//   // ...auth.user is available here
//
// EXTEND HERE: add role checks (e.g. require "ADMIN") as permissions grow.
export async function requireApiSession() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return session;
}

// Content management guard: requires EDITOR or ADMIN. Plain USERs get 403.
export async function requireApiStaff() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isStaff(session.user.role)) {
    return NextResponse.json({ error: "Forbidden — staff only." }, { status: 403 });
  }
  return session;
}

// Stricter guard for sensitive actions (e.g. creating accounts): requires a
// session AND the ADMIN role. EDITOR/USER are rejected with 403.
export async function requireApiAdmin() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden — admin only." }, { status: 403 });
  }
  return session;
}
