// ---------------------------------------------------------------------------
// The wallet — zinc (Zn), the arcade's house currency. Pure rules only: no
// React, no DOM, no Prisma. `now` and `rng` are always parameters.
//
// The same `applyAction()` runs in two places:
//   • the server (/api/wallet) for signed-in visitors — the database row is
//     the source of truth and spins use a crypto rng, so a balance can't be
//     edited from devtools;
//   • the browser (lib/walletClient.ts) for guests, persisted to localStorage.
//
// How zinc comes in:
//   passive  — RATE_PER_HOUR accrues while you're away, capped at CAP_HOURS
//   daily    — DAILY_BONUS once per calendar day
//   wins     — WIN_BONUS for the first win in each game each day
//   trophies — ACHIEVEMENT_BONUS per achievement unlocked
// and goes out through the slot machine and the prize counter.
// ---------------------------------------------------------------------------

import { spin, isValidBet, type SpinResult } from "../app/games/casino/slots.ts";
import { PRIZES_BY_ID, capsuleKey, pickCapsule, pickFortune, type Capsule, type Prize } from "./prizes.ts";

export const CURRENCY = { name: "zinc", symbol: "Zn" } as const;

export const STARTING_BALANCE = 100;
export const RATE_PER_HOUR = 20;
export const HOPPER_RATE_PER_HOUR = 35;
export const CAP_HOURS = 12;
export const PIGGY_CAP_HOURS = 24;
export const DAILY_BONUS = 50;
export const WIN_BONUS = 15;
export const ACHIEVEMENT_BONUS = 25;
/** Refuse to grow past this — keeps the Int column and the UI sane. */
export const MAX_BALANCE = 1_000_000_000;

const HOUR = 3_600_000;

export interface WalletStats {
  earned: number;
  wagered: number;
  won: number;
  spent: number;
  spins: number;
  biggestWin: number;
}

export interface Wallet {
  balance: number;
  /** Epoch ms the passive-income clock has been paid up to. */
  accruedAt: number;
  /** Local calendar day (YYYY-MM-DD) the daily bonus was last claimed. */
  dailyOn: string | null;
  /** Day the per-game win bonuses below belong to. */
  winDay: string | null;
  winGames: string[];
  /** Prize id (or capsule key) → how many owned. */
  owned: Record<string, number>;
  stats: WalletStats;
}

export function newWallet(now: number, achievementsAlreadyUnlocked = 0): Wallet {
  const backpay = Math.max(0, Math.floor(achievementsAlreadyUnlocked)) * ACHIEVEMENT_BONUS;
  return {
    balance: STARTING_BALANCE + backpay,
    accruedAt: now,
    dailyOn: null,
    winDay: null,
    winGames: [],
    owned: {},
    stats: { earned: STARTING_BALANCE + backpay, wagered: 0, won: 0, spent: 0, spins: 0, biggestWin: 0 },
  };
}

const int = (v: unknown, fallback = 0) =>
  typeof v === "number" && Number.isFinite(v) ? Math.max(0, Math.floor(v)) : fallback;

/** Parse anything (a DB JSON column, localStorage) into a well-formed wallet. */
export function normalizeWallet(raw: unknown, now: number): Wallet {
  if (!raw || typeof raw !== "object") return newWallet(now);
  const r = raw as Partial<Wallet> & { stats?: Partial<WalletStats> };
  const owned: Record<string, number> = {};
  if (r.owned && typeof r.owned === "object") {
    for (const [k, v] of Object.entries(r.owned)) {
      const n = int(v);
      if (n > 0 && k.length <= 64) owned[k] = n;
    }
  }
  const s: Partial<WalletStats> = r.stats ?? {};
  return {
    balance: Math.min(MAX_BALANCE, int(r.balance, STARTING_BALANCE)),
    accruedAt: typeof r.accruedAt === "number" && Number.isFinite(r.accruedAt) ? r.accruedAt : now,
    dailyOn: typeof r.dailyOn === "string" ? r.dailyOn : null,
    winDay: typeof r.winDay === "string" ? r.winDay : null,
    winGames: Array.isArray(r.winGames) ? r.winGames.filter((g): g is string => typeof g === "string").slice(0, 64) : [],
    owned,
    stats: {
      earned: int(s.earned), wagered: int(s.wagered), won: int(s.won),
      spent: int(s.spent), spins: int(s.spins), biggestWin: int(s.biggestWin),
    },
  };
}

export const owns = (w: Wallet, id: string) => (w.owned[id] ?? 0) > 0;
export const rateOf = (w: Wallet) => (owns(w, "coin-hopper") ? HOPPER_RATE_PER_HOUR : RATE_PER_HOUR);
export const capHoursOf = (w: Wallet) => (owns(w, "piggy-bank") ? PIGGY_CAP_HOURS : CAP_HOURS);

/** YYYY-MM-DD in the given UTC offset (minutes east, like -getTimezoneOffset()). */
export function dayKey(now: number, offsetMinutes = 0): string {
  return new Date(now + offsetMinutes * 60_000).toISOString().slice(0, 10);
}

function credit(w: Wallet, amount: number): Wallet {
  const add = Math.max(0, Math.min(Math.floor(amount), MAX_BALANCE - w.balance));
  return { ...w, balance: w.balance + add, stats: { ...w.stats, earned: w.stats.earned + add } };
}

/**
 * Pay out passive income up to `now`. Whole tokens only; the fractional
 * remainder stays on the clock so nothing leaks between visits. Time away
 * beyond the cap is forfeited (that's the point of the piggy bank).
 */
export function accrue(w: Wallet, now: number): { wallet: Wallet; earned: number } {
  // A clock that went backwards (device time changed) just restarts the meter.
  if (now < w.accruedAt) return { wallet: { ...w, accruedAt: now }, earned: 0 };

  const rate = rateOf(w);
  const capMs = capHoursOf(w) * HOUR;
  const elapsed = now - w.accruedAt;
  const payable = Math.min(elapsed, capMs);
  const earned = Math.floor((payable * rate) / HOUR);

  let accruedAt: number;
  if (elapsed >= capMs) accruedAt = now; // capped: the rest is forfeited
  else accruedAt = w.accruedAt + Math.ceil((earned * HOUR) / rate);
  if (accruedAt > now) accruedAt = now;

  return { wallet: { ...credit(w, earned), accruedAt }, earned };
}

/** Milliseconds until the next whole token accrues (for a countdown). */
export function msToNextToken(w: Wallet, now: number): number {
  const per = HOUR / rateOf(w);
  const into = Math.max(0, now - w.accruedAt) % per;
  return Math.ceil(per - into);
}

export const canClaimDaily = (w: Wallet, today: string) => w.dailyOn !== today;

// --- actions -------------------------------------------------------------------

export type WalletAction =
  | { type: "daily" }
  | { type: "win"; game: string }
  | { type: "spin"; bet: number }
  | { type: "buy"; id: string }
  /** Server/local internal only — never accepted from a request body. */
  | { type: "achievements"; count: number };

export type Outcome =
  | { type: "daily"; amount: number }
  | { type: "win"; amount: number }
  | { type: "spin"; spin: SpinResult }
  | { type: "buy"; prize: Prize; fortune?: string; capsule?: Capsule; duplicate?: boolean }
  | { type: "achievements"; amount: number };

export type ActionResult = { ok: true; wallet: Wallet; outcome: Outcome } | { ok: false; error: string };

/**
 * Apply one action. Callers accrue first (so the balance is current), then
 * apply, then persist. `today` is the visitor's local calendar day.
 */
export function applyAction(w: Wallet, action: WalletAction, today: string, rng: () => number): ActionResult {
  switch (action.type) {
    case "daily": {
      if (!canClaimDaily(w, today)) return { ok: false, error: "Already claimed today — come back tomorrow." };
      const next = credit({ ...w, dailyOn: today }, DAILY_BONUS);
      return { ok: true, wallet: next, outcome: { type: "daily", amount: next.balance - w.balance } };
    }

    case "win": {
      const games = w.winDay === today ? w.winGames : [];
      if (games.includes(action.game)) {
        return { ok: true, wallet: w, outcome: { type: "win", amount: 0 } };
      }
      const next = credit({ ...w, winDay: today, winGames: [...games, action.game] }, WIN_BONUS);
      return { ok: true, wallet: next, outcome: { type: "win", amount: next.balance - w.balance } };
    }

    case "achievements": {
      const next = credit(w, Math.max(0, Math.floor(action.count)) * ACHIEVEMENT_BONUS);
      return { ok: true, wallet: next, outcome: { type: "achievements", amount: next.balance - w.balance } };
    }

    case "spin": {
      if (!isValidBet(action.bet)) return { ok: false, error: "That's not a bet the machine takes." };
      if (action.bet > w.balance) return { ok: false, error: "Not enough zinc for that bet." };
      const result = spin(action.bet, rng);
      const afterBet = w.balance - action.bet;
      const payout = Math.min(result.payout, MAX_BALANCE - afterBet);
      const stats = {
        ...w.stats,
        wagered: w.stats.wagered + action.bet,
        won: w.stats.won + payout,
        spins: w.stats.spins + 1,
        biggestWin: Math.max(w.stats.biggestWin, payout),
      };
      return {
        ok: true,
        wallet: { ...w, balance: afterBet + payout, stats },
        outcome: { type: "spin", spin: { ...result, payout } },
      };
    }

    case "buy": {
      const prize = PRIZES_BY_ID.get(action.id);
      if (!prize) return { ok: false, error: "The counter doesn't stock that." };
      if (prize.kind !== "consumable" && owns(w, prize.id)) return { ok: false, error: "You already own that." };
      if (prize.price > w.balance) return { ok: false, error: "Not enough zinc." };

      const owned = { ...w.owned, [prize.id]: (w.owned[prize.id] ?? 0) + 1 };
      const outcome: Outcome = { type: "buy", prize };
      if (prize.id === "fortune-cookie") outcome.fortune = pickFortune(rng);
      if (prize.id === "capsule") {
        const capsule = pickCapsule(rng);
        const key = capsuleKey(capsule.id);
        outcome.capsule = capsule;
        outcome.duplicate = (owned[key] ?? 0) > 0;
        owned[key] = (owned[key] ?? 0) + 1;
      }
      const stats = { ...w.stats, spent: w.stats.spent + prize.price };
      return { ok: true, wallet: { ...w, balance: w.balance - prize.price, owned, stats }, outcome };
    }
  }
}

/** Parse an untrusted request body into a client-allowed action. */
export function parseClientAction(body: unknown): WalletAction | null {
  if (!body || typeof body !== "object") return null;
  const b = body as Record<string, unknown>;
  switch (b.type) {
    case "daily":
      return { type: "daily" };
    case "win":
      return typeof b.game === "string" && b.game.length <= 64 ? { type: "win", game: b.game } : null;
    case "spin":
      return isValidBet(b.bet) ? { type: "spin", bet: b.bet } : null;
    case "buy":
      return typeof b.id === "string" && b.id.length <= 64 ? { type: "buy", id: b.id } : null;
    default:
      return null;
  }
}
