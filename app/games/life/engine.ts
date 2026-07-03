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
