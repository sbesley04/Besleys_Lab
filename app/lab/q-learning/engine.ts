// ---------------------------------------------------------------------------
// Tabular Q-learning on a gridworld — pure logic, no React.
//
// The agent knows nothing at the start: no map, no rules, only the reward it
// receives after each move. Q[s][a] is its running estimate of "total future
// reward if I take action a in state s and behave greedily afterwards", and
// the update is the classic
//     Q(s,a) ← Q(s,a) + α·[ r + γ·max_a' Q(s',a') − Q(s,a) ]
// ---------------------------------------------------------------------------

export type Action = 0 | 1 | 2 | 3; // up, right, down, left
export const ACTIONS: Action[] = [0, 1, 2, 3];
export const ACTION_LABELS = ["↑", "→", "↓", "←"];
const DELTAS: [number, number][] = [
  [0, -1],
  [1, 0],
  [0, 1],
  [-1, 0],
];

export interface Cell {
  wall: boolean;
  pit: boolean;
  goal: boolean;
}

export interface Grid {
  cols: number;
  rows: number;
  cells: Cell[];
  start: number;
  goal: number;
  /** Where you end up taking `a` from `s` (walls and edges bounce you back). */
  next: (s: number, a: Action) => number;
  reward: (s: number) => number;
  terminal: (s: number) => boolean;
}

export interface GridSpec {
  cols: number;
  rows: number;
  /** Row strings: '.' floor, '#' wall, 'X' pit, 'G' goal, 'S' start. */
  layout: string[];
}

export const DEFAULT_GRID: GridSpec = {
  cols: 8,
  rows: 6,
  layout: [
    "S..#....",
    "...#.XX.",
    ".#...X..",
    ".#.##...",
    "...#..X.",
    "..X....G",
  ],
};

export const REWARD_GOAL = 1;
export const REWARD_PIT = -1;
/** Small negative reward per move — the reason the agent learns to hurry. */
export const REWARD_STEP = -0.02;

export function makeGrid(spec: GridSpec): Grid {
  const cells: Cell[] = [];
  let start = 0;
  let goal = -1;

  for (let r = 0; r < spec.rows; r++) {
    const row = spec.layout[r] ?? "";
    for (let c = 0; c < spec.cols; c++) {
      const ch = row[c] ?? ".";
      const idx = r * spec.cols + c;
      cells.push({ wall: ch === "#", pit: ch === "X", goal: ch === "G" });
      if (ch === "S") start = idx;
      if (ch === "G") goal = idx;
    }
  }

  const next = (s: number, a: Action): number => {
    const c = s % spec.cols;
    const r = Math.floor(s / spec.cols);
    const [dc, dr] = DELTAS[a];
    const nc = c + dc;
    const nr = r + dr;
    if (nc < 0 || nc >= spec.cols || nr < 0 || nr >= spec.rows) return s; // edge
    const ni = nr * spec.cols + nc;
    return cells[ni].wall ? s : ni; // walls bounce
  };

  return {
    cols: spec.cols,
    rows: spec.rows,
    cells,
    start,
    goal,
    next,
    reward: (s) => (cells[s].goal ? REWARD_GOAL : cells[s].pit ? REWARD_PIT : REWARD_STEP),
    terminal: (s) => cells[s].goal || cells[s].pit,
  };
}

export interface QState {
  /** Q[state][action] */
  q: number[][];
  /** Where the agent currently is. */
  s: number;
  episode: number;
  stepsThisEpisode: number;
  /** Reward totals for the last few episodes — drives the learning curve. */
  history: { episode: number; reward: number; steps: number; success: boolean }[];
  episodeReward: number;
  /** Cells visited this episode, for the trail overlay. */
  trail: number[];
}

export function initQ(grid: Grid): QState {
  return {
    q: grid.cells.map(() => [0, 0, 0, 0]),
    s: grid.start,
    episode: 0,
    stepsThisEpisode: 0,
    history: [],
    episodeReward: 0,
    trail: [grid.start],
  };
}

export interface QParams {
  epsilon: number;
  alpha: number;
  gamma: number;
}

export const MAX_EPISODE_STEPS = 120;

export function bestAction(state: QState, s: number): Action {
  const row = state.q[s];
  let best: Action = 0;
  for (const a of ACTIONS) if (row[a] > row[best]) best = a;
  return best;
}

function maxQ(state: QState, s: number): number {
  return Math.max(...state.q[s]);
}

/**
 * One environment step (not one episode): pick an action ε-greedily, move,
 * observe the reward, update Q, and reset if the episode ended.
 */
export function qStep(
  state: QState,
  grid: Grid,
  params: QParams,
  rng: () => number = Math.random,
): { q: QState; justFinished: boolean } {
  const s = state.s;
  const a: Action = rng() < params.epsilon ? (Math.floor(rng() * 4) as Action) : bestAction(state, s);
  const s2 = grid.next(s, a);
  const r = grid.reward(s2);
  const done = grid.terminal(s2);

  const q = state.q.map((row) => row.slice());
  // Terminal states have no future, so the bootstrap term drops out.
  const target = done ? r : r + params.gamma * maxQ(state, s2);
  q[s][a] += params.alpha * (target - q[s][a]);

  const steps = state.stepsThisEpisode + 1;
  const episodeReward = state.episodeReward + r;
  const trail = state.trail.length > 200 ? [s2] : [...state.trail, s2];
  const timeout = steps >= MAX_EPISODE_STEPS;

  if (done || timeout) {
    const history = [
      ...state.history,
      { episode: state.episode, reward: episodeReward, steps, success: grid.cells[s2].goal },
    ].slice(-400);
    return {
      justFinished: true,
      q: {
        q,
        s: grid.start,
        episode: state.episode + 1,
        stepsThisEpisode: 0,
        history,
        episodeReward: 0,
        trail: [grid.start],
      },
    };
  }

  return {
    justFinished: false,
    q: { ...state, q, s: s2, stepsThisEpisode: steps, episodeReward, trail },
  };
}

/** Run whole episodes at once — the "train 100 episodes" button. */
export function runEpisodes(
  state: QState,
  grid: Grid,
  params: QParams,
  episodes: number,
  rng: () => number = Math.random,
): QState {
  let cur = state;
  let done = 0;
  let guard = 0;
  while (done < episodes && guard++ < episodes * MAX_EPISODE_STEPS + 1000) {
    const r = qStep(cur, grid, params, rng);
    cur = r.q;
    if (r.justFinished) done++;
  }
  return cur;
}

/** Greedy action per cell — the arrows drawn on the grid. */
export function greedyPolicy(state: QState, grid: Grid): Action[] {
  return grid.cells.map((c, i) => (c.wall || c.goal || c.pit ? 0 : bestAction(state, i)));
}

/** State value V(s) = max_a Q(s,a) — the heat shading. */
export function values(state: QState): number[] {
  return state.q.map((row) => Math.max(...row));
}

/** Success rate over the last `window` episodes. Includes exploration noise —
 *  with ε > 0 the agent deliberately makes bad moves, so this understates how
 *  good the learned policy is. Use evaluatePolicy for that. */
export function successRate(state: QState, window = 25): number {
  const recent = state.history.slice(-window);
  if (recent.length === 0) return 0;
  return recent.filter((h) => h.success).length / recent.length;
}

/**
 * Follow the greedy policy from the start with no exploration: does it reach
 * the goal, and in how many steps? This is what "has it learned?" really
 * means — the ε-greedy success rate above is dragged down by deliberate
 * random moves.
 */
export function evaluatePolicy(
  state: QState,
  grid: Grid,
): { reached: boolean; steps: number; path: number[] } {
  const path: number[] = [grid.start];
  const seen = new Set<number>([grid.start]);
  let s = grid.start;

  for (let i = 0; i < MAX_EPISODE_STEPS; i++) {
    if (s === grid.goal) return { reached: true, steps: path.length - 1, path };
    const next = grid.next(s, bestAction(state, s));
    // A loop (or a wall it keeps walking into) means no usable policy yet.
    if (seen.has(next)) return { reached: false, steps: path.length - 1, path };
    seen.add(next);
    path.push(next);
    s = next;
    if (grid.cells[s].pit) return { reached: false, steps: path.length - 1, path };
  }
  return { reached: s === grid.goal, steps: path.length - 1, path };
}
