"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useReducer, useRef, useState, type CSSProperties } from "react";
import { useSession } from "next-auth/react";
import styles from "./solitaire.module.css";
import SaveSlot from "../_components/SaveSlot";
import { unlock, recordPlayed, recordWin, postResult } from "@/lib/arcade";
import {
  dealKlondike, dealSpider, dealFreecell, drawStock, move, autoToFoundation, pickUp,
  autoFinishStep, canAutoFinish, faceDownCount, modeOf, isJoker, isRed, SUIT_GLYPHS, RANK_GLYPHS,
  type SolState, type Loc, type Card, type Variant,
} from "./engine";

// Solitaire table. Cards can be dragged, or clicked once to pick up and again
// where they should go; double-click sends a card home. All rules live in
// engine.ts — this component routes input, keeps the clock, and animates.

const MODE_LABELS: Record<string, string> = {
  "klondike-1": "Klondike · draw 1",
  "klondike-3": "Klondike · draw 3",
  "spider-1": "Spider · 1 suit",
  "spider-2": "Spider · 2 suits",
  "spider-4": "Spider · 4 suits",
  freecell: "FreeCell",
};

const FLIP_MS = 460;
const DRAG_THRESHOLD_PX = 6;
const AUTO_FINISH_STEP_MS = 85;
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
const RANK_NAMES = ["Joker", "Ace", "2", "3", "4", "5", "6", "7", "8", "9", "10", "Jack", "Queen", "King"];
const SUIT_NAMES = ["spades", "hearts", "diamonds", "clubs"];

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

function cardName(c: Card): string {
  return isJoker(c) ? "Joker" : `${RANK_NAMES[c.rank]} of ${SUIT_NAMES[c.suit]}`;
}

function sameLoc(a: Loc, b: Loc): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/** Drop zones carry `data-drop="tableau-3"` etc.; this turns one back into a Loc. */
function parseDrop(value: string | undefined): Loc | null {
  if (!value) return null;
  const [zone, n] = value.split("-");
  const i = Number(n);
  if (!Number.isInteger(i)) return null;
  if (zone === "tableau") return { zone, i, index: 0 };
  if (zone === "foundation" || zone === "cell") return { zone, i };
  return null;
}

/** Long columns fan tighter so a 20-card Spider run doesn't run off the page. */
function fanFor(pile: Card[]): number {
  const faceUp = pile.filter((c) => c.faceUp).length;
  return Math.max(0.32, Math.min(0.42, 5.4 / Math.max(1, faceUp)));
}

interface Drag {
  from: Loc;
  ids: number[];
  pointerId: number;
  x0: number;
  y0: number;
  active: boolean;
  nodes: HTMLElement[];
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
  const [finishing, setFinishing] = useState(false);
  const uiRef = useRef(ui);
  const tableRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef(new Map<number, HTMLElement>());
  const departingRects = useRef(new Map<number, DOMRect>());
  const flipTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const finishTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dragRef = useRef<Drag | null>(null);
  const suppressClickUntil = useRef(0);
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

  // FLIP-style motion: animate each card from where it was to where it is now.
  // Shared by ordinary moves (rects captured just before the reducer runs) and
  // by rejected drags gliding back to their pile.
  const flipFrom = useCallback((previous: Map<number, DOMRect>) => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
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
  }, []);

  // Runs before paint, so a moved card never flashes at its destination first.
  useLayoutEffect(() => {
    if (departingRects.current.size === 0) return;
    const previous = departingRects.current;
    departingRects.current = new Map();
    flipFrom(previous);
  }, [cur, flipFrom]);

  useEffect(() => () => {
    if (flipTimer.current) clearTimeout(flipTimer.current);
    if (finishTimer.current) clearTimeout(finishTimer.current);
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

  function stopAutoFinish() {
    if (finishTimer.current) clearTimeout(finishTimer.current);
    finishTimer.current = null;
    setFinishing(false);
  }

  function afterDeal(state: SolState) {
    postResult({ game: "solitaire", mode: modeOf(state), event: "deal" });
    if (bumpCounter("bl:sol-deals") >= 100) unlock("sol-centurion");
  }

  function newGame(variant: Variant, opt: number) {
    const state =
      variant === "klondike" ? dealKlondike(opt) :
      variant === "spider" ? dealSpider(opt) : dealFreecell();
    stopAutoFinish();
    dispatch({ type: "NEW", state });
    setSelected(null);
    setFinalElapsed(null);
    setNow(Date.now());
    afterDeal(state);
  }

  function undo() {
    stopAutoFinish();
    setSelected(null);
    dispatch({ type: "UNDO" });
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
  const applyRef = useRef(apply);
  applyRef.current = apply;

  // --- end-game cleanup --------------------------------------------------------

  const autoFinishReady = useMemo(() => canAutoFinish(cur), [cur]);

  function startAutoFinish() {
    if (finishing) return;
    setFinishing(true);
    setSelected(null);
    const stepOnce = () => {
      const next = autoFinishStep(uiRef.current.cur);
      if (!next) {
        stopAutoFinish();
        return;
      }
      applyRef.current(next);
      if (next.won) {
        stopAutoFinish();
        return;
      }
      finishTimer.current = setTimeout(stepOnce, AUTO_FINISH_STEP_MS);
    };
    stepOnce();
  }

  // --- click-to-move ---------------------------------------------------------

  /** Second-click handler: try to drop the selection onto `to`. */
  function drop(to: Loc): boolean {
    if (!selected) return false;
    return apply(move(cur, selected, to));
  }

  function clickStock() {
    if (finishing) return;
    setSelected(null);
    apply(drawStock(cur));
  }

  function clickCard(loc: Loc) {
    if (finishing) return;
    // A click on a card inside pile X is also a drop attempt onto X.
    if (selected) {
      const target: Loc = loc.zone === "tableau" ? { zone: "tableau", i: loc.i, index: 0 } : loc;
      if (drop(target)) return;
      if (sameLoc(selected, loc)) {
        setSelected(null);
        return;
      }
    }
    setSelected(pickUp(cur, loc) ? loc : null);
  }

  /** Face-down cards and the open space under a column are drop targets too. */
  function clickPileArea(i: number) {
    if (finishing || !selected) return;
    if (!drop({ zone: "tableau", i, index: 0 })) setSelected(null);
  }

  function isSelected(loc: Loc): boolean {
    if (!selected) return false;
    if (selected.zone === "tableau" && loc.zone === "tableau") {
      return selected.i === loc.i && loc.index >= selected.index;
    }
    return sameLoc(selected, loc);
  }

  function doubleClick(loc: Loc) {
    if (finishing) return;
    setSelected(null);
    apply(autoToFoundation(cur, loc));
  }

  // --- drag-and-drop ---------------------------------------------------------
  // Pointer events drive a lightweight drag: the lifted cards follow the
  // pointer via inline transforms (React never re-renders mid-drag), and on
  // release the zone under the pointer — or else the one the lead card
  // overlaps most — is tried first. A press that never travels past the
  // threshold stays an ordinary click.

  function startPress(e: React.PointerEvent, loc: Loc) {
    if (e.button !== 0 || !e.isPrimary || cur.won || finishing) return;
    const group = pickUp(cur, loc);
    if (!group) return;
    dragRef.current = {
      from: loc, ids: group.map((c) => c.id), pointerId: e.pointerId,
      x0: e.clientX, y0: e.clientY, active: false, nodes: [],
    };
  }

  function releaseNodes(nodes: HTMLElement[]) {
    for (const n of nodes) {
      n.style.transform = "";
      delete n.dataset.dragging;
    }
  }

  function dropCandidates(x: number, y: number, lead: DOMRect | undefined): Loc[] {
    const zones = [...(tableRef.current?.querySelectorAll<HTMLElement>("[data-drop]") ?? [])];
    return zones
      .map((zone) => {
        const r = zone.getBoundingClientRect();
        const underPointer = x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
        const overlap = lead
          ? Math.max(0, Math.min(r.right, lead.right) - Math.max(r.left, lead.left)) *
            Math.max(0, Math.min(r.bottom, lead.bottom) - Math.max(r.top, lead.top))
          : 0;
        return { loc: parseDrop(zone.dataset.drop), score: (underPointer ? 1e9 : 0) + overlap };
      })
      .filter((z): z is { loc: Loc; score: number } => z.loc !== null && z.score > 0)
      .sort((a, b) => b.score - a.score)
      .map((z) => z.loc);
  }

  const dragHandlers = useRef<{
    move: (e: PointerEvent) => void;
    end: (e: PointerEvent) => void;
    cancel: () => void;
  }>({ move: () => {}, end: () => {}, cancel: () => {} });
  dragHandlers.current.move = (e) => {
    const d = dragRef.current;
    if (!d || e.pointerId !== d.pointerId) return;
    const dx = e.clientX - d.x0;
    const dy = e.clientY - d.y0;
    if (!d.active) {
      if (Math.hypot(dx, dy) < DRAG_THRESHOLD_PX) return;
      d.active = true;
      d.nodes = d.ids.map((id) => cardRefs.current.get(id)).filter((n): n is HTMLElement => !!n);
      for (const n of d.nodes) n.dataset.dragging = "true";
      setSelected(null);
    }
    for (const n of d.nodes) n.style.transform = `translate(${dx}px, ${dy}px)`;
  };
  dragHandlers.current.end = (e) => {
    const d = dragRef.current;
    if (!d || e.pointerId !== d.pointerId) return;
    dragRef.current = null;
    if (!d.active) return; // never left the threshold — the click handler takes it
    // The click that follows this pointerup belongs to the drag, not the table.
    suppressClickUntil.current = performance.now() + 300;
    const rects = new Map<number, DOMRect>();
    d.nodes.forEach((n, k) => rects.set(d.ids[k], n.getBoundingClientRect()));
    for (const to of dropCandidates(e.clientX, e.clientY, d.nodes[0]?.getBoundingClientRect())) {
      const next = move(uiRef.current.cur, d.from, to);
      if (next) {
        applyRef.current(next); // measures the cards while they're still under the pointer
        releaseNodes(d.nodes);
        return;
      }
    }
    releaseNodes(d.nodes);
    flipFrom(rects); // nowhere legal — glide back home
  };
  dragHandlers.current.cancel = () => {
    const d = dragRef.current;
    dragRef.current = null;
    if (d?.active) releaseNodes(d.nodes);
  };

  useEffect(() => {
    const onMove = (e: PointerEvent) => dragHandlers.current.move(e);
    const onUp = (e: PointerEvent) => dragHandlers.current.end(e);
    const onCancel = () => dragHandlers.current.cancel();
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onCancel);
    // Releasing outside the window (or tabbing away mid-drag) must not leave a
    // card stranded under the cursor.
    window.addEventListener("blur", onCancel);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onCancel);
      window.removeEventListener("blur", onCancel);
    };
  }, []);

  // Esc drops a held card; Ctrl/Cmd+Z undoes.
  const undoRef = useRef(undo);
  undoRef.current = undo;
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      if (target?.closest("input, select, textarea, [contenteditable='true']")) return;
      if (e.key === "Escape") setSelected(null);
      else if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key.toLowerCase() === "z") {
        e.preventDefault();
        undoRef.current();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // --- rendering -------------------------------------------------------------

  const registerCard = (id: number) => (node: HTMLElement | null) => {
    if (node) cardRefs.current.set(id, node);
    else cardRefs.current.delete(id);
  };

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

  function renderCard(c: Card, loc: Loc, opts: { stackedClass?: string; style?: CSSProperties; extraClass?: string } = {}) {
    const cls = [
      styles.card,
      c.faceUp ? "" : styles.faceDown,
      isJoker(c) && c.faceUp ? styles.jokerCard : "",
      opts.stackedClass ?? "",
      opts.extraClass ?? "",
      isSelected(loc) ? styles.selected : "",
      flippingIds.has(c.id) ? styles.flipping : "",
    ].join(" ");
    return (
      <button
        key={c.id}
        type="button"
        className={cls}
        style={opts.style}
        ref={registerCard(c.id)}
        onPointerDown={c.faceUp ? (e) => startPress(e, loc) : undefined}
        onClick={() => {
          if (c.faceUp) clickCard(loc);
          else if (loc.zone === "tableau") clickPileArea(loc.i);
        }}
        onDoubleClick={() => (c.faceUp ? doubleClick(loc) : undefined)}
        tabIndex={c.faceUp ? 0 : -1}
        aria-disabled={!c.faceUp}
        aria-pressed={c.faceUp ? isSelected(loc) : undefined}
        aria-label={c.faceUp ? cardName(c) : "Face-down card"}
      >
        {c.faceUp ? cardFace(c) : null}
      </button>
    );
  }

  function renderPile(pile: Card[], i: number) {
    return (
      <div
        key={i}
        className={styles.pile}
        data-drop={`tableau-${i}`}
        style={{ "--fan": fanFor(pile) } as CSSProperties}
        onClick={(e) => {
          if (e.target === e.currentTarget) clickPileArea(i);
        }}
      >
        {pile.length === 0 ? (
          <button
            type="button"
            className={styles.slot}
            onClick={() => clickPileArea(i)}
            aria-label={`Empty column ${i + 1}`}
          />
        ) : (
          pile.map((c, j) => {
            const stackedClass =
              j === 0 ? undefined : pile[j - 1].faceUp ? styles.stacked : styles.stackedTight;
            return renderCard(c, { zone: "tableau", i, index: j }, { stackedClass });
          })
        )}
      </div>
    );
  }

  function clickFoundation(i: number) {
    if (finishing) return;
    const loc: Loc = { zone: "foundation", i };
    if (selected) {
      if (drop(loc)) return;
      if (sameLoc(selected, loc)) {
        setSelected(null);
        return;
      }
    }
    setSelected(pickUp(cur, loc) ? loc : null);
  }

  function renderFoundation(pile: Card[], i: number, column: number) {
    const top = pile[pile.length - 1];
    const loc: Loc = { zone: "foundation", i };
    return (
      <div key={`f-${i}`} className={styles.zone} data-drop={`foundation-${i}`} style={{ gridColumn: column }}>
        {top ? (
          <button
            type="button"
            className={`${styles.card} ${styles.foundationCard} ${isSelected(loc) ? styles.selected : ""}`}
            style={{ "--i": i } as CSSProperties}
            ref={registerCard(top.id)}
            onPointerDown={(e) => startPress(e, loc)}
            onClick={() => clickFoundation(i)}
            aria-label={`Foundation ${i + 1}: ${cardName(top)}`}
            aria-pressed={isSelected(loc)}
          >
            {cardFace(top)}
          </button>
        ) : (
          <button type="button" className={styles.slot} onClick={() => clickFoundation(i)} aria-label={`Empty foundation ${i + 1}`}>
            A
          </button>
        )}
      </div>
    );
  }

  function renderStock() {
    const top = cur.stock[cur.stock.length - 1];
    const spider = cur.variant === "spider";
    const count = spider ? Math.ceil(cur.stock.length / 10) : cur.stock.length;
    return (
      <div className={styles.zone} style={{ gridColumn: 1 }}>
        {top ? (
          <button
            type="button"
            className={`${styles.card} ${styles.faceDown} ${cur.stock.length > 1 ? styles.stockStack : ""}`}
            ref={registerCard(top.id)}
            onClick={clickStock}
            aria-label={spider ? `Stock: ${count} deal${count === 1 ? "" : "s"} left` : `Stock, ${count} cards`}
          >
            <span className={styles.stockCount} aria-hidden>{spider ? `${count}×` : count}</span>
          </button>
        ) : spider ? (
          <span className={styles.slot} aria-label="Stock empty" />
        ) : (
          <button type="button" className={styles.slot} onClick={clickStock} aria-label="Recycle the waste pile" disabled={cur.waste.length === 0}>
            ↻
          </button>
        )}
      </div>
    );
  }

  function renderWaste() {
    // Draw-3 fans the last three flips so you can see what's coming back
    // around; only the top one is playable.
    const fan = cur.waste.slice(cur.draw === 3 ? -3 : -1);
    return (
      <div className={styles.waste} style={{ gridColumn: "2 / span 2" }}>
        {fan.length === 0 ? (
          <span className={styles.slot} aria-label="Empty waste" />
        ) : (
          fan.map((c, k) => {
            const style = { "--fan-i": k } as CSSProperties;
            if (k === fan.length - 1) return renderCard(c, { zone: "waste" }, { extraClass: styles.fanCard, style });
            return (
              <div key={c.id} ref={registerCard(c.id)} className={`${styles.card} ${styles.fanCard}`} style={style} aria-hidden>
                {cardFace(c)}
              </div>
            );
          })
        )}
      </div>
    );
  }

  function renderSpiderRuns() {
    const runs = cur.foundations;
    const king = runs[runs.length - 1]?.[0];
    return (
      <div className={styles.zone} style={{ gridColumn: cur.tableau.length }}>
        {king ? (
          <div ref={registerCard(king.id)} className={`${styles.card} ${styles.foundationCard}`} style={{ "--i": 0 } as CSSProperties} aria-label={`${runs.length} of 8 runs complete`} role="img">
            {cardFace(king)}
            <span className={styles.runCount} aria-hidden>{runs.length}/8</span>
          </div>
        ) : (
          <span className={styles.slot} aria-label="Completed runs: 0 of 8" style={{ cursor: "default" }}>
            0/8
          </span>
        )}
      </div>
    );
  }

  const tableClass = [
    styles.table,
    cur.variant === "spider" ? styles.tableSpider : cur.variant === "freecell" ? styles.tableFreecell : "",
    cur.won ? styles.celebrate : "",
  ].join(" ");

  const help =
    cur.variant === "spider"
      ? "Drag a card or a single-suit run, or click it and then click where it goes. A finished K→A run of one suit clears itself. Click the stock to deal a new row — every column needs a card first."
      : cur.variant === "freecell"
        ? "Drag cards, or click one and then click where it goes. Park single cards in the four free cells; how many cards you can move at once grows with empty cells and columns. Double-click sends a card home."
        : "Drag cards, or click one and then click where it goes. Double-click sends a card to its foundation — and a foundation card can come back down if you need it.";

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
              aria-pressed={active}
            >
              {label}
            </button>
          );
        })}
      </div>

      <div className={styles.statusRow}>
        <span>⏱ {fmtTime(elapsed)}</span>
        <span>{cur.moves} {cur.moves === 1 ? "move" : "moves"}</span>
        <button type="button" className={styles.button} onClick={undo} disabled={ui.past.length === 0 || cur.won || finishing}>
          ↩ Undo
        </button>
        <button type="button" className={styles.button} onClick={() => newGame(cur.variant, cur.variant === "klondike" ? cur.draw : cur.suits)}>
          ↻ New deal
        </button>
        {(autoFinishReady || finishing) && !cur.won ? (
          <button type="button" className={`${styles.button} ${styles.buttonActive}`} onClick={startAutoFinish} disabled={finishing}>
            {finishing ? "Finishing…" : "✦ Auto-finish"}
          </button>
        ) : null}
      </div>

      {cur.won && (
        <div className={styles.winBanner} role="status">
          <strong style={{ fontFamily: "var(--font-display)", fontSize: "1.3rem" }}>
            You won{cur.jokerUsed ? " (with a little help from a friend)" : ""}! 🎉
          </strong>
          <p className={styles.help} style={{ marginTop: "0.3rem" }}>
            {MODE_LABELS[modeOf(cur)]} · {fmtTime(elapsed)} · {cur.moves} moves
            {cur.jokerUsed ? " · assisted" : ""}
          </p>
          <button
            type="button"
            className={`${styles.button} ${styles.buttonActive}`}
            style={{ marginTop: "0.6rem" }}
            onClick={() => newGame(cur.variant, cur.variant === "klondike" ? cur.draw : cur.suits)}
          >
            Deal again
          </button>
        </div>
      )}

      <div
        ref={tableRef}
        className={tableClass}
        style={{ "--cols": cur.tableau.length } as CSSProperties}
        onClickCapture={(e) => {
          if (performance.now() < suppressClickUntil.current) {
            e.stopPropagation();
            e.preventDefault();
          }
        }}
      >
        <div className={styles.topRow}>
          {cur.variant !== "freecell" && renderStock()}
          {cur.variant === "klondike" && renderWaste()}
          {cur.variant === "freecell" &&
            cur.cells.map((c, i) => (
              <div key={`cell-${i}`} className={styles.zone} data-drop={`cell-${i}`} style={{ gridColumn: i + 1 }}>
                {c ? (
                  renderCard(c, { zone: "cell", i })
                ) : (
                  <button type="button" className={`${styles.slot} ${styles.cellSlot}`} onClick={() => drop({ zone: "cell", i })} aria-label={`Free cell ${i + 1}`} />
                )}
              </div>
            ))}
          {cur.variant === "spider"
            ? renderSpiderRuns()
            : cur.foundations.map((pile, i) =>
                renderFoundation(pile, i, cur.tableau.length - cur.foundations.length + i + 1),
              )}
        </div>

        <div className={styles.columns}>
          {cur.tableau.map((pile, i) => renderPile(pile, i))}
        </div>
      </div>

      <p className={styles.help}>{help}</p>

      <SaveSlot<SavePayload>
        game="solitaire"
        getState={() => ({
          cur: uiRef.current.cur,
          usedUndo: uiRef.current.usedUndo,
          comeback: uiRef.current.comeback,
          elapsed: uiRef.current.baseElapsed + (Date.now() - uiRef.current.startedAt),
        })}
        onLoad={(payload) => {
          stopAutoFinish();
          // A save taken after the winning move shouldn't post a second win.
          if (payload.cur.won) wonDealRef.current = uiRef.current.dealId + 1;
          dispatch({ type: "LOAD", payload });
          setSelected(null);
          setFinalElapsed(payload.cur.won ? payload.elapsed : null);
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
      <div className={styles.scoreScroll} role="region" tabIndex={0} aria-label="Scrollable solitaire records">
        <table className={styles.scoreTable}>
          <caption className={styles.srOnly}>Personal best solitaire results</caption>
          <thead>
            <tr><th scope="col">Variant</th><th scope="col">Wins</th><th scope="col">Deals</th><th scope="col">Best time</th><th scope="col">Fewest moves</th></tr>
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
    </div>
  );
}
