export const COLS = 28;
export const ROWS = 20;
export const WINS_TO_MATCH = 3;

export type Point = { x: number; y: number };
export type Dir = "up" | "right" | "down" | "left";
export type CycleStatus = "idle" | "running" | "player" | "ai" | "draw";
export type CycleDifficulty = "standard" | "expert";

export interface CycleState {
  player: Point[];
  ai: Point[];
  playerDir: Dir;
  aiDir: Dir;
  pendingDir: Dir;
  status: CycleStatus;
  ticks: number;
  round: number;
  playerScore: number;
  aiScore: number;
  matchWinner: "player" | "ai" | null;
  difficulty: CycleDifficulty;
}

const DELTA: Record<Dir, Point> = {
  up: { x: 0, y: -1 }, right: { x: 1, y: 0 },
  down: { x: 0, y: 1 }, left: { x: -1, y: 0 },
};
const DIRS: Dir[] = ["up", "right", "down", "left"];
const OPPOSITE: Record<Dir, Dir> = { up: "down", down: "up", left: "right", right: "left" };
const key = (p: Point) => `${p.x},${p.y}`;
const inside = (p: Point) => p.x >= 0 && p.x < COLS && p.y >= 0 && p.y < ROWS;

function roundPositions() {
  return {
    player: [{ x: 4, y: Math.floor(ROWS / 2) }],
    ai: [{ x: COLS - 5, y: Math.floor(ROWS / 2) }],
  };
}

export function initialCycleState(difficulty: CycleDifficulty = "standard"): CycleState {
  return {
    ...roundPositions(), playerDir: "right", aiDir: "left", pendingDir: "right",
    status: "idle", ticks: 0, round: 1, playerScore: 0, aiScore: 0,
    matchWinner: null, difficulty,
  };
}

export function startNextRound(state: CycleState): CycleState {
  if (state.status === "running") return state;
  if (state.matchWinner) return { ...initialCycleState(state.difficulty), status: "running" };
  return {
    ...state, ...roundPositions(), playerDir: "right", aiDir: "left", pendingDir: "right",
    status: "running", ticks: 0,
    round: state.status === "idle" ? state.round : state.round + 1,
  };
}

function move(p: Point, dir: Dir): Point {
  const d = DELTA[dir];
  return { x: p.x + d.x, y: p.y + d.y };
}

function reachable(start: Point, blocked: Set<string>): number {
  if (!inside(start) || blocked.has(key(start))) return -1;
  const seen = new Set([key(start)]);
  const queue = [start];
  for (let i = 0; i < queue.length; i++) {
    for (const dir of DIRS) {
      const n = move(queue[i], dir);
      const k = key(n);
      if (inside(n) && !blocked.has(k) && !seen.has(k)) { seen.add(k); queue.push(n); }
    }
  }
  return seen.size;
}

export function chooseAiDir(state: CycleState): Dir {
  const blocked = new Set([...state.player, ...state.ai].map(key));
  const choices = [state.aiDir, ...DIRS].filter((d, i, a) => a.indexOf(d) === i && d !== OPPOSITE[state.aiDir]);
  let best = choices[0];
  let bestScore = -Infinity;
  for (const dir of choices) {
    const next = move(state.ai[0], dir);
    const space = reachable(next, blocked);
    if (space < 0) continue;
    const distance = Math.abs(next.x - state.player[0].x) + Math.abs(next.y - state.player[0].y);
    const centre = Math.abs(next.x - COLS / 2) + Math.abs(next.y - ROWS / 2);
    // Expert still prioritizes survival, but actively closes distance and
    // contests the centre instead of lazily accepting any large open region.
    const score = space * 10 - centre * 0.15 - (state.difficulty === "expert" ? distance * 1.8 : 0);
    if (score > bestScore) { best = dir; bestScore = score; }
  }
  return best;
}

export function turnCycle(state: CycleState, dir: Dir): CycleState {
  if (state.status !== "running" || dir === OPPOSITE[state.playerDir]) return state;
  return { ...state, pendingDir: dir };
}

export function tickCycle(state: CycleState): CycleState {
  if (state.status !== "running") return state;
  const playerDir = state.pendingDir;
  const aiDir = chooseAiDir(state);
  const p = move(state.player[0], playerDir);
  const a = move(state.ai[0], aiDir);
  const occupied = new Set([...state.player, ...state.ai].map(key));
  const playerCrash = !inside(p) || occupied.has(key(p));
  const aiCrash = !inside(a) || occupied.has(key(a));
  const headOn = key(p) === key(a);
  let status: CycleStatus = "running";
  if (headOn || (playerCrash && aiCrash)) status = "draw";
  else if (playerCrash) status = "ai";
  else if (aiCrash) status = "player";

  let playerScore = state.playerScore + (status === "player" ? 1 : 0);
  let aiScore = state.aiScore + (status === "ai" ? 1 : 0);
  const matchWinner = playerScore >= WINS_TO_MATCH ? "player" : aiScore >= WINS_TO_MATCH ? "ai" : null;
  if (matchWinner === "player") playerScore = WINS_TO_MATCH;
  if (matchWinner === "ai") aiScore = WINS_TO_MATCH;
  return {
    ...state,
    player: playerCrash ? state.player : [p, ...state.player],
    ai: aiCrash ? state.ai : [a, ...state.ai],
    playerDir, aiDir, status, ticks: state.ticks + 1,
    playerScore, aiScore, matchWinner,
  };
}
