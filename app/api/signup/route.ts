import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { isValidEmail, passwordProblem, usernameProblem } from "@/lib/validation";

// Public self-service signup. Always creates a USER account — privilege is
// never granted here, only by an admin. This is the one account route that
// does NOT require an existing session.
//
// EXTEND HERE: add rate limiting / email verification before going public.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const email = String(body?.email ?? "").trim().toLowerCase();
  const username = String(body?.username ?? "").trim().toLowerCase();
  // Trimmed so the hash matches what authorize() compares against.
  const password = String(body?.password ?? "").trim();
  const name = body?.name ? String(body.name).trim() : null;

  if (!isValidEmail(email)) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }
  const unError = usernameProblem(username);
  if (unError) return NextResponse.json({ error: unError }, { status: 400 });
  const pwError = passwordProblem(password);
  if (pwError) return NextResponse.json({ error: pwError }, { status: 400 });

  const passwordHash = await bcrypt.hash(password, 12);

  try {
    const user = await prisma.user.create({
      data: { email, username, name, role: "USER", passwordHash },
      select: { id: true, email: true, username: true, role: true },
    });
    return NextResponse.json(user, { status: 201 });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      // Unique violation on email or username.
      const target = (err.meta?.target as string[] | undefined)?.join(", ") ?? "account";
      const field = target.includes("username") ? "username" : "email";
      return NextResponse.json({ error: `That ${field} is already taken.` }, { status: 409 });
    }
    throw err;
  }
}
