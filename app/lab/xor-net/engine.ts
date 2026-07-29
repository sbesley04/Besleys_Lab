// ---------------------------------------------------------------------------
// A 2-2-1 neural network with hand-written backprop — pure logic, no React.
//
// Deliberately tiny: two inputs, two hidden units, one output, tanh hidden
// activation and a sigmoid output. Small enough to draw every weight on
// screen, big enough to solve XOR — which a single layer provably cannot.
// ---------------------------------------------------------------------------

export interface Net {
  /** Input→hidden weights: w1[h][i] */
  w1: number[][];
  /** Hidden biases */
  b1: number[];
  /** Hidden→output weights */
  w2: number[];
  /** Output bias */
  b2: number;
}

export interface Sample {
  x: [number, number];
  y: number;
}

export const XOR_DATA: Sample[] = [
  { x: [0, 0], y: 0 },
  { x: [0, 1], y: 1 },
  { x: [1, 0], y: 1 },
  { x: [1, 1], y: 0 },
];

export const AND_DATA: Sample[] = [
  { x: [0, 0], y: 0 },
  { x: [0, 1], y: 0 },
  { x: [1, 0], y: 0 },
  { x: [1, 1], y: 1 },
];

export const OR_DATA: Sample[] = [
  { x: [0, 0], y: 0 },
  { x: [0, 1], y: 1 },
  { x: [1, 0], y: 1 },
  { x: [1, 1], y: 1 },
];

export const DATASETS = {
  xor: { label: "XOR", data: XOR_DATA, note: "Not linearly separable — needs the hidden layer." },
  and: { label: "AND", data: AND_DATA, note: "Linearly separable. One line does it; the net barely works." },
  or: { label: "OR", data: OR_DATA, note: "Also separable — compare how much faster this converges." },
} as const;

export type DatasetKey = keyof typeof DATASETS;

function sigmoid(z: number): number {
  if (z >= 0) return 1 / (1 + Math.exp(-z));
  const e = Math.exp(z);
  return e / (1 + e);
}

/** Small random weights — symmetry-breaking matters here, so never all zero. */
export function initNet(rng: () => number = Math.random): Net {
  const r = () => (rng() - 0.5) * 2.4;
  return {
    w1: [
      [r(), r()],
      [r(), r()],
    ],
    b1: [r() * 0.3, r() * 0.3],
    w2: [r(), r()],
    b2: r() * 0.3,
  };
}

export interface Activations {
  /** Pre-activations of the hidden layer. */
  z1: number[];
  /** Hidden activations (tanh). */
  h: number[];
  /** Output pre-activation. */
  z2: number;
  /** Output (sigmoid). */
  out: number;
}

export function forward(net: Net, x0: number, x1: number): Activations {
  const z1 = [
    net.w1[0][0] * x0 + net.w1[0][1] * x1 + net.b1[0],
    net.w1[1][0] * x0 + net.w1[1][1] * x1 + net.b1[1],
  ];
  const h = [Math.tanh(z1[0]), Math.tanh(z1[1])];
  const z2 = net.w2[0] * h[0] + net.w2[1] * h[1] + net.b2;
  return { z1, h, z2, out: sigmoid(z2) };
}

/** Mean binary cross-entropy over a dataset. */
export function loss(net: Net, data: Sample[]): number {
  if (data.length === 0) return 0;
  let total = 0;
  for (const d of data) {
    const p = Math.min(1 - 1e-9, Math.max(1e-9, forward(net, d.x[0], d.x[1]).out));
    total += -(d.y * Math.log(p) + (1 - d.y) * Math.log(1 - p));
  }
  return total / data.length;
}

/**
 * One full-batch gradient step. Returns the updated net plus the loss *before*
 * the step, so the demo's loss curve lines up with what the user just saw.
 *
 * With cross-entropy on a sigmoid output, dL/dz2 collapses to (out − y) — the
 * reason this pairing is used everywhere.
 */
export function trainStep(net: Net, data: Sample[], lr = 0.5): { net: Net; loss: number } {
  const before = loss(net, data);
  if (data.length === 0) return { net, loss: before };

  const gw1 = [
    [0, 0],
    [0, 0],
  ];
  const gb1 = [0, 0];
  const gw2 = [0, 0];
  let gb2 = 0;

  for (const d of data) {
    const a = forward(net, d.x[0], d.x[1]);
    const dz2 = a.out - d.y;

    gw2[0] += dz2 * a.h[0];
    gw2[1] += dz2 * a.h[1];
    gb2 += dz2;

    for (let j = 0; j < 2; j++) {
      // tanh'(z) = 1 − tanh²(z)
      const dh = dz2 * net.w2[j];
      const dz1 = dh * (1 - a.h[j] * a.h[j]);
      gw1[j][0] += dz1 * d.x[0];
      gw1[j][1] += dz1 * d.x[1];
      gb1[j] += dz1;
    }
  }

  const n = data.length;
  return {
    loss: before,
    net: {
      w1: [
        [net.w1[0][0] - (lr * gw1[0][0]) / n, net.w1[0][1] - (lr * gw1[0][1]) / n],
        [net.w1[1][0] - (lr * gw1[1][0]) / n, net.w1[1][1] - (lr * gw1[1][1]) / n],
      ],
      b1: [net.b1[0] - (lr * gb1[0]) / n, net.b1[1] - (lr * gb1[1]) / n],
      w2: [net.w2[0] - (lr * gw2[0]) / n, net.w2[1] - (lr * gw2[1]) / n],
      b2: net.b2 - (lr * gb2) / n,
    },
  };
}

/** All four predictions, for the truth-table readout. */
export function truthTable(net: Net, data: Sample[]): { x: [number, number]; y: number; out: number }[] {
  return data.map((d) => ({ x: d.x, y: d.y, out: forward(net, d.x[0], d.x[1]).out }));
}

/** Accuracy at a 0.5 threshold. */
export function accuracy(net: Net, data: Sample[]): number {
  if (data.length === 0) return 0;
  const right = data.filter((d) => Math.round(forward(net, d.x[0], d.x[1]).out) === d.y).length;
  return right / data.length;
}
