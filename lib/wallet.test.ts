// Pure-logic tests for the zinc economy: the slot machine's odds, the wallet's
// accrual clock and actions, and the prize counter. Run with:
//   npm run test:wallet   (node --experimental-strip-types)
import {
  REELS, SYMBOLS, THREE_KIND, BETS, MAX_BET,
  evaluateLine, resolveStops, spin, exactReturn, symbolAt, type SlotSymbol,
} from "../app/games/casino/slots.ts";
import {
  newWallet, normalizeWallet, accrue, applyAction, parseClientAction, dayKey, msToNextToken,
  STARTING_BALANCE, RATE_PER_HOUR, HOPPER_RATE_PER_HOUR, CAP_HOURS, PIGGY_CAP_HOURS,
  DAILY_BONUS, WIN_BONUS, ACHIEVEMENT_BONUS, type Wallet,
} from "./wallet.ts";
import { PRIZES, PRIZES_BY_ID, CAPSULES, FORTUNES, pickCapsule, capsuleKey } from "./prizes.ts";

let fail = 0;
const ok = (c: boolean, n: string) => { if (!c) { fail++; console.log("FAIL:", n); } };

function seeded(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

const HOUR = 3_600_000;
const T0 = Date.UTC(2026, 8, 23, 12);
const TODAY = "2026-09-23";

// ---------- SLOTS: paytable ----------
const line = (...s: SlotSymbol[]) => evaluateLine(s);
ok(line("zinc", "zinc", "zinc").kind === "jackpot", "three zinc is the jackpot");
ok(line("zinc", "zinc", "zinc").multiplier === THREE_KIND.zinc, "jackpot pays the zinc line");
ok(line("seven", "seven", "seven").multiplier === THREE_KIND.seven, "three sevens");
ok(line("seven", "zinc", "seven").multiplier === THREE_KIND.seven, "zinc is wild in the middle");
ok(line("zinc", "zinc", "bell").multiplier === THREE_KIND.bell, "two wilds complete a bell line");
ok(line("zinc", "lemon", "bar").multiplier === 0, "wild can't bridge two different symbols");
ok(line("cherry", "lemon", "bar").multiplier === 1, "one leading cherry returns the stake");
ok(line("cherry", "cherry", "bar").multiplier === 4, "two leading cherries pay 4x");
ok(line("lemon", "cherry", "cherry").multiplier === 0, "cherries only count from the left");
ok(line("cherry", "zinc", "cherry").multiplier === THREE_KIND.cherry, "wild cherry line beats the cherry count");
ok(line("lemon", "bell", "bar").kind === "none", "a mixed line loses");

// Every stop of every reel is a real symbol, and every symbol appears.
ok(REELS.length === 3, "three reels");
ok(REELS.every((r) => r.every((s) => SYMBOLS.includes(s))), "reels only hold known symbols");
ok(SYMBOLS.every((s) => REELS.every((r) => r.includes(s))), "every symbol is on every reel");
ok(symbolAt(0, -1) === REELS[0][REELS[0].length - 1], "reel window wraps above the first stop");
ok(symbolAt(1, REELS[1].length) === REELS[1][0], "reel window wraps below the last stop");

// ---------- SLOTS: the house edge ----------
const { rtp, hitRate, jackpotOdds } = exactReturn();
ok(rtp > 0.9 && rtp < 0.98, `return-to-player in (90%, 98%) — got ${(rtp * 100).toFixed(2)}%`);
ok(hitRate > 0.18 && hitRate < 0.4, `hit rate feels alive — got ${(hitRate * 100).toFixed(1)}%`);
ok(jackpotOdds > 0 && jackpotOdds < 1 / 2000, "jackpot is possible but rare");

// A long seeded simulation should land near the exact figure.
{
  const rng = seeded(7);
  let paid = 0;
  const N = 200_000;
  for (let i = 0; i < N; i++) paid += spin(1, rng).payout;
  ok(Math.abs(paid / N - rtp) < 0.05, `simulated RTP tracks the exact RTP (${(paid / N).toFixed(3)} vs ${rtp.toFixed(3)})`);
}

// resolveStops is what the reels animate to — the payline is the middle row.
{
  const r = resolveStops([3, 4, 5], 10);
  ok(r.window.every((col, i) => col[1] === r.line[i]), "payline is the middle row of the window");
  ok(r.payout === 10 * r.result.multiplier, "payout scales with the bet");
  ok(spin(5, () => 0.999999).stops.every((s, i) => s === REELS[i].length - 1), "rng near 1 stays on the strip");
}
ok(BETS.every((b) => b <= MAX_BET), "every bet chip is legal");

// ---------- WALLET: accrual ----------
let w = newWallet(T0);
ok(w.balance === STARTING_BALANCE, "new wallets start with the float");
ok(newWallet(T0, 4).balance === STARTING_BALANCE + 4 * ACHIEVEMENT_BONUS, "existing trophies are back-paid");

{
  const a = accrue(w, T0 + HOUR);
  ok(a.earned === RATE_PER_HOUR, "one hour pays the hourly rate");
  ok(a.wallet.accruedAt === T0 + HOUR, "clock advances exactly when the hour is paid");
  const half = accrue(w, T0 + HOUR / RATE_PER_HOUR / 2);
  ok(half.earned === 0 && half.wallet.accruedAt === T0, "half a token pays nothing and keeps the clock");
  // Many small visits must add up to the same as one long one.
  let chunked = w;
  let total = 0;
  for (let t = 1; t <= 60; t++) {
    const step = accrue(chunked, T0 + t * 77_000);
    chunked = step.wallet;
    total += step.earned;
  }
  ok(total === accrue(w, T0 + 60 * 77_000).earned, "frequent visits don't lose fractional tokens");
  const capped = accrue(w, T0 + 100 * HOUR);
  ok(capped.earned === RATE_PER_HOUR * CAP_HOURS, "time away is capped");
  ok(capped.wallet.accruedAt === T0 + 100 * HOUR, "capped time is forfeited, not banked");
  const back = accrue(w, T0 - HOUR);
  ok(back.earned === 0 && back.wallet.accruedAt === T0 - HOUR, "a clock that goes backwards just restarts");
  ok(msToNextToken(w, T0) === HOUR / RATE_PER_HOUR, "countdown to the next token");
}

// ---------- WALLET: actions ----------
const rng = seeded(42);
{
  const d1 = applyAction(w, { type: "daily" }, TODAY, rng);
  ok(d1.ok && d1.wallet.balance === STARTING_BALANCE + DAILY_BONUS, "daily bonus pays");
  const d2 = d1.ok ? applyAction(d1.wallet, { type: "daily" }, TODAY, rng) : d1;
  ok(!d2.ok, "daily bonus can't be claimed twice in a day");
  const d3 = d1.ok ? applyAction(d1.wallet, { type: "daily" }, "2026-09-24", rng) : d1;
  ok(d3.ok, "daily bonus comes back tomorrow");
}
{
  const a = applyAction(w, { type: "win", game: "tetris" }, TODAY, rng);
  ok(a.ok && a.outcome.type === "win" && a.outcome.amount === WIN_BONUS, "first win of the day pays");
  const b = a.ok ? applyAction(a.wallet, { type: "win", game: "tetris" }, TODAY, rng) : a;
  ok(b.ok && b.outcome.type === "win" && b.outcome.amount === 0, "second win in the same game pays nothing");
  const c = b.ok ? applyAction(b.wallet, { type: "win", game: "snake" }, TODAY, rng) : b;
  ok(c.ok && c.outcome.type === "win" && c.outcome.amount === WIN_BONUS, "a different game pays again");
  const d = c.ok ? applyAction(c.wallet, { type: "win", game: "tetris" }, "2026-09-24", rng) : c;
  ok(d.ok && d.outcome.type === "win" && d.outcome.amount === WIN_BONUS, "win bonuses reset each day");
}
{
  const r = applyAction(w, { type: "achievements", count: 3 }, TODAY, rng);
  ok(r.ok && r.wallet.balance === STARTING_BALANCE + 3 * ACHIEVEMENT_BONUS, "achievements pay per unlock");
}

// Spins: balance is conserved exactly (balance' = balance - bet + payout).
{
  let cur: Wallet = { ...w, balance: 10_000 };
  let conserved = true;
  const r2 = seeded(99);
  for (let i = 0; i < 500; i++) {
    const res = applyAction(cur, { type: "spin", bet: 10 }, TODAY, r2);
    if (!res.ok || res.outcome.type !== "spin") { conserved = false; break; }
    if (res.wallet.balance !== cur.balance - 10 + res.outcome.spin.payout) conserved = false;
    cur = res.wallet;
  }
  ok(conserved, "every spin conserves zinc");
  ok(cur.stats.spins === 500 && cur.stats.wagered === 5000, "spin stats accumulate");
  ok(!applyAction({ ...w, balance: 4 }, { type: "spin", bet: 5 }, TODAY, rng).ok, "can't bet more than you have");
  ok(!applyAction(w, { type: "spin", bet: 0 }, TODAY, rng).ok, "zero bets are refused");
  ok(!applyAction({ ...w, balance: 10_000 }, { type: "spin", bet: MAX_BET + 1 }, TODAY, rng).ok, "over-max bets are refused");
  ok(!applyAction(w, { type: "spin", bet: 2.5 }, TODAY, rng).ok, "fractional bets are refused");
}

// Prize counter.
{
  const rich: Wallet = { ...w, balance: 100_000 };
  const lamp = applyAction(rich, { type: "buy", id: "lava-lamp" }, TODAY, rng);
  ok(lamp.ok && lamp.wallet.owned["lava-lamp"] === 1, "buying decor adds it to the wallet");
  ok(lamp.ok && lamp.wallet.balance === 100_000 - PRIZES_BY_ID.get("lava-lamp")!.price, "decor costs its price");
  ok(lamp.ok && !applyAction(lamp.wallet, { type: "buy", id: "lava-lamp" }, TODAY, rng).ok, "decor can only be bought once");
  ok(!applyAction(w, { type: "buy", id: "golden-fleece" }, TODAY, rng).ok, "can't buy what you can't afford");
  ok(!applyAction(rich, { type: "buy", id: "yacht" }, TODAY, rng).ok, "unknown prizes are refused");

  const cookie = applyAction(rich, { type: "buy", id: "fortune-cookie" }, TODAY, rng);
  ok(cookie.ok && cookie.outcome.type === "buy" && FORTUNES.includes(cookie.outcome.fortune ?? ""), "fortune cookies contain a fortune");
  const again = cookie.ok ? applyAction(cookie.wallet, { type: "buy", id: "fortune-cookie" }, TODAY, rng) : cookie;
  ok(again.ok && again.wallet.owned["fortune-cookie"] === 2, "consumables can be bought repeatedly");

  let cw = rich;
  const seen = new Set<string>();
  for (let i = 0; i < 400; i++) {
    const res = applyAction(cw, { type: "buy", id: "capsule" }, TODAY, rng);
    if (res.ok && res.outcome.type === "buy" && res.outcome.capsule) seen.add(res.outcome.capsule.id);
    if (res.ok) cw = res.wallet;
  }
  ok(seen.size === CAPSULES.length, "every capsule toy can drop");
  ok(CAPSULES.every((c) => (cw.owned[capsuleKey(c.id)] ?? 0) > 0), "capsules are stored under capsule keys");

  // Rarity actually matters.
  const r3 = seeded(5);
  const counts: Record<string, number> = {};
  for (let i = 0; i < 20_000; i++) {
    const c = pickCapsule(r3);
    counts[c.rarity] = (counts[c.rarity] ?? 0) + 1;
  }
  ok((counts.common ?? 0) > (counts.uncommon ?? 0) && (counts.uncommon ?? 0) > (counts.rare ?? 0), "commons beat uncommons beat rares");

  const hopper = applyAction(rich, { type: "buy", id: "coin-hopper" }, TODAY, rng);
  ok(hopper.ok && accrue(hopper.wallet, hopper.wallet.accruedAt + HOUR).earned === HOPPER_RATE_PER_HOUR, "coin hopper raises the hourly rate");
  const piggy = applyAction(rich, { type: "buy", id: "piggy-bank" }, TODAY, rng);
  ok(piggy.ok && accrue(piggy.wallet, piggy.wallet.accruedAt + 100 * HOUR).earned === RATE_PER_HOUR * PIGGY_CAP_HOURS, "piggy bank raises the cap");
}
ok(new Set(PRIZES.map((p) => p.id)).size === PRIZES.length, "prize ids are unique");
ok(PRIZES.every((p) => p.price > 0 && Number.isInteger(p.price)), "prize prices are positive integers");

// ---------- WALLET: parsing untrusted input ----------
ok(parseClientAction({ type: "achievements", count: 1000 }) === null, "clients can't mint achievement bonuses");
ok(parseClientAction({ type: "spin", bet: -5 }) === null, "negative bets don't parse");
ok(parseClientAction({ type: "spin", bet: 25 })?.type === "spin", "a real bet parses");
ok(parseClientAction(null) === null && parseClientAction("spin") === null, "junk bodies don't parse");
{
  const n = normalizeWallet({ balance: -50, owned: { "lava-lamp": 2, junk: "x" }, stats: { spins: 3.7 } }, T0);
  ok(n.balance === 0, "negative balances clamp to zero");
  ok(n.owned["lava-lamp"] === 2 && !("junk" in n.owned), "owned map is sanitised");
  ok(n.stats.spins === 3 && n.accruedAt === T0, "stats floor and a missing clock starts now");
  ok(normalizeWallet("garbage", T0).balance === STARTING_BALANCE, "unparseable wallets start fresh");
}
ok(dayKey(Date.UTC(2026, 8, 23, 23, 30), 0) === "2026-09-23", "day key in UTC");
ok(dayKey(Date.UTC(2026, 8, 23, 23, 30), 60) === "2026-09-24", "day key respects the visitor's offset");

console.log(fail ? `${fail} wallet test(s) failed` : "wallet: all tests passed");
process.exit(fail ? 1 : 0);
