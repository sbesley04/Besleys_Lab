// ---------------------------------------------------------------------------
// Linear regression, logistic regression, and a linear SVM — pure logic, no
// React. Shared by the /lab/regression and /lab/svm demos.
//
// Linear regression is closed-form (least squares); logistic and the SVM are
// trained by gradient descent so the demos can show them converging.
// ---------------------------------------------------------------------------

export interface XY {
  x: number;
  y: number;
}

export interface LabeledPt {
  x: number;
  y: number;
  /** 0 or 1 */
  label: number;
}

// --- Linear regression --------------------------------------------------------

export interface LinearFit {
  slope: number;
  intercept: number;
  /** Coefficient of determination, clamped to [0, 1]. */
  r2: number;
  /** Mean squared error of the fit. */
  mse: number;
}

/** Ordinary least squares for y = slope·x + intercept. */
export function fitLinear(points: XY[]): LinearFit {
  const n = points.length;
  if (n === 0) return { slope: 0, intercept: 0, r2: 0, mse: 0 };

  const meanX = points.reduce((s, p) => s + p.x, 0) / n;
  const meanY = points.reduce((s, p) => s + p.y, 0) / n;
  let sxy = 0;
  let sxx = 0;
  for (const p of points) {
    sxy += (p.x - meanX) * (p.y - meanY);
    sxx += (p.x - meanX) ** 2;
  }
  // Vertical data (no x-variance) has no least-squares line; fall back to a
  // horizontal line through the mean rather than emitting NaN.
  const slope = sxx === 0 ? 0 : sxy / sxx;
  const intercept = meanY - slope * meanX;

  let ssRes = 0;
  let ssTot = 0;
  for (const p of points) {
    ssRes += (p.y - (slope * p.x + intercept)) ** 2;
    ssTot += (p.y - meanY) ** 2;
  }
  const r2 = ssTot === 0 ? 1 : Math.max(0, Math.min(1, 1 - ssRes / ssTot));
  return { slope, intercept, r2, mse: ssRes / n };
}

// --- Logistic regression ------------------------------------------------------

export interface LogisticFit {
  /** Weight on x. */
  w: number;
  b: number;
  /** Mean cross-entropy loss at the end of training. */
  loss: number;
}

export function sigmoid(z: number): number {
  // Numerically stable on both tails.
  if (z >= 0) return 1 / (1 + Math.exp(-z));
  const e = Math.exp(z);
  return e / (1 + e);
}

/** Batch gradient descent on the cross-entropy loss (1D input). */
export function fitLogistic(points: LabeledPt[], iterations = 600, lr = 0.4): LogisticFit {
  let w = 0;
  let b = 0;
  const n = points.length;
  if (n === 0) return { w, b, loss: 0 };

  for (let it = 0; it < iterations; it++) {
    let gw = 0;
    let gb = 0;
    for (const p of points) {
      const err = sigmoid(w * p.x + b) - p.label;
      gw += err * p.x;
      gb += err;
    }
    w -= (lr * gw) / n;
    b -= (lr * gb) / n;
  }

  let loss = 0;
  for (const p of points) {
    const q = Math.min(1 - 1e-9, Math.max(1e-9, sigmoid(w * p.x + b)));
    loss += -(p.label * Math.log(q) + (1 - p.label) * Math.log(1 - q));
  }
  return { w, b, loss: loss / n };
}

export function predictLogistic(fit: LogisticFit, x: number): number {
  return sigmoid(fit.w * x + fit.b);
}

// --- Linear SVM ---------------------------------------------------------------

export interface SVMFit {
  /** Weight vector [w1, w2]. */
  w: [number, number];
  b: number;
  /** Regularization strength used for the fit. */
  C: number;
}

/**
 * Soft-margin linear SVM by subgradient descent on
 *   ½‖w‖² + C · Σ max(0, 1 − yᵢ(w·xᵢ + b))
 * with labels mapped from {0,1} to {−1,+1}.
 */
export function fitSVM(points: LabeledPt[], iterations = 1200, C = 1, lr0 = 0.05): SVMFit {
  let w: [number, number] = [0, 0];
  let b = 0;
  const n = points.length;
  if (n === 0) return { w, b, C };

  for (let it = 1; it <= iterations; it++) {
    // Decaying step size keeps the subgradient method stable.
    const lr = lr0 / (1 + it * 0.002);
    let gw0 = w[0];
    let gw1 = w[1];
    let gb = 0;
    for (const p of points) {
      const y = p.label === 1 ? 1 : -1;
      const margin = y * (w[0] * p.x + w[1] * p.y + b);
      if (margin < 1) {
        gw0 -= C * y * p.x;
        gw1 -= C * y * p.y;
        gb -= C * y;
      }
    }
    w = [w[0] - (lr * gw0) / n, w[1] - (lr * gw1) / n];
    b -= (lr * gb) / n;
  }
  return { w, b, C };
}

/** Geometric margin width (2/‖w‖). Infinite when w collapses to zero. */
export function svmMargin(fit: SVMFit): number {
  const norm = Math.hypot(fit.w[0], fit.w[1]);
  return norm === 0 ? Infinity : 2 / norm;
}

export function svmDecision(fit: SVMFit, x: number, y: number): number {
  return fit.w[0] * x + fit.w[1] * y + fit.b;
}

/** Points within (or violating) the margin — the ones that define the boundary. */
export function supportVectors(fit: SVMFit, points: LabeledPt[], tol = 0.15): number[] {
  const out: number[] = [];
  points.forEach((p, i) => {
    const y = p.label === 1 ? 1 : -1;
    if (y * svmDecision(fit, p.x, p.y) <= 1 + tol) out.push(i);
  });
  return out;
}

// --- The kernel trick ---------------------------------------------------------

/**
 * The lift used by the kernel view: (x, y) → (r, θ-ish) where r = x² + y².
 * Concentric rings are inseparable in the plane but trivially separable once
 * radius becomes an axis — which is the entire intuition behind kernels.
 */
export function liftRadial(p: { x: number; y: number }): { x: number; y: number } {
  return { x: Math.hypot(p.x, p.y), y: p.x * p.x + p.y * p.y };
}

/** Two concentric rings — the classic non-separable dataset. */
export function sampleRings(n: number, rng: () => number): LabeledPt[] {
  const out: LabeledPt[] = [];
  for (let i = 0; i < n; i++) {
    const inner = i % 2 === 0;
    const r = (inner ? 0.9 : 2.6) + (rng() - 0.5) * 0.5;
    const t = rng() * Math.PI * 2;
    out.push({ x: r * Math.cos(t), y: r * Math.sin(t), label: inner ? 0 : 1 });
  }
  return out;
}

/** Two linearly-separable gaussian blobs. */
export function sampleTwoBlobs(n: number, rng: () => number, gap = 2.2): LabeledPt[] {
  const out: LabeledPt[] = [];
  for (let i = 0; i < n; i++) {
    const cls = i % 2;
    const cx = cls === 0 ? -gap : gap;
    const cy = cls === 0 ? -gap * 0.55 : gap * 0.55;
    out.push({
      x: cx + (rng() - 0.5) * 2.1,
      y: cy + (rng() - 0.5) * 2.1,
      label: cls,
    });
  }
  return out;
}
