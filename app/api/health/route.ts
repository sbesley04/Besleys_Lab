import { NextResponse } from "next/server";

// Deployment diagnostics: GET /api/health reports whether the runtime
// environment is wired up correctly — env vars present (never their values)
// and whether the database actually answers. Safe to leave enabled; it
// exposes booleans only.
export const dynamic = "force-dynamic";

export async function GET() {
  const dbUrl = process.env.DATABASE_URL ?? "";
  const scheme = dbUrl ? (dbUrl.split(":")[0] || "unknown") : null;

  const env = {
    DATABASE_URL: dbUrl ? `set (${scheme})` : "MISSING",
    NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET ? "set" : "MISSING",
    NEXTAUTH_URL: process.env.NEXTAUTH_URL ? "set" : "not set (fine on Vercel)",
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL ? "set" : "not set (OG/sitemap fall back to localhost)",
    VERCEL: process.env.VERCEL ? "yes" : "no",
  };

  // Import prisma lazily: if DATABASE_URL is missing, the client constructor
  // throws at import time and would kill this route before it could report.
  let database = "unknown";
  let userCount: number | string = "unknown";
  try {
    const { prisma } = await import("@/lib/prisma");
    await prisma.$queryRaw`SELECT 1`;
    database = "connected";
    try {
      userCount = await prisma.user.count();
    } catch {
      userCount = "tables missing — did `prisma db push` run in the build?";
    }
  } catch (err) {
    database = `FAILED: ${err instanceof Error ? err.message.split("\n")[0].slice(0, 200) : "unknown error"}`;
  }

  const ok = database === "connected" && env.NEXTAUTH_SECRET === "set" && typeof userCount === "number";

  return NextResponse.json(
    {
      ok,
      env,
      database,
      adminSeeded: typeof userCount === "number" ? userCount > 0 : userCount,
      hint: ok
        ? "All good. If pages still error, check the function logs in the Vercel dashboard."
        : "Fix the MISSING/FAILED items above in Vercel → Project → Settings → Environment Variables, then redeploy.",
    },
    { status: ok ? 200 : 500 },
  );
}
