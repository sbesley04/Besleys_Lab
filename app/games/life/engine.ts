// ---------------------------------------------------------------------------
// Conway's Game of Life — pure logic, no React. A finite (non-wrapping) grid:
// cells outside the bounds are treated as dead. Consumed by Life.tsx.
//
// EXTEND HERE: flip `WRAP` to make the grid toroidal (gliders wrap around), or
// add named seed patterns to the PATTERNS map.
// ---------------------------------------------------------------------------

export const COLS = 32;
export const ROWS = 24;
const WRAP = false;

export type Grid = boolean[]; // length COLS*ROWS, row-major

export interface GameState {
  grid: Grid;
  generation: number;
  running: boolean;
}

export type Action =
  | { type: "TOGGLE"; index: number }
  | { type: "STEP" }
  | { type: "PLAY" }
  | { type: "PAUSE" }
  | { type: "CLEAR" }
  | { type: "RANDOMIZE"; density?: number }
  | { type: "LOAD"; state: GameState }; // restore a saved pattern (paused)

export function emptyGrid(): Grid {
  return Array<boolean>(COLS * ROWS).fill(false);
}

function liveNeighbors(grid: Grid, x: number, y: number): number {
  let count = 0;
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dy === 0) continue;
      let nx = x + dx;
      let ny = y + dy;
      if (WRAP) {
        nx = (nx + COLS) % COLS;
        ny = (ny + ROWS) % ROWS;
      } else if (nx < 0 || nx >= COLS || ny < 0 || ny >= ROWS) {
        continue;
      }
      if (grid[ny * COLS + nx]) count++;
    }
  }
  return count;
}

/** Advance one generation under the standard B3/S23 rules. */
export function step(grid: Grid): Grid {
  const next = emptyGrid();
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      const i = y * COLS + x;
      const n = liveNeighbors(grid, x, y);
      next[i] = grid[i] ? n === 2 || n === 3 : n === 3;
    }
  }
  return next;
}

export function randomGrid(density = 0.28, rng: () => number = Math.random): Grid {
  return Array.from({ length: COLS * ROWS }, () => rng() < density);
}

export function createInitialState(): GameState {
  return { grid: emptyGrid(), generation: 0, running: false };
}

// --- Glider detection --------------------------------------------------------
// A glider occupies a 3x3 box in one of two canonical phases (the other two
// phases are rotations/reflections of these). We precompute every rotation and
// mirror once, then scan the grid for an exact match whose surrounding ring is
// empty — so a glider embedded in a blob doesn't count, a drawn one does.

type Mask = boolean[]; // 9 cells, row-major 3x3

const GLIDER_PHASES: string[] = [
  ".X." + "..X" + "XXX",
  "X.X" + ".XX" + ".X.",
];

function rot(m: Mask): Mask {
  const r: Mask = Array(9).fill(false);
  for (let y = 0; y < 3; y++)
    for (let x = 0; x < 3; x++) r[x * 3 + (2 - y)] = m[y * 3 + x];
  return r;
}
function mirror(m: Mask): Mask {
  const r: Mask = Array(9).fill(false);
  for (let y = 0; y < 3; y++)
    for (let x = 0; x < 3; x++) r[y * 3 + (2 - x)] = m[y * 3 + x];
  return r;
}

const GLIDER_MASKS: Mask[] = (() => {
  const seen = new Map<string, Mask>();
  for (const phase of GLIDER_PHASES) {
    let m: Mask = phase.split("").map((c) => c === "X");
    for (let flip = 0; flip < 2; flip++) {
      for (let i = 0; i < 4; i++) {
        seen.set(m.map((b) => (b ? "X" : ".")).join(""), m);
        m = rot(m);
      }
      m = mirror(m);
    }
  }
  return [...seen.values()];
})();

/** True when the grid contains an isolated glider (any phase/orientation). */
export function containsGlider(grid: Grid): boolean {
  const at = (x: number, y: number): boolean =>
    x >= 0 && x < COLS && y >= 0 && y < ROWS ? grid[y * COLS + x] : false;

  for (let y0 = 0; y0 <= ROWS - 3; y0++) {
    for (let x0 = 0; x0 <= COLS - 3; x0++) {
      mask: for (const m of GLIDER_MASKS) {
        for (let y = 0; y < 3; y++)
          for (let x = 0; x < 3; x++)
            if (at(x0 + x, y0 + y) !== m[y * 3 + x]) continue mask;
        // Core matches — the one-cell ring around it must be dead.
        for (let x = -1; x <= 3; x++)
          if (at(x0 + x, y0 - 1) || at(x0 + x, y0 + 3)) continue mask;
        for (let y = 0; y < 3; y++)
          if (at(x0 - 1, y0 + y) || at(x0 + 3, y0 + y)) continue mask;
        return true;
      }
    }
  }
  return false;
}

export function reducer(state: GameState, action: Action): GameState {
  switch (action.type) {
    case "LOAD":
      return { ...action.state, running: false };

    case "TOGGLE": {
      // Editing only makes sense while paused.
      if (state.running) return state;
      const grid = state.grid.slice();
      grid[action.index] = !grid[action.index];
      return { ...state, grid };
    }

    case "STEP":
      return { ...state, grid: step(state.grid), generation: state.generation + 1 };

    case "PLAY":
      return { ...state, running: true };

    case "PAUSE":
      return { ...state, running: false };

    case "CLEAR":
      return createInitialState();

    case "RANDOMIZE":
      return { grid: randomGrid(action.density), generation: 0, running: false };

    default:
      return state;
  }
}
