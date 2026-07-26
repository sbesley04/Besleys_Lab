// Pure-logic tests for the solitaire engine. Run with:
//   npm run test:solitaire   (node --experimental-strip-types)
import {
  dealKlondike, dealSpider, dealFreecell, drawStock, move, autoToFoundation,
  movableGroup, faceDownCount, modeOf, isJoker, type SolState, type Card,
} from "./engine.ts";

let fail = 0;
const ok = (c: boolean, n: string) => { if (!c) { fail++; console.log("FAIL:", n); } };

// Deterministic rng for reproducible deals.
function seeded(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

const card = (suit: number, rank: number, faceUp = true, id = rank + suit * 13): Card =>
  ({ id, suit, rank, faceUp });

// ---------- deals ----------
const k = dealKlondike(1, seeded(1), false);
ok(k.tableau.length === 7, "klondike has 7 columns");
ok(k.tableau.reduce((n, p) => n + p.length, 0) === 28, "klondike deals 28 to tableau");
ok(k.stock.length === 24, "klondike stock has 24");
ok(k.tableau.every((p) => p[p.length - 1].faceUp), "klondike tops are face-up");
ok(faceDownCount(k) === 21, "klondike starts 21 face-down");
ok(modeOf(k) === "klondike-1", "klondike mode string");

const kj = dealKlondike(3, seeded(2), true);
const allK = [...kj.stock, ...kj.tableau.flat()];
ok(allK.length === 53 && allK.some(isJoker), "forced joker deal has 53 cards");
ok(modeOf(kj) === "klondike-3", "draw-3 mode string");

const sp = dealSpider(2, seeded(3));
ok(sp.tableau.length === 10, "spider has 10 columns");
ok(sp.tableau.reduce((n, p) => n + p.length, 0) === 54, "spider deals 54");
ok(sp.stock.length === 50, "spider stock has 50");
ok(new Set(sp.tableau.flat().map((c) => c.suit)).size === 2, "spider 2-suit uses 2 suits");

const fc = dealFreecell(seeded(4));
ok(fc.tableau.length === 8, "freecell has 8 columns");
ok(fc.tableau.flat().length === 52 && fc.tableau.flat().every((c) => c.faceUp), "freecell all face-up");
ok(fc.cells.length === 4, "freecell has 4 cells");

// ---------- klondike rules ----------
// Hand-build a tiny position: tableau col0 = [♠7], col1 = [♥6], col2 = empty.
function pos(overrides: Partial<SolState>): SolState {
  return {
    variant: "klondike", draw: 1, suits: 4, stock: [], waste: [],
    foundations: [[], [], [], []], cells: [], tableau: [[], [], [], [], [], [], []],
    moves: 0, won: false, hasJoker: false, jokerUsed: false, ...overrides,
  };
}
let p = pos({ tableau: [[card(0, 7)], [card(1, 6)], [], [], [], [], []] });
let m = move(p, { zone: "tableau", i: 1, index: 0 }, { zone: "tableau", i: 0 });
ok(m !== null && m.tableau[0].length === 2, "red 6 stacks on black 7");
ok(move(p, { zone: "tableau", i: 0, index: 0 }, { zone: "tableau", i: 1 }) === null, "black 7 won't stack on red 6");
ok(move(p, { zone: "tableau", i: 1, index: 0 }, { zone: "tableau", i: 2 }) === null, "only kings on empty klondike column");
let pk = pos({ tableau: [[card(0, 13)], [], [], [], [], [], []] });
ok(move(pk, { zone: "tableau", i: 0, index: 0 }, { zone: "tableau", i: 1 }) !== null, "king moves to empty column");

// Foundation: ace up, then two of same suit.
let pf = pos({ tableau: [[card(0, 1)], [card(0, 2)], [], [], [], [], []] });
let f1 = move(pf, { zone: "tableau", i: 0, index: 0 }, { zone: "foundation", i: 0 });
ok(f1 !== null, "ace goes to foundation");
let f2 = f1 && move(f1, { zone: "tableau", i: 1, index: 0 }, { zone: "foundation", i: 0 });
ok(!!f2 && f2.foundations[0].length === 2, "two of same suit follows ace");
let pw = pos({ tableau: [[card(1, 2)], [], [], [], [], [], []], foundations: [[card(0, 1)], [], [], []] });
ok(move(pw, { zone: "tableau", i: 0, index: 0 }, { zone: "foundation", i: 0 }) === null, "wrong suit rejected at foundation");

// Draw + recycle.
let pd = pos({ stock: [card(0, 5, false), card(1, 9, false)] });
let d1 = drawStock(pd)!;
ok(d1.waste.length === 1 && d1.waste[0].faceUp, "draw flips one to waste");
let d2 = drawStock(drawStock(d1)!); // empty stock -> recycle
ok(d2 !== null && d2.stock.length === 2 && d2.waste.length === 0, "empty stock recycles waste");

// Face-down flip after moving a group away.
let pg = pos({ tableau: [[card(2, 9, false), card(0, 7), card(1, 6)], [card(1, 8)], [], [], [], [], []] });
const grp = movableGroup(pg, pg.tableau[0], 1);
ok(grp !== null && grp.length === 2, "7-6 alternating group is movable");
let mg = move(pg, { zone: "tableau", i: 0, index: 1 }, { zone: "tableau", i: 1 })!;
ok(mg.tableau[1].length === 3, "group lands on red 8");
ok(mg.tableau[0].length === 1 && mg.tableau[0][0].faceUp, "exposed card flips face-up");

// ---------- joker ----------
const joker = { id: 53, suit: 4, rank: 0, faceUp: true };
let pj = pos({ hasJoker: true, tableau: [[card(0, 7)], [joker], [card(1, 9)], [], [], [], []] });
let j1 = move(pj, { zone: "tableau", i: 1, index: 0 }, { zone: "tableau", i: 0 });
ok(j1 !== null && j1.jokerUsed, "joker sits on anything and flags assisted");
let j2 = j1 && move(j1, { zone: "tableau", i: 2, index: 0 }, { zone: "tableau", i: 0 });
ok(!!j2 && j2.tableau[0].length === 3, "anything sits on the joker");
ok(move(pj, { zone: "tableau", i: 1, index: 0 }, { zone: "foundation", i: 0 }) === null, "joker never reaches a foundation");

// Win: 51 cards up, last ace goes up -> won (joker may still be on the table).
const fullPile = (suit: number) => Array.from({ length: 13 }, (_, r) => card(suit, r + 1));
let nearWin = pos({
  foundations: [fullPile(0), fullPile(1), fullPile(2), fullPile(3).slice(0, 12)],
  tableau: [[card(3, 13)], [joker], [], [], [], [], []],
  hasJoker: true,
});
let winState = move(nearWin, { zone: "tableau", i: 0, index: 0 }, { zone: "foundation", i: 3 });
ok(!!winState && winState.won, "52 cards on foundations wins even with joker in play");

// ---------- spider ----------
// Complete run sweeps: build col with K..2 face-up and play the ace on.
const runTail = Array.from({ length: 12 }, (_, i) => card(0, 13 - i)); // K..2
let spPos: SolState = {
  variant: "spider", draw: 1, suits: 1, stock: [], waste: [], foundations: [],
  cells: [], tableau: [runTail, [card(0, 1)], [], [], [], [], [], [], [], []],
  moves: 0, won: false, hasJoker: false, jokerUsed: false,
};
let swept = move(spPos, { zone: "tableau", i: 1, index: 0 }, { zone: "tableau", i: 0 })!;
ok(swept.foundations.length === 1 && swept.tableau[0].length === 0, "spider sweeps a full K-A run");
// Group moves need one suit in spider.
let spMix: SolState = { ...spPos, tableau: [[card(0, 9), card(1, 8)], [card(2, 9)], [], [], [], [], [], [], [], []] };
ok(movableGroup(spMix, spMix.tableau[0], 0) === null, "spider mixed-suit group can't travel");
ok(move(spMix, { zone: "tableau", i: 0, index: 1 }, { zone: "tableau", i: 1 }) !== null, "spider single card lands on any suit");
// No spider deal onto an empty column.
let spEmpty: SolState = { ...spPos, stock: [card(0, 5, false)], tableau: [[card(0, 9)], [], [], [], [], [], [], [], [], []] };
ok(drawStock(spEmpty) === null, "spider won't deal over an empty column");

// ---------- freecell ----------
let fcPos: SolState = {
  variant: "freecell", draw: 1, suits: 4, stock: [], waste: [],
  foundations: [[], [], [], []], cells: [null, null, null, null],
  tableau: [[card(0, 7), card(1, 6), card(0, 5), card(2, 4)], [card(1, 8)], [], [], [], [], [], []],
  moves: 0, won: false, hasJoker: false, jokerUsed: false,
};
// 4-card alternating run, 4 free cells + 2 empty cols -> capacity 5*4=20, fine.
let fcm = move(fcPos, { zone: "tableau", i: 0, index: 0 }, { zone: "tableau", i: 1 });
ok(fcm !== null && fcm.tableau[1].length === 5, "freecell supermove within capacity");
// Zero free cells, no empties -> capacity 1, group of 2 fails.
let tight: SolState = {
  ...fcPos,
  cells: [card(3, 13), card(3, 12), card(3, 11), card(3, 10)],
  tableau: [[card(0, 5), card(1, 4)], [card(1, 6)], [card(2, 13)], [card(2, 12)], [card(2, 11)], [card(2, 10)], [card(2, 9)], [card(2, 8)]],
};
ok(move(tight, { zone: "tableau", i: 0, index: 0 }, { zone: "tableau", i: 1 }) === null, "freecell capacity blocks big moves");
// Cell in/out.
let toCell = move(fcPos, { zone: "tableau", i: 0, index: 3 }, { zone: "cell", i: 0 });
ok(toCell !== null && toCell.cells[0] !== null, "single card parks in a free cell");
ok(toCell !== null && move(toCell, { zone: "cell", i: 0 }, { zone: "cell", i: 1 }) === null, "no cell-to-cell shuffling");

// autoToFoundation finds the right pile.
let auto = pos({ tableau: [[card(2, 1)], [], [], [], [], [], []] });
ok(autoToFoundation(auto, { zone: "tableau", i: 0, index: 0 }) !== null, "auto-foundation finds a slot");

console.log(fail === 0 ? "\nALL SOLITAIRE ENGINE TESTS PASSED" : `\n${fail} failed`);
process.exit(fail ? 1 : 0);
