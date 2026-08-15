"use client";

import { useCallback, useEffect, useLayoutEffect, useReducer, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import styles from "./solitaire.module.css";
import SaveSlot from "../_components/SaveSlot";
import { unlock, recordPlayed, recordWin, postResult } from "@/lib/arcade";
import {
  dealKlondike, dealSpider, dealFreecell, drawStock, move, autoToFoundation,
  faceDownCount, modeOf, isJoker, isRed, SUIT_GLYPHS, RANK_GLYPHS,
  type SolState, type Loc, type Card, type Variant,
} from "./engine";

// Click-to-move solitaire. First click selects a card (or a run), second click
// drops it. Double-click sends a card to its foundation. All rules live in
// engine.ts — this component is a click router plus timers and scorekeeping.

const MODE_LABELS: Record<string, string> = {
  "klondike-1": "Klondike · draw 1",
  "klondike-3": "Klondike · draw 3",
  "spider-1": "Spider · 1 suit",
  "spider-2": "Spider · 2 suits",
  "spider-4": "Spider · 4 suits",
  freecell: "FreeCell",
};

const FLIP_MS = 460;
const PIP_POSITIONS: Record<number, string[]> = {
  1: ["center"],
  2: ["top", "bottom"],
  3: ["top", "center", "bottom"],
  4: ["topLeft", "topRight", "bottomLeft", "bottomRight"],
  5: ["topLeft", "topRight", "center", "bottomLeft", "bottomRight"],
  6: ["topLeft", "topRight", "middleLeft", "middleRight", "bottomLeft", "bottomRight"],
  7: ["topLeft", "topRight", "upperCenter", "middleLeft", "middleRight", "bottomLeft", "bottomRight"],
  8: ["topLeft", "topRight", "upperCenter", "middleLeft", "middleRight", "lowerCenter", "bottomLeft", "bottomRight"],
  9: ["topLeft", "topRight", "upperCenter", "middleLeft", "middleRight", "center", "bottomLeft", "bottomRight", "lowerCenter"],
  10: ["topLeft", "topRight", "top", "middleLeft", "middleRight", "center", "bottomLeft", "bottomRight", "bottom", "lowerCenter"],
};

interface UI {
  cur: SolState;
  past: SolState[];
  usedUndo: boolean;
  comeback: boolean; // had 40+ face-down after move 10
  dealId: number; // increments per deal/load so win effects fire once
  baseElapsed: number; // ms accumulated before startedAt (loads)
  startedAt: number;
}

function allCards(state: SolState): Card[] {
  return [
    ...state.stock,
    ...state.waste,
    ...state.foundations.flat(),
    ...state.cells.filter((card): card is Card => card !== null),
    ...state.tableau.flat(),
  ];
}

type UIAction =
  | { type: "NEW"; state: SolState }
  | { type: "APPLY"; state: SolState }
  | { type: "UNDO" }
  | { type: "LOAD"; payload: SavePayload };

export interface SavePayload {
  cur: SolState;
  usedUndo: boolean;
  comeback: boolean;
  elapsed: number;
}

function uiReducer(ui: UI, action: UIAction): UI {
  switch (action.type) {
    case "NEW":
      return {
        cur: action.state, past: [], usedUndo: false, comeback: false,
        dealId: ui.dealId + 1, baseElapsed: 0, startedAt: Date.now(),
      };
    case "APPLY": {
      const comeback =
        ui.comeback || (action.state.moves >= 10 && faceDownCount(action.state) >= 40);
      return { ...ui, cur: action.state, past: [...ui.past.slice(-499), ui.cur], comeback };
    }
    case "UNDO": {
      if (ui.past.length === 0 || ui.cur.won) return ui;
      const past = ui.past.slice();
      const cur = past.pop()!;
      return { ...ui, cur, past, usedUndo: true };
    }
    case "LOAD":
      return {
        cur: action.payload.cur, past: [], usedUndo: action.payload.usedUndo,
        comeback: action.payload.comeback, dealId: ui.dealId + 1,
        baseElapsed: action.payload.elapsed, startedAt: Date.now(),
      };
    default:
      return ui;
  }
}

function bumpCounter(key: string): number {
  try {
    const n = (parseInt(localStorage.getItem(key) ?? "0", 10) || 0) + 1;
    localStorage.setItem(key, String(n));
    return n;
  } catch {
    return 0;
  }
}

function addToSet(key: string, value: string): Set<string> {
  try {
    const set = new Set<string>(JSON.parse(localStorage.getItem(key) ?? "[]"));
    set.add(value);
    localStorage.setItem(key, JSON.stringify([...set]));
    return set;
  } catch {
    return new Set([value]);
  }
}

function fmtTime(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

// Fixed-seed rng for the SSR placeholder deal — server and client must render
// identical markup, so the real (random) deal happens after mount.
function placeholderRng(): () => number {
  let s = 0x5eed;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

export default function Solitaire() {
  const [ui, dispatch] = useReducer(
    uiReducer,
    undefined,
    (): UI => ({
      cur: dealKlondike(1, placeholderRng(), false), past: [], usedUndo: false, comeback: false,
      dealId: 0, baseElapsed: 0, startedAt: Date.now(),
    }),
  );
  const { cur } = ui;
  const [selected, setSelected] = useState<Loc | null>(null);
  const [now, setNow] = useState(Date.now());
  const [finalElapsed, setFinalElapsed] = useState<number | null>(null);
  const [scoreRefresh, setScoreRefresh] = useState(0);
  const [flippingIds, setFlippingIds] = useState<Set<number>>(() => new Set());
  const uiRef = useRef(ui);
  const cardRefs = useRef(new Map<number, HTMLButtonElement>());
  const departingRects = useRef(new Map<number, DOMRect>());
  const flipTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  uiRef.current = ui;

  // After mount, swap the SSR placeholder for a real random deal.
  useEffect(() => {
    recordPlayed("solitaire");
    newGame("klondike", 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Ticking clock while a game is live.
  useEffect(() => {
    if (cur.won) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [cur.won, ui.dealId]);

  // FLIP-style motion: capture a card's previous screen location before the
  // reducer moves it, then animate it from that location after React paints
  // its new pile. It works for tableau runs, free cells, waste, and foundations.
  useLayoutEffect(() => {
    if (departingRects.current.size === 0) return;
    const previous = departingRects.current;
    departingRects.current = new Map();
    const frame = requestAnimationFrame(() => {
      previous.forEach((from, id) => {
        const card = cardRefs.current.get(id);
        if (!card) return;
        const to = card.getBoundingClientRect();
        const dx = from.left - to.left;
        const dy = from.top - to.top;
        const sx = from.width / Math.max(to.width, 1);
        const sy = from.height / Math.max(to.height, 1);
        if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return;
        card.animate(
          [
            { transform: `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})`, zIndex: 20 },
            { transform: "translate(0, 0) scale(1, 1)", zIndex: 20 },
          ],
          { duration: 310, easing: "cubic-bezier(.2,.82,.22,1)", fill: "none" },
        );
      });
    });
    return () => cancelAnimationFrame(frame);
  }, [cur]);

  useEffect(() => () => {
    if (flipTimer.current) clearTimeout(flipTimer.current);
  }, []);
  // Frozen at the winning move — reading the live expression after a win
  // collapses to baseElapsed (0:00 on a fresh deal), and recomputing
  // Date.now() during render made the banner drift on every re-render.
  const elapsed = cur.won && finalElapsed !== null
    ? finalElapsed
    : Math.max(0, ui.baseElapsed + (now - ui.startedAt));

  // Card 53: unlock the moment the joker is visible anywhere.
  const jokerVisible =
    cur.hasJoker &&
    (cur.waste.some((c) => isJoker(c) && c.faceUp) ||
      cur.tableau.some((p) => p.some((c) => isJoker(c) && c.faceUp)));
  useEffect(() => {
    if (jokerVisible) unlock("sol-card-53");
  }, [jokerVisible]);

  // Win effects — once per deal.
  const wonDealRef = useRef(-1);
  useEffect(() => {
    if (!cur.won || wonDealRef.current === ui.dealId) return;
    wonDealRef.current = ui.dealId;
    const timeMs = ui.baseElapsed + (Date.now() - ui.startedAt);
    setFinalElapsed(timeMs); // freeze the clock at the winning move
    const mode = modeOf(cur);

    postResult({
      game: "solitaire", mode, event: "win", timeMs, moves: cur.moves,
      meta: { assisted: cur.jokerUsed },
    });
    recordWin("solitaire");

    if (!ui.usedUndo) unlock("sol-clean-sweep");
    if (cur.variant === "klondike" && timeMs < 3 * 60_000) unlock("sol-speed-run");
    if (timeMs > 30 * 60_000) unlock("sol-thoughtful");
    if (cur.variant === "klondike" && cur.draw === 3) unlock("sol-vegas");
    if (ui.comeback) unlock("sol-comeback");
    const wonVariants = addToSet("bl:sol-won-variants", cur.variant);
    if (["klondike", "spider", "freecell"].every((v) => wonVariants.has(v))) {
      unlock("sol-triple-crown");
    }
    setScoreRefresh((n) => n + 1);
  }, [cur, ui]);

  function afterDeal(state: SolState) {
    postResult({ game: "solitaire", mode: modeOf(state), event: "deal" });
    if (bumpCounter("bl:sol-deals") >= 100) unlock("sol-centurion");
  }

  function newGame(variant: Variant, opt: number) {
    const state =
      variant === "klondike" ? dealKlondike(opt) :
      variant === "spider" ? dealSpider(opt) : dealFreecell();
    dispatch({ type: "NEW", state });
    setSelected(null);
    setFinalElapsed(null);
    setNow(Date.now());
    afterDeal(state);
  }

  const apply = useCallback((state: SolState | null): boolean => {
    if (!state) return false;
    const previousCards = allCards(cur);
    const nextCards = allCards(state);
    const nextIds = new Set(nextCards.map((c) => c.id));
    const rects = new Map<number, DOMRect>();
    cardRefs.current.forEach((node, id) => {
      if (nextIds.has(id)) rects.set(id, node.getBoundingClientRect());
    });
    departingRects.current = rects;

    const wasFaceDown = new Set(previousCards.filter((c) => !c.faceUp).map((c) => c.id));
    const revealed = nextCards.filter((c) => c.faceUp && wasFaceDown.has(c.id)).map((c) => c.id);
    if (revealed.length) {
      setFlippingIds(new Set(revealed));
      if (flipTimer.current) clearTimeout(flipTimer.current);
      flipTimer.current = setTimeout(() => setFlippingIds(new Set()), FLIP_MS);
    }
    dispatch({ type: "APPLY", state });
    setSelected(null);
    return true;
  }, [cur]);

  /** Second-click handler: try to drop the selection onto `to`. */
  function drop(to: Loc): boolean {
    if (!selected) return false;
    return apply(move(cur, selected, to));
  }

  function clickStock() {
    setSelected(null);
    apply(drawStock(cur));
  }

  function clickCard(loc: Loc) {
    // A click on a card inside pile X is also a drop attempt onto X.
    if (selected) {
      const target: Loc = loc.zone === "tableau" ? { zone: "tableau", i: loc.i, index: 0 } : loc;
      if (drop(target)) return;
      if (sameLoc(selected, loc)) {
        setSelected(null);
        return;
      }
    }
    setSelected(loc);
  }

  function sameLoc(a: Loc, b: Loc): boolean {
    return JSON.stringify(a) === JSON.stringify(b);
  }

  function isSelected(loc: Loc): boolean {
    if (!selected) return false;
    if (selected.zone === "tableau" && loc.zone === "tableau") {
      return selected.i === loc.i && loc.index >= selected.index;
    }
    return sameLoc(selected, loc);
  }

  function doubleClick(loc: Loc) {
    setSelected(null);
    apply(autoToFoundation(cur, loc));
  }

  // --- rendering -------------------------------------------------------------

  function cardFace(c: Card) {
    const color = isJoker(c) ? styles.joker : isRed(c) ? styles.red : styles.black;
    const courtClass = c.rank === 11 ? styles.jack : c.rank === 12 ? styles.queen : c.rank === 13 ? styles.king : "";
    const rank = isJoker(c) ? "J" : RANK_GLYPHS[c.rank];
    const suit = isJoker(c) ? "✦" : SUIT_GLYPHS[c.suit];
    return (
      <>
        <span className={`${styles.corner} ${styles.cornerTop} ${color}`} aria-hidden>
          <span>{rank}</span>
          <span className={styles.cornerSuit}>{suit}</span>
        </span>
        {c.rank >= 11 && c.rank <= 13 && !isJoker(c) ? (
          <span className={styles.courtField} aria-hidden>
            <span className={`${styles.courtPortrait} ${styles.courtTop} ${courtClass}`} />
            <span className={`${styles.courtPortrait} ${styles.courtBottom} ${courtClass}`} />
            <span className={`${styles.courtSuit} ${color}`}><span>{suit}</span></span>
          </span>
        ) : !isJoker(c) ? (
          <span className={`${styles.pipField} ${color}`} aria-hidden>
            {PIP_POSITIONS[c.rank]?.map((position, i) => (
              <span
                key={`${c.id}-${i}`}
                className={`${styles.cardPip} ${c.rank === 1 ? styles.acePip : ""} ${styles[position]}`}
              >
                {suit}
              </span>
            ))}
          </span>
        ) : (
          <span className={`${styles.jokerArt} ${color}`} aria-hidden>
            <span>✦</span>
            <small>JOKER</small>
          </span>
        )}
        <span className={`${styles.corner} ${styles.cornerBottom} ${color}`} aria-hidden>
          <span>{rank}</span>
          <span className={styles.cornerSuit}>{suit}</span>
        </span>
      </>
    );
  }

  function renderCard(c: Card, loc: Loc, stackedClass?: string) {
    const cls = [
      styles.card,
      c.faceUp ? "" : styles.faceDown,
      isJoker(c) && c.faceUp ? styles.jokerCard : "",
      stackedClass ?? "",
      isSelected(loc) ? styles.selected : "",
      flippingIds.has(c.id) ? styles.flipping : "",
    ].join(" ");
    return (
      <button
        key={c.id}
        type="button"
        className={cls}
        ref={(node) => {
          if (node) cardRefs.current.set(c.id, node);
          else cardRefs.current.delete(c.id);
        }}
        onClick={() => (c.faceUp ? clickCard(loc) : undefined)}
        onDoubleClick={() => (c.faceUp ? doubleClick(loc) : undefined)}
        aria-label={
          c.faceUp
            ? isJoker(c) ? "Joker" : `${RANK_GLYPHS[c.rank]} of ${SUIT_GLYPHS[c.suit]}`
            : "Face-down card"
        }
      >
        {c.faceUp ? cardFace(c) : null}
      </button>
    );
  }

  function renderPile(pile: Card[], i: number) {
    if (pile.length === 0) {
      return (
        <button
          key={`empty-${i}`}
          type="button"
          className={styles.slot}
          onClick={() => drop({ zone: "tableau", i, index: 0 })}
          aria-label={`Empty column ${i + 1}`}
        />
      );
    }
    return (
      <div key={i} className={styles.pile}>
        {pile.map((c, j) => {
          const stackedClass =
            j === 0 ? undefined : pile[j - 1].faceUp ? styles.stacked : styles.stackedTight;
          return renderCard(c, { zone: "tableau", i, index: j }, stackedClass);
        })}
      </div>
    );
  }

  const wasteTop = cur.waste[cur.waste.length - 1];
  const wide = cur.variant !== "klondike";

  return (
    <div className={styles.layout}>
      <div className={styles.controls} role="group" aria-label="Variant">
        {(
          [
            ["klondike", 1, "Klondike"],
            ["klondike", 3, "Klondike (draw 3)"],
            ["spider", 1, "Spider (1 suit)"],
            ["spider", 2, "Spider (2 suits)"],
            ["spider", 4, "Spider (4 suits)"],
            ["freecell", 0, "FreeCell"],
          ] as [Variant, number, string][]
        ).map(([variant, opt, label]) => {
          const active = modeOf(cur) === (variant === "klondike" ? `klondike-${opt}` : variant === "spider" ? `spider-${opt}` : "freecell");
          return (
            <button
              key={label}
              type="button"
              className={`${styles.button} ${active ? styles.buttonActive : ""}`}
              onClick={() => newGame(variant, opt)}
            >
              {label}
            </button>
          );
        })}
      </div>

      <div className={styles.statusRow}>
        <span>⏱ {fmtTime(elapsed)}</span>
        <span>{cur.moves} moves</span>
        <button type="button" className={styles.button} onClick={() => dispatch({ type: "UNDO" })} disabled={ui.past.length === 0 || cur.won}>
          ↩ Undo
        </button>
        <button type="button" className={styles.button} onClick={() => newGame(cur.variant, cur.variant === "klondike" ? cur.draw : cur.suits)}>
          ↻ New deal
        </button>
      </div>

      {cur.won && (
        <div className={styles.winBanner}>
          <strong style={{ fontFamily: "var(--font-display)", fontSize: "1.3rem" }}>
            You won{cur.jokerUsed ? " (with a little help from a friend)" : ""}! 🎉
          </strong>
          <p className={styles.help} style={{ marginTop: "0.3rem" }}>
            {MODE_LABELS[modeOf(cur)]} · {fmtTime(elapsed)} · {cur.moves} moves
            {cur.jokerUsed ? " · assisted" : ""}
          </p>
        </div>
      )}

      <div className={`${styles.table} ${wide ? styles.tableWide : ""}`}>
        <div className={styles.topRow}>
          <div className={styles.pileGroup}>
            {/* Stock */}
            {cur.variant !== "freecell" && (
              cur.stock.length > 0 ? (
                <button
                  type="button"
                  className={`${styles.card} ${styles.faceDown}`}
                  ref={(node) => {
                    const top = cur.stock[cur.stock.length - 1];
                    if (!top) return;
                    if (node) cardRefs.current.set(top.id, node);
                    else cardRefs.current.delete(top.id);
                  }}
                  onClick={clickStock}
                  aria-label={`Stock, ${cur.stock.length} cards`}
                >
                </button>
              ) : (
                <button type="button" className={styles.slot} onClick={clickStock} aria-label="Empty stock">
                  ↻
                </button>
              )
            )}
            {/* Waste (Klondike) */}
            {cur.variant === "klondike" &&
              (wasteTop ? (
                renderCard(wasteTop, { zone: "waste" })
              ) : (
                <span className={styles.slot} aria-label="Empty waste" />
              ))}
            {/* Free cells */}
            {cur.variant === "freecell" &&
              cur.cells.map((c, i) =>
                c ? (
                  renderCard(c, { zone: "cell", i })
                ) : (
                  <button key={`cell-${i}`} type="button" className={styles.slot} onClick={() => drop({ zone: "cell", i })} aria-label={`Free cell ${i + 1}`} />
                ),
              )}
          </div>

          <div className={styles.pileGroup}>
            {/* Foundations */}
            {cur.variant === "spider" ? (
              <span className={styles.slot} aria-label="Completed runs" style={{ cursor: "default" }}>
                {cur.foundations.length}/8
              </span>
            ) : (
              cur.foundations.map((pile, i) => {
                const top = pile[pile.length - 1];
                return top ? (
                  <button
                    key={`f-${i}`}
                    type="button"
                    className={styles.card}
                    ref={(node) => {
                      if (node) cardRefs.current.set(top.id, node);
                      else cardRefs.current.delete(top.id);
                    }}
                    onClick={() => drop({ zone: "foundation", i })}
                    aria-label={`Foundation ${i + 1}`}
                  >
                    {cardFace(top)}
                  </button>
                ) : (
                  <button key={`f-${i}`} type="button" className={styles.slot} onClick={() => drop({ zone: "foundation", i })} aria-label={`Empty foundation ${i + 1}`}>
                    A
                  </button>
                );
              })
            )}
          </div>
        </div>

        <div
          className={styles.columns}
          style={{ gridTemplateColumns: `repeat(${cur.tableau.length}, minmax(0, 1fr))` }}
        >
          {cur.tableau.map((pile, i) => renderPile(pile, i))}
        </div>
      </div>

      <p className={styles.help}>
        Click a card to pick it up, click where it should go. Double-click sends a card to its
        foundation. {cur.variant === "spider" ? "Click the stock to deal a new row (no empty columns allowed)." : ""}
      </p>

      <SaveSlot<SavePayload>
        game="solitaire"
        getState={() => ({
          cur: uiRef.current.cur,
          usedUndo: uiRef.current.usedUndo,
          comeback: uiRef.current.comeback,
          elapsed: uiRef.current.baseElapsed + (Date.now() - uiRef.current.startedAt),
        })}
        onLoad={(payload) => {
          dispatch({ type: "LOAD", payload });
          setSelected(null);
          setFinalElapsed(null);
          setNow(Date.now());
        }}
        validate={(s): s is SavePayload =>
          !!s && typeof s === "object" && !!(s as SavePayload).cur &&
          Array.isArray((s as SavePayload).cur.tableau)
        }
      />

      <HighScores refresh={scoreRefresh} />
    </div>
  );
}

// --- personal bests panel ----------------------------------------------------

interface Summary {
  byMode: Record<string, { deals: number; wins: number; bestTimeMs: number | null; fewestMoves: number | null }>;
}

function HighScores({ refresh }: { refresh: number }) {
  const { data: session } = useSession();
  const [summary, setSummary] = useState<Summary | null>(null);

  useEffect(() => {
    if (!session?.user) return;
    fetch("/api/results?game=solitaire")
      .then((r) => (r.ok ? r.json() : null))
      .then(setSummary)
      .catch(() => {});
  }, [session?.user, refresh]);

  if (!session?.user) {
    return <p className={styles.help}>Sign in and your wins, best times, and fewest-move records collect here.</p>;
  }
  const modes = summary ? Object.keys(summary.byMode).filter((m) => MODE_LABELS[m]) : [];
  if (modes.length === 0) return null;

  return (
    <div>
      <h3 style={{ fontFamily: "var(--font-display)", fontSize: "1.15rem", margin: "0 0 0.4rem" }}>
        Personal bests
      </h3>
      <table className={styles.scoreTable}>
        <thead>
          <tr><th>Variant</th><th>Wins</th><th>Deals</th><th>Best time</th><th>Fewest moves</th></tr>
        </thead>
        <tbody>
          {modes.sort().map((m) => {
            const s = summary!.byMode[m];
            return (
              <tr key={m}>
                <td>{MODE_LABELS[m]}</td>
                <td>{s.wins}</td>
                <td>{s.deals}</td>
                <td>{s.bestTimeMs != null ? fmtTime(s.bestTimeMs) : "—"}</td>
                <td>{s.fewestMoves ?? "—"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
