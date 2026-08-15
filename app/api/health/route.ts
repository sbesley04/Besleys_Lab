import { NextResponse } from "next/server";

// Public liveness check. Detailed environment and database diagnostics belong
// in server logs; exposing them here gives attackers a useful configuration
// and schema probe.
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { prisma } = await import("@/lib/prisma");
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Health check failed", err);
    return NextResponse.json({ ok: false }, { status: 503 });
  }
}
