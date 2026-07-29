// Pure-logic tests for the Minesweeper and evolution engines. Run with:
//   npm run test:minesweeper   (node --experimental-strip-types)
import {
  createBoard, seedMines, reveal, toggleFlag, chord, neighbors, isWon,
  minesRemaining, progress, LEVELS, LEVELS_BY_KEY, type Board,
} from "./engine.ts";
import {
  createWorld, stepWorld, nextGeneration, runGeneration, energyCost,
  averageTraits, DEFAULT_PARAMS, TICKS_PER_GENERATION,
} from "../evolution/engine.ts";

let fail = 0;
const ok = (c: boolean, n: string) => { if (!c) { fail++; console.log("FAIL:", n); } };

function seeded(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

// ---------- MINESWEEPER ----------
const beginner = LEVELS_BY_KEY.get("beginner")!;
let b = createBoard(beginner);
ok(b.cells.length === 81, "beginner board is 9x9");
ok(b.status === "idle" && !b.seeded, "board starts idle and unseeded");
ok(b.cells.every((c) => c.state === "hidden" && !c.mine), "board starts empty and hidden");
ok(minesRemaining(b) === 10, "mine counter starts at the mine count");

// Neighbors: corner has 3, edge 5, middle 8.
ok(neighbors(b, 0).length === 3, "corner cell has 3 neighbors");
ok(neighbors(b, 4).length === 5, "edge cell has 5 neighbors");
ok(neighbors(b, 40).length === 8, "middle cell has 8 neighbors");

// First click is always safe, and so is its whole neighbourhood.
for (let seed = 1; seed <= 25; seed++) {
  const fresh = createBoard(beginner);
  const opened = reveal(fresh, 40, seeded(seed));
  ok(!opened.cells[40].mine, `first click is never a mine (seed ${seed})`);
  ok(opened.status !== "lost", `first click never loses (seed ${seed})`);
  const safeZone = [40, ...neighbors(fresh, 40)];
  ok(safeZone.every((i) => !opened.cells[i].mine), `first-click neighbourhood is clear (seed ${seed})`);
  ok(opened.cells.filter((c) => c.mine).length === 10, `exactly 10 mines placed (seed ${seed})`);
}

// Adjacency counts agree with the actual mine layout.
const seededBoard = seedMines(createBoard(beginner), 40, seeded(3));
let adjacencyOk = true;
seededBoard.cells.forEach((c, i) => {
  const actual = neighbors(seededBoard, i).filter((n) => seededBoard.cells[n].mine).length;
  if (c.adjacent !== actual) adjacencyOk = false;
});
ok(adjacencyOk, "adjacent counts match the mine layout");

// Flood fill: revealing a zero opens a region larger than one cell.
const zeroIdx = seededBoard.cells.findIndex((c) => !c.mine && c.adjacent === 0);
if (zeroIdx >= 0) {
  const flooded = reveal(seededBoard, zeroIdx, seeded(3));
  const openedCount = flooded.cells.filter((c) => c.state === "revealed").length;
  ok(openedCount > 1, "revealing a zero floods outward");
  ok(flooded.cells.every((c) => !(c.state === "revealed" && c.mine)), "flood never reveals a mine");
}

// Flags: toggle on/off, block reveals, and move the counter.
let flagged = toggleFlag(seededBoard, 0);
ok(flagged.cells[0].state === "flagged", "flag toggles on");
ok(minesRemaining(flagged) === 9, "flag decrements the counter");
ok(toggleFlag(flagged, 0).cells[0].state === "hidden", "flag toggles off");
ok(reveal(flagged, 0, seeded(1)).cells[0].state === "flagged", "flagged cells resist reveal");

// Hitting a mine loses and exposes the rest.
const mineIdx = seededBoard.cells.findIndex((c) => c.mine);
const lost = reveal(seededBoard, mineIdx, seeded(3));
ok(lost.status === "lost", "revealing a mine loses");
ok(lost.detonated === mineIdx, "the detonated cell is recorded");
ok(lost.cells.filter((c) => c.mine && c.state === "revealed").length === 10, "all mines shown on loss");
ok(reveal(lost, 0, seeded(3)) === lost, "a finished board ignores further reveals");

// Winning: reveal every safe cell.
let winBoard: Board = seedMines(createBoard(beginner), 40, seeded(8));
for (let i = 0; i < winBoard.cells.length; i++) {
  if (!winBoard.cells[i].mine) winBoard = reveal(winBoard, i, seeded(8));
}
ok(winBoard.status === "won", "revealing every safe cell wins");
ok(isWon(winBoard), "isWon agrees");
ok(winBoard.cells.filter((c) => c.state === "flagged").length === 10, "win auto-flags the mines");
ok(progress(winBoard) === 1, "progress reaches 1 on a win");

// Chording: only fires when flags match the number, and can lose the game.
let chordBoard = seedMines(createBoard(beginner), 40, seeded(15));
const numIdx = chordBoard.cells.findIndex((c) => !c.mine && c.adjacent === 1);
if (numIdx >= 0) {
  chordBoard = reveal(chordBoard, numIdx, seeded(15));
  const before = chordBoard.cells.filter((c) => c.state === "revealed").length;
  ok(chord(chordBoard, numIdx, seeded(15)) === chordBoard, "chording without enough flags does nothing");
  const mineNeighbor = neighbors(chordBoard, numIdx).find((n) => chordBoard.cells[n].mine)!;
  const withFlag = toggleFlag(chordBoard, mineNeighbor);
  const chorded = chord(withFlag, numIdx, seeded(15));
  ok(chorded.cells.filter((c) => c.state === "revealed").length > before, "correct chord opens neighbours");
  ok(chorded.status !== "lost", "correct chord is safe");
  // Wrong flag → chording detonates.
  const safeNeighbor = neighbors(chordBoard, numIdx).find((n) => !chordBoard.cells[n].mine && chordBoard.cells[n].state === "hidden");
  if (safeNeighbor !== undefined) {
    const badFlag = toggleFlag(chordBoard, safeNeighbor);
    ok(chord(badFlag, numIdx, seeded(15)).status === "lost", "chording on a wrong flag loses");
  }
}
ok(LEVELS.length === 3 && LEVELS[2].mines === 99, "expert level has 99 mines");

// ---------- EVOLUTION ----------
const erng = seeded(4);
let w = createWorld(DEFAULT_PARAMS, 12, erng);
ok(w.creatures.length === 12, "world starts with the requested population");
ok(w.food.length === DEFAULT_PARAMS.foodCount, "food is scattered");
ok(w.creatures.every((c) => c.traits.speed === 1 && c.traits.size === 1), "founders are unmutated");
ok(w.generation === 1 && w.history.length === 0, "world starts at generation 1");

// Energy cost rises steeply with size and speed — the tradeoff that drives it.
ok(energyCost({ speed: 2, size: 1, sense: 1 }) > energyCost({ speed: 1, size: 1, sense: 1 }), "faster costs more");
ok(energyCost({ speed: 1, size: 2, sense: 1 }) > energyCost({ speed: 1, size: 1, sense: 1 }), "bigger costs more");
// Doubling speed should roughly quadruple the movement term (v²), so the cost
// grows far faster than the trait itself.
const base1 = energyCost({ speed: 1, size: 1, sense: 0 });
const base2 = energyCost({ speed: 2, size: 1, sense: 0 });
ok(base2 >= 3.9 * base1, "speed cost is superlinear (≈v²)");
const big2 = energyCost({ speed: 1, size: 2, sense: 0 });
ok(big2 >= 7.9 * base1, "size cost is cubic");

// Ticking moves creatures and consumes food.
let ticked = w;
for (let i = 0; i < 40; i++) ticked = stepWorld(ticked, erng);
ok(ticked.tick === 40, "ticks accumulate");
ok(ticked.creatures.some((c, i) => c.x !== w.creatures[i].x || c.y !== w.creatures[i].y), "creatures move");
ok(ticked.food.some((f) => f.eaten), "some food gets eaten");
ok(
  ticked.creatures.every((c) => c.x >= 0 && c.x <= DEFAULT_PARAMS.fieldSize && c.y >= 0 && c.y <= DEFAULT_PARAMS.fieldSize),
  "creatures stay inside the field",
);

// Generations: survivors carry over, records accumulate.
let gen2 = nextGeneration(ticked, erng);
ok(gen2.generation === 2, "generation advances");
ok(gen2.history.length === 1, "a record is written per generation");
ok(gen2.tick === 0, "tick resets each generation");
ok(gen2.food.every((f) => !f.eaten), "food is replenished");
ok(gen2.creatures.every((c) => c.eaten === 0 && c.alive), "next generation starts fresh");

// Selection actually shifts traits over many generations with plentiful food.
let evo = createWorld({ ...DEFAULT_PARAMS, foodCount: 90, mutationRate: 0.18 }, 16, seeded(21));
for (let g = 0; g < 25 && !evo.extinct; g++) evo = runGeneration(evo, seeded(100 + g));
ok(evo.generation > 1, "simulation advances through generations");
ok(evo.history.length >= 1, "history records generations");
if (!evo.extinct) {
  const avg = averageTraits(evo.creatures);
  ok(avg.speed > 0 && avg.size > 0 && avg.sense > 0, "traits stay positive");
  ok(avg.speed <= 3 && avg.size <= 3 && avg.sense <= 3, "traits stay clamped in range");
  ok(evo.creatures.every((c) => c.traits.speed >= 0.25), "traits never collapse to zero");
}

// Starvation: no food at all must lead to extinction, not an infinite loop.
let starve = createWorld({ ...DEFAULT_PARAMS, foodCount: 0 }, 10, seeded(2));
for (let g = 0; g < 5 && !starve.extinct; g++) starve = runGeneration(starve, seeded(300 + g));
ok(starve.extinct, "no food leads to extinction");
ok(starve.creatures.length === 0, "extinct world has no creatures");

// Population is capped so the sim can't explode.
let boom = createWorld({ ...DEFAULT_PARAMS, foodCount: 400 }, 40, seeded(6));
for (let g = 0; g < 12; g++) boom = runGeneration(boom, seeded(400 + g));
ok(boom.creatures.length <= 220, "population stays under the cap");
ok(TICKS_PER_GENERATION > 0, "generation length is positive");

console.log(fail === 0 ? "\nALL MINESWEEPER + EVOLUTION TESTS PASSED" : `\n${fail} failed`);
process.exit(fail ? 1 : 0);
