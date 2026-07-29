// ---------------------------------------------------------------------------
// k-means — pure logic, no React. Split into the two half-steps the demo shows
// separately (assign, then update), because watching them alternate is the
// whole point of the exercise.
// ---------------------------------------------------------------------------

export interface Pt {
  x: number;
  y: number;
}

function dist2(a: Pt, b: Pt): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}

/** Naive (Forgy) initialization: k distinct points chosen at random. */
export function kmeansInit(points: Pt[], k: number, rng: () => number = Math.random): Pt[] {
  if (points.length === 0) return Array.from({ length: k }, () => ({ x: 0, y: 0 }));
  const picked: Pt[] = [];
  const used = new Set<number>();
  for (let i = 0; i < k; i++) {
    let idx = Math.floor(rng() * points.length);
    let guard = 0;
    while (used.has(idx) && guard++ < points.length) idx = (idx + 1) % points.length;
    used.add(idx);
    picked.push({ ...points[idx] });
  }
  return picked;
}

/**
 * A deliberately terrible initialization: every centroid drawn from one tight
 * corner of the data. Used by the "bad start" button to show convergence to a
 * poor local optimum.
 */
export function kmeansBadInit(points: Pt[], k: number, rng: () => number = Math.random): Pt[] {
  if (points.length === 0) return Array.from({ length: k }, () => ({ x: 0, y: 0 }));
  // Anchor on the point nearest one corner of the bounding box, then jitter.
  const minX = Math.min(...points.map((p) => p.x));
  const minY = Math.min(...points.map((p) => p.y));
  const corner = { x: minX, y: minY };
  const anchor = points.reduce((best, p) => (dist2(p, corner) < dist2(best, corner) ? p : best), points[0]);
  return Array.from({ length: k }, () => ({
    x: anchor.x + (rng() - 0.5) * 0.25,
    y: anchor.y + (rng() - 0.5) * 0.25,
  }));
}

/** k-means++ seeding: spread centroids out by distance-weighted sampling. */
export function kmeansPlusPlus(points: Pt[], k: number, rng: () => number = Math.random): Pt[] {
  if (points.length === 0) return Array.from({ length: k }, () => ({ x: 0, y: 0 }));
  const centroids: Pt[] = [{ ...points[Math.floor(rng() * points.length)] }];

  while (centroids.length < k) {
    const d2 = points.map((p) => Math.min(...centroids.map((c) => dist2(p, c))));
    const total = d2.reduce((s, v) => s + v, 0);
    if (total <= 0) {
      // All points coincide with a centroid — just duplicate one.
      centroids.push({ ...points[Math.floor(rng() * points.length)] });
      continue;
    }
    let r = rng() * total;
    let idx = 0;
    while (idx < d2.length - 1 && (r -= d2[idx]) > 0) idx++;
    centroids.push({ ...points[idx] });
  }
  return centroids;
}

/** Assignment step: nearest centroid for each point. */
export function assign(points: Pt[], centroids: Pt[]): number[] {
  return points.map((p) => {
    let best = 0;
    let bestD = Infinity;
    centroids.forEach((c, i) => {
      const d = dist2(p, c);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    });
    return best;
  });
}

/**
 * Update step: each centroid moves to the mean of its members. A centroid that
 * lost every member stays put (returning NaN would poison the next assignment).
 */
export function updateCentroids(points: Pt[], labels: number[], k: number, previous?: Pt[]): Pt[] {
  const sums = Array.from({ length: k }, () => ({ x: 0, y: 0, n: 0 }));
  points.forEach((p, i) => {
    const c = sums[labels[i]];
    if (!c) return;
    c.x += p.x;
    c.y += p.y;
    c.n++;
  });
  return sums.map((s, i) => {
    if (s.n > 0) return { x: s.x / s.n, y: s.y / s.n };
    return previous?.[i] ? { ...previous[i] } : { x: 0, y: 0 };
  });
}

/** Within-cluster sum of squares — the objective k-means minimizes. */
export function inertia(points: Pt[], labels: number[], centroids: Pt[]): number {
  return points.reduce((sum, p, i) => {
    const c = centroids[labels[i]];
    return c ? sum + dist2(p, c) : sum;
  }, 0);
}

/** True when no point changed cluster between two assignments. */
export function converged(a: number[], b: number[]): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

/** Generate `n` points in `k` gaussian blobs — the "scatter some data" button. */
export function sampleBlobs(
  n: number,
  k: number,
  rng: () => number,
  domain: [number, number],
  range: [number, number],
): Pt[] {
  const centers = Array.from({ length: k }, () => ({
    x: domain[0] + 0.15 * (domain[1] - domain[0]) + rng() * 0.7 * (domain[1] - domain[0]),
    y: range[0] + 0.15 * (range[1] - range[0]) + rng() * 0.7 * (range[1] - range[0]),
  }));
  const spread = 0.09 * (domain[1] - domain[0]);
  return Array.from({ length: n }, (_, i) => {
    const c = centers[i % k];
    // Box–Muller for a round blob.
    const u = Math.max(1e-9, rng());
    const v = rng();
    const r = Math.sqrt(-2 * Math.log(u)) * spread;
    return { x: c.x + r * Math.cos(2 * Math.PI * v), y: c.y + r * Math.sin(2 * Math.PI * v) };
  });
}
