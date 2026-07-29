// ---------------------------------------------------------------------------
// Optimizers and 2D loss surfaces — pure logic, no React. Shared by the
// gradient-descent demo and the learning-rate-schedule demo.
//
// Every surface exposes f(x, y) and its analytic gradient, so the demos show
// true descent paths rather than finite-difference approximations.
// ---------------------------------------------------------------------------

export interface Surface {
  key: string;
  name: string;
  /** What this surface is meant to teach. */
  note: string;
  f: (x: number, y: number) => number;
  grad: (x: number, y: number) => [number, number];
  domain: [number, number];
  range: [number, number];
  /** A sensible starting point for "reset". */
  start: [number, number];
  /** Learning rate at which this surface starts to misbehave (for the hint). */
  divergesAbove: number;
}

export const SURFACES: Surface[] = [
  {
    key: "bowl",
    name: "Bowl",
    note: "A convex quadratic — the easy case. Every path ends at the same minimum.",
    f: (x, y) => 0.5 * x * x + 1.6 * y * y,
    grad: (x, y) => [x, 3.2 * y],
    domain: [-4, 4],
    range: [-3, 3],
    start: [-3.2, 2.2],
    divergesAbove: 0.62,
  },
  {
    key: "ravine",
    name: "Ravine",
    note: "A long, steep-walled valley. Plain SGD zig-zags across it; momentum sails down it.",
    f: (x, y) => 0.05 * x * x + 3.2 * y * y,
    grad: (x, y) => [0.1 * x, 6.4 * y],
    domain: [-5, 5],
    range: [-2.4, 2.4],
    start: [-4.4, 1.8],
    divergesAbove: 0.31,
  },
  {
    key: "saddle",
    name: "Saddle",
    note: "Flat in one direction, falling in another. Gradients vanish near the middle and progress stalls.",
    f: (x, y) => x * x - 1.4 * y * y,
    grad: (x, y) => [2 * x, -2.8 * y],
    domain: [-3, 3],
    range: [-2.2, 2.2],
    start: [-2.4, 0.06],
    divergesAbove: 0.35,
  },
  {
    key: "bumpy",
    name: "Bumpy",
    note: "Local minima everywhere. Where you start decides where you land.",
    f: (x, y) => 0.16 * (x * x + y * y) - Math.cos(2.2 * x) - Math.cos(2.2 * y) + 2,
    grad: (x, y) => [0.32 * x + 2.2 * Math.sin(2.2 * x), 0.32 * y + 2.2 * Math.sin(2.2 * y)],
    domain: [-4.2, 4.2],
    range: [-3.2, 3.2],
    start: [-3.6, 2.6],
    divergesAbove: 0.42,
  },
];

export const SURFACES_BY_KEY = new Map(SURFACES.map((s) => [s.key, s]));

// --- Optimizers --------------------------------------------------------------

export type OptimizerKey = "sgd" | "momentum" | "adam";

export const OPTIMIZER_LABELS: Record<OptimizerKey, string> = {
  sgd: "SGD",
  momentum: "Momentum",
  adam: "Adam",
};

export interface OptState {
  x: number;
  y: number;
  /** Velocity (momentum) / first moment (Adam). */
  vx: number;
  vy: number;
  /** Second moment (Adam only). */
  sx: number;
  sy: number;
  t: number;
  /** Set once the iterate leaves the plotted region or goes non-finite. */
  diverged: boolean;
  path: [number, number][];
}

export function initOpt(x: number, y: number): OptState {
  return { x, y, vx: 0, vy: 0, sx: 0, sy: 0, t: 0, diverged: false, path: [[x, y]] };
}

const ADAM_B1 = 0.9;
const ADAM_B2 = 0.999;
const ADAM_EPS = 1e-8;

/** One optimizer update. Returns a new state; never mutates the input. */
export function stepOpt(
  state: OptState,
  surface: Surface,
  optimizer: OptimizerKey,
  lr: number,
  momentum: number,
  maxPath = 600,
): OptState {
  if (state.diverged) return state;

  const [gx, gy] = surface.grad(state.x, state.y);
  let x = state.x;
  let y = state.y;
  let { vx, vy, sx, sy } = state;
  const t = state.t + 1;

  if (optimizer === "sgd") {
    x -= lr * gx;
    y -= lr * gy;
  } else if (optimizer === "momentum") {
    // Classic heavy-ball: v ← βv − ηg, θ ← θ + v
    vx = momentum * vx - lr * gx;
    vy = momentum * vy - lr * gy;
    x += vx;
    y += vy;
  } else {
    vx = ADAM_B1 * vx + (1 - ADAM_B1) * gx;
    vy = ADAM_B1 * vy + (1 - ADAM_B1) * gy;
    sx = ADAM_B2 * sx + (1 - ADAM_B2) * gx * gx;
    sy = ADAM_B2 * sy + (1 - ADAM_B2) * gy * gy;
    // Bias correction — without it the first steps are far too small.
    const mhx = vx / (1 - ADAM_B1 ** t);
    const mhy = vy / (1 - ADAM_B1 ** t);
    const shx = sx / (1 - ADAM_B2 ** t);
    const shy = sy / (1 - ADAM_B2 ** t);
    x -= (lr * mhx) / (Math.sqrt(shx) + ADAM_EPS);
    y -= (lr * mhy) / (Math.sqrt(shy) + ADAM_EPS);
  }

  const escaped =
    !Number.isFinite(x) ||
    !Number.isFinite(y) ||
    Math.abs(x) > Math.abs(surface.domain[1]) * 3 ||
    Math.abs(y) > Math.abs(surface.range[1]) * 3;

  const path = state.path.length >= maxPath ? state.path.slice(1) : state.path.slice();
  if (!escaped) path.push([x, y]);

  return { x, y, vx, vy, sx, sy, t, diverged: escaped, path };
}

/** Gradient magnitude — used for the "has it converged?" readout. */
export function gradNorm(surface: Surface, x: number, y: number): number {
  const [gx, gy] = surface.grad(x, y);
  return Math.hypot(gx, gy);
}

// --- Learning-rate schedules --------------------------------------------------

export type ScheduleKey = "constant" | "step" | "cosine" | "warmup";

export const SCHEDULE_LABELS: Record<ScheduleKey, string> = {
  constant: "Constant",
  step: "Step decay",
  cosine: "Cosine anneal",
  warmup: "Warmup + cosine",
};

export const SCHEDULE_NOTES: Record<ScheduleKey, string> = {
  constant:
    "One rate for the whole run. Fast enough to make progress means too fast to settle — you orbit the minimum forever.",
  step:
    "Cut the rate by a factor every so often. Each drop lets the iterate settle into detail the previous rate couldn't resolve.",
  cosine:
    "Ease smoothly from the full rate down to nearly zero. No cliff-edge transitions, and it lands softly.",
  warmup:
    "Start tiny, ramp up, then anneal down. The slow start keeps the first (often wild) steps from wrecking the run.",
};

/**
 * Learning rate at step `t` of `total`.
 * `base` is the peak rate; every schedule is expressed as a multiplier on it.
 */
export function scheduleLr(
  schedule: ScheduleKey,
  base: number,
  t: number,
  total: number,
  opts: { stepDrop?: number; stepEvery?: number; warmupFrac?: number } = {},
): number {
  const { stepDrop = 0.35, stepEvery = 0.25, warmupFrac = 0.15 } = opts;
  const p = total <= 0 ? 0 : Math.min(1, Math.max(0, t / total));

  switch (schedule) {
    case "constant":
      return base;
    case "step": {
      const drops = Math.floor(p / stepEvery);
      return base * stepDrop ** drops;
    }
    case "cosine":
      return base * 0.5 * (1 + Math.cos(Math.PI * p));
    case "warmup": {
      if (p < warmupFrac) return base * (p / warmupFrac);
      const q = (p - warmupFrac) / (1 - warmupFrac);
      return base * 0.5 * (1 + Math.cos(Math.PI * q));
    }
    default:
      return base;
  }
}
