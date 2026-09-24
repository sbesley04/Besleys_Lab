import { randomInt } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { accrue, applyAction, dayKey, newWallet, normalizeWallet, type Outcome, type Wallet, type WalletAction } from "@/lib/wallet";

// Server side of the zinc wallet. Every read/modify/write goes through
// `withWallet`, which:
//   1. loads (or creates) the user's row,
//   2. pays out passive income up to now,
//   3. applies the action with a crypto rng,
//   4. writes back only if nobody else wrote in between (version check),
//      retrying from step 1 if they did.

const MAX_ATTEMPTS = 12;

export class WalletBusyError extends Error {
  constructor() {
    super("Wallet is busy — too many concurrent updates.");
  }
}

/** Back off a little (with jitter) so racing writers stop colliding in lockstep. */
const backoff = (attempt: number) =>
  new Promise((resolve) => setTimeout(resolve, Math.random() * 8 * (attempt + 1)));

/** Uniform in [0, 1) from the OS CSPRNG — spins can't be predicted client-side. */
export function cryptoRng(): number {
  return randomInt(0, 2 ** 32) / 2 ** 32;
}

/** Clamp a client-reported timezone offset (minutes east of UTC). */
export function offsetFrom(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(-840, Math.min(840, Math.round(value))) : 0;
}

export type WalletResponse =
  | { ok: true; wallet: Wallet; accrued: number; outcome: Outcome | null }
  | { ok: false; error: string; wallet: Wallet; accrued: number };

async function load(userId: string, now: number, action: WalletAction | null) {
  const row = await prisma.wallet.findUnique({ where: { userId } });
  if (row) {
    let data: unknown = null;
    try {
      data = JSON.parse(row.data);
    } catch {
      /* corrupt row: normalizeWallet starts it fresh */
    }
    return { id: row.id, version: row.version, wallet: normalizeWallet(data, now) };
  }
  // First visit: back-pay the achievements this account already holds — minus
  // any being credited by this very action, which are already in the count.
  const trophies = await prisma.achievement.count({ where: { userId } });
  const crediting = action?.type === "achievements" ? action.count : 0;
  const wallet = newWallet(now, trophies - crediting);
  try {
    const created = await prisma.wallet.create({
      data: { userId, balance: wallet.balance, data: JSON.stringify(wallet) },
    });
    return { id: created.id, version: created.version, wallet };
  } catch (err) {
    // Two first requests raced to create the row; the other one won.
    if ((err as { code?: string }).code !== "P2002") throw err;
    return null;
  }
}

/**
 * Run an action (or `null` to just accrue and read) against a user's wallet.
 * `offsetMinutes` is the visitor's timezone, so "daily" means their day.
 */
export async function withWallet(userId: string, action: WalletAction | null, offsetMinutes = 0): Promise<WalletResponse> {
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    if (attempt > 0) await backoff(attempt);
    const now = Date.now();
    const loaded = await load(userId, now, action);
    if (!loaded) continue;

    const { wallet: accrued, earned } = accrue(loaded.wallet, now);
    let next = accrued;
    let outcome: Outcome | null = null;
    let error: string | null = null;

    if (action) {
      const res = applyAction(accrued, action, dayKey(now, offsetMinutes), cryptoRng);
      if (res.ok) {
        next = res.wallet;
        outcome = res.outcome;
      } else {
        error = res.error;
      }
    }

    // Nothing changed (a failed action on a wallet with nothing to accrue):
    // skip the write entirely.
    const dirty = next !== accrued || earned > 0 || accrued.accruedAt !== loaded.wallet.accruedAt;
    if (dirty) {
      const { count } = await prisma.wallet.updateMany({
        where: { id: loaded.id, version: loaded.version },
        data: { balance: next.balance, data: JSON.stringify(next), version: { increment: 1 } },
      });
      if (count === 0) continue; // lost a race — re-read and try again
    }

    return error
      ? { ok: false, error, wallet: next, accrued: earned }
      : { ok: true, wallet: next, accrued: earned, outcome };
  }
  throw new WalletBusyError();
}
