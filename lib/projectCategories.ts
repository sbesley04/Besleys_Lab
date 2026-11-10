// The sections /projects is split into. Featured projects set a category in
// code; shelf projects store it as a plain string column (SQLite has no enums),
// so anything unrecognised falls back to "other".

export const projectCategories = [
  { id: "full-stack", label: "Full stack" },
  { id: "data-science", label: "Data science" },
  { id: "other", label: "Other" },
] as const;

export type ProjectCategory = (typeof projectCategories)[number]["id"];

/** Any input → a valid category id, defaulting to "other". */
export function normalizeCategory(input: unknown): ProjectCategory {
  return projectCategories.find((c) => c.id === input)?.id ?? "other";
}
