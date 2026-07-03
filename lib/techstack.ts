// techStack lives in SQLite as a comma-separated string (no array type). These
// two helpers are the single place that conversion happens, so the rest of the
// app works with clean string[] on read and a normalized string on write.

/** Accepts an array or comma-separated string → normalized "a,b,c" for storage. */
export function normalizeTechStack(input: unknown): string {
  const raw = Array.isArray(input)
    ? input
    : typeof input === "string"
      ? input.split(",")
      : [];
  return raw
    .filter((s) => s != null)
    .map((s) => String(s).trim())
    .filter(Boolean)
    .join(",");
}

/** Stored string → string[] for rendering. */
export function splitTechStack(value: string | null | undefined): string[] {
  return value ? value.split(",").map((s) => s.trim()).filter(Boolean) : [];
}
