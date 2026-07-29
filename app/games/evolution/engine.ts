// ---------------------------------------------------------------------------
// Evolution sandbox — pure logic, no React.
//
// Each generation: creatures forage for food on a square field. Eating one
// piece survives; eating two reproduces (with mutation); eating none is death.
// Traits trade off against each other through an energy cost, so there's no
// universally best creature — only one that suits the current environment.
//
//   speed  — moves further per tick, but costs energy ∝ speed²
//   size   — eats smaller creatures, but costs energy ∝ size³
//   sense  — spots food from further away, mild linear cost
//
// The whole point is that you set the environment, not the outcome.
// ---------------------------------------------------------------------------

export interface Traits {
  speed: number;
  size: number;
  sense: number;
}

export interface Creature {
  id: number;
  traits: Traits;
  x: number;
  y: number;
  energy: number;
  eaten: number;
  /** Generation this creature was born into. */
  born: number;
  alive: boolean;
  /** Home edge it must return to (creatures start and end on the border). */
  homeEdge: 0 | 1 | 2 | 3;
}

export interface Food {
  x: number;
  y: number;
  eaten: boolean;
}

export interface WorldParams {
  foodCount: number;
  mutationRate: number;
  /** Energy available per creature per generation. */
  energyBudget: number;
  /** Bigger creatures can eat smaller ones when this is on. */
  predation: boolean;
  fieldSize: number;
}

export const DEFAULT_PARAMS: WorldParams = {
  foodCount: 55,
  mutationRate: 0.12,
  energyBudget: 620,
  predation: false,
  fieldSize: 100,
};

export interface GenerationRecord {
  generation: number;
  population: number;
  survivors: number;
  born: number;
  avgSpeed: number;
  avgSize: number;
  avgSense: number;
}

export interface World {
  params: WorldParams;
  creatures: Creature[];
  food: Food[];
  generation: number;
  tick: number;
  history: GenerationRecord[];
  nextId: number;
  /** True once the population dies out entirely. */
  extinct: boolean;
}

export const TICKS_PER_GENERATION = 200;
const EAT_RADIUS = 2.4;
/** How much bigger you must be to eat another creature. */
const PREDATION_RATIO = 1.35;

function clampTrait(v: number): number {
  return Math.max(0.25, Math.min(3, v));
}

/** Energy cost per tick for a set of traits — the tradeoff that drives it all. */
export function energyCost(t: Traits): number {
  return t.speed * t.speed * t.size * t.size * t.size + t.sense * 0.35;
}

function spawnOnEdge(rng: () => number, size: number): { x: number; y: number; edge: 0 | 1 | 2 | 3 } {
  const edge = Math.floor(rng() * 4) as 0 | 1 | 2 | 3;
  const p = rng() * size;
  if (edge === 0) return { x: p, y: 0, edge };
  if (edge === 1) return { x: size, y: p, edge };
  if (edge === 2) return { x: p, y: size, edge };
  return { x: 0, y: p, edge };
}

export function createWorld(
  params: WorldParams = DEFAULT_PARAMS,
  population = 12,
  rng: () => number = Math.random,
): World {
  const creatures: Creature[] = [];
  for (let i = 0; i < population; i++) {
    const spot = spawnOnEdge(rng, params.fieldSize);
    creatures.push({
      id: i + 1,
      traits: { speed: 1, size: 1, sense: 1 },
      x: spot.x,
      y: spot.y,
      energy: params.energyBudget,
      eaten: 0,
      born: 0,
      alive: true,
      homeEdge: spot.edge,
    });
  }
  return {
    params,
    creatures,
    food: scatterFood(params, rng),
    generation: 1,
    tick: 0,
    history: [],
    nextId: population + 1,
    extinct: false,
  };
}

export function scatterFood(params: WorldParams, rng: () => number): Food[] {
  const margin = params.fieldSize * 0.08;
  return Array.from({ length: params.foodCount }, () => ({
    x: margin + rng() * (params.fieldSize - margin * 2),
    y: margin + rng() * (params.fieldSize - margin * 2),
    eaten: false,
  }));
}

/** Nearest uneaten food within sense range, or null. */
function findFood(c: Creature, food: Food[]): Food | null {
  const range = c.traits.sense * 22;
  let best: Food | null = null;
  let bestD = range;
  for (const f of food) {
    if (f.eaten) continue;
    const d = Math.hypot(f.x - c.x, f.y - c.y);
    if (d < bestD) {
      bestD = d;
      best = f;
    }
  }
  return best;
}

function findPrey(c: Creature, creatures: Creature[]): Creature | null {
  const range = c.traits.sense * 20;
  let best: Creature | null = null;
  let bestD = range;
  for (const o of creatures) {
    if (o === c || !o.alive) continue;
    if (c.traits.size < o.traits.size * PREDATION_RATIO) continue;
    const d = Math.hypot(o.x - c.x, o.y - c.y);
    if (d < bestD) {
      bestD = d;
      best = o;
    }
  }
  return best;
}

/** One simulation tick: everyone moves, eats, and burns energy. */
export function stepWorld(world: World, rng: () => number = Math.random): World {
  const size = world.params.fieldSize;
  const creatures = world.creatures.map((c) => ({ ...c, traits: { ...c.traits } }));
  const food = world.food.map((f) => ({ ...f }));

  for (const c of creatures) {
    if (!c.alive) continue;

    // Out of energy: dead where it stands.
    c.energy -= energyCost(c.traits);
    if (c.energy <= 0) {
      c.alive = false;
      continue;
    }

    let targetX: number | null = null;
    let targetY: number | null = null;

    // With two meals banked, head home instead of foraging.
    if (c.eaten >= 2) {
      if (c.homeEdge === 0) { targetX = c.x; targetY = 0; }
      else if (c.homeEdge === 1) { targetX = size; targetY = c.y; }
      else if (c.homeEdge === 2) { targetX = c.x; targetY = size; }
      else { targetX = 0; targetY = c.y; }
    } else {
      const prey = world.params.predation ? findPrey(c, creatures) : null;
      const meal = findFood(c, food);
      // Prefer whichever is closer.
      const dPrey = prey ? Math.hypot(prey.x - c.x, prey.y - c.y) : Infinity;
      const dFood = meal ? Math.hypot(meal.x - c.x, meal.y - c.y) : Infinity;
      if (prey && dPrey <= dFood) { targetX = prey.x; targetY = prey.y; }
      else if (meal) { targetX = meal.x; targetY = meal.y; }
    }

    const stride = c.traits.speed * 1.15;
    if (targetX === null || targetY === null) {
      // Nothing in range — wander.
      const a = rng() * Math.PI * 2;
      c.x += Math.cos(a) * stride;
      c.y += Math.sin(a) * stride;
    } else {
      const dx = targetX - c.x;
      const dy = targetY - c.y;
      const d = Math.hypot(dx, dy) || 1;
      c.x += (dx / d) * stride;
      c.y += (dy / d) * stride;
    }
    c.x = Math.max(0, Math.min(size, c.x));
    c.y = Math.max(0, Math.min(size, c.y));

    // Eat any food underfoot.
    for (const f of food) {
      if (f.eaten) continue;
      if (Math.hypot(f.x - c.x, f.y - c.y) <= EAT_RADIUS + c.traits.size) {
        f.eaten = true;
        c.eaten++;
        break;
      }
    }

    // Predation: eat a sufficiently smaller neighbour.
    if (world.params.predation) {
      for (const o of creatures) {
        if (o === c || !o.alive) continue;
        if (c.traits.size < o.traits.size * PREDATION_RATIO) continue;
        if (Math.hypot(o.x - c.x, o.y - c.y) <= EAT_RADIUS + c.traits.size) {
          o.alive = false;
          c.eaten += 1;
          break;
        }
      }
    }
  }

  return { ...world, creatures, food, tick: world.tick + 1 };
}

function mutate(t: Traits, rate: number, rng: () => number): Traits {
  const jitter = () => 1 + (rng() * 2 - 1) * rate;
  return {
    speed: clampTrait(t.speed * jitter()),
    size: clampTrait(t.size * jitter()),
    sense: clampTrait(t.sense * jitter()),
  };
}

export function averageTraits(creatures: Creature[]): Traits {
  const alive = creatures.filter((c) => c.alive);
  if (alive.length === 0) return { speed: 0, size: 0, sense: 0 };
  return {
    speed: alive.reduce((s, c) => s + c.traits.speed, 0) / alive.length,
    size: alive.reduce((s, c) => s + c.traits.size, 0) / alive.length,
    sense: alive.reduce((s, c) => s + c.traits.sense, 0) / alive.length,
  };
}

/**
 * End of generation: 0 food = death, 1 = survive, 2+ = survive and reproduce.
 * Survivors and offspring are re-placed on the edge with a fresh energy budget.
 */
export function nextGeneration(world: World, rng: () => number = Math.random): World {
  const survivors = world.creatures.filter((c) => c.alive && c.eaten >= 1);
  const avg = averageTraits(world.creatures);

  const record: GenerationRecord = {
    generation: world.generation,
    population: world.creatures.filter((c) => c.alive || c.eaten > 0).length,
    survivors: survivors.length,
    born: 0,
    avgSpeed: avg.speed,
    avgSize: avg.size,
    avgSense: avg.sense,
  };

  const next: Creature[] = [];
  let id = world.nextId;

  for (const s of survivors) {
    const spot = spawnOnEdge(rng, world.params.fieldSize);
    next.push({
      ...s,
      id: s.id,
      x: spot.x,
      y: spot.y,
      homeEdge: spot.edge,
      energy: world.params.energyBudget,
      eaten: 0,
      alive: true,
    });
    if (s.eaten >= 2) {
      const babySpot = spawnOnEdge(rng, world.params.fieldSize);
      next.push({
        id: id++,
        traits: mutate(s.traits, world.params.mutationRate, rng),
        x: babySpot.x,
        y: babySpot.y,
        homeEdge: babySpot.edge,
        energy: world.params.energyBudget,
        eaten: 0,
        born: world.generation + 1,
        alive: true,
      });
      record.born++;
    }
  }

  // A hard cap keeps the simulation (and the render) bounded.
  const capped = next.slice(0, 220);

  return {
    ...world,
    creatures: capped,
    food: scatterFood(world.params, rng),
    generation: world.generation + 1,
    tick: 0,
    history: [...world.history, record].slice(-300),
    nextId: id,
    extinct: capped.length === 0,
  };
}

/** Convenience: run a whole generation at once. */
export function runGeneration(world: World, rng: () => number = Math.random): World {
  let w = world;
  for (let i = 0; i < TICKS_PER_GENERATION; i++) {
    w = stepWorld(w, rng);
    // Early exit once everyone is done (dead or heading home fed).
    if (w.creatures.every((c) => !c.alive || c.eaten >= 2)) break;
  }
  return nextGeneration(w, rng);
}
