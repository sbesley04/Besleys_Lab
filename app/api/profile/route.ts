import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { requireApiSession } from "@/lib/api";
import { usernameProblem, passwordProblem } from "@/lib/validation";

// Self-service profile updates for the signed-in account. Handles name,
// username, and password changes. A password change requires the current
// password. Users can only ever edit themselves (id comes from the session).
export async function PATCH(req: NextRequest) {
  const auth = await requireApiSession();
  if (auth instanceof NextResponse) return auth;

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid request." }, { status: 400 });

  const me = await prisma.user.findUnique({ where: { id: auth.user.id } });
  if (!me) return NextResponse.json({ error: "Account not found." }, { status: 404 });

  const data: Prisma.UserUpdateInput = {};

  // Name (optional, may be cleared).
  if (typeof body.name === "string") {
    data.name = body.name.trim() || null;
  }

  // Username change.
  if (typeof body.username === "string") {
    const username = body.username.trim().toLowerCase();
    const unError = usernameProblem(username);
    if (unError) return NextResponse.json({ error: unError }, { status: 400 });
    data.username = username;
  }

  // Password change — requires the current password. Trimmed to match what
  // signup hashes and authorize() compares.
  if (body.newPassword) {
    const newPassword = String(body.newPassword).trim();
    const pwError = passwordProblem(newPassword);
    if (pwError) return NextResponse.json({ error: pwError }, { status: 400 });

    const current = String(body.currentPassword ?? "").trim();
    const currentOk =
      (await bcrypt.compare(current, me.passwordHash)) ||
      (await bcrypt.compare(String(body.currentPassword ?? ""), me.passwordHash));
    if (!currentOk) {
      return NextResponse.json({ error: "Current password is incorrect." }, { status: 400 });
    }
    data.passwordHash = await bcrypt.hash(newPassword, 12);
  }

  try {
    const updated = await prisma.user.update({
      where: { id: me.id },
      data,
      select: { id: true, email: true, username: true, name: true, role: true },
    });
    return NextResponse.json(updated);
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return NextResponse.json({ error: "That username is already taken." }, { status: 409 });
    }
    throw err;
  }
}

// Self-service account deletion, backing the "delete your data on request"
// promise in the privacy policy. Requires the current password as
// confirmation. Restricted to plain USER accounts: EDITOR/ADMIN are the
// site's staff, may own Post/Project rows (which aren't cascade-deleted —
// see schema), and losing the only admin would lock the site's owner out.
// Staff account removal stays an admin-only action via /api/users/[id].
export async function DELETE(req: NextRequest) {
  const auth = await requireApiSession();
  if (auth instanceof NextResponse) return auth;

  const me = await prisma.user.findUnique({ where: { id: auth.user.id } });
  if (!me) return NextResponse.json({ error: "Account not found." }, { status: 404 });

  if (me.role !== "USER") {
    return NextResponse.json(
      { error: "Staff accounts can't be self-deleted — contact the site admin." },
      { status: 403 },
    );
  }

  const body = await req.json().catch(() => null);
  const password = String(body?.password ?? "").trim();
  const passwordOk =
    (await bcrypt.compare(password, me.passwordHash)) ||
    (await bcrypt.compare(String(body?.password ?? ""), me.passwordHash));
  if (!passwordOk) {
    return NextResponse.json({ error: "Password is incorrect." }, { status: 400 });
  }

  // Cascades to Account, Session, GameSave, Roster, SimulationRun,
  // BookReview, Achievement, and GameResult rows (all `onDelete: Cascade`
  // in schema.prisma) — nothing further to clean up by hand.
  await prisma.user.delete({ where: { id: me.id } });
  return NextResponse.json({ ok: true });
}
