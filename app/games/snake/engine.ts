// ---------------------------------------------------------------------------
// Snake engine — pure logic, no React. Consumed by Snake.tsx via useReducer;
// the loop dispatches { type: "TICK" }. Board is COLS x ROWS.
//
// EXTEND HERE: add wrap-around walls, obstacles, or a speed curve by editing
// the reducer — rendering stays untouched.
// ---------------------------------------------------------------------------

export const COLS = 20;
export const ROWS = 20;

export type Point = { x: number; y: number };
export type Dir = "up" | "down" | "left" | "right";
export type Status = "idle" | "running" | "paused" | "over";

export interface GameState {
  snake: Point[]; // head is index 0
  dir: Dir; // current heading
  pendingDir: Dir; // next heading, applied on TICK (prevents mid-tick reversal)
  food: Point;
  score: number;
  status: Status;
}

export type Action =
  | { type: "START" }
  | { type: "TICK" }
  | { type: "TURN"; dir: Dir }
  | { type: "TOGGLE_PAUSE" }
  | { type: "LOAD"; state: GameState }; // restore a saved game (comes back paused)

const DELTA: Record<Dir, Point> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

const OPPOSITE: Record<Dir, Dir> = {
  up: "down",
  down: "up",
  left: "right",
  right: "left",
};

function eq(a: Point, b: Point): boolean {
  return a.x === b.x && a.y === b.y;
}

// Place food on a random cell not occupied by the snake. Deterministic when a
// rng is supplied (used by tests); defaults to Math.random.
export function placeFood(snake: Point[], rng: () => number = Math.random): Point {
  const occupied = new Set(snake.map((p) => `${p.x},${p.y}`));
  const free: Point[] = [];
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      if (!occupied.has(`${x},${y}`)) free.push({ x, y });
    }
  }
  if (free.length === 0) return snake[0]; // board full — win condition
  return free[Math.floor(rng() * free.length)];
}

export function createInitialState(): GameState {
  const start: Point[] = [
    { x: 8, y: 10 },
    { x: 7, y: 10 },
    { x: 6, y: 10 },
  ];
  return {
    snake: start,
    dir: "right",
    pendingDir: "right",
    food: { x: 14, y: 10 },
    score: 0,
    status: "idle",
  };
}

export function reducer(state: GameState, action: Action): GameState {
  switch (action.type) {
    case "LOAD":
      // Come back paused so the snake doesn't move the instant it loads.
      return { ...action.state, status: action.state.status === "running" ? "paused" : action.state.status };

    case "START":
      return { ...createInitialState(), status: "running" };

    case "TOGGLE_PAUSE":
      if (state.status === "running") return { ...state, status: "paused" };
      if (state.status === "paused") return { ...state, status: "running" };
      return state;

    case "TURN": {
      if (state.status !== "running") return state;
      // Ignore reversals relative to the *committed* direction.
      if (action.dir === OPPOSITE[state.dir]) return state;
      return { ...state, pendingDir: action.dir };
    }

    case "TICK": {
      if (state.status !== "running") return state;

      const dir = state.pendingDir;
      const delta = DELTA[dir];
      const head = state.snake[0];
      const next: Point = { x: head.x + delta.x, y: head.y + delta.y };

      // Wall collision.
      if (next.x < 0 || next.x >= COLS || next.y < 0 || next.y >= ROWS) {
        return { ...state, dir, status: "over" };
      }

      const eating = eq(next, state.food);
      // The tail cell is vacated this tick unless we're growing — so colliding
      // with the current tail is allowed when not eating.
      const body = eating ? state.snake : state.snake.slice(0, -1);
      if (body.some((p) => eq(p, next))) {
        return { ...state, dir, status: "over" };
      }

      const snake = [next, ...body];
      if (eating) {
        return {
          ...state,
          snake,
          dir,
          food: placeFood(snake),
          score: state.score + 1,
        };
      }
      return { ...state, snake, dir };
    }

    default:
      return state;
  }
}
