// Roster types, validation, and the sample roster for the Hunger Games
// simulator. Shared by the engine, the UI, and the API routes — keep it free
// of React and Next imports so the node test runner can load it directly.

export interface TributeStats {
  judge: number; // 0–12, Gamemaker score
  sponsor: number; // 0–10, sponsor appeal
  advantages: number; // 0–10, resourcefulness edge in fights
  kill: number; // 0–10, willingness to kill
  fight: number; // 0–10, combat skill
  survival: number; // 0–10, fieldcraft
}

export interface RosterPlayer {
  name: string;
  district: number; // 1–12
  stats: TributeStats;
}

export const STAT_KEYS = [
  "judge",
  "sponsor",
  "advantages",
  "kill",
  "fight",
  "survival",
] as const;

export type StatKey = (typeof STAT_KEYS)[number];

export const STAT_LABELS: Record<StatKey, string> = {
  judge: "Judge score",
  sponsor: "Sponsors",
  advantages: "Advantages",
  kill: "Killer instinct",
  fight: "Combat",
  survival: "Survival",
};

export function statMax(key: StatKey): number {
  return key === "judge" ? 12 : 10;
}

export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 24;
export const MAX_NAME_LENGTH = 24;

// --- Validation ---------------------------------------------------------------

function isInt(n: unknown): n is number {
  return typeof n === "number" && Number.isInteger(n);
}

/** Errors for a single player; `label` names the player in messages. */
export function playerProblems(p: RosterPlayer, label?: string): string[] {
  const who = label ?? (p.name?.trim() ? `"${p.name.trim()}"` : "Unnamed tribute");
  const errors: string[] = [];
  const name = typeof p.name === "string" ? p.name.trim() : "";
  if (!name) errors.push(`${who}: name is required.`);
  else if (name.length > MAX_NAME_LENGTH)
    errors.push(`${who}: name must be at most ${MAX_NAME_LENGTH} characters.`);
  if (!isInt(p.district) || p.district < 1 || p.district > 12)
    errors.push(`${who}: district must be a whole number from 1 to 12.`);
  for (const key of STAT_KEYS) {
    const v = p.stats?.[key];
    const max = statMax(key);
    if (!isInt(v) || v < 0 || v > max)
      errors.push(`${who}: ${STAT_LABELS[key].toLowerCase()} must be a whole number from 0 to ${max}.`);
  }
  return errors;
}

/** Full-roster validation: size, per-player fields, duplicate names. */
export function rosterProblems(players: RosterPlayer[]): string[] {
  const errors: string[] = [];
  if (!Array.isArray(players)) return ["Roster must be a list of tributes."];
  if (players.length < MIN_PLAYERS)
    errors.push(`At least ${MIN_PLAYERS} tributes are required.`);
  if (players.length > MAX_PLAYERS)
    errors.push(`At most ${MAX_PLAYERS} tributes are allowed.`);
  const seen = new Map<string, number>();
  players.forEach((p, i) => {
    errors.push(...playerProblems(p, p.name?.trim() ? `"${p.name.trim()}"` : `Tribute ${i + 1}`));
    const key = (p.name ?? "").trim().toLowerCase();
    if (key) {
      if (seen.has(key)) errors.push(`Duplicate name: "${p.name.trim()}" (names must be unique).`);
      seen.set(key, i);
    }
  });
  return errors;
}

/**
 * Parse roster JSON from an import (file or clipboard). Accepts either a bare
 * array of players or `{ "players": [...] }`. Returns players or an error —
 * never throws.
 */
export function parseRosterJson(text: string): { players?: RosterPlayer[]; error?: string } {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { error: "That file isn't valid JSON." };
  }
  const list = Array.isArray(raw)
    ? raw
    : raw && typeof raw === "object" && Array.isArray((raw as { players?: unknown }).players)
      ? (raw as { players: unknown[] }).players
      : null;
  if (!list) return { error: "Expected a JSON array of tributes (or { \"players\": [...] })." };

  const players: RosterPlayer[] = list.map((item) => {
    const o = (item ?? {}) as Record<string, unknown>;
    const stats = (o.stats ?? o) as Record<string, unknown>; // allow flat stat fields
    const num = (v: unknown) => (typeof v === "number" ? Math.round(v) : NaN);
    return {
      name: typeof o.name === "string" ? o.name.trim() : "",
      district: num(o.district),
      stats: {
        judge: num(stats.judge),
        sponsor: num(stats.sponsor),
        advantages: num(stats.advantages),
        kill: num(stats.kill),
        fight: num(stats.fight),
        survival: num(stats.survival),
      },
    };
  });
  const errors = rosterProblems(players);
  if (errors.length) return { error: errors.slice(0, 3).join(" ") };
  return { players };
}

export function rosterToJson(players: RosterPlayer[]): string {
  return JSON.stringify({ players }, null, 2);
}

// --- Sample roster --------------------------------------------------------------
// The original hardcoded cast from the Python simulator, kept as the quick-start
// roster so new visitors can run a game immediately.

function p(
  name: string,
  district: number,
  judge: number,
  sponsor: number,
  advantages: number,
  kill: number,
  fight: number,
  survival: number,
): RosterPlayer {
  return { name, district, stats: { judge, sponsor, advantages, kill, fight, survival } };
}

export const SAMPLE_ROSTER: RosterPlayer[] = [
  p("Daniela", 1, 6, 6, 7, 9, 4, 3),
  p("Kushal", 1, 7, 10, 4, 2, 6, 4),
  p("Kailash", 2, 11, 9, 6, 9, 9, 9),
  p("Bella", 3, 5, 4, 3, 5, 4, 3),
  p("Sahana", 3, 4, 4, 7, 10, 3, 2),
  p("Connor", 4, 6, 10, 8, 6, 7, 10),
  p("Hanna", 5, 5, 4, 6, 7, 7, 6),
  p("Virat", 6, 8, 2, 9, 7, 6, 4),
  p("Ananya", 7, 6, 3, 7, 7, 5, 6),
  p("Sasha", 8, 7, 7, 4, 4, 6, 6),
  p("Meadow", 9, 8, 3, 2, 3, 6, 7),
  p("Aanya", 9, 7, 9, 6, 2, 7, 7),
  p("Sam", 10, 10, 6, 6, 8, 9, 10),
  p("Michelina", 11, 8, 8, 7, 1, 8, 10),
  p("Zoe", 12, 6, 1, 9, 10, 6, 5),
];

/** A fresh blank tribute for the roster editor. */
export function blankPlayer(): RosterPlayer {
  return { name: "", district: 1, stats: { judge: 6, sponsor: 5, advantages: 5, kill: 5, fight: 5, survival: 5 } };
}
