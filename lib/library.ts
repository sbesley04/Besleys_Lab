// Shared constants + validation for the library (books) and field notebook.
// Used by the admin forms and the API routes so both enforce the same rules.

export const BOOK_DESIGNS = ["plain", "bands", "ornate", "split", "dots"] as const;
export type BookDesign = (typeof BOOK_DESIGNS)[number];

export const BOOK_DESIGN_LABELS: Record<BookDesign, string> = {
  plain: "Plain cloth",
  bands: "Title bands",
  ornate: "Gilded ornate",
  split: "Two-tone split",
  dots: "Dotted spine",
};

export const SPINE_HEIGHT = { min: 140, max: 260, default: 200 };
export const SPINE_THICKNESS = { min: 24, max: 72, default: 40 };
export const MAX_SHELVES = 6;
export const MAX_BOOKCASES = 8;

// --- Shelf decor -----------------------------------------------------------------

export const DECOR_KINDS = ["snake-plant", "pothos", "cactus", "bonsai"] as const;
export type DecorKind = (typeof DECOR_KINDS)[number];

export const DECOR_LABELS: Record<DecorKind, string> = {
  "snake-plant": "Snake plant",
  pothos: "Trailing pothos",
  cactus: "Cactus",
  bonsai: "Bonsai",
};

export function decorProblems(d: { kind?: unknown; bookcase?: unknown; shelf?: unknown }): string[] {
  const errors: string[] = [];
  if (!DECOR_KINDS.includes(d.kind as DecorKind)) errors.push("Unknown decor kind.");
  if (d.bookcase !== undefined && (!Number.isInteger(d.bookcase) || (d.bookcase as number) < 0 || (d.bookcase as number) >= MAX_BOOKCASES))
    errors.push(`Bookcase must be between 0 and ${MAX_BOOKCASES - 1}.`);
  if (d.shelf !== undefined && (!Number.isInteger(d.shelf) || (d.shelf as number) < 0 || (d.shelf as number) >= MAX_SHELVES))
    errors.push(`Shelf must be between 0 and ${MAX_SHELVES - 1}.`);
  return errors;
}

const HEX_RE = /^#[0-9a-fA-F]{6}$/;

export function isHexColor(value: unknown): value is string {
  return typeof value === "string" && HEX_RE.test(value);
}

/** Pick a legible ink for text printed on a spine of the given color. */
export function spineInk(hex: string): string {
  if (!isHexColor(hex)) return "#f5f0e8";
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return luminance > 150 ? "#2a2620" : "#f5f0e8";
}

/** Darken/lighten a hex color by a factor (-1..1) for spine shading. */
export function shade(hex: string, factor: number): string {
  if (!isHexColor(hex)) return hex;
  const ch = (i: number) => {
    const v = parseInt(hex.slice(i, i + 2), 16);
    const out = factor < 0 ? v * (1 + factor) : v + (255 - v) * factor;
    return Math.round(Math.max(0, Math.min(255, out)))
      .toString(16)
      .padStart(2, "0");
  };
  return `#${ch(1)}${ch(3)}${ch(5)}`;
}

export interface BookInput {
  title: string;
  author: string;
  slug?: string;
  review?: string;
  rating?: number | null;
  color?: string;
  height?: number;
  thickness?: number;
  design?: string;
  bookcase?: number;
  shelf?: number;
  position?: number;
  published?: boolean;
}

/** Validation errors for a book payload (create or update). */
export function bookProblems(b: Partial<BookInput>): string[] {
  const errors: string[] = [];
  if (!b.title?.trim()) errors.push("Title is required.");
  if (!b.author?.trim()) errors.push("Author is required.");
  if (b.color !== undefined && !isHexColor(b.color))
    errors.push("Spine color must be a hex value like #7a6a52.");
  if (b.height !== undefined && (!Number.isInteger(b.height) || b.height < SPINE_HEIGHT.min || b.height > SPINE_HEIGHT.max))
    errors.push(`Height must be a whole number between ${SPINE_HEIGHT.min} and ${SPINE_HEIGHT.max}.`);
  if (
    b.thickness !== undefined &&
    (!Number.isInteger(b.thickness) || b.thickness < SPINE_THICKNESS.min || b.thickness > SPINE_THICKNESS.max)
  )
    errors.push(`Thickness must be a whole number between ${SPINE_THICKNESS.min} and ${SPINE_THICKNESS.max}.`);
  if (b.design !== undefined && !BOOK_DESIGNS.includes(b.design as BookDesign))
    errors.push("Unknown spine design.");
  if (b.shelf !== undefined && (!Number.isInteger(b.shelf) || b.shelf < 0 || b.shelf >= MAX_SHELVES))
    errors.push(`Shelf must be between 0 and ${MAX_SHELVES - 1}.`);
  if (b.bookcase !== undefined && (!Number.isInteger(b.bookcase) || b.bookcase < 0 || b.bookcase >= MAX_BOOKCASES))
    errors.push(`Bookcase must be between 0 and ${MAX_BOOKCASES - 1}.`);
  if (b.rating !== undefined && b.rating !== null && (!Number.isInteger(b.rating) || b.rating < 1 || b.rating > 5))
    errors.push("Rating must be 1–5 (or empty).");
  return errors;
}

export const REVIEW_MAX_LENGTH = 4000;

export function reviewProblems(body: unknown, rating: unknown): string[] {
  const errors: string[] = [];
  if (typeof body !== "string" || !body.trim()) errors.push("Write something before posting.");
  else if (body.length > REVIEW_MAX_LENGTH) errors.push(`Reviews are capped at ${REVIEW_MAX_LENGTH} characters.`);
  if (rating !== undefined && rating !== null && (!Number.isInteger(rating) || (rating as number) < 1 || (rating as number) > 5))
    errors.push("Rating must be 1–5.");
  return errors;
}

export function fieldNoteProblems(n: { image?: unknown; alt?: unknown; caption?: unknown; tilt?: unknown }): string[] {
  const errors: string[] = [];
  const image = typeof n.image === "string" ? n.image.trim() : "";
  if (!image) errors.push("An image path is required.");
  else if (!/^(\/|https?:\/\/)/.test(image))
    errors.push("Image must be a site path (/photos/… or /uploads/…) or an https URL.");
  if (typeof n.alt !== "string" || !n.alt.trim()) errors.push("Alt text is required (describe the photo).");
  if (typeof n.caption !== "string" || !n.caption.trim()) errors.push("A caption is required.");
  if (n.tilt !== undefined && (typeof n.tilt !== "number" || Number.isNaN(n.tilt) || Math.abs(n.tilt) > 8))
    errors.push("Tilt must be a number between -8 and 8 degrees.");
  return errors;
}
