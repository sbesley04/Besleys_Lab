// ---------------------------------------------------------------------------
// Client-side arcade progression helpers (imported by client components only —
// everything here touches localStorage / window).
//
// Achievements unlock instantly against a localStorage cache (so guests get
// the fun too), toast via a window CustomEvent that AchievementToaster
// listens for, and persist to /api/achievements when signed in. The POST is
// idempotent and 401s harmlessly for guests.
// ---------------------------------------------------------------------------

import { ACHIEVEMENTS_BY_KEY } from "@/lib/achievements";

const LS_UNLOCKED = "bl:achievements";
const LS_PLAYED = "bl:played";
const LS_WINS = "bl:wins";

export const TOAST_EVENT = "bl:toast-achievement";

function readSet(key: string): Set<string> {
  try {
    const raw = localStorage.getItem(key);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

function writeSet(key: string, set: Set<string>) {
  try {
    localStorage.setItem(key, JSON.stringify([...set]));
  } catch {
    /* storage full/blocked — achievements just won't persist locally */
  }
}

export function localUnlocked(): Set<string> {
  return readSet(LS_UNLOCKED);
}

/**
 * Unlock achievements by key. Dedupes against the local cache, fires the
 * toast event for anything new, and best-effort persists to the server.
 * Safe to call repeatedly with the same keys.
 */
export function unlock(...keys: string[]) {
  const known = keys.filter((k) => ACHIEVEMENTS_BY_KEY.has(k));
  if (known.length === 0) return;
  const have = readSet(LS_UNLOCKED);
  const fresh = known.filter((k) => !have.has(k));
  if (fresh.length === 0) return;

  fresh.forEach((k) => have.add(k));
  writeSet(LS_UNLOCKED, have);

  window.dispatchEvent(new CustomEvent(TOAST_EVENT, { detail: { keys: fresh } }));

  fetch("/api/achievements", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ keys: fresh }),
  }).catch(() => {});
}

/** Push every locally-unlocked achievement to the server (idempotent). Called
 *  once per pageview by the toaster when a session exists, so guest unlocks
 *  attach to the account the next time the user is signed in. */
export function syncLocalToServer() {
  const local = [...readSet(LS_UNLOCKED)];
  for (let i = 0; i < local.length; i += 20) {
    fetch("/api/achievements", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ keys: local.slice(i, i + 20) }),
    }).catch(() => {});
  }
}

/** Every slug that counts toward Lab Rat. Kept in sync with the registry by
 *  the arcade test suite. */
export const LAB_RAT_SLUGS = ["hunger-games", "tetris", "snake", "2048", "life", "solitaire", "sudoku"];

/** Call once when a game screen mounts: tracks Lab Rat + Night Shift. */
export function recordPlayed(slug: string) {
  const played = readSet(LS_PLAYED);
  played.add(slug);
  writeSet(LS_PLAYED, played);
  if (LAB_RAT_SLUGS.every((s) => played.has(s))) unlock("meta-lab-rat");

  const hour = new Date().getHours();
  if (hour >= 2 && hour < 5) unlock("meta-night-shift");
}

/** Call on any game win: tracks Renaissance Scientist (wins in 4 games). */
export function recordWin(slug: string) {
  const wins = readSet(LS_WINS);
  wins.add(slug);
  writeSet(LS_WINS, wins);
  if (wins.size >= 4) unlock("meta-renaissance");
}

/** Best-effort game-result recording (high scores / stats). Guests 401 quietly. */
export function postResult(r: {
  game: string;
  mode?: string;
  event?: "deal" | "win";
  score?: number;
  timeMs?: number;
  moves?: number;
  meta?: unknown;
}) {
  fetch("/api/results", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(r),
  }).catch(() => {});
}
