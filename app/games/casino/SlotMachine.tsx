"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import styles from "./casino.module.css";
import WalletBar, { fmt } from "../_components/WalletBar";
import {
  BETS, CHERRY_PAYS, MAX_BET, REELS, THREE_KIND, SYMBOL_LABEL,
  exactReturn, type SlotSymbol, type SpinResult,
} from "./slots";
import { announceWallet, useWallet, walletAct } from "@/lib/walletClient";
import { CURRENCY, DAILY_BONUS, rateOf } from "@/lib/wallet";
import { unlock } from "@/lib/arcade";
import { coinClink, reelStop, slotWin } from "@/lib/sound";

// The slot machine's face. The spin itself is resolved elsewhere (the server
// for signed-in visitors, lib/walletClient for guests); this component only
// animates the reels to the stops it was handed and then reveals the payout.
//
// Reel animation: each reel renders its strip COPIES times. The resting
// position is always in the second copy; a spin runs forward into the fourth
// copy (so it visibly loops a few times), then snaps back to the equivalent
// cell in the second copy with the transition off. No frame shows the jump.

const COPIES = 5;
const STRIP = REELS[0].length;
const SPIN_MS = [1100, 1500, 1900];

type Phase = "idle" | "spinning" | "result";

interface LogRow {
  id: number;
  bet: number;
  payout: number;
  label: string | null;
  line: SlotSymbol[];
}

export function SymbolFace({ symbol }: { symbol: SlotSymbol }) {
  switch (symbol) {
    case "zinc":
      return (
        <span className={styles.znTile} aria-label="Zinc">
          <small>30</small>Zn
        </span>
      );
    case "seven":
      return <span className={styles.seven} aria-label="Seven">7</span>;
    case "bar":
      return <span className={styles.bar} aria-label="Bar">BAR</span>;
    case "cherry":
      return <span className={styles.emoji} aria-label="Cherry">🍒</span>;
    case "lemon":
      return <span className={styles.emoji} aria-label="Lemon">🍋</span>;
    case "clover":
      return <span className={styles.emoji} aria-label="Clover">🍀</span>;
    case "bell":
      return <span className={styles.emoji} aria-label="Bell">🔔</span>;
  }
}

export default function SlotMachine() {
  const { wallet } = useWallet();
  const [bet, setBet] = useState<number>(5);
  const [phase, setPhase] = useState<Phase>("idle");
  // Where each reel rests (a cell index into its repeated strip) and whether
  // the move there is animated.
  const [pos, setPos] = useState<number[]>(() => [STRIP + 1, STRIP + 7, STRIP + 15]);
  const [animating, setAnimating] = useState(false);
  const [landed, setLanded] = useState<boolean[]>([true, true, true]);
  const [result, setResult] = useState<SpinResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pulled, setPulled] = useState(false);
  const [log, setLog] = useState<LogRow[]>([]);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const logId = useRef(0);
  // State lags a render behind; a double-click must not start two spins.
  const busy = useRef(false);

  const odds = useMemo(() => exactReturn(), []);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const spin = useCallback(async () => {
    if (busy.current || !wallet) return;
    const later = (ms: number, fn: () => void) => timers.current.push(setTimeout(fn, ms));
    if (bet > wallet.balance) {
      setError(wallet.balance === 0 ? "Out of zinc." : "Not enough zinc for that bet — try a smaller chip.");
      return;
    }
    busy.current = true;
    setError(null);
    setResult(null);
    setPhase("spinning");
    setPulled(true);
    later(380, () => setPulled(false));

    const res = await walletAct({ type: "spin", bet }, { quiet: true });
    if (!res.ok || res.outcome?.type !== "spin") {
      setError(res.ok ? "The machine jammed. Try again." : res.error);
      if (res.wallet) announceWallet(res.wallet);
      setPhase("idle");
      busy.current = false;
      return;
    }
    const outcome = res.outcome.spin;
    const settled = res.wallet;
    // The bet leaves the wallet now; the win waits for the reels.
    announceWallet({ ...settled, balance: settled.balance - outcome.payout });

    setLanded([false, false, false]);
    setAnimating(true);
    setPos(outcome.stops.map((s) => s + STRIP * 3));

    outcome.stops.forEach((_, i) => {
      later(SPIN_MS[i], () => {
        reelStop(i);
        setLanded((l) => l.map((v, j) => (j === i ? true : v)));
      });
    });

    later(SPIN_MS[2] + 120, () => {
      // Snap back into the second copy, invisibly.
      setAnimating(false);
      setPos(outcome.stops.map((s) => s + STRIP));
      setResult(outcome);
      setPhase("result");
      busy.current = false;
      announceWallet(settled);
      setLog((l) => [
        { id: ++logId.current, bet: outcome.bet, payout: outcome.payout, label: outcome.result.label, line: outcome.line },
        ...l,
      ].slice(0, 8));

      const kind = outcome.result.kind;
      if (kind === "jackpot") slotWin("jackpot");
      else if (outcome.result.multiplier >= 10) slotWin("big");
      else if (outcome.payout > outcome.bet) slotWin("small");
      else if (outcome.payout > 0) coinClink(1);

      unlock("cas-first-spin");
      if (outcome.bet >= MAX_BET) unlock("cas-high-roller");
      if (kind === "three" || kind === "jackpot") unlock("cas-three");
      if (kind === "jackpot") unlock("cas-jackpot");
      if (settled.balance === 0) unlock("cas-ruin");
    });
  }, [bet, wallet]);

  // Space pulls the lever (unless you're typing somewhere).
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement;
      if (e.code !== "Space" || t?.tagName === "INPUT" || t?.tagName === "TEXTAREA" || t?.tagName === "BUTTON" || t?.isContentEditable) return;
      e.preventDefault();
      void spin();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [spin]);

  // Keep the chosen chip affordable when the balance drops.
  useEffect(() => {
    if (wallet && bet > wallet.balance && phase !== "spinning") {
      const fits = [...BETS].reverse().find((b) => b <= wallet.balance);
      if (fits) setBet(fits);
    }
  }, [wallet, bet, phase]);

  const win = result && result.payout > 0;
  const net = result ? result.payout - result.bet : 0;

  let display: string;
  if (phase === "spinning") display = "Good luck…";
  else if (result?.result.kind === "jackpot") display = `JACKPOT! +${fmt(result.payout)} ${CURRENCY.symbol}`;
  else if (win && result) display = `${result.result.label} — pays ${fmt(result.payout)}`;
  else if (result) display = "No luck. Again?";
  else display = "Insert zinc · pull the lever";

  const broke = wallet !== null && wallet.balance < BETS[0];

  return (
    <div className={styles.layout}>
      <WalletBar links={[{ href: "/games/prizes", label: "Prize counter →" }, { href: "/games", label: "Back to the room" }]} />

      <div className={styles.floor}>
        <div className={`${styles.machine} ${result?.result.kind === "jackpot" ? styles.jackpot : ""}`}>
          <span className={`${styles.beacon} ${phase === "spinning" || win ? styles.beaconOn : ""}`} aria-hidden />
          <div className={styles.sign}>
            <span className={styles.signSmall}>Luck o&apos; the</span>
            <span className={styles.signBig}>LAB</span>
          </div>

          <div className={styles.window} aria-live="polite" aria-atomic>
            <span className="sr-only">
              {phase === "result" && result ? `Payline: ${result.line.map((s) => SYMBOL_LABEL[s]).join(", ")}. ${display}` : ""}
            </span>
            {REELS.map((strip, i) => (
              <div key={i} className={`${styles.reel} ${landed[i] ? "" : styles.reelBlur}`} aria-hidden>
                <div
                  className={styles.strip}
                  style={{
                    transform: `translateY(calc(var(--cell) * ${-(pos[i] - 1)}))`,
                    transition: animating ? `transform ${SPIN_MS[i]}ms cubic-bezier(0.15, 0.6, 0.25, 1.02)` : "none",
                  }}
                >
                  {Array.from({ length: COPIES }, (_, c) =>
                    strip.map((sym, j) => (
                      <div key={`${c}-${j}`} className={styles.cell}>
                        <SymbolFace symbol={sym} />
                      </div>
                    )),
                  )}
                </div>
              </div>
            ))}
            <span className={styles.payline} aria-hidden />
          </div>

          <div className={`${styles.led} ${win ? styles.ledWin : ""}`}>{display}</div>

          <div className={styles.controls}>
            <div className={styles.chips} role="radiogroup" aria-label="Bet">
              {BETS.map((b) => (
                <button
                  key={b}
                  type="button"
                  role="radio"
                  aria-checked={bet === b}
                  className={`${styles.chip} ${bet === b ? styles.chipOn : ""}`}
                  onClick={() => setBet(b)}
                  disabled={phase === "spinning" || (wallet !== null && b > wallet.balance)}
                >
                  {b}
                </button>
              ))}
            </div>
            <button
              type="button"
              className={styles.spin}
              onClick={() => void spin()}
              disabled={phase === "spinning" || !wallet || broke}
            >
              {phase === "spinning" ? "Spinning…" : `Spin · ${bet} ${CURRENCY.symbol}`}
            </button>
          </div>

          <div className={styles.tray} aria-hidden>
            {win && result && Array.from({ length: Math.min(12, Math.ceil(result.payout / Math.max(1, result.bet))) }, (_, i) => (
              <span key={`${logId.current}-${i}`} className={styles.trayCoin} style={{ left: `${10 + ((i * 37) % 80)}%`, animationDelay: `${i * 60}ms` }} />
            ))}
          </div>

          <button
            type="button"
            className={`${styles.lever} ${pulled ? styles.leverPulled : ""}`}
            onClick={() => void spin()}
            disabled={phase === "spinning" || !wallet || broke}
            aria-label="Pull the lever"
          >
            <span className={styles.leverKnob} />
          </button>
        </div>

        <aside className={styles.side}>
          {error && <p className={styles.error} role="alert">{error}</p>}
          {broke && wallet && (
            <p className={styles.broke}>
              Out of zinc. It trickles back at {rateOf(wallet)} {CURRENCY.symbol} an hour, the daily bonus is worth {DAILY_BONUS},
              and your first win in each game every day pays too.
            </p>
          )}
          {result && phase === "result" && result.payout > 0 && (
            <p className={styles.net}>
              {net > 0 ? `+${fmt(net)} on that spin.` : net === 0 ? "Broke even." : `Got ${fmt(result.payout)} of ${fmt(result.bet)} back.`}
            </p>
          )}

          <section className={`paper-card ${styles.card}`} aria-labelledby="paytable">
            <h2 id="paytable" className={styles.cardTitle}>Paytable</h2>
            <p className={styles.cardHint}>Middle row only. Zn is wild. Pays are × your bet.</p>
            <table className={styles.pays}>
              <tbody>
                {(Object.entries(THREE_KIND) as [SlotSymbol, number][])
                  .sort((a, b) => b[1] - a[1])
                  .map(([sym, mult]) => (
                    <tr key={sym}>
                      <td className={styles.payLine}>
                        <SymbolFace symbol={sym} /><SymbolFace symbol={sym} /><SymbolFace symbol={sym} />
                      </td>
                      <td className={styles.payMult}>{mult}×</td>
                    </tr>
                  ))}
                {Object.entries(CHERRY_PAYS).map(([n, mult]) => (
                  <tr key={`c${n}`}>
                    <td className={styles.payLine}>
                      {Array.from({ length: Number(n) }, (_, i) => <SymbolFace key={i} symbol="cherry" />)}
                      <span className={styles.any}>from the left</span>
                    </td>
                    <td className={styles.payMult}>{mult}×</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className={styles.fine}>
              Fine print, honestly: this machine pays back {(odds.rtp * 100).toFixed(1)}% of what goes in over the long run,
              hits {(odds.hitRate * 100).toFixed(0)}% of the time, and lands the jackpot about once every{" "}
              {fmt(Math.round(1 / odds.jackpotOdds))} spins. The house always wins; it&apos;s just slow about it.
            </p>
          </section>

          {wallet && (
            <section className={`paper-card ${styles.card}`} aria-labelledby="slot-stats">
              <h2 id="slot-stats" className={styles.cardTitle}>Your record</h2>
              <dl className={styles.stats}>
                <div><dt>Spins</dt><dd>{fmt(wallet.stats.spins)}</dd></div>
                <div><dt>Wagered</dt><dd>{fmt(wallet.stats.wagered)}</dd></div>
                <div><dt>Won</dt><dd>{fmt(wallet.stats.won)}</dd></div>
                <div><dt>Biggest</dt><dd>{fmt(wallet.stats.biggestWin)}</dd></div>
              </dl>
            </section>
          )}

          {log.length > 0 && (
            <section className={`paper-card ${styles.card}`} aria-labelledby="slot-log">
              <h2 id="slot-log" className={styles.cardTitle}>This session</h2>
              <ol className={styles.log}>
                {log.map((row) => (
                  <li key={row.id} className={row.payout > 0 ? styles.logWin : undefined}>
                    <span className={styles.logLine}>
                      {row.line.map((s, i) => <SymbolFace key={i} symbol={s} />)}
                    </span>
                    <span>{row.payout > 0 ? `+${fmt(row.payout)}` : `−${fmt(row.bet)}`}</span>
                  </li>
                ))}
              </ol>
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}
