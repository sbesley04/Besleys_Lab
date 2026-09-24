"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import styles from "./arcade.module.css";
import { GAME_CATEGORY_LABELS, GAME_CATEGORY_ORDER, games } from "./registry";
import GameRoom from "./_room/GameRoom";
import WalletBar from "./_components/WalletBar";

const GAME_SECTIONS = GAME_CATEGORY_ORDER.map((category) => ({
  category,
  games: games.filter((game) => game.category === category),
}));

// The arcade hub, client-side: the game room (furniture you click into, plus
// its residents — a Junimo napping on the furniture and a sheep on the floor,
// see _room/), the zinc wallet, the glider salute (earned in Game of Life),
// a plain list of every game for anyone who'd rather not walk around, and a
// terminal that opens if you type a certain six letters.

export default function ArcadeHub() {
  return (
    <>
      <GliderSalute />
      <WalletBar
        links={[
          { href: "/games/casino", label: "Slot machine →" },
          { href: "/games/prizes", label: "Prize counter →" },
        ]}
      />
      <GameRoom />
      <Directory />
      <ArcadeTerminalSummon />
    </>
  );
}

// --- every game, as a plain list ----------------------------------------------

function Directory() {
  return (
    <details className={styles.directory}>
      <summary className={styles.directorySummary}>Every game, as a list ({games.length})</summary>
      <div className={styles.directoryCols}>
        {GAME_SECTIONS.map(({ category, games: list }) => (
          <section key={category}>
            <h2 className={styles.categoryTitle}>{GAME_CATEGORY_LABELS[category]}</h2>
            <ul className={styles.directoryList}>
              {list.map((game) => (
                <li key={game.slug}>
                  <Link href={`/games/${game.slug}`}>{game.title}</Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
        <section>
          <h2 className={styles.categoryTitle}>Zinc</h2>
          <ul className={styles.directoryList}>
            <li><Link href="/games/casino">Slot machine</Link></li>
            <li><Link href="/games/prizes">Prize counter</Link></li>
          </ul>
        </section>
      </div>
    </details>
  );
}

// --- glider salute -----------------------------------------------------------

function GliderSalute() {
  const [earned, setEarned] = useState(false);
  useEffect(() => {
    try {
      setEarned(localStorage.getItem("bl:glider") === "1");
    } catch { /* ignore */ }
  }, []);
  if (!earned) return null;

  const pattern = [false, true, false, false, false, true, true, true, true];
  return (
    <div className={styles.gliderLane} aria-hidden title="Gliderwright">
      <span className={styles.glider}>
        {pattern.map((on, i) => (
          <i key={i} className={on ? styles.gliderOn : undefined} />
        ))}
      </span>
    </div>
  );
}

// The original access word remains an Arcade-only secret. The site-wide
// `sudo` shortcut dispatches the same event from EggEffects.
const SUMMON = "besley";

function ArcadeTerminalSummon() {
  useEffect(() => {
    let buffer = "";
    function onKey(event: KeyboardEvent) {
      const target = event.target as HTMLElement;
      if (
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.isContentEditable ||
        event.key.length !== 1
      ) {
        return;
      }
      buffer = (buffer + event.key.toLowerCase()).slice(-SUMMON.length);
      if (buffer === SUMMON) {
        buffer = "";
        window.dispatchEvent(new Event("bl:open-terminal"));
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return null;
}
