"use client";

import { useRef, useState } from "react";
import styles from "./prizes.module.css";
import WalletBar, { ZnCoin, fmt } from "../_components/WalletBar";
import { useWallet, walletAct } from "@/lib/walletClient";
import { CURRENCY, owns } from "@/lib/wallet";
import { CAPSULES, DECOR_IDS, PRIZES, capsuleKey, type Capsule, type Prize, type PrizeKind } from "@/lib/prizes";
import { unlock } from "@/lib/arcade";
import { coinClink } from "@/lib/sound";

// The prize counter: the catalogue from lib/prizes.ts, grouped by kind, plus
// the capsule collection. Purchases go through walletAct like everything else,
// so a signed-in visitor's buy is checked and resolved on the server.

const SECTIONS: { kind: PrizeKind; title: string; blurb: string }[] = [
  { kind: "consumable", title: "Random things", blurb: "Buy as many as you like. What you get is up to the counter." },
  { kind: "decor", title: "For the game room", blurb: "Bought once, lives in the room for good." },
  { kind: "upgrade", title: "Upgrades", blurb: "Make zinc come in faster, or keep it coming longer." },
];

type Reveal =
  | { type: "fortune"; text: string }
  | { type: "capsule"; capsule: Capsule; duplicate: boolean }
  | { type: "owned"; prize: Prize };

export default function PrizeCounter() {
  const { wallet } = useWallet();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reveal, setReveal] = useState<Reveal | null>(null);
  const revealRef = useRef<HTMLDivElement>(null);

  async function buy(prize: Prize) {
    if (busy) return;
    setBusy(prize.id);
    setError(null);
    const res = await walletAct({ type: "buy", id: prize.id });
    setBusy(null);
    if (!res.ok || res.outcome?.type !== "buy") {
      setError(res.ok ? "The counter lost your order." : res.error);
      return;
    }
    coinClink(2);
    const o = res.outcome;
    if (o.fortune) setReveal({ type: "fortune", text: o.fortune });
    else if (o.capsule) setReveal({ type: "capsule", capsule: o.capsule, duplicate: Boolean(o.duplicate) });
    else setReveal({ type: "owned", prize: o.prize });
    requestAnimationFrame(() => revealRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }));

    const w = res.wallet;
    unlock("shop-first");
    if (DECOR_IDS.every((id) => owns(w, id))) unlock("shop-decorator");
    if (CAPSULES.every((c) => owns(w, capsuleKey(c.id)))) unlock("shop-capsules");
  }

  const collected = wallet ? CAPSULES.filter((c) => owns(wallet, capsuleKey(c.id))).length : 0;

  return (
    <div>
      <WalletBar links={[{ href: "/games/casino", label: "Slot machine →" }, { href: "/games", label: "Back to the room" }]} />

      <div ref={revealRef} className={styles.revealSlot} aria-live="polite">
        {error && <p className={styles.error} role="alert">{error}</p>}
        {reveal && (
          <div className={styles.reveal} key={JSON.stringify(reveal)}>
            {reveal.type === "fortune" && (
              <>
                <span className={styles.revealIcon} aria-hidden>🥠</span>
                <p className={styles.fortune}>“{reveal.text}”</p>
              </>
            )}
            {reveal.type === "capsule" && (
              <>
                <span className={`${styles.revealIcon} ${styles.pop}`} aria-hidden>{reveal.capsule.icon}</span>
                <p>
                  <strong>{reveal.capsule.name}</strong>{" "}
                  <span className={`${styles.rarity} ${styles[reveal.capsule.rarity]}`}>{reveal.capsule.rarity}</span>
                  <br />
                  <span className={styles.revealNote}>
                    {reveal.duplicate ? "Another one for the pile." : "New for the collection!"}
                  </span>
                </p>
              </>
            )}
            {reveal.type === "owned" && (
              <>
                <span className={`${styles.revealIcon} ${styles.pop}`} aria-hidden>{reveal.prize.icon}</span>
                <p>
                  <strong>{reveal.prize.name}</strong> is yours.{" "}
                  <span className={styles.revealNote}>
                    {reveal.prize.kind === "decor" ? "Go look — it's in the game room now." : "Already working."}
                  </span>
                </p>
              </>
            )}
            <button type="button" className={styles.close} onClick={() => setReveal(null)} aria-label="Dismiss">×</button>
          </div>
        )}
      </div>

      {SECTIONS.map((section) => (
        <section key={section.kind} className={styles.section} aria-labelledby={`prizes-${section.kind}`}>
          <h2 id={`prizes-${section.kind}`} className={styles.sectionTitle}>{section.title}</h2>
          <p className={styles.sectionBlurb}>{section.blurb}</p>
          <div className={styles.grid}>
            {PRIZES.filter((p) => p.kind === section.kind).map((prize) => {
              const have = wallet ? (wallet.owned[prize.id] ?? 0) : 0;
              const soldOut = prize.kind !== "consumable" && have > 0;
              const short = wallet ? prize.price > wallet.balance : true;
              return (
                <article key={prize.id} className={`paper-card ${styles.prize} ${soldOut ? styles.owned : ""}`}>
                  <span className={styles.icon} aria-hidden>{prize.icon}</span>
                  <h3 className={styles.name}>{prize.name}</h3>
                  <p className={styles.desc}>{prize.desc}</p>
                  <div className={styles.buyRow}>
                    <span className={styles.price}>
                      <ZnCoin size={20} /> {fmt(prize.price)}
                    </span>
                    {soldOut ? (
                      <span className={styles.ownedTag}>Owned ✓</span>
                    ) : (
                      <button
                        type="button"
                        className={styles.buy}
                        onClick={() => void buy(prize)}
                        disabled={!wallet || short || busy !== null}
                        title={short && wallet ? `You need ${fmt(prize.price - wallet.balance)} more ${CURRENCY.symbol}` : undefined}
                      >
                        {busy === prize.id ? "…" : short && wallet ? "Not enough" : "Buy"}
                      </button>
                    )}
                  </div>
                  {prize.kind === "consumable" && have > 0 && (
                    <span className={styles.count}>bought {fmt(have)}×</span>
                  )}
                </article>
              );
            })}
          </div>
        </section>
      ))}

      <section className={styles.section} aria-labelledby="capsule-shelf">
        <h2 id="capsule-shelf" className={styles.sectionTitle}>
          Capsule shelf <span className={styles.progress}>{collected} / {CAPSULES.length}</span>
        </h2>
        <p className={styles.sectionBlurb}>Everything that&apos;s come out of the capsule machine. Rares are rare.</p>
        <ul className={styles.shelf}>
          {CAPSULES.map((c) => {
            const n = wallet ? (wallet.owned[capsuleKey(c.id)] ?? 0) : 0;
            return (
              <li key={c.id} className={`${styles.slot} ${n > 0 ? styles.slotHave : ""}`} title={n > 0 ? c.name : "???"}>
                <span className={styles.slotIcon} aria-hidden>{n > 0 ? c.icon : "?"}</span>
                <span className={styles.slotName}>{n > 0 ? c.name : "???"}</span>
                {n > 1 && <span className={styles.slotCount}>×{n}</span>}
                <span className={`${styles.rarityDot} ${styles[c.rarity]}`} aria-label={c.rarity} />
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
