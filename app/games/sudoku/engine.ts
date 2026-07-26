// ---------------------------------------------------------------------------
// Sudoku engine — pure logic, no React. Generates puzzles with a unique
// solution by filling a complete grid (randomized backtracking) and digging
// clues back out while a solution-counting solver confirms uniqueness.
//
// Difficulty is clue count: fewer givens, harder puzzle. The daily puzzle is
// just generate() with an rng seeded from the date string, so everyone gets
// the same board on the same day.
// ---------------------------------------------------------------------------

export type Grid = number[]; // length 81, row-major, 0 = empty

export const DIFFICULTIES = ["easy", "medium", "hard", "expert"] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];

/** Target givens per difficulty. Digging stops early if uniqueness would break. */
export const CLUE_TARGETS: Record<Difficulty, number> = {
  easy: 40,
  medium: 34,
  hard: 29,
  expert: 25,
};

export function seededRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

/** Deterministic seed for a YYYY-MM-DD date string. */
export function dailySeed(date: string): number {
  let h = 2166136261;
  for (let i = 0; i < date.length; i++) {
    h ^= date.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

const rowOf = (i: number) => Math.floor(i / 9);
const colOf = (i: number) => i % 9;
const boxOf = (i: number) => Math.floor(rowOf(i) / 3) * 3 + Math.floor(colOf(i) / 3);

/** Indices sharing a row, column, or box with cell i (excluding i). */
export function peers(i: number): number[] {
  const out: number[] = [];
  for (let j = 0; j < 81; j++) {
    if (j !== i && (rowOf(j) === rowOf(i) || colOf(j) === colOf(i) || boxOf(j) === boxOf(i))) {
      out.push(j);
    }
  }
  return out;
}

const PEERS: number[][] = Array.from({ length: 81 }, (_, i) => peers(i));

export function isLegal(grid: Grid, i: number, v: number): boolean {
  return PEERS[i].every((j) => grid[j] !== v);
}

function shuffled<T>(arr: T[], rng: () => number): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Count solutions up to `cap` (2 is enough to prove non-uniqueness). */
export function solveCount(grid: Grid, cap = 2): number {
  const g = grid.slice();
  let count = 0;

  function step(): boolean {
    // Most-constrained cell first keeps the search shallow.
    let best = -1;
    let bestOpts: number[] | null = null;
    for (let i = 0; i < 81; i++) {
      if (g[i] !== 0) continue;
      const opts: number[] = [];
      for (let v = 1; v <= 9; v++) if (isLegal(g, i, v)) opts.push(v);
      if (opts.length === 0) return false;
      if (!bestOpts || opts.length < bestOpts.length) {
        best = i;
        bestOpts = opts;
        if (opts.length === 1) break;
      }
    }
    if (best === -1) {
      count++;
      return count >= cap; // true aborts the search
    }
    for (const v of bestOpts!) {
      g[best] = v;
      if (step()) return true;
      g[best] = 0;
    }
    return false;
  }

  step();
  return count;
}

/** First solution of a grid, or null. */
export function solve(grid: Grid): Grid | null {
  const g = grid.slice();

  function step(): boolean {
    let best = -1;
    let bestOpts: number[] | null = null;
    for (let i = 0; i < 81; i++) {
      if (g[i] !== 0) continue;
      const opts: number[] = [];
      for (let v = 1; v <= 9; v++) if (isLegal(g, i, v)) opts.push(v);
      if (opts.length === 0) return false;
      if (!bestOpts || opts.length < bestOpts.length) {
        best = i;
        bestOpts = opts;
        if (opts.length === 1) break;
      }
    }
    if (best === -1) return true;
    for (const v of bestOpts!) {
      g[best] = v;
      if (step()) return true;
      g[best] = 0;
    }
    return false;
  }

  return step() ? g : null;
}

/** A complete, valid, randomized grid. */
export function generateFull(rng: () => number = Math.random): Grid {
  const g: Grid = Array(81).fill(0);

  function fill(i: number): boolean {
    if (i === 81) return true;
    for (const v of shuffled([1, 2, 3, 4, 5, 6, 7, 8, 9], rng)) {
      if (isLegal(g, i, v)) {
        g[i] = v;
        if (fill(i + 1)) return true;
        g[i] = 0;
      }
    }
    return false;
  }

  fill(0);
  return g;
}

export interface Puzzle {
  puzzle: Grid;
  solution: Grid;
  difficulty: Difficulty;
  clues: number;
}

/** Generate a unique-solution puzzle at the given difficulty. */
export function generate(difficulty: Difficulty, rng: () => number = Math.random): Puzzle {
  const solution = generateFull(rng);
  const puzzle = solution.slice();
  const target = CLUE_TARGETS[difficulty];
  let clues = 81;

  // Dig in random order; skip any removal that breaks uniqueness.
  for (const i of shuffled(Array.from({ length: 81 }, (_, k) => k), rng)) {
    if (clues <= target) break;
    const saved = puzzle[i];
    puzzle[i] = 0;
    if (solveCount(puzzle, 2) === 1) {
      clues--;
    } else {
      puzzle[i] = saved;
    }
  }

  return { puzzle, solution, difficulty, clues };
}

/** All cells filled and equal to the solution. */
export function isSolved(entries: Grid, solution: Grid): boolean {
  return entries.every((v, i) => v === solution[i]);
}

/** Today's date as YYYY-MM-DD in the visitor's timezone. */
export function todayString(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Longest run of consecutive dates ending at `today`, given a set of
 *  YYYY-MM-DD strings. Used for the daily-puzzle streak. */
export function streakEndingToday(dates: Set<string>, today: string): number {
  let streak = 0;
  const cursor = new Date(`${today}T12:00:00`); // noon dodges DST edges
  while (dates.has(todayString(cursor))) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}
