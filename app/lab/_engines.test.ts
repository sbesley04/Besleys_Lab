// Pure-logic tests for the /lab demo engines. Run with:
//   npm run test:lab   (node --experimental-strip-types)
import {
  SURFACES, SURFACES_BY_KEY, initOpt, stepOpt, gradNorm, scheduleLr,
} from "./gradient-descent/engine.ts";
import {
  kmeansInit, assign, updateCentroids, inertia, kmeansPlusPlus,
} from "./k-means/engine.ts";
import { fitLinear, fitLogistic, predictLogistic, fitSVM, svmMargin } from "./regression/engine.ts";
import { initNet, forward, trainStep, XOR_DATA } from "./xor-net/engine.ts";
import { posterior, confusionCounts } from "./bayes/engine.ts";
import { buildChain, generate as markovGenerate } from "./markov-blog/engine.ts";
import {
  makeGrid, initQ, qStep, runEpisodes, greedyPolicy, bestAction, successRate,
  evaluatePolicy, DEFAULT_GRID,
} from "./q-learning/engine.ts";
import { heatRamp, makeScale, seededRng, stablePoint, ticks } from "./_components/plot.ts";

let fail = 0;
const ok = (c: boolean, n: string) => { if (!c) { fail++; console.log("FAIL:", n); } };
const near = (a: number, b: number, eps = 1e-6) => Math.abs(a - b) < eps;

// ---------- shared plotting ----------
const sharedScale = makeScale(500, 320, [-2, 8], [-4, 6], 30);
ok(near(sharedScale.invX(sharedScale.x(3.25)), 3.25), "x scale round-trips");
ok(near(sharedScale.invY(sharedScale.y(-1.75)), -1.75), "y scale round-trips");
ok(ticks(-1, 1, 4).includes(0), "human-friendly ticks include zero");
ok(ticks(2, 2, 5).length === 1, "zero-span tick range stays finite");
for (const t of [-1, 0, 0.5, 1, 2]) {
  const color = heatRamp(t);
  ok(color.length === 3 && color.every((channel) => Number.isInteger(channel) && channel >= 0 && channel <= 255), `heat ramp returns a valid RGB color at ${t}`);
}
ok(heatRamp(-1).every((channel, i) => channel === heatRamp(0)[i]), "heat ramp clamps its low end");
ok(heatRamp(2).every((channel, i) => channel === heatRamp(1)[i]), "heat ramp clamps its high end");
const normalizedPoint = stablePoint({ x: 1 / 3, y: -2 / 7, label: 1 });
ok(normalizedPoint.x === 0.333333 && normalizedPoint.y === -0.285714, "generated points normalize for stable SVG hydration");
ok(normalizedPoint.label === 1, "point normalization preserves extra fields");

// ---------- gradient descent ----------
for (const s of SURFACES) {
  // Analytic gradient must match a central finite difference.
  const [x, y] = [0.7, -0.45];
  const h = 1e-5;
  const fdx = (s.f(x + h, y) - s.f(x - h, y)) / (2 * h);
  const fdy = (s.f(x, y + h) - s.f(x, y - h)) / (2 * h);
  const [gx, gy] = s.grad(x, y);
  ok(near(gx, fdx, 1e-4), `${s.key} grad x matches finite difference`);
  ok(near(gy, fdy, 1e-4), `${s.key} grad y matches finite difference`);
}
ok(SURFACES_BY_KEY.get("bowl")!.name === "Bowl", "surface lookup works");

const bowl = SURFACES_BY_KEY.get("bowl")!;
// Descent reduces loss and converges to the origin.
let st = initOpt(-3, 2);
const startLoss = bowl.f(st.x, st.y);
for (let i = 0; i < 300; i++) st = stepOpt(st, bowl, "sgd", 0.1, 0.9);
ok(bowl.f(st.x, st.y) < startLoss, "sgd reduces loss");
ok(Math.hypot(st.x, st.y) < 0.01, "sgd converges to the bowl minimum");
ok(st.path.length > 1 && !st.diverged, "sgd records a path and stays finite");
ok(gradNorm(bowl, st.x, st.y) < 0.05, "gradient vanishes at convergence");

// Too large a learning rate diverges and is flagged.
let blown = initOpt(-3, 2);
for (let i = 0; i < 200; i++) blown = stepOpt(blown, bowl, "sgd", 1.9, 0.9);
ok(blown.diverged, "excessive learning rate is flagged as diverged");
ok(stepOpt(blown, bowl, "sgd", 1.9, 0.9) === blown, "diverged state is frozen");

// Momentum beats plain SGD through a ravine (same lr, same budget).
const ravine = SURFACES_BY_KEY.get("ravine")!;
let plain = initOpt(...ravine.start);
let mom = initOpt(...ravine.start);
for (let i = 0; i < 120; i++) {
  plain = stepOpt(plain, ravine, "sgd", 0.12, 0.9);
  mom = stepOpt(mom, ravine, "momentum", 0.12, 0.9);
}
ok(ravine.f(mom.x, mom.y) < ravine.f(plain.x, plain.y), "momentum outruns sgd in a ravine");

// Adam makes progress and applies bias correction (first step is not ~0).
let adam = initOpt(-3, 2);
const adam1 = stepOpt(adam, bowl, "adam", 0.1, 0.9);
ok(Math.abs(adam1.x - adam.x) > 0.05, "adam's first step is bias-corrected, not tiny");
for (let i = 0; i < 400; i++) adam = stepOpt(adam, bowl, "adam", 0.1, 0.9);
ok(bowl.f(adam.x, adam.y) < 0.01, "adam converges on the bowl");

// ---------- lr schedules ----------
ok(scheduleLr("constant", 0.1, 0, 100) === 0.1, "constant schedule is flat");
ok(scheduleLr("constant", 0.1, 99, 100) === 0.1, "constant stays flat at the end");
ok(near(scheduleLr("cosine", 0.1, 0, 100), 0.1, 1e-9), "cosine starts at the base rate");
ok(scheduleLr("cosine", 0.1, 100, 100) < 1e-9, "cosine anneals to zero");
ok(scheduleLr("step", 0.1, 0, 100) === 0.1, "step decay starts at base");
ok(scheduleLr("step", 0.1, 99, 100) < 0.1, "step decay drops over time");
ok(scheduleLr("warmup", 0.1, 0, 100) < 1e-9, "warmup starts near zero");
ok(scheduleLr("warmup", 0.1, 15, 100) > 0.09, "warmup reaches the peak rate");
ok(scheduleLr("warmup", 0.1, 100, 100) < 1e-9, "warmup anneals back down");
// Monotonic decay for cosine.
let prev = Infinity;
let monotone = true;
for (let t = 0; t <= 100; t += 5) {
  const v = scheduleLr("cosine", 0.1, t, 100);
  if (v > prev + 1e-12) monotone = false;
  prev = v;
}
ok(monotone, "cosine decreases monotonically");

// ---------- k-means ----------
// Three well-separated blobs should be recovered exactly.
const rng = seededRng(11);
const blobs: { x: number; y: number }[] = [];
const centers = [[-3, -3], [3, -2], [0, 3]];
for (const [cx, cy] of centers) {
  for (let i = 0; i < 25; i++) {
    blobs.push({ x: cx + (rng() - 0.5) * 0.9, y: cy + (rng() - 0.5) * 0.9 });
  }
}
let cents = kmeansPlusPlus(blobs, 3, seededRng(5));
let labels = assign(blobs, cents);
for (let i = 0; i < 30; i++) {
  cents = updateCentroids(blobs, assign(blobs, cents), 3);
  labels = assign(blobs, cents);
}
const groups = new Set(labels.map((l, i) => `${l}-${Math.round(blobs[i].x)}`));
ok(new Set(labels).size === 3, "k-means finds three clusters");
ok(groups.size === 3, "each blob maps to one cluster");
ok(inertia(blobs, labels, cents) < 12, "inertia is small for separated blobs");

// Inertia never increases across an iteration.
let c2 = kmeansInit(blobs, 4, seededRng(3));
let last = Infinity;
let nonIncreasing = true;
for (let i = 0; i < 15; i++) {
  const a = assign(blobs, c2);
  const cur = inertia(blobs, a, c2);
  if (cur > last + 1e-9) nonIncreasing = false;
  last = cur;
  c2 = updateCentroids(blobs, a, 4);
}
ok(nonIncreasing, "k-means inertia never increases");
ok(kmeansPlusPlus(blobs, 3, seededRng(5)).length === 3, "k-means++ returns k centroids");
// Empty cluster handling: k > distinct points must not produce NaN centroids.
const tiny = [{ x: 1, y: 1 }, { x: 1, y: 1 }];
const tinyC = updateCentroids(tiny, assign(tiny, kmeansInit(tiny, 3, seededRng(1))), 3);
ok(tinyC.every((c) => Number.isFinite(c.x) && Number.isFinite(c.y)), "empty clusters stay finite");

// ---------- regression ----------
// Perfect line: y = 2x + 1.
const linePts = [0, 1, 2, 3, 4].map((x) => ({ x, y: 2 * x + 1 }));
const fit = fitLinear(linePts);
ok(near(fit.slope, 2, 1e-9) && near(fit.intercept, 1, 1e-9), "linear regression recovers the line");
ok(near(fit.r2, 1, 1e-9), "perfect fit has r² = 1");
// Noisy data still has 0 <= r² <= 1.
const noisy = [{ x: 0, y: 1 }, { x: 1, y: 2.4 }, { x: 2, y: 4.1 }, { x: 3, y: 8 }];
const nf = fitLinear(noisy);
ok(nf.r2 >= 0 && nf.r2 <= 1, "r² stays in range on noisy data");
// Degenerate input (all same x) must not produce NaN.
const vert = [{ x: 2, y: 0 }, { x: 2, y: 5 }];
ok(Number.isFinite(fitLinear(vert).slope), "vertical data doesn't produce NaN");

// Logistic separates two clean groups.
const logPts = [
  ...[-3, -2.5, -2, -1.5].map((x) => ({ x, y: 0, label: 0 })),
  ...[1.5, 2, 2.5, 3].map((x) => ({ x, y: 0, label: 1 })),
];
const lg = fitLogistic(logPts, 400, 0.5);
ok(predictLogistic(lg, -2.5) < 0.25, "logistic predicts low for class 0");
ok(predictLogistic(lg, 2.5) > 0.75, "logistic predicts high for class 1");
ok(predictLogistic(lg, -100) >= 0 && predictLogistic(lg, 100) <= 1, "logistic output stays in [0,1]");

// SVM finds a separating boundary with a positive margin.
const svmPts = [
  { x: -2, y: -2, label: 0 }, { x: -2.5, y: -1.4, label: 0 }, { x: -1.6, y: -2.6, label: 0 },
  { x: 2, y: 2, label: 1 }, { x: 2.4, y: 1.5, label: 1 }, { x: 1.7, y: 2.7, label: 1 },
];
const svm = fitSVM(svmPts, 900);
const sides = svmPts.map((p) => Math.sign(svm.w[0] * p.x + svm.w[1] * p.y + svm.b));
ok(sides.slice(0, 3).every((s) => s === sides[0]), "svm puts class 0 on one side");
ok(sides.slice(3).every((s) => s === sides[3]), "svm puts class 1 on the other side");
ok(sides[0] !== sides[3], "svm separates the two classes");
ok(svmMargin(svm) > 0 && Number.isFinite(svmMargin(svm)), "svm margin is positive and finite");

// ---------- xor net ----------
let net = initNet(seededRng(7));
const before = trainStep(net, XOR_DATA, 0.5).loss;
for (let i = 0; i < 4000; i++) net = trainStep(net, XOR_DATA, 0.5).net;
const after = trainStep(net, XOR_DATA, 0.5).loss;
ok(after < before, "xor net reduces loss");
ok(after < 0.05, "xor net actually learns xor");
for (const d of XOR_DATA) {
  const out = forward(net, d.x[0], d.x[1]).out;
  ok(Math.round(out) === d.y, `xor net predicts ${d.x} -> ${d.y}`);
  ok(out >= 0 && out <= 1, "xor output is a probability");
}

// ---------- bayes ----------
// Textbook case: 1% prevalence, 99% sensitivity, 95% specificity.
const post = posterior(0.01, 0.99, 0.95);
ok(post > 0.16 && post < 0.17, "bayes matches the textbook 16.7% result");
ok(posterior(0.5, 0.99, 0.99) > 0.98, "high prevalence gives high posterior");
ok(posterior(0, 0.99, 0.95) === 0, "zero prevalence gives zero posterior");
const counts = confusionCounts(10000, 0.01, 0.99, 0.95);
ok(counts.tp + counts.fn === 100, "confusion counts respect prevalence");
ok(counts.tp + counts.fp + counts.tn + counts.fn === 10000, "confusion counts sum to the population");
ok(counts.fp > counts.tp, "false positives outnumber true positives when disease is rare");

// ---------- markov ----------
const corpus = "the cat sat on the mat. the cat ate the rat. a dog sat on a log.";
const chain = buildChain(corpus, 2);
ok(chain.size > 0, "markov chain builds states");
const text = markovGenerate(chain, 2, 40, seededRng(4));
ok(text.length > 0, "markov generates text");
ok(text.split(/\s+/).length <= 41, "markov respects the word limit");
// Every generated bigram must have existed in the corpus.
const words = corpus.toLowerCase().replace(/[.]/g, " .").split(/\s+/).filter(Boolean);
const seen = new Set<string>();
for (let i = 0; i + 1 < words.length; i++) seen.add(`${words[i]} ${words[i + 1]}`);
const gen = text.toLowerCase().replace(/[.]/g, " .").split(/\s+/).filter(Boolean);
let allSeen = true;
for (let i = 0; i + 1 < gen.length; i++) if (!seen.has(`${gen[i]} ${gen[i + 1]}`)) allSeen = false;
ok(allSeen, "markov only emits bigrams that occurred in the corpus");
ok(buildChain("", 2).size === 0, "empty corpus yields an empty chain");

// ---------- q-learning ----------
const grid = makeGrid(DEFAULT_GRID);
ok(grid.goal >= 0, "grid has a goal");
let q = initQ(grid);
const qrng = seededRng(21);
// runEpisodes counts *episodes*; qStep is a single environment step.
q = runEpisodes(q, grid, { epsilon: 0.25, alpha: 0.5, gamma: 0.95 }, 1200, qrng);
ok(q.episode >= 1200, "runEpisodes completes the requested episodes");
ok(q.history.length > 0, "episode history is recorded");
ok(successRate(q) > 0.5, "success rate climbs with training");
// A single qStep advances exactly one step.
const oneStep = qStep(q, grid, { epsilon: 0, alpha: 0.5, gamma: 0.95 }, qrng);
ok(oneStep.q.stepsThisEpisode === 1 || oneStep.justFinished, "qStep advances one step");
const policy = greedyPolicy(q, grid);
ok(policy.length === grid.cells.length, "policy covers every cell");
// From the start, following the greedy policy must reach the goal without
// looping forever or stepping in a pit.
let cur = grid.start;
let steps = 0;
let reached = false;
const visited = new Set<number>();
while (steps++ < 60) {
  if (cur === grid.goal) { reached = true; break; }
  if (visited.has(cur)) break;
  visited.add(cur);
  const a = bestAction(q, cur);
  cur = grid.next(cur, a);
}
ok(reached, "q-learning finds a path to the goal");
ok(!grid.cells[cur]?.pit, "learned path avoids pits");

// evaluatePolicy agrees, and reports a sane path.
const evaluated = evaluatePolicy(q, grid);
ok(evaluated.reached, "evaluatePolicy reaches the goal after training");
ok(evaluated.steps >= 12, "path is at least the manhattan-ish minimum");
ok(evaluated.path[0] === grid.start, "path starts at the start");
ok(evaluated.path[evaluated.path.length - 1] === grid.goal, "path ends at the goal");
ok(evaluated.path.every((s) => !grid.cells[s].pit && !grid.cells[s].wall), "path avoids pits and walls");
// An untrained agent must NOT be reported as solving it.
ok(!evaluatePolicy(initQ(grid), grid).reached, "an untrained policy doesn't reach the goal");

console.log(fail === 0 ? "\nALL LAB ENGINE TESTS PASSED" : `\n${fail} failed`);
process.exit(fail ? 1 : 0);
