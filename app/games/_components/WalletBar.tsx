"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import styles from "./walletBar.module.css";
import { useWallet, walletAct } from "@/lib/walletClient";
import { canClaimDaily, capHoursOf, dayKey, rateOf, DAILY_BONUS, CURRENCY } from "@/lib/wallet";
import { coinClink } from "@/lib/sound";

// The token booth: balance, income rate, the daily bonus, and (on first read)
// what trickled in while you were away. Shared by the game room, the slot
// machine, and the prize counter.

export function ZnCoin({ size = 22 }: { size?: number }) {
  return (
    <span className={styles.coin} style={{ width: size, height: size, fontSize: size * 0.42 }} aria-hidden>
      {CURRENCY.symbol}
    </span>
  );
}

export const fmt = (n: number) => n.toLocaleString("en-US");

export default function WalletBar({ links = [] }: { links?: { href: string; label: string }[] }) {
  const { wallet, accrued, signedIn } = useWallet();
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [bump, setBump] = useState(0);
  const [today, setToday] = useState<string | null>(null);

  // The local calendar day only exists in the browser.
  useEffect(() => {
    setToday(dayKey(Date.now(), -new Date().getTimezoneOffset()));
  }, []);

  useEffect(() => {
    if (accrued > 0) setMessage(`+${fmt(accrued)} ${CURRENCY.symbol} trickled in while you were away.`);
  }, [accrued]);

  // Pulse the number whenever the balance moves.
  const balance = wallet?.balance;
  useEffect(() => {
    if (balance !== undefined) setBump((b) => b + 1);
  }, [balance]);

  async function claim() {
    setBusy(true);
    const res = await walletAct({ type: "daily" });
    setBusy(false);
    if (res.ok && res.outcome?.type === "daily") {
      coinClink(5);
      setMessage(`Daily bonus: +${res.outcome.amount} ${CURRENCY.symbol}. See you tomorrow.`);
    } else if (!res.ok) {
      setMessage(res.error);
    }
  }

  const dailyReady = wallet && today ? canClaimDaily(wallet, today) : false;

  return (
    <section className={styles.bar} aria-label={`Your ${CURRENCY.name} wallet`}>
      <div className={styles.balance}>
        <ZnCoin size={30} />
        <span className={styles.amount} key={bump} aria-live="polite">
          {wallet ? fmt(wallet.balance) : "—"}
        </span>
        <span className={styles.unit}>{CURRENCY.name}</span>
      </div>

      <div className={styles.meta}>
        {wallet ? (
          <span>
            +{rateOf(wallet)} {CURRENCY.symbol}/hr · banks up to {capHoursOf(wallet)}h away
          </span>
        ) : (
          <span>Counting the till…</span>
        )}
        {!signedIn && wallet && (
          <span className={styles.guest}>
            Guest wallet, this browser only. <Link href="/login">Sign in</Link> to keep it.
          </span>
        )}
      </div>

      <div className={styles.actions}>
        <button
          type="button"
          className={styles.daily}
          onClick={claim}
          disabled={!dailyReady || busy}
          title={dailyReady ? `Claim ${DAILY_BONUS} ${CURRENCY.symbol}` : "Come back tomorrow"}
        >
          {!wallet || !today ? "Daily bonus" : dailyReady ? `Daily +${DAILY_BONUS}` : "Daily claimed ✓"}
        </button>
        {links.map((l) => (
          <Link key={l.href} href={l.href} className={styles.link}>
            {l.label}
          </Link>
        ))}
      </div>

      {message && (
        <p className={styles.message} role="status">
          {message}
          <button type="button" className={styles.dismiss} onClick={() => setMessage(null)} aria-label="Dismiss">
            ×
          </button>
        </p>
      )}
    </section>
  );
}
