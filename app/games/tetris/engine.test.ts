// Pure-logic tests for the Tetris engine. No test framework needed:
//   node --experimental-strip-types app/games/tetris/engine.test.ts
// Exits non-zero if any assertion fails.
import {
  reducer,
  createInitialState,
  renderBoard,
  cellsFor,
  gravityIntervalMs,
  COLS,
  ROWS,
  type GameState,
} from "./engine.ts";

let pass = 0;
let fail = 0;
function check(name: string, cond: boolean) {
  if (cond) pass++;
  else {
    fail++;
    console.log("FAIL:", name);
  }
}

// --- setup / movement ---
let s = createInitialState();
check("board dimensions", s.board.length === ROWS && s.board[0].length === COLS);
check("starts idle", s.status === "idle");

s = reducer(s, { type: "START" });
check("running after start", s.status === "running" && s.piece !== null);

let left = s;
for (let i = 0; i < 20; i++) left = reducer(left, { type: "MOVE", dir: -1 });
check("stops at left wall", cellsFor(left.piece!).every(([, c]) => c >= 0));

let right = s;
for (let i = 0; i < 20; i++) right = reducer(right, { type: "MOVE", dir: 1 });
check("stops at right wall", cellsFor(right.piece!).every(([, c]) => c < COLS));

// --- hard drop locks + spawns ---
const dropped = reducer(s, { type: "HARD_DROP" });
check("hard drop locks 4 cells", dropped.board.flat().filter((x) => x !== null).length === 4);
check("hard drop spawns next", dropped.piece !== null && dropped.status === "running");
check("hard drop awards points", dropped.score > 0);

// --- rotation ---
let t = { ...createInitialState(), next: "T" as const };
t = reducer(t, { type: "START" });
check("rotate advances state", reducer(t, { type: "ROTATE" }).piece!.rotation !== t.piece!.rotation);

// --- line clear ---
// Fill the bottom row except column 9, then drop a vertical I into column 9.
// Vertical I (rotation 1) sits at column offset 2, so origin col = 9 - 2 = 7.
const board = Array.from({ length: ROWS }, () => Array(COLS).fill(null));
for (let c = 0; c < COLS - 1; c++) board[ROWS - 1][c] = "O";
const lc = {
  ...createInitialState(),
  board,
  piece: { key: "I", rotation: 1, row: ROWS - 4, col: 7 },
  status: "running",
  next: "O",
} as GameState;
const afterClear = reducer(lc, { type: "HARD_DROP" });
check("clears a completed line", afterClear.lines === 1 && afterClear.score >= 100);

// --- misc ---
check("gravity speeds up by level", gravityIntervalMs(1) > gravityIntervalMs(5));
check("renderBoard merges active piece", renderBoard(s).flat().filter((x) => x !== null).length === 4);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
