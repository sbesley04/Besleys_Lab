// ---------------------------------------------------------------------------
// Solitaire engine — pure logic for three variants (Klondike draw-1/draw-3,
// Spider 1/2/4-suit, FreeCell), no React. Consumed by Solitaire.tsx.
//
// One state shape covers all variants; zones a variant doesn't use stay empty
// (waste is Klondike-only, cells are FreeCell-only). Moves go through move()
// with { zone, ... } locations so the UI stays a dumb click-router.
//
// Card 53: ~1 in 100 Klondike deals includes a Joker (rank 0). It's fully
// wild on the tableau — sits on anything, accepts anything — but can never
// reach a foundation, so the win condition (52 cards up) is unaffected.
// Touching it flips state.jokerUsed, which stamps the win as "assisted".
// ---------------------------------------------------------------------------

export type Variant = "klondike" | "spider" | "freecell";

export interface Card {
  id: number;
  suit: number; // 0 ♠, 1 ♥, 2 ♦, 3 ♣ — 4 = joker
  rank: number; // 1 (A) … 13 (K) — 0 = joker
  faceUp: boolean;
}

export const SUIT_GLYPHS = ["♠", "♥", "♦", "♣", "★"];
export const RANK_GLYPHS = ["🃏", "A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];

export const isJoker = (c: Card) => c.rank === 0;
export const isRed = (c: Card) => c.suit === 1 || c.suit === 2;

export interface SolState {
  variant: Variant;
  draw: number; // Klondike: cards per stock flip (1 or 3)
  suits: number; // Spider: 1, 2, or 4
  stock: Card[];
  waste: Card[];
  foundations: Card[][]; // K/FC: 4 suit piles. Spider: completed runs pile up here (8 to win)
  cells: (Card | null)[]; // FreeCell only
  tableau: Card[][];
  moves: number;
  won: boolean;
  hasJoker: boolean;
  jokerUsed: boolean;
}

export type Loc =
  | { zone: "waste" }
  | { zone: "foundation"; i: number }
  | { zone: "cell"; i: number }
  | { zone: "tableau"; i: number; index: number };

// --- deck building -----------------------------------------------------------

export function shuffle<T>(arr: T[], rng: () => number = Math.random): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function makeDeck(suits: number[], copies: number, startId: number): Card[] {
  const cards: Card[] = [];
  let id = startId;
  for (let c = 0; c < copies; c++) {
    for (const suit of suits) {
      for (let rank = 1; rank <= 13; rank++) {
        cards.push({ id: id++, suit, rank, faceUp: false });
      }
    }
  }
  return cards;
}

export const JOKER_ODDS = 1 / 100;

export function dealKlondike(draw: number, rng: () => number = Math.random, forceJoker?: boolean): SolState {
  let deck = makeDeck([0, 1, 2, 3], 1, 1);
  const hasJoker = forceJoker ?? rng() < JOKER_ODDS;
  if (hasJoker) deck.push({ id: 53, suit: 4, rank: 0, faceUp: false });
  deck = shuffle(deck, rng);

  const tableau: Card[][] = [];
  for (let i = 0; i < 7; i++) {
    const pile = deck.splice(0, i + 1);
    pile[pile.length - 1].faceUp = true;
    tableau.push(pile);
  }
  return {
    variant: "klondike",
    draw,
    suits: 4,
    stock: deck,
    waste: [],
    foundations: [[], [], [], []],
    cells: [],
    tableau,
    moves: 0,
    won: false,
    hasJoker,
    jokerUsed: false,
  };
}

export function dealSpider(suits: number, rng: () => number = Math.random): SolState {
  const suitSet = suits === 1 ? [0] : suits === 2 ? [0, 1] : [0, 1, 2, 3];
  let deck = shuffle(makeDeck(suitSet, 8 / suits, 1), rng); // always 104 cards

  const tableau: Card[][] = [];
  for (let i = 0; i < 10; i++) {
    const pile = deck.splice(0, i < 4 ? 6 : 5);
    pile[pile.length - 1].faceUp = true;
    tableau.push(pile);
  }
  return {
    variant: "spider",
    draw: 1,
    suits,
    stock: deck,
    waste: [],
    foundations: [],
    cells: [],
    tableau,
    moves: 0,
    won: false,
    hasJoker: false,
    jokerUsed: false,
  };
}

export function dealFreecell(rng: () => number = Math.random): SolState {
  const deck = shuffle(makeDeck([0, 1, 2, 3], 1, 1), rng).map((c) => ({ ...c, faceUp: true }));
  const tableau: Card[][] = Array.from({ length: 8 }, () => []);
  deck.forEach((c, i) => tableau[i % 8].push(c));
  return {
    variant: "freecell",
    draw: 1,
    suits: 4,
    stock: [],
    waste: [],
    foundations: [[], [], [], []],
    cells: [null, null, null, null],
    tableau,
    moves: 0,
    won: false,
    hasJoker: false,
    jokerUsed: false,
  };
}

// --- rules -------------------------------------------------------------------

/** Can `lower` sit on `upper` in the tableau? */
function stacks(variant: Variant, upper: Card, lower: Card): boolean {
  if (isJoker(upper) || isJoker(lower)) return true; // wild
  if (lower.rank !== upper.rank - 1) return false;
  if (variant === "spider") return true; // any suit descends
  return isRed(upper) !== isRed(lower); // alternating colors
}

/** Is pile.slice(index) a legal group to pick up? */
export function movableGroup(state: SolState, pile: Card[], index: number): Card[] | null {
  const group = pile.slice(index);
  if (group.length === 0 || group.some((c) => !c.faceUp)) return null;
  for (let i = 0; i + 1 < group.length; i++) {
    const a = group[i];
    const b = group[i + 1];
    if (!stacks(state.variant, a, b)) return null;
    // Spider groups must additionally be a single suit to travel together.
    if (state.variant === "spider" && a.suit !== b.suit) return null;
  }
  return group;
}

function canFoundation(pile: Card[], c: Card): boolean {
  if (isJoker(c)) return false;
  if (pile.length === 0) return c.rank === 1;
  const top = pile[pile.length - 1];
  return top.suit === c.suit && c.rank === top.rank + 1;
}

/** FreeCell supermove capacity: (1+free cells) × 2^(empty cols). */
function freecellCapacity(state: SolState, destIndex: number): number {
  const free = state.cells.filter((c) => c === null).length;
  let empties = 0;
  state.tableau.forEach((p, i) => {
    if (p.length === 0 && i !== destIndex) empties++;
  });
  return (1 + free) * 2 ** empties;
}

function faceDownCount(state: SolState): number {
  let n = 0;
  for (const pile of state.tableau) for (const c of pile) if (!c.faceUp) n++;
  return n;
}
export { faceDownCount };

// --- mutations (all return a fresh state, or null when illegal) --------------

function clone(state: SolState): SolState {
  return {
    ...state,
    stock: state.stock.slice(),
    waste: state.waste.slice(),
    foundations: state.foundations.map((p) => p.slice()),
    cells: state.cells.slice(),
    tableau: state.tableau.map((p) => p.slice()),
  };
}

function flipExposed(pile: Card[]) {
  const top = pile[pile.length - 1];
  if (top && !top.faceUp) pile[pile.length - 1] = { ...top, faceUp: true };
}

/** Spider: sweep any complete K→A single-suit face-up run to the foundations. */
function sweepSpiderRuns(state: SolState) {
  for (let i = 0; i < state.tableau.length; i++) {
    const pile = state.tableau[i];
    if (pile.length < 13) continue;
    const tail = pile.slice(-13);
    const isRun =
      tail.every((c) => c.faceUp && c.suit === tail[0].suit) &&
      tail.every((c, k) => c.rank === 13 - k);
    if (isRun) {
      state.foundations.push(pile.splice(pile.length - 13, 13));
      flipExposed(pile);
    }
  }
  if (state.foundations.length === 8) state.won = true;
}

function checkWin(state: SolState) {
  if (state.variant === "spider") return; // handled by sweepSpiderRuns
  const up = state.foundations.reduce((n, p) => n + p.length, 0);
  if (up === 52) state.won = true;
}

/** Klondike: flip `draw` cards to the waste; on empty stock, recycle waste.
 *  Spider: deal one card to every column (requires no empty columns). */
export function drawStock(state: SolState): SolState | null {
  if (state.won) return null;
  if (state.variant === "klondike") {
    const s = clone(state);
    if (s.stock.length === 0) {
      if (s.waste.length === 0) return null;
      s.stock = s.waste.reverse().map((c) => ({ ...c, faceUp: false }));
      s.waste = [];
    } else {
      const n = Math.min(s.draw, s.stock.length);
      for (let i = 0; i < n; i++) {
        const c = s.stock.pop()!;
        s.waste.push({ ...c, faceUp: true }); // revealing the joker is free; playing it flags jokerUsed
      }
    }
    s.moves++;
    return s;
  }
  if (state.variant === "spider") {
    if (state.stock.length === 0) return null;
    if (state.tableau.some((p) => p.length === 0)) return null; // classic rule
    const s = clone(state);
    for (const pile of s.tableau) {
      const c = s.stock.pop();
      if (c) pile.push({ ...c, faceUp: true });
    }
    s.moves++;
    sweepSpiderRuns(s);
    return s;
  }
  return null;
}

function takeFrom(state: SolState, from: Loc): Card[] | null {
  if (from.zone === "waste") {
    const c = state.waste[state.waste.length - 1];
    return c ? [c] : null;
  }
  if (from.zone === "cell") {
    const c = state.cells[from.i];
    return c ? [c] : null;
  }
  if (from.zone === "tableau") {
    return movableGroup(state, state.tableau[from.i] ?? [], from.index);
  }
  return null; // foundations are one-way
}

function removeFrom(state: SolState, from: Loc, count: number) {
  if (from.zone === "waste") state.waste.pop();
  else if (from.zone === "cell") state.cells[from.i] = null;
  else if (from.zone === "tableau") {
    state.tableau[from.i].splice(from.index, count);
    flipExposed(state.tableau[from.i]);
  }
}

export function move(state: SolState, from: Loc, to: Loc): SolState | null {
  if (state.won) return null;
  const group = takeFrom(state, from);
  if (!group) return null;
  const single = group.length === 1 ? group[0] : null;

  if (to.zone === "foundation") {
    if (!single) return null;
    if (state.variant === "spider") return null;
    const pile = state.foundations[to.i];
    if (!pile || !canFoundation(pile, single)) return null;
    const s = clone(state);
    removeFrom(s, from, 1);
    s.foundations[to.i].push(single);
    s.moves++;
    checkWin(s);
    return s;
  }

  if (to.zone === "cell") {
    if (state.variant !== "freecell" || !single) return null;
    if (state.cells[to.i] !== null) return null;
    if (from.zone === "cell") return null;
    const s = clone(state);
    removeFrom(s, from, 1);
    s.cells[to.i] = single;
    s.moves++;
    return s;
  }

  if (to.zone === "tableau") {
    if (from.zone === "tableau" && from.i === to.i) return null;
    const dest = state.tableau[to.i];
    if (!dest) return null;
    const top = dest[dest.length - 1];

    if (top) {
      if (!top.faceUp || !stacks(state.variant, top, group[0])) return null;
    } else {
      // Empty column rules: Klondike wants a King (or the Joker); Spider and
      // FreeCell take anything.
      if (state.variant === "klondike" && group[0].rank !== 13 && !isJoker(group[0])) return null;
    }
    if (state.variant === "freecell" && group.length > freecellCapacity(state, to.i)) return null;

    const s = clone(state);
    const touchesJoker = group.some(isJoker) || (top ? isJoker(top) : false);
    removeFrom(s, from, group.length);
    s.tableau[to.i].push(...group);
    s.moves++;
    if (touchesJoker) s.jokerUsed = true;
    if (s.variant === "spider") sweepSpiderRuns(s);
    return s;
  }

  return null;
}

/** Try to send a single card to any foundation (double-click convenience). */
export function autoToFoundation(state: SolState, from: Loc): SolState | null {
  for (let i = 0; i < state.foundations.length; i++) {
    const s = move(state, from, { zone: "foundation", i });
    if (s) return s;
  }
  return null;
}

/** Mode string used for high-score buckets ("klondike-3", "spider-2", ...). */
export function modeOf(state: SolState): string {
  if (state.variant === "klondike") return `klondike-${state.draw}`;
  if (state.variant === "spider") return `spider-${state.suits}`;
  return "freecell";
}
