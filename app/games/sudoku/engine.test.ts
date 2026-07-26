// Pure-logic tests for the sudoku engine. Run with:
//   npm run test:sudoku   (node --experimental-strip-types)
import {
  generate, generateFull, solve, solveCount, isLegal, isSolved,
  seededRng, dailySeed, streakEndingToday, todayString, CLUE_TARGETS, type Grid,
} from "./engine.ts";

let fail = 0;
const ok = (c: boolean, n: string) => { if (!c) { fail++; console.log("FAIL:", n); } };

function validComplete(g: Grid): boolean {
  if (g.length !== 81 || g.some((v) => v < 1 || v > 9)) return false;
  for (let i = 0; i < 81; i++) {
    const v = g[i];
    const t = g.slice();
    t[i] = 0;
    if (!isLegal(t, i, v)) return false;
  }
  return true;
}

// Full-grid generation is valid and seeded-deterministic.
const full = generateFull(seededRng(42));
ok(validComplete(full), "generateFull produces a valid grid");
ok(JSON.stringify(generateFull(seededRng(42))) === JSON.stringify(full), "same seed, same grid");
ok(JSON.stringify(generateFull(seededRng(43))) !== JSON.stringify(full), "different seed, different grid");

// Puzzles: unique solution, matches stated solution, near clue target.
for (const diff of ["easy", "expert"] as const) {
  const p = generate(diff, seededRng(7));
  ok(solveCount(p.puzzle, 2) === 1, `${diff} puzzle has a unique solution`);
  const solved = solve(p.puzzle);
  ok(!!solved && JSON.stringify(solved) === JSON.stringify(p.solution), `${diff} solver matches solution`);
  ok(p.clues === p.puzzle.filter((v) => v !== 0).length, `${diff} clue count is accurate`);
  ok(p.clues >= CLUE_TARGETS[diff], `${diff} has at least the target clues`);
  ok(p.puzzle.every((v, i) => v === 0 || v === p.solution[i]), `${diff} givens agree with solution`);
}
const easy = generate("easy", seededRng(9));
const expert = generate("expert", seededRng(9));
ok(easy.clues > expert.clues, "easy keeps more clues than expert");

// Daily seed is stable per date string.
ok(dailySeed("2026-07-20") === dailySeed("2026-07-20"), "daily seed stable");
ok(dailySeed("2026-07-20") !== dailySeed("2026-07-21"), "daily seed varies by day");

// isSolved.
const p = generate("easy", seededRng(3));
ok(isSolved(p.solution, p.solution), "solution counts as solved");
ok(!isSolved(p.puzzle, p.solution), "unfinished grid is not solved");

// Streaks.
const today = todayString(new Date("2026-07-20T12:00:00"));
const dates = new Set(["2026-07-20", "2026-07-19", "2026-07-18", "2026-07-15"]);
ok(streakEndingToday(dates, today) === 3, "streak counts consecutive days");
ok(streakEndingToday(new Set(["2026-07-19"]), today) === 0, "streak requires today");

console.log(fail === 0 ? "\nALL SUDOKU ENGINE TESTS PASSED" : `\n${fail} failed`);
process.exit(fail ? 1 : 0);
