// ---------------------------------------------------------------------------
// Plot helpers shared by every demo: mapping between data space and the SVG /
// canvas viewBox, tick generation, and the demo palette.
//
// Every demo draws into a fixed 0..W, 0..H viewBox and lets CSS scale it, so
// coordinates stay simple and the output is crisp at any size.
// ---------------------------------------------------------------------------

export interface Scale {
  /** data → view */
  x: (v: number) => number;
  y: (v: number) => number;
  /** view → data */
  invX: (px: number) => number;
  invY: (py: number) => number;
  width: number;
  height: number;
  pad: number;
  domain: [number, number];
  range: [number, number];
}

export function makeScale(
  width: number,
  height: number,
  domain: [number, number],
  range: [number, number],
  pad = 28,
): Scale {
  const [d0, d1] = domain;
  const [r0, r1] = range;
  const innerW = width - pad * 2;
  const innerH = height - pad * 2;
  return {
    width,
    height,
    pad,
    domain,
    range,
    x: (v) => pad + ((v - d0) / (d1 - d0)) * innerW,
    // Screen y grows downward; data y grows upward.
    y: (v) => pad + innerH - ((v - r0) / (r1 - r0)) * innerH,
    invX: (px) => d0 + ((px - pad) / innerW) * (d1 - d0),
    invY: (py) => r0 + ((pad + innerH - py) / innerH) * (r1 - r0),
  };
}

/** Roughly `count` human-friendly tick values covering [lo, hi]. */
export function ticks(lo: number, hi: number, count = 5): number[] {
  const span = hi - lo;
  if (span <= 0) return [lo];
  const raw = span / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const norm = raw / mag;
  const step = (norm >= 7.5 ? 10 : norm >= 3.5 ? 5 : norm >= 1.5 ? 2 : 1) * mag;
  const start = Math.ceil(lo / step) * step;
  const out: number[] = [];
  for (let v = start; v <= hi + step * 1e-6; v += step) {
    out.push(Math.abs(v) < step * 1e-6 ? 0 : Number(v.toFixed(10)));
  }
  return out;
}

/** Convert a pointer event to data coordinates within an SVG/canvas element. */
export function pointerToData(
  e: { clientX: number; clientY: number },
  el: SVGSVGElement | HTMLCanvasElement,
  scale: Scale,
): { x: number; y: number } {
  const rect = el.getBoundingClientRect();
  const px = ((e.clientX - rect.left) / rect.width) * scale.width;
  const py = ((e.clientY - rect.top) / rect.height) * scale.height;
  return { x: scale.invX(px), y: scale.invY(py) };
}

// --- Palette ---------------------------------------------------------------
// Categorical colors chosen to sit on cream paper *and* on the dark blueprint
// theme, and to stay distinguishable for the common color-vision deficiencies
// (they differ in lightness as well as hue).

export const SERIES = {
  ink: "#2f2b24",
  rust: "#a03c2e",
  blue: "#2b5f8b",
  green: "#3f7d4f",
  gold: "#b08829",
  violet: "#6b4d92",
  teal: "#2f7d78",
} as const;

export type SeriesKey = keyof typeof SERIES;

/** Two-class colors used by every point-classification demo. */
export const CLASS_COLORS = [SERIES.blue, SERIES.rust] as const;

export const CLUSTER_COLORS = [
  SERIES.blue, SERIES.rust, SERIES.green, SERIES.gold,
  SERIES.violet, SERIES.teal, "#8a6d3b", "#4a4a4a",
] as const;

/** Sample a warm sequential ramp (0 = cool/low, 1 = hot/high) as "r,g,b". */
export function heatRamp(t: number): [number, number, number] {
  const u = Math.max(0, Math.min(1, t));
  // paper cream → gold → rust → deep ink-red
  const stops: [number, [number, number, number]][] = [
    [0.0, [245, 240, 232]],
    [0.45, [222, 195, 138]],
    [0.75, [199, 124, 76]],
    [1.0, [122, 42, 32]],
  ];
  for (let i = 0; i < stops.length - 1; i++) {
    const [t0, c0] = stops[i];
    const [t1, c1] = stops[i + 1];
    if (u <= t1) {
      const f = (u - t0) / (t1 - t0);
      return [
        Math.round(c0[0] + (c1[0] - c0[0]) * f),
        Math.round(c0[1] + (c1[1] - c0[1]) * f),
        Math.round(c0[2] + (c1[2] - c0[2]) * f),
      ];
    }
  }
  return stops[stops.length - 1][1];
}

/** Deterministic RNG so demos can offer reproducible "random" datasets. */
export function seededRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

/** Standard-normal sample via Box–Muller. */
export function gauss(rng: () => number): number {
  let u = 0;
  let v = 0;
  while (u === 0) u = rng();
  while (v === 0) v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}
