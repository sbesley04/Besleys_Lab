// Hunger Games arena simulation engine — a TypeScript port of the original
// Python prototype (hungergames/arena_sim.py), reworked to accept any roster.
//
// Design: pure and deterministic. `simulate(roster, seed)` returns the full
// run — arena map, one snapshot per turn (positions, health, events, narrative
// lines), and final placements. Same (roster, seed) → same result, which is
// how saved simulations replay without storing the whole log.
//
// No React/Next imports — the node test runner loads this file directly.

import type { RosterPlayer, TributeStats } from "./roster";

// --- Config -------------------------------------------------------------------

export const GRID = 64;
export const TURN_HOURS = 4;
const CORNUCOPIA: readonly [number, number] = [GRID / 2, GRID / 2];

const WEIGHTS: Record<keyof TributeStats, number> = {
  fight: 0.22,
  kill: 0.2,
  survival: 0.18,
  sponsor: 0.16,
  advantages: 0.13,
  judge: 0.11,
};

const ALLY_THRESHOLD = 55;
const DISTRICT_BOND = 40;
const CAREER_BOND = 20;
const KINDRED_AGGRESSOR = 30;
const PROXIMITY = 3;
const REFUGE_PER_TURN = 3;

const BETRAYAL_BASE = 0.04;
const BETRAYAL_AGGRESSOR_BASE = 0.3;
const BETRAYAL_THINNING = 0.55;

const HAZARD_BASE_CHANCE = 0.05;
const HAZARD_MAX_CHANCE = 0.85;

const RING_MIN_RADIUS = 3;

export const CAREER_DISTRICTS = new Set([1, 2, 4]);

// --- Seeded RNG (mulberry32) ----------------------------------------------------

export class RNG {
  private s: number;

  constructor(seed: number) {
    this.s = (seed >>> 0) || 0x9e3779b9;
  }

  /** Uniform float in [0, 1). */
  random(): number {
    this.s = (this.s + 0x6d2b79f5) >>> 0;
    let t = this.s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Integer in [a, b] inclusive. */
  randint(a: number, b: number): number {
    return a + Math.floor(this.random() * (b - a + 1));
  }

  uniform(a: number, b: number): number {
    return a + this.random() * (b - a);
  }

  choice<T>(arr: readonly T[]): T {
    return arr[Math.floor(this.random() * arr.length)];
  }
}

// --- Game parameters (seed-derived per-run configuration) -----------------------

const BORDER_DISASTERS: readonly [string, number, string][] = [
  ["lava", 27, "A wall of magma advances from the arena's edge"],
  ["insect swarm", 16, "A mutt insect swarm churns inward across the boundary"],
  ["toxic gas", 21, "Capitol toxic gas rolls in from the perimeter"],
  ["fire curtain", 24, "A Gamemaker fire wall pushes the boundary"],
  ["acid storm", 18, "Acid rain sheets down on the outer arena"],
  ["glacier", 14, "Sheets of glacial ice lock the perimeter shut"],
  ["floodwall", 23, "Engineered floodwaters surge from the arena's edge"],
  ["sonic wave", 13, "A subsonic pressure wave herds tributes inward"],
];

type WeatherType =
  | "clear" | "heat_wave" | "sandstorm" | "dry_lightning"
  | "fog" | "rain" | "storm" | "blizzard" | "freezing_mist";

const WEATHER_PROFILES: Record<string, readonly [WeatherType, number][]> = {
  arid: [["clear", 0.45], ["heat_wave", 0.2], ["sandstorm", 0.2], ["dry_lightning", 0.15]],
  temperate: [["clear", 0.45], ["fog", 0.22], ["rain", 0.23], ["storm", 0.1]],
  tropical: [["clear", 0.25], ["rain", 0.35], ["storm", 0.25], ["fog", 0.15]],
  arctic: [["clear", 0.4], ["blizzard", 0.3], ["fog", 0.18], ["freezing_mist", 0.12]],
};

const NIGHT_SPANS: Record<string, [number, number]> = {
  short: [22, 4],
  normal: [20, 6],
  long: [18, 8],
  blackout: [17, 10],
};

export interface GameParams {
  borderDisaster: string;
  borderDamage: number;
  borderDescription: string;
  borderShape: "square" | "circle" | "north_south";
  ringStart: number;
  ringRate: number;
  nightType: "none" | "short" | "normal" | "long" | "blackout";
  weatherRegion: "arid" | "temperate" | "tropical" | "arctic";
}

function makeParams(rng: RNG): GameParams {
  const bd = rng.choice(BORDER_DISASTERS);
  return {
    borderDisaster: bd[0],
    borderDamage: bd[1],
    borderDescription: bd[2],
    borderShape: rng.choice(["square", "square", "square", "circle", "circle", "north_south"] as const),
    ringStart: rng.randint(4, 10),
    ringRate: rng.choice([1, 1, 2, 2, 2, 3]),
    nightType: rng.choice(["none", "none", "short", "normal", "normal", "long", "blackout"] as const),
    weatherRegion: rng.choice(["arid", "temperate", "temperate", "tropical", "arctic"] as const),
  };
}

// --- Regions --------------------------------------------------------------------

export type Biome =
  | "plains" | "forest" | "mountain" | "water" | "cornucopia"
  | "swamp" | "hills" | "desert" | "ruins" | "toxic_bog";

interface RegionMods { move: number; hide: number; cache: number; encounter: number }

const REGIONS: Record<Biome, RegionMods> = {
  plains: { move: 1.5, hide: 0.6, cache: 0.8, encounter: 1.4 },
  forest: { move: 0.7, hide: 1.5, cache: 1.0, encounter: 0.8 },
  mountain: { move: 0.5, hide: 1.2, cache: 1.5, encounter: 0.7 },
  water: { move: 0.6, hide: 0.9, cache: 1.1, encounter: 0.9 },
  cornucopia: { move: 1.0, hide: 0.3, cache: 3.0, encounter: 2.5 },
  swamp: { move: 0.45, hide: 1.4, cache: 0.9, encounter: 0.7 },
  hills: { move: 0.8, hide: 0.9, cache: 1.2, encounter: 1.1 },
  desert: { move: 1.3, hide: 0.4, cache: 0.6, encounter: 1.5 },
  ruins: { move: 0.7, hide: 1.4, cache: 2.0, encounter: 0.6 },
  toxic_bog: { move: 0.35, hide: 1.5, cache: 0.7, encounter: 0.5 },
};

const REGION_FLAVOUR: Record<Biome, string[]> = {
  plains: ["the open plains", "the sun-bleached grassland", "the exposed flats"],
  forest: ["the forest", "the dense treeline", "the dark undergrowth"],
  mountain: ["the rocky slopes", "the high ridgeline", "the boulder field"],
  water: ["the lake shore", "the river bend", "the still water"],
  cornucopia: ["the Cornucopia", "the golden horn", "the centre of the arena"],
  swamp: ["the swamp", "the murky wetlands", "the reed-choked bog"],
  hills: ["the rolling hills", "the high ground", "the grassy ridgeline"],
  desert: ["the sand flats", "the dry wastes", "the scorched plain"],
  ruins: ["the ruins", "the crumbled station", "the rubble field"],
  toxic_bog: ["the toxic bog", "the poisoned mire", "the sulfur flats"],
};

// --- Cache items ------------------------------------------------------------------

interface CacheItem { type: "weapon" | "med" | "food"; fight?: number; heal?: number; label: string; w: number }

const CACHE_ITEMS: CacheItem[] = [
  { type: "weapon", fight: 3, label: "a trident", w: 1 },
  { type: "weapon", fight: 3, label: "a compound bow with arrows", w: 2 },
  { type: "weapon", fight: 2, label: "a hunting knife", w: 4 },
  { type: "weapon", fight: 2, label: "a hand axe", w: 4 },
  { type: "weapon", fight: 2, label: "a short sword", w: 2 },
  { type: "weapon", fight: 1, label: "a makeshift spear", w: 5 },
  { type: "weapon", fight: 1, label: "a set of throwing knives", w: 4 },
  { type: "weapon", fight: 1, label: "a crude wooden club", w: 4 },
  { type: "med", heal: 50, label: "a Capitol trauma kit", w: 1 },
  { type: "med", heal: 35, label: "a medical kit", w: 3 },
  { type: "med", heal: 25, label: "a field dressing and antiseptic", w: 4 },
  { type: "med", heal: 15, label: "a tourniquet", w: 5 },
  { type: "med", heal: 10, label: "a packet of painkillers", w: 5 },
  { type: "food", heal: 20, label: "a full backpack of supplies", w: 2 },
  { type: "food", heal: 15, label: "a supply pack", w: 4 },
  { type: "food", heal: 8, label: "dried rations and a canteen", w: 5 },
  { type: "food", heal: 5, label: "a handful of edible roots", w: 6 },
];

const ITEM_TOTAL = CACHE_ITEMS.reduce((s, it) => s + it.w, 0);

function drawItem(rng: RNG): CacheItem {
  let r = rng.random() * ITEM_TOTAL;
  for (const item of CACHE_ITEMS) {
    r -= item.w;
    if (r <= 0) return { ...item };
  }
  return { ...CACHE_ITEMS[CACHE_ITEMS.length - 1] };
}

// --- Injuries & hazards -----------------------------------------------------------

const INJURIES = [
  "a deep gash across the forearm",
  "cracked ribs making every breath costly",
  "a sprained ankle slowing each step",
  "burns scoring one side of the face",
  "a shoulder wound limiting weapon reach",
  "a concussion blurring the edges of things",
  "an arrow graze along the thigh",
  "an infected cut festering now",
  "a puncture wound that keeps reopening",
  "a torn muscle in the calf",
];

const HAZARD_KINDS = [
  "wall of fire",
  "flash flood",
  "toxic fog",
  "tracker-jacker swarm",
  "ground tremor",
  "Gamemaker bombardment",
  "acid rain",
  "muttation wolf pack",
  "wildfire",
  "sinkhole collapse",
  "lightning storm",
  "venomous snake release",
];

const HAZARD_ESCAPE: Record<string, string[]> = {
  "wall of fire": ["Outruns the flames with scorched boots.", "Finds a gap in the fire wall and dives through."],
  "flash flood": ["Grabs a tree branch and holds until the surge passes.", "Scrambles to high ground as the channel fills below."],
  "toxic fog": ["Ties cloth over the mouth and moves fast.", "Drops low — the fog runs thin near the earth."],
  "tracker-jacker swarm": ["Hits the water and stays under until the buzzing fades.", "Runs and doesn't stop until the sound is gone."],
  "ground tremor": ["Braces against a boulder and rides it out.", "Runs off the fault line as cracks open underfoot."],
  "Gamemaker bombardment": ["Reads the trajectory and sprints between impacts.", "Zigzags through the blasts, ears ringing."],
  "acid rain": ["Finds shelter under a rock shelf just in time.", "Sprints to the treeline, rain hissing on stone behind."],
  "muttation wolf pack": ["Climbs a tree. The mutts circle and move on.", "Fights one off with bare hands, then runs."],
  wildfire: ["Cuts a firebreak in the undergrowth and waits behind it.", "Slips through upwind before the line closes."],
  "sinkhole collapse": ["Leaps clear as the ground opens beneath.", "Grabs a root on the lip and hauls up."],
  "lightning storm": ["Sheds all metal gear and lies flat in the open.", "Counts seconds between flash and thunder. Stays ahead."],
  "venomous snake release": ["Climbs above the release zone before the snakes spread.", "Moves through — fast but deliberate."],
};

// --- Player -------------------------------------------------------------------------

type EventTag =
  | "cache" | "sponsor" | "ally" | "betrayed_win" | "attacked_win"
  | "survived_hit" | "defended" | "hazard" | "ring"
  | "died" | "died_hazard" | "died_ring";

interface PEvent { tag: EventTag; data?: string; heal?: number }

type Personality = "predator" | "career" | "ghost" | "survivor" | "hunter" | "default";

class Tribute {
  name: string;
  district: number;
  stats: TributeStats;
  overall: number;
  x = 0;
  y = 0;
  health = 100;
  alive = true;
  kills = 0;
  ally: number | null = null;
  inventory: CacheItem[] = [];
  injuries: string[] = [];
  events: PEvent[] = [];
  deathTurn: number | null = null;
  killedBy: string | null = null;

  constructor(src: RosterPlayer) {
    this.name = src.name.trim();
    this.district = src.district;
    this.stats = { ...src.stats };
    const norm = (k: keyof TributeStats) => this.stats[k] / (k === "judge" ? 12 : 10);
    this.overall = Math.round(
      (Object.keys(WEIGHTS) as (keyof TributeStats)[]).reduce(
        (s, k) => s + norm(k) * WEIGHTS[k],
        0,
      ) * 1000,
    ) / 10;
  }

  get fightPower(): number {
    const bonus = this.inventory.reduce((s, i) => s + (i.fight ?? 0), 0);
    return (this.stats.fight + bonus) * (this.health / 100);
  }

  personality(): Personality {
    const { kill: k, fight: f, survival: sv } = this.stats;
    if (k >= 7 && f >= 7) return "predator";
    if (CAREER_DISTRICTS.has(this.district) && f >= 5 && k >= 5) return "career";
    if (k <= 2 && sv >= 7) return "ghost";
    if (sv >= 7) return "survivor";
    if (k >= 7) return "hunter";
    return "default";
  }
}

// --- Arena generation ------------------------------------------------------------------

function makeNoise(rng: RNG, octaves: [number, number][], W: number): number[][] {
  const buf: number[][] = Array.from({ length: W }, () => new Array<number>(W).fill(0));
  const total = octaves.reduce((s, [, w]) => s + w, 0);
  for (const [res, weight] of octaves) {
    const pts: number[][] = Array.from({ length: res + 2 }, () =>
      Array.from({ length: res + 2 }, () => rng.random()),
    );
    for (let gy = 0; gy < W; gy++) {
      for (let gx = 0; gx < W; gx++) {
        const fx = (gx / (W - 1)) * res;
        const fy = (gy / (W - 1)) * res;
        let ix = Math.floor(fx);
        let iy = Math.floor(fy);
        const tx = fx - ix;
        const ty = fy - iy;
        ix = Math.min(ix, res - 1);
        iy = Math.min(iy, res - 1);
        const v =
          pts[iy][ix] * (1 - tx) * (1 - ty) +
          pts[iy][ix + 1] * tx * (1 - ty) +
          pts[iy + 1][ix] * (1 - tx) * ty +
          pts[iy + 1][ix + 1] * tx * ty;
        buf[gy][gx] += (v * weight) / total;
      }
    }
  }
  return buf;
}

/** Rank-map to uniform [0,1] so elevation zones are always present. */
function equalize(buf: number[][]): number[][] {
  const W = buf.length;
  const flat: [number, number, number][] = [];
  for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) flat.push([buf[y][x], y, x]);
  flat.sort((a, b) => a[0] - b[0]);
  const out = Array.from({ length: W }, () => new Array<number>(W).fill(0));
  flat.forEach(([, y, x], rank) => {
    out[y][x] = rank / (flat.length - 1);
  });
  return out;
}

function rescale(buf: number[][]): number[][] {
  let lo = Infinity;
  let hi = -Infinity;
  for (const row of buf) for (const v of row) {
    if (v < lo) lo = v;
    if (v > hi) hi = v;
  }
  const span = hi - lo || 1;
  return buf.map((row) => row.map((v) => (v - lo) / span));
}

function biomeAt(e: number, m: number, s: number): Biome {
  if (e < 0.1) return m > 0.54 ? "toxic_bog" : "water";
  if (e < 0.22) {
    if (m > 0.6) return "toxic_bog";
    if (m > 0.44) return "swamp";
    return "water";
  }
  if (e < 0.34) {
    if (m > 0.64) return "toxic_bog";
    if (m > 0.52) return "swamp";
    if (m < 0.34) return "desert";
    return "plains";
  }
  if (m < 0.3) return "desert";
  if (e < 0.46) {
    if (m > 0.6) return "forest";
    if (m > 0.48) return "swamp";
    return "plains";
  }
  if (e < 0.68 && s > 0.72) return "ruins";
  if (e < 0.62) return m > 0.5 ? "forest" : "plains";
  if (e < 0.76) return m > 0.58 ? "forest" : "hills";
  if (e < 0.9) return m > 0.44 ? "hills" : "mountain";
  return "mountain";
}

export function buildArena(rng: RNG): Biome[][] {
  const W = GRID;
  const elev = equalize(makeNoise(rng, [[4, 0.5], [8, 0.3], [16, 0.2]], W));
  const moist = rescale(makeNoise(rng, [[5, 0.5], [10, 0.35], [20, 0.15]], W));
  const struct = rescale(makeNoise(rng, [[6, 0.6], [12, 0.4]], W));

  const grid: Biome[][] = Array.from({ length: W }, (_, y) =>
    Array.from({ length: W }, (_, x) => biomeAt(elev[y][x], moist[y][x], struct[y][x])),
  );

  // Dissolve isolated 1–3 cell puddles into swamp.
  const visited = Array.from({ length: W }, () => new Array<boolean>(W).fill(false));
  for (let sy = 0; sy < W; sy++) {
    for (let sx = 0; sx < W; sx++) {
      if (grid[sy][sx] !== "water" || visited[sy][sx]) continue;
      const region: [number, number][] = [];
      const q: [number, number][] = [[sy, sx]];
      visited[sy][sx] = true;
      while (q.length) {
        const [y, x] = q.pop()!;
        region.push([y, x]);
        for (const [dy, dx] of [[-1, 0], [1, 0], [0, -1], [0, 1]] as const) {
          const ny = y + dy;
          const nx = x + dx;
          if (ny >= 0 && ny < W && nx >= 0 && nx < W && grid[ny][nx] === "water" && !visited[ny][nx]) {
            visited[ny][nx] = true;
            q.push([ny, nx]);
          }
        }
      }
      if (region.length <= 3) for (const [y, x] of region) grid[y][x] = "swamp";
    }
  }

  const [ccx, ccy] = CORNUCOPIA;
  for (const dy of [0, -1]) for (const dx of [0, -1]) grid[ccy + dy][ccx + dx] = "cornucopia";
  return grid;
}

function regionAt(arena: Biome[][], x: number, y: number): Biome {
  return arena[Math.max(0, Math.min(GRID - 1, y))][Math.max(0, Math.min(GRID - 1, x))];
}

// --- Affinity ---------------------------------------------------------------------------

function affinity(a: Tribute, b: Tribute, turn: number): [number, boolean] {
  let score = 0;
  if (turn === 1) score += 18;
  else if (turn === 2) score += 10;
  else if (turn === 3) score += 5;

  if (a.district === b.district) score += DISTRICT_BOND;
  if (CAREER_DISTRICTS.has(a.district) && CAREER_DISTRICTS.has(b.district) && a.district !== b.district)
    score += CAREER_BOND;
  score += ((10 - b.stats.kill) / 9) * 25;
  const aggressorPact = a.stats.kill >= 7 && b.stats.kill >= 7;
  if (aggressorPact) score += KINDRED_AGGRESSOR;
  if (b.overall > a.overall) score += Math.min(30, (b.overall - a.overall) * 0.8);
  let comp = 0;
  if (a.stats.fight <= 4 && b.stats.fight >= 7) comp += 12;
  if (a.stats.survival <= 4 && b.stats.survival >= 7) comp += 12;
  score += comp;
  if (a.ally === null && a.overall < 60) score += Math.min(20, REFUGE_PER_TURN * turn);
  return [Math.min(100, score), aggressorPact];
}

// --- Snapshots ----------------------------------------------------------------------------

export interface HazardEvent {
  kind: string;
  x: number;
  y: number;
  radius: number;
  hit: string[];
}

export interface PlayerSnapshot {
  name: string;
  district: number;
  x: number;
  y: number;
  health: number;
  alive: boolean;
  kills: number;
  overall: number;
  ally: number | null;
  injuries: string[];
  /** Narrative line(s) for this turn; null when dead in an earlier turn. */
  dialogue: string | null;
  /** Machine-readable event tags for UI badges. */
  tags: EventTag[];
}

export interface TurnSnapshot {
  turn: number;
  hour: number;
  aliveCount: number;
  safeRadius: number;
  isNight: boolean;
  weather: { type: WeatherType; intensity: number };
  hazard: HazardEvent | null;
  deaths: string[]; // names of tributes who died this turn
  players: PlayerSnapshot[];
}

export interface Placement {
  place: number;
  name: string;
  district: number;
  kills: number;
  deathTurn: number | null;
  killedBy: string | null;
}

export interface SimResult {
  seed: number;
  params: GameParams;
  arena: Biome[][];
  snapshots: TurnSnapshot[];
  winner: string | null;
  /**
   * winner  — one tribute survived;
   * wipeout — the arena killed the last tributes in the same turn;
   * cap     — the turn cap was reached with multiple tributes alive.
   */
  outcome: "winner" | "wipeout" | "cap";
  placements: Placement[];
}

// --- Simulation ------------------------------------------------------------------------------

class Sim {
  rng: RNG;
  seed: number;
  params: GameParams;
  arena: Biome[][];
  players: Tribute[];
  alliances = new Map<number, { members: Tribute[]; aggressor: boolean }>();
  private allyCounter = 0;
  turn = 0;
  weather: { type: WeatherType; intensity: number } = { type: "clear", intensity: 0 };
  snapshots: TurnSnapshot[] = [];

  constructor(roster: RosterPlayer[], seed: number) {
    this.rng = new RNG(seed);
    this.seed = seed;
    this.params = makeParams(this.rng);
    this.arena = buildArena(this.rng);
    this.players = roster.map((r) => new Tribute(r));
    this.spawn();
  }

  private spawn() {
    const [cx, cy] = CORNUCOPIA;
    const n = this.players.length;
    const radius = 5;
    this.players.forEach((p, i) => {
      const ang = (2 * Math.PI * i) / n;
      p.x = Math.max(0, Math.min(GRID - 1, Math.round(cx + radius * Math.cos(ang))));
      p.y = Math.max(0, Math.min(GRID - 1, Math.round(cy + radius * Math.sin(ang))));
    });
  }

  get alive(): Tribute[] {
    return this.players.filter((p) => p.alive);
  }

  private dist(a: Tribute, b: Tribute): number {
    return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
  }

  // ── environment ────────────────────────────────────────────────────────

  private isNight(): boolean {
    if (this.params.nightType === "none") return false;
    const hour = (this.turn * TURN_HOURS) % 24;
    const [ns, ds] = NIGHT_SPANS[this.params.nightType];
    return ns > ds ? hour >= ns || hour < ds : hour >= ns && hour < ds;
  }

  private rollWeather(): { type: WeatherType; intensity: number } {
    const profile = WEATHER_PROFILES[this.params.weatherRegion];
    const r = this.rng.random();
    let cum = 0;
    for (const [wtype, prob] of profile) {
      cum += prob;
      if (r < cum) return { type: wtype, intensity: Math.round(this.rng.uniform(0.4, 1.0) * 100) / 100 };
    }
    return { type: "clear", intensity: 0 };
  }

  private advanceWeather() {
    if (this.turn <= 1 || this.rng.random() < 0.3) this.weather = this.rollWeather();
  }

  private envModifiers(): { encounter: number; move: number; cache: number; ally: number } {
    let e = 1, m = 1, c = 1, a = 1;
    if (this.isNight()) {
      const nt = this.params.nightType;
      if (nt === "short") { e *= 0.7; m *= 0.88; c *= 0.8; }
      else if (nt === "normal") { e *= 0.58; m *= 0.8; c *= 0.7; }
      else if (nt === "long") { e *= 0.48; m *= 0.74; c *= 0.6; }
      else if (nt === "blackout") {
        if (this.rng.random() < 0.4) { e *= 0.2; m *= 0.5; c *= 0.3; a *= 0.72; }
        else { e *= 0.42; m *= 0.68; c *= 0.5; a *= 0.85; }
      }
    }
    const wt = this.weather.type;
    const wi = this.weather.intensity;
    if (wt === "fog") { e *= Math.max(0.28, 1 - 0.55 * wi); c *= 0.85; }
    else if (wt === "rain") { e *= 0.84; m *= Math.max(0.7, 1 - 0.2 * wi); c *= 0.8; a *= 0.88; }
    else if (wt === "storm") { e *= 0.66; m *= Math.max(0.56, 1 - 0.32 * wi); c *= 0.64; a *= 0.8; }
    else if (wt === "sandstorm") { e *= 0.55; m *= Math.max(0.45, 1 - 0.42 * wi); c *= 0.55; }
    else if (wt === "blizzard") { e *= 0.48; m *= Math.max(0.44, 1 - 0.46 * wi); c *= 0.5; a *= 0.78; }
    else if (wt === "heat_wave") { e *= 1.15; m *= 1.05; c *= 0.85; }
    else if (wt === "dry_lightning") { e *= 0.78; c *= 0.8; }
    else if (wt === "freezing_mist") { e *= 0.62; m *= 0.72; c *= 0.65; a *= 0.82; }
    return { encounter: e, move: m, cache: c, ally: a };
  }

  // ── alliances ──────────────────────────────────────────────────────────

  private newAlliance(members: Tribute[], aggressor: boolean) {
    this.allyCounter += 1;
    this.alliances.set(this.allyCounter, { members: [...members], aggressor });
    for (const m of members) m.ally = this.allyCounter;
  }

  private leaveAlliance(p: Tribute) {
    const aid = p.ally;
    if (aid === null) return;
    const info = this.alliances.get(aid);
    if (info) {
      info.members = info.members.filter((m) => m !== p);
      if (info.members.length <= 1) {
        for (const m of info.members) m.ally = null;
        this.alliances.delete(aid);
      }
    }
    p.ally = null;
  }

  // ── phases ─────────────────────────────────────────────────────────────

  private phaseMovement() {
    const [cx, cy] = CORNUCOPIA;
    const env = this.envModifiers();
    for (const p of this.alive) {
      const reg = REGIONS[regionAt(this.arena, p.x, p.y)];
      const base = 2 + this.rng.random() * 2;
      const speed = Math.max(1, Math.round(base * reg.move * env.move));
      const confidence = (p.stats.fight + p.stats.kill) / 2;
      const caution = p.stats.survival;
      const toCenter = this.turn <= 1 && confidence >= 6;
      const threats = this.alive.filter(
        (o) => o !== p && o.overall > p.overall + 8 && o.health > 60 && this.dist(p, o) <= PROXIMITY + 2,
      );

      let allyPos: [number, number] | null = null;
      if (p.ally !== null) {
        const info = this.alliances.get(p.ally);
        if (info) {
          const partners = info.members.filter((m) => m !== p && m.alive);
          if (partners.length) {
            allyPos = [
              Math.floor(partners.reduce((s, m) => s + m.x, 0) / partners.length),
              Math.floor(partners.reduce((s, m) => s + m.y, 0) / partners.length),
            ];
          }
        }
      }

      let tx: number;
      let ty: number;
      if (toCenter) {
        tx = cx; ty = cy;
      } else if (threats.length && caution >= confidence) {
        const t = threats.reduce((best, o) => (this.dist(p, o) < this.dist(p, best) ? o : best));
        tx = p.x + (p.x - t.x);
        ty = p.y + (p.y - t.y);
      } else if (allyPos) {
        const [apx, apy] = allyPos;
        const distToAlly = Math.max(Math.abs(p.x - apx), Math.abs(p.y - apy));
        if (distToAlly <= 2 && this.rng.random() < 0.28) {
          tx = apx + this.rng.randint(-2, 2);
          ty = apy + this.rng.randint(-2, 2);
        } else {
          tx = apx; ty = apy;
        }
      } else if (confidence >= 6 && this.rng.random() < 0.5) {
        tx = cx; ty = cy;
      } else {
        tx = p.x + this.rng.randint(-speed, speed);
        ty = p.y + this.rng.randint(-speed, speed);
      }

      const dx = Math.max(-speed, Math.min(speed, tx - p.x));
      const dy = Math.max(-speed, Math.min(speed, ty - p.y));
      p.x = Math.max(0, Math.min(GRID - 1, p.x + dx));
      p.y = Math.max(0, Math.min(GRID - 1, p.y + dy));
    }
  }

  private phaseCaches() {
    const env = this.envModifiers();
    for (const p of this.alive) {
      const reg = REGIONS[regionAt(this.arena, p.x, p.y)];
      const chance = 0.1 * reg.cache * (0.6 + p.stats.survival / 10) * env.cache;
      if (this.rng.random() < chance) {
        const item = drawItem(this.rng);
        p.inventory.push(item);
        if (item.heal) p.health = Math.min(100, p.health + item.heal);
        p.events.push({ tag: "cache", data: item.label });
      }
    }
  }

  private phaseSponsor() {
    for (const p of this.alive) {
      const chance = 0.02 * p.stats.sponsor;
      if (this.rng.random() < chance && p.health < 90) {
        const heal = 20 + p.stats.sponsor * 2;
        p.health = Math.min(100, p.health + heal);
        const cleared = p.injuries.length ? p.injuries.shift()! : undefined;
        p.events.push({ tag: "sponsor", data: cleared, heal });
      }
    }
  }

  private phaseAlliances() {
    const t = this.turn;
    let searchR: number;
    let threshold: number;
    if (t <= 2) { searchR = PROXIMITY + 5; threshold = ALLY_THRESHOLD - 20; }
    else if (t <= 4) { searchR = PROXIMITY + 3; threshold = ALLY_THRESHOLD - 10; }
    else { searchR = PROXIMITY; threshold = ALLY_THRESHOLD; }

    const envAlly = this.envModifiers().ally;
    const seen = new Set<string>();
    for (const a of this.alive) {
      if (a.ally !== null) continue;
      for (const b of this.alive) {
        if (b === a || b.ally !== null) continue;
        if (this.dist(a, b) > searchR) continue;
        if (regionAt(this.arena, a.x, a.y) === "cornucopia") continue;
        const key = [a.name, b.name].sort().join("|");
        if (seen.has(key)) continue;
        seen.add(key);
        const [ab, agg1] = affinity(a, b, this.turn);
        const [ba, agg2] = affinity(b, a, this.turn);
        const envThresh = threshold * envAlly;
        if (ab >= envThresh && ba >= envThresh) {
          this.newAlliance([a, b], agg1 || agg2);
          a.events.push({ tag: "ally", data: b.name });
          b.events.push({ tag: "ally", data: a.name });
        }
      }
    }
  }

  private phaseBetrayal() {
    const n0 = this.players.length;
    const thinning = 1 - this.alive.length / n0;
    for (const [aid, info] of [...this.alliances]) {
      if (!this.alliances.has(aid)) continue;
      const members = info.members.filter((m) => m.alive);
      if (members.length < 2) continue;
      const base = info.aggressor ? BETRAYAL_AGGRESSOR_BASE : BETRAYAL_BASE;
      let chance = base + thinning * BETRAYAL_THINNING;
      if (members.some((m) => m.health < 50)) chance += 0.15;
      if (this.rng.random() < chance) {
        const betrayer = members.reduce((best, m) => (m.stats.kill > best.stats.kill ? m : best));
        const rest = members.filter((m) => m !== betrayer);
        const victim = rest.reduce((weakest, m) => (m.fightPower < weakest.fightPower ? m : weakest));
        this.resolveCombat(betrayer, victim, true);
        for (const m of members) this.leaveAlliance(m);
      }
    }
  }

  private phaseCombat() {
    const env = this.envModifiers();
    const checked = new Set<string>();
    for (const a of [...this.alive]) {
      if (!a.alive) continue;
      for (const b of [...this.alive]) {
        if (b === a || !b.alive || !a.alive) continue;
        if (a.ally !== null && a.ally === b.ally) continue;
        const key = [a.name, b.name].sort().join("|");
        if (checked.has(key)) continue;
        checked.add(key);
        const fightRange = this.alive.length <= 5 ? 2 : 1;
        if (this.dist(a, b) > fightRange) continue;
        const reg = REGIONS[regionAt(this.arena, a.x, a.y)];
        if (this.rng.random() > 0.5 * reg.encounter * env.encounter) continue;
        if (this.wantsFight(a, b)) this.resolveCombat(a, b);
        else if (this.wantsFight(b, a)) this.resolveCombat(b, a);
      }
    }
  }

  private wantsFight(a: Tribute, b: Tribute): boolean {
    const nAlive = this.alive.length;
    if (a.stats.kill <= 2 && b.health > 40 && nAlive > 3) return false;
    const threatGap = b.overall - a.overall;
    if (threatGap > 6 && b.health > 55) return this.rng.random() < 0.1;
    let appetite = a.stats.kill / 10;
    if (b.health < 50) appetite += 0.3;
    appetite += (1 - nAlive / this.players.length) * 0.5;
    if (nAlive <= 4) appetite += 0.35;
    return this.rng.random() < appetite;
  }

  private resolveCombat(attacker: Tribute, defender: Tribute, betrayal = false) {
    let pa = attacker.fightPower + attacker.stats.advantages * 0.15 + this.rng.random() * 3;
    const pd = defender.fightPower + defender.stats.advantages * 0.15 + this.rng.random() * 3;
    if (betrayal) pa += 2;
    if (pa >= pd) {
      const dmg = 30 + Math.floor((pa - pd) * 6) + this.rng.randint(0, 20);
      defender.health -= dmg;
      if (dmg > 30 && this.rng.random() < 0.45 && defender.injuries.length < 3)
        defender.injuries.push(this.rng.choice(INJURIES));
      attacker.events.push({ tag: betrayal ? "betrayed_win" : "attacked_win", data: defender.name });
      if (defender.health <= 0) this.kill(defender, attacker);
      else defender.events.push({ tag: "survived_hit", data: attacker.name });
    } else {
      const dmg = 25 + Math.floor((pd - pa) * 6) + this.rng.randint(0, 15);
      attacker.health -= dmg;
      if (dmg > 28 && this.rng.random() < 0.4 && attacker.injuries.length < 3)
        attacker.injuries.push(this.rng.choice(INJURIES));
      defender.events.push({ tag: "defended", data: attacker.name });
      if (attacker.health <= 0) this.kill(attacker, defender);
    }
  }

  private kill(victim: Tribute, killer: Tribute) {
    victim.alive = false;
    victim.health = 0;
    victim.deathTurn = this.turn;
    victim.killedBy = killer.name;
    killer.kills += 1;
    victim.events.push({ tag: "died", data: killer.name });
    if (victim.ally !== null) this.leaveAlliance(victim);
  }

  private currentRadius(): number {
    if (this.turn <= this.params.ringStart) return GRID;
    const shrink = this.turn - this.params.ringStart;
    return Math.max(RING_MIN_RADIUS, GRID / 2 - shrink * this.params.ringRate);
  }

  private outsideBorder(p: Tribute, rad: number): boolean {
    const [cx, cy] = CORNUCOPIA;
    const shape = this.params.borderShape;
    if (shape === "circle") return (p.x - cx) ** 2 + (p.y - cy) ** 2 > rad * rad;
    if (shape === "north_south") return Math.abs(p.y - cy) > rad;
    return Math.max(Math.abs(p.x - cx), Math.abs(p.y - cy)) > rad;
  }

  private phaseRing() {
    const rad = this.currentRadius();
    if (rad >= GRID) return;
    const [cx, cy] = CORNUCOPIA;
    const turnsPastMin = Math.max(
      0,
      this.turn - (this.params.ringStart + Math.floor((GRID / 2 - RING_MIN_RADIUS) / Math.max(1, this.params.ringRate))),
    );
    const dmg = this.params.borderDamage + turnsPastMin * 3;

    for (const p of this.alive) {
      if (!this.outsideBorder(p, rad)) continue;
      p.health -= dmg;
      p.events.push({ tag: "ring", data: this.params.borderDisaster });

      const shape = this.params.borderShape;
      if (shape === "circle") {
        const ddx = cx - p.x;
        const ddy = cy - p.y;
        const dist = Math.max(1, Math.sqrt(ddx * ddx + ddy * ddy));
        const step = Math.min(5, Math.floor(dist - rad) + 2);
        p.x = Math.max(0, Math.min(GRID - 1, p.x + Math.round((ddx / dist) * step)));
        p.y = Math.max(0, Math.min(GRID - 1, p.y + Math.round((ddy / dist) * step)));
      } else if (shape === "north_south") {
        const step = 2 + Math.max(0, Math.abs(p.y - cy) - rad);
        p.y = Math.max(0, Math.min(GRID - 1, p.y + (p.y > cy ? -step : step)));
      } else {
        const step = 2 + Math.max(0, Math.max(Math.abs(p.x - cx), Math.abs(p.y - cy)) - rad);
        if (p.x !== cx) p.x += p.x > cx ? -step : step;
        if (p.y !== cy) p.y += p.y > cy ? -step : step;
        p.x = Math.max(0, Math.min(GRID - 1, p.x));
        p.y = Math.max(0, Math.min(GRID - 1, p.y));
      }

      if (p.health <= 0) {
        p.alive = false;
        p.health = 0;
        p.deathTurn = this.turn;
        p.events.push({ tag: "died_ring", data: this.params.borderDisaster });
        if (p.ally !== null) this.leaveAlliance(p);
      }
    }
  }

  private phaseHazard(): HazardEvent | null {
    const progress = 1 - this.alive.length / this.players.length;
    const chance = HAZARD_BASE_CHANCE + progress * (HAZARD_MAX_CHANCE - HAZARD_BASE_CHANCE);
    if (this.rng.random() > chance) return null;
    const kind = this.rng.choice(HAZARD_KINDS);
    const hx = this.rng.randint(0, GRID - 1);
    const hy = this.rng.randint(0, GRID - 1);
    const rad = 3 + Math.floor(progress * 4);
    const hit: string[] = [];
    for (const p of this.alive) {
      if (Math.max(Math.abs(p.x - hx), Math.abs(p.y - hy)) > rad) continue;
      let dmg = this.rng.randint(20, 50);
      dmg = Math.floor(dmg * (1.2 - p.stats.survival / 20));
      p.health -= dmg;
      if (dmg > 25 && this.rng.random() < 0.35 && p.injuries.length < 3)
        p.injuries.push(this.rng.choice(INJURIES));
      p.events.push({ tag: "hazard", data: kind });
      if (p.health <= 0) {
        p.alive = false;
        p.health = 0;
        p.deathTurn = this.turn;
        p.events.push({ tag: "died_hazard", data: kind });
        if (p.ally !== null) this.leaveAlliance(p);
      } else {
        p.x = Math.max(0, Math.min(GRID - 1, p.x + (p.x >= hx ? 2 : -2)));
        p.y = Math.max(0, Math.min(GRID - 1, p.y + (p.y >= hy ? 2 : -2)));
      }
      hit.push(p.name);
    }
    return { kind, x: hx, y: hy, radius: rad, hit };
  }

  // ── narrative ──────────────────────────────────────────────────────────

  private flavour(p: Tribute): string {
    return this.rng.choice(REGION_FLAVOUR[regionAt(this.arena, p.x, p.y)]);
  }

  private deathLine(p: Tribute, killer: string): string {
    const killNote = p.kills
      ? ` ${p.name} had ${p.kills} kill${p.kills !== 1 ? "s" : ""} on the record.`
      : "";
    const options: Record<Personality, string[]> = {
      predator: [
        `Meets ${killer} in open ground and doesn't back down. The fight is short and conclusive — ${killer} is the better predator today.${killNote} The cannon sounds.`,
        `For the first time in these Games, the fight isn't won before it starts. ${killer} finds a gap in the pattern. The cannon sounds.`,
      ],
      career: [
        `District ${p.district} training covers almost every scenario. ${killer} turns out to be the exception. The cannon sounds.`,
        `${killer} found the flaw the training never addressed.${killNote} The cannon follows.`,
      ],
      ghost: [
        `Hidden this long, ${p.name} finally runs out of places to disappear. ${killer} closes the distance before there's time to react. The cannon sounds.`,
        `The strategy was to wait everyone out. ${killer} was more patient.${killNote} The cannon sounds.`,
      ],
      survivor: [
        `Every step until now was calculated. ${killer} didn't give time for a calculation. The cannon sounds.`,
        `Survival instincts failed at the worst moment. ${killer} caught the one angle that wasn't covered. The cannon sounds.`,
      ],
      hunter: [
        `Pushed the pace one encounter too many. ${killer} held ground and made it count. The cannon sounds.${killNote}`,
        `The field has been thinning fast, and so has the patience. ${killer} was waiting for exactly that. The cannon sounds.`,
      ],
      default: [
        `${killer} closes in near ${this.flavour(p)} and the fight goes only one way.${killNote} The cannon sounds.`,
        `Cornered by ${killer} with nowhere left to run. The cannon sounds.`,
      ],
    };
    return this.rng.choice(options[p.personality()]);
  }

  private eventLine(p: Tribute, ev: PEvent): string {
    const r = this.rng;
    switch (ev.tag) {
      case "cache":
        return r.choice([
          `Uncovers ${ev.data} stashed in ${this.flavour(p)}.`,
          `Finds ${ev.data} — a good day by arena standards.`,
          `Scavenges ${ev.data} from a hidden cache.`,
        ]);
      case "sponsor": {
        const base = r.choice([
          `A silver parachute drifts down: sponsor aid, +${ev.heal} health.`,
          `Sponsors send a parcel when it matters — recovers ${ev.heal} health.`,
        ]);
        return ev.data ? `${base} The ${ev.data.split(" ").slice(-2).join(" ")} finally gets treated.` : base;
      }
      case "ally":
        return r.choice([
          `Forms an alliance with ${ev.data}. Two sets of eyes now.`,
          `Falls in with ${ev.data} — safer together, for now.`,
        ]);
      case "betrayed_win":
        return r.choice([
          `Turns on ${ev.data} while the fire still burns. The alliance ends the way alliances end here.`,
          `Waits for ${ev.data} to look away. The pact was always going to break — better to be the one breaking it.`,
        ]);
      case "attacked_win":
        return r.choice([
          `Catches ${ev.data} near ${this.flavour(p)} and strikes first. Comes away the stronger.`,
          `Presses the advantage against ${ev.data} and lands the decisive blows.`,
          `Ambushes ${ev.data} — quick, brutal, effective.`,
        ]);
      case "survived_hit":
        return r.choice([
          `Takes a beating from ${ev.data} but breaks away before it ends.`,
          `${ev.data} draws blood, but not enough. Escapes into ${this.flavour(p)}.`,
        ]);
      case "defended":
        return r.choice([
          `${ev.data} attacks — and regrets it. Holds ground and drives them off.`,
          `Turns ${ev.data}'s ambush around and sends them running.`,
        ]);
      case "hazard":
        return `${r.choice(HAZARD_ESCAPE[ev.data ?? ""] ?? ["Scrambles clear."])} (${ev.data})`;
      case "ring":
        return r.choice([
          `Caught outside the safe zone as the ${this.params.borderDisaster} advances. Runs for the shrinking centre.`,
          `The ${this.params.borderDisaster} closes in — takes damage crossing back inside the ring.`,
        ]);
      default:
        return "";
    }
  }

  private idleLine(p: Tribute, ctx: { threats: number; nearby: number }): string {
    const r = this.rng;
    const here = this.flavour(p);
    if (p.health < 30)
      return r.choice([
        `Badly hurt and hiding in ${here}. Every option is a bad one.`,
        `Barely moving. ${here} is shelter, for whatever that's worth.`,
      ]);
    if (ctx.threats > 0)
      return r.choice([
        `Keeps low in ${here} — someone dangerous is close.`,
        `Moves quietly through ${here}, aware of being hunted.`,
      ]);
    const pers = p.personality();
    if (pers === "predator" || pers === "hunter")
      return r.choice([
        `Hunts through ${here}, reading tracks.`,
        `Prowls ${here}, looking for the next encounter.`,
      ]);
    if (pers === "ghost" || pers === "survivor")
      return r.choice([
        `Stays invisible in ${here}, conserving strength.`,
        `Sets small snares near ${here} and waits.`,
        `Finds water, keeps moving through ${here}. The quiet game.`,
      ]);
    return r.choice([
      `Moves carefully through ${here}.`,
      `Scouts ${here} and keeps clear of trouble.`,
      `Rests briefly in ${here}, listening.`,
    ]);
  }

  private envContextLine(): string {
    const lines: string[] = [];
    if (this.isNight()) {
      lines.push("Night makes everything harder to read.", "The dark slows every decision.");
    }
    const wl: Partial<Record<WeatherType, string[]>> = {
      fog: ["The fog closes in tight."],
      rain: ["Rain pounds the ground without mercy."],
      storm: ["Lightning fractures the sky overhead."],
      sandstorm: ["Sand scours every exposed surface."],
      blizzard: ["The blizzard is killing cold."],
      heat_wave: ["The heat is relentless. Movement costs everything."],
      dry_lightning: ["The sky crackles — unpredictable."],
      freezing_mist: ["Ice forms underfoot with each step."],
    };
    lines.push(...(wl[this.weather.type] ?? []));
    return lines.length ? this.rng.choice(lines) : "";
  }

  private dialogue(p: Tribute, ctx: { threats: number; nearby: number }): string | null {
    if (!p.alive && p.deathTurn === this.turn) {
      for (const ev of p.events) {
        if (ev.tag === "died") return this.deathLine(p, ev.data ?? "another tribute");
        if (ev.tag === "died_hazard")
          return `The ${ev.data} is too much. ${p.name}'s run ends here. The cannon sounds.`;
        if (ev.tag === "died_ring")
          return `The ${this.params.borderDisaster} claims ${p.name} at the arena's edge. The cannon sounds.`;
      }
      return "The cannon sounds.";
    }
    if (!p.alive) return null;

    const lines = p.events.map((ev) => this.eventLine(p, ev)).filter(Boolean);
    if (!lines.length) lines.push(this.idleLine(p, ctx));
    if (this.rng.random() < 0.28) {
      const env = this.envContextLine();
      if (env) lines.push(env);
    }
    return lines.join(" ");
  }

  private takeSnapshot(hazard: HazardEvent | null) {
    const alive = this.alive;
    const deaths = this.players
      .filter((p) => p.deathTurn === this.turn)
      .map((p) => p.name);
    const snap: TurnSnapshot = {
      turn: this.turn,
      hour: this.turn * TURN_HOURS,
      aliveCount: alive.length,
      safeRadius: this.currentRadius(),
      isNight: this.isNight(),
      weather: { ...this.weather },
      hazard,
      deaths,
      players: this.players.map((p) => {
        const nearby = alive.filter((o) => o !== p && this.dist(p, o) <= 8);
        const threats = nearby.filter((o) => o.overall > p.overall + 6 && o.health > 45);
        return {
          name: p.name,
          district: p.district,
          x: p.x,
          y: p.y,
          health: Math.max(0, p.health),
          alive: p.alive,
          kills: p.kills,
          overall: p.overall,
          ally: p.ally,
          injuries: [...p.injuries],
          dialogue: this.dialogue(p, { threats: threats.length, nearby: nearby.length }),
          tags: p.events.map((e) => e.tag),
        };
      }),
    };
    this.snapshots.push(snap);
  }

  run(maxTurns?: number): TurnSnapshot[] {
    const cap =
      maxTurns ?? this.params.ringStart + Math.floor(GRID / 2 / Math.max(1, this.params.ringRate)) + 90;
    this.advanceWeather();
    this.takeSnapshot(null);
    while (this.alive.length > 1 && this.turn < cap) {
      this.turn += 1;
      for (const p of this.players) p.events = [];
      this.advanceWeather();
      this.phaseMovement();
      this.phaseCaches();
      this.phaseSponsor();
      this.phaseAlliances();
      this.phaseCombat();
      this.phaseBetrayal();
      this.phaseRing();
      const hazard = this.phaseHazard();
      this.takeSnapshot(hazard);
    }
    return this.snapshots;
  }
}

// --- Public API ---------------------------------------------------------------------------------

export function simulate(roster: RosterPlayer[], seed: number, maxTurns?: number): SimResult {
  const sim = new Sim(roster, seed);
  sim.run(maxTurns);

  const alive = sim.alive;
  const winner = alive.length === 1 ? alive[0].name : null;
  const outcome: SimResult["outcome"] =
    alive.length === 1 ? "winner" : alive.length === 0 ? "wipeout" : "cap";

  // Placements: survivors first (winner = 1), then by death turn descending.
  const ordered = [...sim.players].sort((a, b) => {
    if (a.alive !== b.alive) return a.alive ? -1 : 1;
    if (a.alive) return b.overall - a.overall;
    return (b.deathTurn ?? 0) - (a.deathTurn ?? 0);
  });
  const placements: Placement[] = ordered.map((p, i) => ({
    place: i + 1,
    name: p.name,
    district: p.district,
    kills: p.kills,
    deathTurn: p.deathTurn,
    killedBy: p.killedBy,
  }));

  return {
    seed,
    params: sim.params,
    arena: sim.arena,
    snapshots: sim.snapshots,
    winner,
    outcome,
    placements,
  };
}

/** A random seed in a friendly range for the UI's "new game" button. */
export function randomSeed(): number {
  return Math.floor(Math.random() * 1_000_000);
}
