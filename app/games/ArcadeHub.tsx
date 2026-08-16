"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import styles from "./arcade.module.css";
import { GAME_CATEGORY_LABELS, GAME_CATEGORY_ORDER, games } from "./registry";
import { unlock } from "@/lib/arcade";
import { baa } from "@/lib/sound";
import GridText from "@/app/_components/eggs/GridText";

const GAME_SECTIONS = GAME_CATEGORY_ORDER.map((category) => ({
  category,
  games: games.filter((game) => game.category === category),
}));

// The arcade hub, client-side: the game-card grid plus its residents —
// a Junimo asleep behind one of the cards, a sheep grazing in the margin,
// the glider salute (earned in Game of Life), and a terminal that opens if
// you type a certain six letters.

export default function ArcadeHub() {
  return (
    <>
      <GliderSalute />
      <GameGrid />
      <Sheep />
      <ArcadeTerminalSummon />
    </>
  );
}

// --- game cards + Junimo -----------------------------------------------------

function GameGrid() {
  // Where the Junimo naps: a random card, re-rolled when disturbed.
  const [junimoAt, setJunimoAt] = useState<string | null>(null);
  const [junimoLeft, setJunimoLeft] = useState(60);
  const [awake, setAwake] = useState(false);
  const scurrying = useRef(false);
  const scurryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setJunimoAt(games[Math.floor(Math.random() * games.length)]?.slug ?? null);
    setJunimoLeft(20 + Math.random() * 60);

    return () => {
      if (scurryTimer.current) clearTimeout(scurryTimer.current);
    };
  }, []);

  function disturb(slug: string) {
    if (slug !== junimoAt || scurrying.current) return;
    scurrying.current = true;
    setAwake(true);
    scurryTimer.current = setTimeout(() => {
      let next = Math.floor(Math.random() * games.length);
      if (games.length > 1 && games[next]?.slug === slug) next = (next + 1) % games.length;
      setJunimoAt(games[next]?.slug ?? null);
      setJunimoLeft(20 + Math.random() * 60);
      setAwake(false);
      scurrying.current = false;
    }, 620);
  }

  return (
    <div className={styles.catalogue}>
      {GAME_SECTIONS.map(({ category, games: categoryGames }) => {
        return (
          <section className={styles.category} key={category} aria-labelledby={`games-${category}`}>
            <div className={styles.categoryHeader}>
              <h2 id={`games-${category}`} className={styles.categoryTitle}>
                {GAME_CATEGORY_LABELS[category]}
              </h2>
              <span className={styles.categoryCount} aria-hidden>{categoryGames.length}</span>
            </div>
            <div className={styles.grid}>
              {categoryGames.map((game) => {
                const descriptionId = `game-${game.slug}-description`;
                return (
                  <div
                    key={game.slug}
                    className={styles.cardWrap}
                    onMouseEnter={() => disturb(game.slug)}
                    onFocusCapture={() => disturb(game.slug)}
                  >
                    {junimoAt === game.slug ? (
                      <span
                        className={`${styles.junimo} ${awake ? styles.junimoAwake : ""}`}
                        style={{ left: `${junimoLeft}%` }}
                        aria-hidden
                      >
                        <Junimo />
                      </span>
                    ) : null}
                    <Link
                      href={`/games/${game.slug}`}
                      className={`paper-card ${styles.card}`}
                      aria-describedby={descriptionId}
                    >
                      <span className={styles.cardTopline}>
                        <GridText paper="Play in browser" grid="Executable" />
                      </span>
                      <h3 className={styles.cardTitle}>{game.title}</h3>
                      <p id={descriptionId} className={styles.cardBlurb}>
                        <GridText paper={game.blurb} grid={game.gridBlurb} />
                      </p>
                      <span className={styles.cardArrow} aria-hidden>→</span>
                    </Link>
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}

// A small original moss sprite, very much asleep on the job.
function Junimo() {
  return (
    <svg viewBox="0 0 38 36" width="38" height="36" aria-hidden>
      <path d="M18 9 C16 4 19 1 23 1" fill="none" stroke="#49683f" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M23 2 C29 1 30 6 25 8" fill="#88a953" stroke="#49683f" strokeWidth="1.1" />
      <path d="M5 27 C3 17 8 9 18 8 C29 8 35 17 33 27 C31 33 8 34 5 27Z" fill="#789a4d" stroke="#3e5d39" strokeWidth="1.6" />
      <path d="M8 20 C11 14 15 12 18 12 C24 12 28 15 30 20" fill="none" stroke="#b5cb76" strokeWidth="1" opacity=".85" />
      <ellipse cx="13.5" cy="21" rx="2.1" ry="1.35" fill="#253526" />
      <ellipse cx="23.5" cy="21" rx="2.1" ry="1.35" fill="#253526" />
      <path d="M15 26 Q18.5 28 22 26" fill="none" stroke="#253526" strokeWidth="1.25" strokeLinecap="round" />
      <circle cx="8" cy="27" r="1.2" fill="#d8ba62" opacity=".8" />
    </svg>
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

// --- the sheep ---------------------------------------------------------------

const SHEAR_CLICKS = 5;

function Sheep() {
  const [clicks, setClicks] = useState(0);
  const [shorn, setShorn] = useState(false);
  const [popping, setPopping] = useState(false);
  const [jeb, setJeb] = useState(false);
  const [shaking, setShaking] = useState(false);
  const shakeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const woolTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    try {
      // Wool grows back overnight.
      setShorn(localStorage.getItem("bl:sheep-shorn") === new Date().toDateString());
      setJeb(localStorage.getItem("bl:jeb") === "1");
    } catch { /* ignore */ }

    return () => {
      if (shakeTimer.current) clearTimeout(shakeTimer.current);
      if (woolTimer.current) clearTimeout(woolTimer.current);
    };
  }, []);

  function poke() {
    if (shorn) {
      baa();
      return;
    }
    setShaking(true);
    if (shakeTimer.current) clearTimeout(shakeTimer.current);
    shakeTimer.current = setTimeout(() => setShaking(false), 320);
    const n = clicks + 1;
    setClicks(n);
    if (n >= SHEAR_CLICKS) {
      baa();
      setPopping(true);
      woolTimer.current = setTimeout(() => {
        setShorn(true);
        setPopping(false);
      }, 650);
      unlock("egg-shear");
      try {
        localStorage.setItem("bl:sheep-shorn", new Date().toDateString());
      } catch { /* ignore */ }
    }
  }

  return (
    <div className={styles.sheepWrap}>
      <button
        type="button"
        className={`${styles.sheep} ${shaking ? styles.sheepShake : ""}`}
        onClick={poke}
        aria-label={shorn ? "A shorn sheep; its wool grows back tomorrow" : "A sheep, inexplicably"}
        title="baa"
      >
        <svg viewBox="0 0 68 46" width="86" height="58" aria-hidden>
          {/* legs and small hooves */}
          <path d="M19 33v8m17-8v8" stroke="#594a3e" strokeWidth="4" strokeLinecap="round" />
          <path d="M16.5 41h5m11.5 0h5" stroke="#332b25" strokeWidth="2" strokeLinecap="round" />
          {/* wool, laid up as a loose field sketch rather than square blocks */}
          {!shorn && (
            <g className={`${popping ? styles.woolPop : ""}`}>
              <path d="M8 29 C4 25 7 18 12 18 C8 12 14 7 19 10 C21 4 29 5 31 10 C37 5 44 10 43 16 C50 17 52 26 46 30 C42 35 15 35 8 29Z" fill="#f4f0e5" stroke="#b8af9b" strokeWidth="1.3" className={jeb ? styles.jebWool : ""} />
              <path d="M14 18c4-4 8 2 12-2s8 2 13-1M13 25c4-3 9 2 13-1s8 3 15-1" fill="none" stroke="#d3cab6" strokeWidth="1" opacity=".9" />
            </g>
          )}
          {/* shorn body */}
          {shorn && <path d="M10 29C8 20 15 14 29 15c12 0 17 6 15 14-7 5-27 5-34 0Z" fill="#e5bda9" stroke="#bb8d7b" strokeWidth="1.2" />}
          {/* head */}
          <path d="M43 14c4-6 13-2 14 4v8c-2 5-10 6-14 1Z" fill="#dfd1b8" stroke="#ad9d86" strokeWidth="1.2" />
          <path d="M47 14l-1-5m6 5 3-4" stroke="#8b7865" strokeWidth="2" strokeLinecap="round" />
          <ellipse cx="49" cy="20" rx="1.3" ry="1.7" fill="#2b2b2b" />
          <ellipse cx="54" cy="20" rx="1.3" ry="1.7" fill="#2b2b2b" />
          <ellipse cx="52" cy="25" rx="3.2" ry="1.5" fill="#c88888" />
        </svg>
      </button>
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
