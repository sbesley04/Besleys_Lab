import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiSession } from "@/lib/api";
import { ACHIEVEMENT_KEYS } from "@/lib/achievements";

// Per-user achievement unlocks.
//   GET  /api/achievements          → my unlocked keys + timestamps
//   POST /api/achievements          → { keys: string[] } — unlock (idempotent),
//                                     responds with the keys that were new
//
// Unknown keys are ignored rather than erroring so an old client with a stale
// registry can't fail the whole batch. Rows are scoped to the session user.

export async function GET() {
  const auth = await requireApiSession();
  if (auth instanceof NextResponse) return auth;

  const rows = await prisma.achievement.findMany({
    where: { userId: auth.user.id },
    select: { key: true, unlockedAt: true },
    orderBy: { unlockedAt: "asc" },
  });
  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  const auth = await requireApiSession();
  if (auth instanceof NextResponse) return auth;

  const body = await req.json().catch(() => null);
  const keys: unknown = body?.keys;
  if (!Array.isArray(keys) || keys.length === 0 || keys.length > 20) {
    return NextResponse.json({ error: "Provide 1–20 achievement keys." }, { status: 400 });
  }

  const valid = [...new Set(keys.filter((k): k is string => typeof k === "string" && ACHIEVEMENT_KEYS.has(k)))];
  if (valid.length === 0) return NextResponse.json({ unlocked: [] });

  const existing = await prisma.achievement.findMany({
    where: { userId: auth.user.id, key: { in: valid } },
    select: { key: true },
  });
  const have = new Set(existing.map((r) => r.key));
  const candidates = valid.filter((k) => !have.has(k));

  // Two unlocks can land at once — a game calling unlock() while the toaster
  // flushes the local cache on the same pageview — and both would pass the
  // check above. `skipDuplicates` isn't supported on SQLite, so each row is
  // inserted independently and a lost race (P2002) just means someone else
  // already recorded it. Anything else is a real failure and still throws.
  const unlocked: string[] = [];
  await Promise.all(
    candidates.map(async (key) => {
      try {
        await prisma.achievement.create({ data: { userId: auth.user.id, key } });
        unlocked.push(key);
      } catch (err) {
        const code = (err as { code?: string }).code;
        if (code !== "P2002") throw err;
      }
    }),
  );
  return NextResponse.json({ unlocked });
}
