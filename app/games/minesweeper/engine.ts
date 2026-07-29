// ---------------------------------------------------------------------------
// Minesweeper — pure logic, no React. Consumed by Minesweeper.tsx.
//
// Mines are placed on the *first click* rather than at deal time, with the
// clicked cell and its neighbours guaranteed safe — so no game is ever lost on
// move one, and every board opens with a usable region.
// ---------------------------------------------------------------------------

export type CellState = "hidden" | "revealed" | "flagged";
export type Status = "idle" | "playing" | "won" | "lost";

export interface Cell {
  mine: boolean;
  /** Adjacent mine count, computed once mines are placed. */
  adjacent: number;
  state: CellState;
}

export interface Board {
  cols: number;
  rows: number;
  mines: number;
  cells: Cell[];
  status: Status;
  /** Cell index that ended the game, for the "boom" highlight. */
  detonated: number | null;
  /** Mines placed yet? False until the first reveal. */
  seeded: boolean;
}

export interface Level {
  key: string;
  name: string;
  cols: number;
  rows: number;
  mines: number;
}

export const LEVELS: Level[] = [
  { key: "beginner", name: "Beginner", cols: 9, rows: 9, mines: 10 },
  { key: "intermediate", name: "Intermediate", cols: 16, rows: 16, mines: 40 },
  { key: "expert", name: "Expert", cols: 30, rows: 16, mines: 99 },
];

export const LEVELS_BY_KEY = new Map(LEVELS.map((l) => [l.key, l]));

export function createBoard(level: Level): Board {
  return {
    cols: level.cols,
    rows: level.rows,
    mines: level.mines,
    cells: Array.from({ length: level.cols * level.rows }, () => ({
      mine: false,
      adjacent: 0,
      state: "hidden" as CellState,
    })),
    status: "idle",
    detonated: null,
    seeded: false,
  };
}

export function neighbors(board: Board, i: number): number[] {
  const c = i % board.cols;
  const r = Math.floor(i / board.cols);
  const out: number[] = [];
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue;
      const nc = c + dc;
      const nr = r + dr;
      if (nc < 0 || nc >= board.cols || nr < 0 || nr >= board.rows) continue;
      out.push(nr * board.cols + nc);
    }
  }
  return out;
}

/**
 * Place mines, keeping `safe` and its neighbours clear. Called on the first
 * reveal so the opening click always opens something.
 */
export function seedMines(board: Board, safe: number, rng: () => number = Math.random): Board {
  const next: Board = { ...board, cells: board.cells.map((c) => ({ ...c })), seeded: true };
  const forbidden = new Set([safe, ...neighbors(board, safe)]);

  const candidates: number[] = [];
  for (let i = 0; i < next.cells.length; i++) if (!forbidden.has(i)) candidates.push(i);

  // If the board is so small that the safe zone doesn't leave room, fall back
  // to keeping only the clicked cell clear.
  const pool = candidates.length >= next.mines
    ? candidates
    : next.cells.map((_, i) => i).filter((i) => i !== safe);

  // Partial Fisher–Yates: shuffle only as many as we need.
  const picked = pool.slice();
  for (let i = 0; i < next.mines && i < picked.length; i++) {
    const j = i + Math.floor(rng() * (picked.length - i));
    [picked[i], picked[j]] = [picked[j], picked[i]];
    next.cells[picked[i]].mine = true;
  }

  for (let i = 0; i < next.cells.length; i++) {
    next.cells[i].adjacent = neighbors(next, i).filter((n) => next.cells[n].mine).length;
  }
  return next;
}

/** Flood-fill empty regions outward from `start`. Mutates `cells` in place. */
function floodReveal(board: Board, start: number) {
  const stack = [start];
  while (stack.length > 0) {
    const i = stack.pop()!;
    const cell = board.cells[i];
    if (cell.state !== "hidden") continue;
    cell.state = "revealed";
    if (cell.adjacent === 0 && !cell.mine) {
      for (const n of neighbors(board, i)) {
        if (board.cells[n].state === "hidden") stack.push(n);
      }
    }
  }
}

/** Every non-mine cell revealed? */
export function isWon(board: Board): boolean {
  return board.cells.every((c) => c.mine || c.state === "revealed");
}

export function reveal(board: Board, i: number, rng: () => number = Math.random): Board {
  if (board.status === "won" || board.status === "lost") return board;
  if (board.cells[i].state !== "hidden") return board;

  let next: Board = board.seeded
    ? { ...board, cells: board.cells.map((c) => ({ ...c })) }
    : seedMines(board, i, rng);
  next.status = "playing";

  if (next.cells[i].mine) {
    next.cells[i].state = "revealed";
    // Reveal every other mine so the finished board reads clearly.
    next.cells.forEach((c) => {
      if (c.mine && c.state === "hidden") c.state = "revealed";
    });
    return { ...next, status: "lost", detonated: i };
  }

  floodReveal(next, i);
  if (isWon(next)) {
    // Auto-flag the remaining mines — the traditional finish.
    next.cells.forEach((c) => {
      if (c.mine) c.state = "flagged";
    });
    return { ...next, status: "won" };
  }
  return next;
}

export function toggleFlag(board: Board, i: number): Board {
  if (board.status === "won" || board.status === "lost") return board;
  const cell = board.cells[i];
  if (cell.state === "revealed") return board;
  const cells = board.cells.map((c) => ({ ...c }));
  cells[i].state = cell.state === "flagged" ? "hidden" : "flagged";
  return { ...board, cells, status: board.status === "idle" ? "idle" : board.status };
}

/**
 * Chording: clicking a revealed number whose adjacent flag count matches it
 * reveals all its remaining hidden neighbours. The expert player's main verb —
 * and a fast way to lose if the flags are wrong.
 */
export function chord(board: Board, i: number, rng: () => number = Math.random): Board {
  const cell = board.cells[i];
  if (cell.state !== "revealed" || cell.adjacent === 0) return board;
  const ns = neighbors(board, i);
  const flags = ns.filter((n) => board.cells[n].state === "flagged").length;
  if (flags !== cell.adjacent) return board;

  let next = board;
  for (const n of ns) {
    if (next.cells[n].state === "hidden") next = reveal(next, n, rng);
    if (next.status === "lost") return next;
  }
  return next;
}

export function flagCount(board: Board): number {
  return board.cells.filter((c) => c.state === "flagged").length;
}

/** Mines minus flags — the traditional counter (can go negative). */
export function minesRemaining(board: Board): number {
  return board.mines - flagCount(board);
}

/** Fraction of safe cells uncovered, for the progress readout. */
export function progress(board: Board): number {
  const safe = board.cells.length - board.mines;
  const done = board.cells.filter((c) => !c.mine && c.state === "revealed").length;
  return safe === 0 ? 0 : done / safe;
}
