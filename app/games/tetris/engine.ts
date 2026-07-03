// ---------------------------------------------------------------------------
// Tetris engine — pure logic, no React. Kept separate from the component so it
// can be unit-tested and reasoned about on its own. The reducer is consumed by
// Tetris.tsx via useReducer; the game loop just dispatches { type: "TICK" }.
//
// EXTEND HERE: add hold-piece, wall kicks, or scoring tweaks here without
// touching rendering. Board is 10 wide x 20 tall.
// ---------------------------------------------------------------------------

export const COLS = 10;
export const ROWS = 20;

// Cell holds either null (empty) or a tetromino key, used to look up its ink tone.
export type Cell = TetrominoKey | null;
export type Board = Cell[][];

export type TetrominoKey = "I" | "O" | "T" | "S" | "Z" | "J" | "L";

// Each shape is a list of rotation states; every state is a list of [row, col]
// offsets from the piece origin. Coordinates chosen so rotation stays compact.
const SHAPES: Record<TetrominoKey, number[][][]> = {
  I: [
    [[1, 0], [1, 1], [1, 2], [1, 3]],
    [[0, 2], [1, 2], [2, 2], [3, 2]],
    [[2, 0], [2, 1], [2, 2], [2, 3]],
    [[0, 1], [1, 1], [2, 1], [3, 1]],
  ],
  O: [
    [[0, 1], [0, 2], [1, 1], [1, 2]],
  ],
  T: [
    [[0, 1], [1, 0], [1, 1], [1, 2]],
    [[0, 1], [1, 1], [1, 2], [2, 1]],
    [[1, 0], [1, 1], [1, 2], [2, 1]],
    [[0, 1], [1, 0], [1, 1], [2, 1]],
  ],
  S: [
    [[0, 1], [0, 2], [1, 0], [1, 1]],
    [[0, 1], [1, 1], [1, 2], [2, 2]],
    [[1, 1], [1, 2], [2, 0], [2, 1]],
    [[0, 0], [1, 0], [1, 1], [2, 1]],
  ],
  Z: [
    [[0, 0], [0, 1], [1, 1], [1, 2]],
    [[0, 2], [1, 1], [1, 2], [2, 1]],
    [[1, 0], [1, 1], [2, 1], [2, 2]],
    [[0, 1], [1, 0], [1, 1], [2, 0]],
  ],
  J: [
    [[0, 0], [1, 0], [1, 1], [1, 2]],
    [[0, 1], [0, 2], [1, 1], [2, 1]],
    [[1, 0], [1, 1], [1, 2], [2, 2]],
    [[0, 1], [1, 1], [2, 0], [2, 1]],
  ],
  L: [
    [[0, 2], [1, 0], [1, 1], [1, 2]],
    [[0, 1], [1, 1], [2, 1], [2, 2]],
    [[1, 0], [1, 1], [1, 2], [2, 0]],
    [[0, 0], [0, 1], [1, 1], [2, 1]],
  ],
};

const KEYS: TetrominoKey[] = ["I", "O", "T", "S", "Z", "J", "L"];

export interface Piece {
  key: TetrominoKey;
  rotation: number;
  row: number; // origin row (can be negative while entering)
  col: number; // origin col
}

export type Status = "idle" | "running" | "paused" | "over";

export interface GameState {
  board: Board;
  piece: Piece | null;
  next: TetrominoKey;
  score: number;
  lines: number;
  level: number;
  status: Status;
}

export type Action =
  | { type: "START" }
  | { type: "TICK" }
  | { type: "MOVE"; dir: -1 | 1 }
  | { type: "ROTATE" }
  | { type: "SOFT_DROP" }
  | { type: "HARD_DROP" }
  | { type: "TOGGLE_PAUSE" }
  | { type: "LOAD"; state: GameState }; // restore a saved game (comes back paused)

// --- helpers ----------------------------------------------------------------

function emptyBoard(): Board {
  return Array.from({ length: ROWS }, () => Array<Cell>(COLS).fill(null));
}

function randomKey(): TetrominoKey {
  return KEYS[Math.floor(Math.random() * KEYS.length)];
}

export function cellsFor(piece: Piece): [number, number][] {
  const states = SHAPES[piece.key];
  const offsets = states[piece.rotation % states.length];
  return offsets.map(([r, c]) => [piece.row + r, piece.col + c]);
}

function collides(board: Board, piece: Piece): boolean {
  return cellsFor(piece).some(([r, c]) => {
    if (c < 0 || c >= COLS || r >= ROWS) return true; // walls / floor
    if (r < 0) return false; // still entering from the top
    return board[r][c] !== null; // overlaps a settled block
  });
}

function spawn(key: TetrominoKey): Piece {
  // Spawn fully visible at the top-center. If this position already collides
  // (board filled to the top), the caller treats it as game over.
  return { key, rotation: 0, row: 0, col: 3 };
}

function lockAndClear(board: Board, piece: Piece): { board: Board; cleared: number } {
  const next = board.map((row) => row.slice());
  for (const [r, c] of cellsFor(piece)) {
    if (r >= 0 && r < ROWS && c >= 0 && c < COLS) next[r][c] = piece.key;
  }
  const kept = next.filter((row) => row.some((cell) => cell === null));
  const cleared = ROWS - kept.length;
  const padding = Array.from({ length: cleared }, () => Array<Cell>(COLS).fill(null));
  return { board: [...padding, ...kept], cleared };
}

// Standard line-clear scoring, scaled by level.
const LINE_SCORE = [0, 100, 300, 500, 800];

export function gravityIntervalMs(level: number): number {
  // Speeds up as levels climb; floored so it never gets impossible.
  return Math.max(120, 800 - (level - 1) * 70);
}

// --- reducer ----------------------------------------------------------------

export function createInitialState(): GameState {
  return {
    board: emptyBoard(),
    piece: null,
    next: randomKey(),
    score: 0,
    lines: 0,
    level: 1,
    status: "idle",
  };
}

/** Settle the active piece, clear lines, and bring in the next piece. */
function settle(state: GameState, piece: Piece): GameState {
  const { board, cleared } = lockAndClear(state.board, piece);
  const lines = state.lines + cleared;
  const level = Math.floor(lines / 10) + 1;
  const score = state.score + LINE_SCORE[cleared] * state.level;

  const nextPiece = spawn(state.next);
  const following = randomKey();

  // If the freshly spawned piece already collides, it's game over.
  if (collides(board, nextPiece)) {
    return { ...state, board, lines, level, score, piece: nextPiece, next: following, status: "over" };
  }
  return { ...state, board, lines, level, score, piece: nextPiece, next: following };
}

export function reducer(state: GameState, action: Action): GameState {
  switch (action.type) {
    case "LOAD":
      // Come back paused so the piece doesn't drop the instant it loads.
      return { ...action.state, status: action.state.status === "running" ? "paused" : action.state.status };

    case "START": {
      const first = spawn(state.next);
      return {
        ...createInitialState(),
        next: randomKey(),
        piece: first,
        status: "running",
      };
    }

    case "TOGGLE_PAUSE": {
      if (state.status === "running") return { ...state, status: "paused" };
      if (state.status === "paused") return { ...state, status: "running" };
      return state;
    }

    case "TICK":
    case "SOFT_DROP": {
      if (state.status !== "running" || !state.piece) return state;
      const moved = { ...state.piece, row: state.piece.row + 1 };
      if (collides(state.board, moved)) {
        return settle(state, state.piece);
      }
      const bonus = action.type === "SOFT_DROP" ? 1 : 0;
      return { ...state, piece: moved, score: state.score + bonus };
    }

    case "MOVE": {
      if (state.status !== "running" || !state.piece) return state;
      const moved = { ...state.piece, col: state.piece.col + action.dir };
      return collides(state.board, moved) ? state : { ...state, piece: moved };
    }

    case "ROTATE": {
      if (state.status !== "running" || !state.piece) return state;
      const states = SHAPES[state.piece.key].length;
      const rotated = { ...state.piece, rotation: (state.piece.rotation + 1) % states };
      // Simple wall-kick: try in place, then nudge 1 left/right.
      for (const dc of [0, -1, 1, -2, 2]) {
        const candidate = { ...rotated, col: rotated.col + dc };
        if (!collides(state.board, candidate)) return { ...state, piece: candidate };
      }
      return state;
    }

    case "HARD_DROP": {
      if (state.status !== "running" || !state.piece) return state;
      let dropped = state.piece;
      let distance = 0;
      while (!collides(state.board, { ...dropped, row: dropped.row + 1 })) {
        dropped = { ...dropped, row: dropped.row + 1 };
        distance++;
      }
      return settle({ ...state, score: state.score + distance * 2 }, dropped);
    }

    default:
      return state;
  }
}

/** Merge the settled board with the active piece for rendering. */
export function renderBoard(state: GameState): Board {
  const view = state.board.map((row) => row.slice());
  if (state.piece) {
    for (const [r, c] of cellsFor(state.piece)) {
      if (r >= 0 && r < ROWS && c >= 0 && c < COLS) view[r][c] = state.piece.key;
    }
  }
  return view;
}
