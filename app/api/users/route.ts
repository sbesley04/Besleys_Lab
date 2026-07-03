import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { requireApiAdmin } from "@/lib/api";
import { isValidEmail, passwordProblem, usernameProblem, normalizeRole } from "@/lib/validation";

// Account management (ADMIN only). There is deliberately NO public signup —
// this is a single-operator site, so accounts are created by an existing admin.
//   GET  /api/users → list accounts (no password hashes)
//   POST /api/users → create an account

export async function GET() {
  const auth = await requireApiAdmin();
  if (auth instanceof NextResponse) return auth;

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "asc" },
    select: { id: true, email: true, username: true, name: true, role: true, createdAt: true },
  });
  return NextResponse.json(users);
}

export async function POST(req: NextRequest) {
  const auth = await requireApiAdmin();
  if (auth instanceof NextResponse) return auth;

  const body = await req.json().catch(() => null);
  const email = String(body?.email ?? "").trim().toLowerCase();
  const username = String(body?.username ?? "").trim().toLowerCase();
  const password = String(body?.password ?? "");
  const name = body?.name ? String(body.name).trim() : null;
  const role = normalizeRole(body?.role);

  if (!isValidEmail(email)) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }
  const unError = usernameProblem(username);
  if (unError) return NextResponse.json({ error: unError }, { status: 400 });
  const pwError = passwordProblem(password);
  if (pwError) {
    return NextResponse.json({ error: pwError }, { status: 400 });
  }

  const passwordHash = await bcrypt.hash(password, 12);

  try {
    const user = await prisma.user.create({
      data: { email, username, name, role, passwordHash },
      select: { id: true, email: true, username: true, name: true, role: true, createdAt: true },
    });
    return NextResponse.json(user, { status: 201 });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      const target = (err.meta?.target as string[] | undefined)?.join(", ") ?? "email";
      const fieldName = target.includes("username") ? "username" : "email";
      return NextResponse.json({ error: `That ${fieldName} is already taken.` }, { status: 409 });
    }
    throw err;
  }
}
