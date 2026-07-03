// ---------------------------------------------------------------------------
// 2048 engine — pure logic, no React. The board is a flat array of 16 numbers
// (0 = empty). All movement reduces to "slide a row left"; the four directions
// are handled by rotating rows/columns into left-moving lines and back.
//
// EXTEND HERE: change SIZE for a larger board, or adjust scoring/spawn odds.
// ---------------------------------------------------------------------------

export const SIZE = 4;
export type Board = number[]; // length SIZE*SIZE, row-major
export type Dir = "left" | "right" | "up" | "down";
export type Status = "playing" | "over";

export interface GameState {
  board: Board;
  score: number;
  status: Status;
  won: boolean; // reached 2048 at least once (play continues)
}

export type Action =
  | { type: "START" }
  | { type: "MOVE"; dir: Dir }
  | { type: "LOAD"; state: GameState }; // restore a saved game

function emptyBoard(): Board {
  return Array<number>(SIZE * SIZE).fill(0);
}

/** Slide+merge a single line toward index 0. Returns the new line and points. */
export function collapseLine(line: number[]): { line: number[]; gained: number } {
  const tiles = line.filter((n) => n !== 0);
  const out: number[] = [];
  let gained = 0;
  for (let i = 0; i < tiles.length; i++) {
    if (i + 1 < tiles.length && tiles[i] === tiles[i + 1]) {
      const merged = tiles[i] * 2;
      out.push(merged);
      gained += merged;
      i++; // skip the consumed partner
    } else {
      out.push(tiles[i]);
    }
  }
  while (out.length < line.length) out.push(0);
  return { line: out, gained };
}

// Extract the four lines for a direction, each ordered so index 0 is where
// tiles slide toward. Returns the cell indices that make up each line.
function lineIndices(dir: Dir): number[][] {
  const lines: number[][] = [];
  for (let i = 0; i < SIZE; i++) {
    const idx: number[] = [];
    for (let j = 0; j < SIZE; j++) {
      let r: number, c: number;
      if (dir === "left") {
        r = i; c = j;
      } else if (dir === "right") {
        r = i; c = SIZE - 1 - j;
      } else if (dir === "up") {
        r = j; c = i;
      } else {
        r = SIZE - 1 - j; c = i;
      }
      idx.push(r * SIZE + c);
    }
    lines.push(idx);
  }
  return lines;
}

/** Apply a move without spawning. Returns the resulting board, points, and
 *  whether anything moved. Exposed for testing. */
export function applyMove(board: Board, dir: Dir): { board: Board; gained: number; moved: boolean } {
  const next = board.slice();
  let gained = 0;
  let moved = false;
  for (const idx of lineIndices(dir)) {
    const line = idx.map((i) => board[i]);
    const { line: collapsed, gained: g } = collapseLine(line);
    gained += g;
    idx.forEach((cellIndex, k) => {
      if (next[cellIndex] !== collapsed[k]) moved = true;
      next[cellIndex] = collapsed[k];
    });
  }
  return { board: next, gained, moved };
}

export function emptyCells(board: Board): number[] {
  const cells: number[] = [];
  board.forEach((v, i) => {
    if (v === 0) cells.push(i);
  });
  return cells;
}

/** Add a 2 (90%) or 4 (10%) to a random empty cell. rng injectable for tests. */
export function spawn(board: Board, rng: () => number = Math.random): Board {
  const cells = emptyCells(board);
  if (cells.length === 0) return board;
  const cell = cells[Math.floor(rng() * cells.length)];
  const next = board.slice();
  next[cell] = rng() < 0.9 ? 2 : 4;
  return next;
}

/** No moves remain when the board is full and no neighbors are equal. */
export function isGameOver(board: Board): boolean {
  if (emptyCells(board).length > 0) return false;
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      const v = board[r * SIZE + c];
      if (c + 1 < SIZE && board[r * SIZE + c + 1] === v) return false;
      if (r + 1 < SIZE && board[(r + 1) * SIZE + c] === v) return false;
    }
  }
  return true;
}

export function createInitialState(rng: () => number = Math.random): GameState {
  const board = spawn(spawn(emptyBoard(), rng), rng);
  return { board, score: 0, status: "playing", won: false };
}

export function reducer(state: GameState, action: Action): GameState {
  switch (action.type) {
    case "START":
      return createInitialState();

    case "LOAD":
      return action.state;

    case "MOVE": {
      if (state.status !== "playing") return state;
      const { board, gained, moved } = applyMove(state.board, action.dir);
      if (!moved) return state; // illegal move — no spawn, no change

      const withSpawn = spawn(board);
      const won = state.won || withSpawn.includes(2048);
      const status: Status = isGameOver(withSpawn) ? "over" : "playing";
      return { board: withSpawn, score: state.score + gained, status, won };
    }

    default:
      return state;
  }
}
