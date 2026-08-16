import {
  SURFACES_BY_KEY, initOpt, scheduleLr, stepOpt,
  type OptState, type OptimizerKey, type ScheduleKey,
} from "../../lab/gradient-descent/engine.ts";

export type GolfDifficulty = "field" | "grant";
export interface GolfHole {
  key: string;
  surface: "bowl" | "ravine" | "bumpy";
  name: string;
  par: number;
  tolerance: number;
  computeBudget: number;
  start: [number, number];
}

export const HOLES: GolfHole[] = [
  { key: "warmup", surface: "bowl", name: "The Calibration Bowl", par: 2, tolerance: 0.09, computeBudget: 100, start: [-3.2, 2.2] },
  { key: "ravine", surface: "ravine", name: "Momentum Alley", par: 3, tolerance: 0.08, computeBudget: 150, start: [-4.4, 1.8] },
  { key: "precision", surface: "bowl", name: "Needle’s Eye", par: 3, tolerance: 0.035, computeBudget: 135, start: [3.7, -2.5] },
  { key: "bumps", surface: "bumpy", name: "Local-Minimum Links", par: 5, tolerance: 0.16, computeBudget: 260, start: [-3.6, 2.6] },
  { key: "return", surface: "ravine", name: "Reverse Ravine", par: 4, tolerance: 0.045, computeBudget: 180, start: [4.6, -2] },
];

export interface GolfState {
  hole: number;
  ball: OptState;
  strokes: number[];
  computeUsed: number[];
  currentStrokes: number;
  currentCompute: number;
  difficulty: GolfDifficulty;
  /** Optional so saves from the first release still load safely. */
  activeOptimizer?: OptimizerKey | null;
  status: "playing" | "hole" | "failed" | "complete";
}

export function holeTolerance(hole: GolfHole, difficulty: GolfDifficulty): number {
  return hole.tolerance * (difficulty === "grant" ? 0.62 : 1);
}

export function holeBudget(hole: GolfHole, difficulty: GolfDifficulty): number {
  return Math.round(hole.computeBudget * (difficulty === "grant" ? 0.72 : 1));
}

export function createGolf(difficulty: GolfDifficulty = "field"): GolfState {
  return { hole: 0, ball: initOpt(...HOLES[0].start), strokes: [], computeUsed: [], currentStrokes: 0, currentCompute: 0, difficulty, activeOptimizer: null, status: "playing" };
}

export function takeShot(
  state: GolfState,
  optimizer: OptimizerKey,
  schedule: ScheduleKey,
  lr: number,
  momentum: number,
  requestedSteps: number,
): GolfState {
  if (state.status !== "playing") return state;
  const hole = HOLES[state.hole];
  const surface = SURFACES_BY_KEY.get(hole.surface)!;
  const remaining = holeBudget(hole, state.difficulty) - state.currentCompute;
  const steps = Math.max(0, Math.min(requestedSteps, remaining));
  if (steps === 0) return { ...state, status: "failed" };
  // Velocity and moments are optimizer-specific. Carrying them from Momentum
  // into Adam (or back again later) makes a method switch behave unpredictably.
  let ball = state.activeOptimizer === optimizer
    ? state.ball
    : { ...state.ball, vx: 0, vy: 0, sx: 0, sy: 0, t: 0 };
  let evaluations = 0;
  for (let i = 0; i < steps && !ball.diverged; i++) {
    ball = stepOpt(ball, surface, optimizer, scheduleLr(schedule, lr, i, steps), momentum);
    evaluations++;
  }
  const currentStrokes = state.currentStrokes + 1;
  const currentCompute = state.currentCompute + evaluations;
  const sunk = !ball.diverged && Math.hypot(ball.x, ball.y) <= holeTolerance(hole, state.difficulty);
  const status = sunk ? "hole" : ball.diverged || currentCompute >= holeBudget(hole, state.difficulty) ? "failed" : "playing";
  return { ...state, ball, currentStrokes, currentCompute, activeOptimizer: optimizer, status };
}

export function retryHole(state: GolfState): GolfState {
  if (state.status !== "failed") return state;
  const hole = HOLES[state.hole];
  return { ...state, ball: initOpt(...hole.start), currentStrokes: state.currentStrokes + 2, currentCompute: 0, activeOptimizer: null, status: "playing" };
}

export function nextHole(state: GolfState): GolfState {
  if (state.status !== "hole") return state;
  const strokes = [...state.strokes, state.currentStrokes];
  const computeUsed = [...state.computeUsed, state.currentCompute];
  const hole = state.hole + 1;
  if (hole >= HOLES.length) return { ...state, strokes, computeUsed, status: "complete" };
  return { ...state, hole, ball: initOpt(...HOLES[hole].start), strokes, computeUsed, currentStrokes: 0, currentCompute: 0, activeOptimizer: null, status: "playing" };
}

export function golfScore(state: GolfState): number {
  const played = [...state.strokes, ...(state.status === "complete" ? [] : [state.currentStrokes])];
  return played.reduce((sum, strokes, i) => sum + strokes - HOLES[i].par, 0);
}
