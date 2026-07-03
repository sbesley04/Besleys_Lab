// Shared rules for user-saved state (game saves, rosters, simulations).
// Used by the API routes; kept here so limits live in one place.

import { games } from "@/app/games/registry";

/** Valid game slugs for GameSave rows — driven by the arcade registry. */
export const GAME_SLUGS = new Set(games.map((g) => g.slug));

/** Hard cap on a serialized save payload (SQLite/Postgres text column). */
export const MAX_SAVE_BYTES = 200_000;

/** Save-slot and roster names: short, human, no leading/trailing space. */
export const MAX_SLOT_NAME = 40;

/** Keep at most this many recorded simulation runs per user (oldest pruned). */
export const MAX_SIM_RUNS = 25;

export function slotNameProblem(name: unknown): string | null {
  if (typeof name !== "string" || !name.trim()) return "A name is required.";
  if (name.trim().length > MAX_SLOT_NAME) return `Names must be at most ${MAX_SLOT_NAME} characters.`;
  return null;
}

/** Validates that `data` is a JSON string under the size cap. */
export function savePayloadProblem(data: unknown): string | null {
  if (typeof data !== "string" || !data.length) return "Save data is required.";
  if (data.length > MAX_SAVE_BYTES) return "Save data is too large.";
  try {
    JSON.parse(data);
  } catch {
    return "Save data must be valid JSON.";
  }
  return null;
}
