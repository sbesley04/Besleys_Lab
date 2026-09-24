// ---------------------------------------------------------------------------
// The slot machine — pure rules. No React, no DOM, rng injectable.
//
// Three physical-style reels, one payline (the middle row). A spin picks one
// stop per reel uniformly; the window shows the stop plus its neighbours so
// the reels look continuous. Zinc (the house token, "Zn") is wild: it fills in
// for any symbol in a three-of-a-kind, and three of them is the jackpot.
//
// Because every stop is equally likely, the machine's exact return-to-player
// is a finite sum over STOPS³ outcomes — `exactReturn()` computes it, and the
// test suite pins it inside a band. Retune the strips or the paytable and the
// test tells you immediately whether the house still has a (small) edge.
// ---------------------------------------------------------------------------

export type SlotSymbol = "cherry" | "lemon" | "clover" | "bell" | "bar" | "seven" | "zinc";

export const SYMBOLS: SlotSymbol[] = ["cherry", "lemon", "clover", "bell", "bar", "seven", "zinc"];

/** Display glyphs. Kept here so the paytable and the reels can't disagree. */
export const SYMBOL_LABEL: Record<SlotSymbol, string> = {
  cherry: "Cherry",
  lemon: "Lemon",
  clover: "Clover",
  bell: "Bell",
  bar: "Bar",
  seven: "Seven",
  zinc: "Zinc (wild)",
};

// Reel strips, top to bottom. Written out rather than generated so the order —
// what sits next to what — is deliberate: sevens and zinc are spaced out so a
// near miss shows up often enough to be tense, not so often it feels rigged.
const C = "cherry", L = "lemon", K = "clover", B = "bell", R = "bar", S = "seven", Z = "zinc";

export const REELS: SlotSymbol[][] = [
  [C, L, K, R, L, B, C, S, L, K, C, B, L, R, K, Z, L, C, B, K, L, S] as SlotSymbol[],
  [L, K, B, C, R, L, K, S, B, L, C, K, R, L, B, Z, K, L, C, B, K, R] as SlotSymbol[],
  [K, L, B, R, C, L, K, B, S, L, K, C, R, B, L, K, Z, C, L, B, K, L] as SlotSymbol[],
];

/** Three-of-a-kind payouts, as a multiple of the bet (stake included). */
export const THREE_KIND: Record<SlotSymbol, number> = {
  zinc: 250,
  seven: 100,
  bar: 30,
  bell: 15,
  clover: 8,
  lemon: 5,
  cherry: 10,
};

/** Cherries counted from the left edge that didn't make a three-of-a-kind. */
export const CHERRY_PAYS: Record<number, number> = { 1: 1, 2: 4 };

export const BETS = [1, 5, 10, 25, 50, 100] as const;
export const MAX_BET = 100;

export interface LineResult {
  /** Multiplier of the bet (0 = loss). */
  multiplier: number;
  /** Human label for the win, or null for a loss. */
  label: string | null;
  kind: "jackpot" | "three" | "cherries" | "none";
}

/** Score a payline of three symbols. */
export function evaluateLine(line: SlotSymbol[]): LineResult {
  if (line.every((s) => s === "zinc")) {
    return { multiplier: THREE_KIND.zinc, label: "Zn Zn Zn — jackpot", kind: "jackpot" };
  }
  const real = line.filter((s) => s !== "zinc");
  if (real.every((s) => s === real[0])) {
    const sym = real[0];
    const wild = real.length < 3 ? " (with wild)" : "";
    return { multiplier: THREE_KIND[sym], label: `Three ${SYMBOL_LABEL[sym].toLowerCase()}s${wild}`, kind: "three" };
  }
  let lead = 0;
  while (lead < line.length && line[lead] === "cherry") lead++;
  const pay = CHERRY_PAYS[lead] ?? 0;
  if (pay > 0) {
    return { multiplier: pay, label: lead === 1 ? "A cherry" : `${lead} cherries`, kind: "cherries" };
  }
  return { multiplier: 0, label: null, kind: "none" };
}

export interface SpinResult {
  /** Stop index per reel — the symbol on the payline. */
  stops: number[];
  /** The payline (middle row). */
  line: SlotSymbol[];
  /** Rows above/on/below the payline per reel, for drawing the window. */
  window: SlotSymbol[][];
  bet: number;
  payout: number;
  result: LineResult;
}

export function symbolAt(reel: number, stop: number): SlotSymbol {
  const strip = REELS[reel];
  return strip[((stop % strip.length) + strip.length) % strip.length];
}

export function isValidBet(bet: unknown): bet is number {
  return typeof bet === "number" && Number.isInteger(bet) && bet >= 1 && bet <= MAX_BET;
}

/** Resolve one spin from explicit stops (deterministic — handy for tests). */
export function resolveStops(stops: number[], bet: number): SpinResult {
  const line = stops.map((stop, reel) => symbolAt(reel, stop));
  const window = stops.map((stop, reel) => [symbolAt(reel, stop - 1), symbolAt(reel, stop), symbolAt(reel, stop + 1)]);
  const result = evaluateLine(line);
  return { stops, line, window, bet, payout: bet * result.multiplier, result };
}

/** Spin with an injectable rng in [0, 1). */
export function spin(bet: number, rng: () => number): SpinResult {
  const stops = REELS.map((strip) => Math.min(strip.length - 1, Math.floor(rng() * strip.length)));
  return resolveStops(stops, bet);
}

/** Exact return-to-player and hit rate, by enumerating every outcome. */
export function exactReturn(): { rtp: number; hitRate: number; jackpotOdds: number } {
  let paid = 0;
  let hits = 0;
  let jackpots = 0;
  let total = 0;
  const [a, b, c] = REELS;
  for (let i = 0; i < a.length; i++) {
    for (let j = 0; j < b.length; j++) {
      for (let k = 0; k < c.length; k++) {
        const r = evaluateLine([a[i], b[j], c[k]]);
        paid += r.multiplier;
        if (r.multiplier > 0) hits++;
        if (r.kind === "jackpot") jackpots++;
        total++;
      }
    }
  }
  return { rtp: paid / total, hitRate: hits / total, jackpotOdds: jackpots / total };
}
