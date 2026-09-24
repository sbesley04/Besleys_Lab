"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import styles from "./room.module.css";
import arcade from "../arcade.module.css";
import RoomScene, { VIEW_H, VIEW_W, type Station } from "./RoomScene";
import { Junimo, Sheep } from "./Residents";
import { GAME_CATEGORY_LABELS, games, type GameMeta } from "../registry";
import { useWallet } from "@/lib/walletClient";
import { jukeboxTune } from "@/lib/sound";
import GridText from "@/app/_components/eggs/GridText";

// The arcade hub as a room you stand in. Each piece of furniture is a
// "station": the cabinets, the card table, the puzzle board and the computer
// open a drawer of their games; the slot machine and the prize counter are
// doors to their own pages. Hit areas are HTML buttons/links laid over the
// SVG in viewBox units → percentages, so they stay aligned at any size and
// keep real focus rings and labels.

interface StationDef {
  id: Station;
  title: string;
  /** Handwritten tag in the room. */
  tag: string;
  gridTag: string;
  /** Hit box in viewBox units: x, y, w, h. */
  box: [number, number, number, number];
  /** Where the tag sits (viewBox units) and which way it leans. */
  tagAt: [number, number, number];
  categories?: GameMeta["category"][];
  href?: string;
  blurb: string;
}

export const STATIONS: StationDef[] = [
  {
    id: "arcade", title: "The cabinets", tag: "arcade classics", gridTag: "ARCADE.SYS",
    box: [460, 330, 296, 312], tagAt: [608, 318, -3], categories: ["arcade"],
    blurb: "Two coin-op cabinets humming against the wall. Quick games, high scores.",
  },
  {
    id: "logic", title: "The puzzle board", tag: "puzzles, pinned", gridTag: "LOGIC.BRD",
    box: [842, 238, 200, 156], tagAt: [1100, 262, 4], categories: ["logic"],
    blurb: "Everything pinned to the cork is a problem somebody hasn't finished yet.",
  },
  {
    id: "sims", title: "The computer", tag: "simulations running", gridTag: "SIM.EXE",
    box: [818, 404, 240, 262], tagAt: [1030, 700, -2], categories: ["simulations"],
    blurb: "Left running overnight. Populations evolve, gardens grow, tributes fall.",
  },
  {
    id: "cards", title: "The card table", tag: "card table", gridTag: "CARDS.DAT",
    box: [44, 712, 640, 272], tagAt: [120, 700, -6], categories: ["cards"],
    blurb: "Green felt, a few stacks of chips, and a deck that's seen things.",
  },
  {
    id: "prizes", title: "Prize counter", tag: "spend your zinc", gridTag: "EXCHANGE",
    box: [150, 226, 272, 452], tagAt: [292, 214, 8], href: "/games/prizes",
    blurb: "Trade zinc for decor, upgrades, and small random things.",
  },
  {
    id: "casino", title: "Slot machine", tag: "feeling lucky?", gridTag: "RNG.BET",
    box: [1238, 452, 290, 520], tagAt: [1390, 430, 5], href: "/games/casino",
    blurb: "Luck o' the Lab. Three reels, one payline, zinc is wild.",
  },
];

const pct = (v: number, of: number) => `${(v / of) * 100}%`;
const boxStyle = ([x, y, w, h]: StationDef["box"]) => ({
  left: pct(x, VIEW_W), top: pct(y, VIEW_H), width: pct(w, VIEW_W), height: pct(h, VIEW_H),
});

export default function GameRoom() {
  const { wallet } = useWallet();
  const [hot, setHot] = useState<Station | null>(null);
  const [open, setOpen] = useState<Station | null>(null);
  const drawerRef = useRef<HTMLDivElement>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);

  const owned = useMemo(
    () => new Set(Object.entries(wallet?.owned ?? {}).filter(([, n]) => n > 0).map(([id]) => id)),
    [wallet],
  );

  // On a phone the room is wider than the screen; start looking at the middle.
  useEffect(() => {
    const el = scrollerRef.current;
    if (el && el.scrollWidth > el.clientWidth) el.scrollLeft = (el.scrollWidth - el.clientWidth) / 2;
  }, []);

  // --- the Junimo naps behind a random station, and moves when disturbed ----
  const [junimo, setJunimo] = useState<{ at: Station; left: number } | null>(null);
  const [junimoAwake, setJunimoAwake] = useState(false);
  const scurry = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    const napSpots = STATIONS.filter((s) => s.id !== "cards");
    const pick = napSpots[Math.floor(Math.random() * napSpots.length)];
    setJunimo({ at: pick.id, left: 20 + Math.random() * 60 });
    return () => {
      if (scurry.current) clearTimeout(scurry.current);
    };
  }, []);

  function disturb(id: Station) {
    setHot(id);
    if (!junimo || junimo.at !== id || junimoAwake) return;
    setJunimoAwake(true);
    scurry.current = setTimeout(() => {
      const others = STATIONS.filter((s) => s.id !== id && s.id !== "cards");
      const next = others[Math.floor(Math.random() * others.length)];
      setJunimo({ at: next.id, left: 20 + Math.random() * 60 });
      setJunimoAwake(false);
    }, 620);
  }

  function toggle(id: Station) {
    setOpen((cur) => (cur === id ? null : id));
    // Bring the drawer into view once it has rendered.
    requestAnimationFrame(() => drawerRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }));
  }

  const openDef = STATIONS.find((s) => s.id === open) ?? null;
  const junimoDef = junimo ? STATIONS.find((s) => s.id === junimo.at) : null;

  return (
    <div className={styles.wrap}>
      <div className={styles.scroller} ref={scrollerRef}>
        <div className={styles.room} onMouseLeave={() => setHot(null)}>
          <RoomScene hot={hot ?? open} owned={owned} />

          {/* handwritten tags */}
          {STATIONS.map((s) => (
            <span
              key={`tag-${s.id}`}
              className={`${styles.tag} ${hot === s.id || open === s.id ? styles.tagHot : ""}`}
              style={{ left: pct(s.tagAt[0], VIEW_W), top: pct(s.tagAt[1], VIEW_H), rotate: `${s.tagAt[2]}deg` }}
              aria-hidden
            >
              <GridText paper={s.tag} grid={s.gridTag} />
            </span>
          ))}

          {junimo && junimoDef && (
            <span
              className={`${styles.junimoSpot} ${junimoAwake ? arcade.junimoAwake : ""}`}
              style={{
                left: `calc(${pct(junimoDef.box[0] + (junimoDef.box[2] * junimo.left) / 100, VIEW_W)} - 15px)`,
                top: `calc(${pct(junimoDef.box[1], VIEW_H)} - 16px)`,
              }}
              aria-hidden
            >
              <Junimo />
            </span>
          )}

          {/* hit areas */}
          {STATIONS.map((s) => {
            const count = s.categories ? games.filter((g) => s.categories!.includes(g.category)).length : 0;
            const common = {
              className: styles.hit,
              style: boxStyle(s.box),
              onMouseEnter: () => disturb(s.id),
              onFocus: () => disturb(s.id),
              onBlur: () => setHot(null),
            };
            return s.href ? (
              <Link key={s.id} href={s.href} {...common} aria-label={`${s.title} — ${s.blurb}`} />
            ) : (
              <button
                key={s.id}
                type="button"
                {...common}
                onClick={() => toggle(s.id)}
                aria-expanded={open === s.id}
                aria-controls="room-drawer"
                aria-label={`${s.title}: ${count} game${count === 1 ? "" : "s"}`}
              />
            );
          })}

          {owned.has("jukebox") && (
            <button
              type="button"
              className={styles.hit}
              style={boxStyle([1166, 484, 92, 212])}
              onClick={() => jukeboxTune()}
              aria-label="Jukebox — play a tune"
            />
          )}

          <div className={styles.sheepSpot}>
            <Sheep golden={owned.has("golden-fleece")} />
          </div>
        </div>
      </div>
      <p className={styles.hint}>
        <GridText
          paper="Click something in the room — every piece of furniture has games in it. On a phone, swipe to look around."
          grid="Select an object to enumerate its programs."
        />
      </p>

      <div id="room-drawer" ref={drawerRef} className={styles.drawerAnchor}>
        {openDef && openDef.categories && (
          <section className={`paper-card ${styles.drawer}`} aria-label={openDef.title}>
            <header className={styles.drawerHead}>
              <div>
                <span className={styles.drawerKicker}>
                  {openDef.categories.map((c) => GAME_CATEGORY_LABELS[c]).join(" · ")}
                </span>
                <h2 className={styles.drawerTitle}>{openDef.title}</h2>
                <p className={styles.drawerBlurb}>{openDef.blurb}</p>
              </div>
              <button type="button" className={styles.drawerClose} onClick={() => setOpen(null)} aria-label="Close">
                ×
              </button>
            </header>
            <div className={arcade.grid}>
              {games
                .filter((g) => openDef.categories!.includes(g.category))
                .map((game) => (
                  <Link key={game.slug} href={`/games/${game.slug}`} className={`paper-card ${arcade.card}`}>
                    <span className={arcade.cardTopline}>
                      <GridText paper="Play in browser" grid="Executable" />
                    </span>
                    <h3 className={arcade.cardTitle}>{game.title}</h3>
                    <p className={arcade.cardBlurb}>
                      <GridText paper={game.blurb} grid={game.gridBlurb} />
                    </p>
                    <span className={arcade.cardArrow} aria-hidden>→</span>
                  </Link>
                ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
