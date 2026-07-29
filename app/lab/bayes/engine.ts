// ---------------------------------------------------------------------------
// Bayes' theorem for the medical-test framing — pure logic, no React.
//
// P(disease | positive) = P(pos|dis)·P(dis) / [ P(pos|dis)·P(dis) + P(pos|¬dis)·P(¬dis) ]
// with sensitivity = P(pos|dis) and specificity = P(neg|¬dis).
// ---------------------------------------------------------------------------

export interface Counts {
  /** Has the disease, tests positive. */
  tp: number;
  /** Healthy, tests positive — the ones people forget about. */
  fp: number;
  /** Healthy, tests negative. */
  tn: number;
  /** Has the disease, tests negative. */
  fn: number;
}

/** P(disease | positive test). */
export function posterior(prevalence: number, sensitivity: number, specificity: number): number {
  const pos = sensitivity * prevalence + (1 - specificity) * (1 - prevalence);
  if (pos <= 0) return 0;
  return (sensitivity * prevalence) / pos;
}

/** P(no disease | negative test) — the reassurance number. */
export function negativePosterior(
  prevalence: number,
  sensitivity: number,
  specificity: number,
): number {
  const neg = (1 - sensitivity) * prevalence + specificity * (1 - prevalence);
  if (neg <= 0) return 0;
  return (specificity * (1 - prevalence)) / neg;
}

/**
 * Expected confusion-matrix counts for a population. Rounded so the visual
 * blocks are whole people, with the diseased group rounded first so
 * prevalence stays exact (tp + fn is always round(N·prevalence)).
 */
export function confusionCounts(
  population: number,
  prevalence: number,
  sensitivity: number,
  specificity: number,
): Counts {
  const diseased = Math.round(population * prevalence);
  const healthy = population - diseased;
  const tp = Math.round(diseased * sensitivity);
  const fn = diseased - tp;
  const tn = Math.round(healthy * specificity);
  const fp = healthy - tn;
  return { tp, fp, tn, fn };
}

/** Bayes factor for a positive result: how much the odds shift. */
export function likelihoodRatio(sensitivity: number, specificity: number): number {
  const fpr = 1 - specificity;
  return fpr <= 0 ? Infinity : sensitivity / fpr;
}

/** Preset scenarios that make the sliders concrete. */
export interface Scenario {
  key: string;
  name: string;
  prevalence: number;
  sensitivity: number;
  specificity: number;
  note: string;
}

export const SCENARIOS: Scenario[] = [
  {
    key: "rare",
    name: "Rare disease",
    prevalence: 0.001,
    sensitivity: 0.99,
    specificity: 0.99,
    note: "A 99%-accurate test for a 1-in-1000 disease. A positive result is still wrong ~91% of the time.",
  },
  {
    key: "textbook",
    name: "Textbook case",
    prevalence: 0.01,
    sensitivity: 0.99,
    specificity: 0.95,
    note: "The classic exam question: the answer is about 17%, and almost nobody guesses that low.",
  },
  {
    key: "screening",
    name: "Population screening",
    prevalence: 0.004,
    sensitivity: 0.87,
    specificity: 0.89,
    note: "Roughly mammography-shaped numbers — why screening programs generate so many callbacks.",
  },
  {
    key: "symptomatic",
    name: "Symptomatic patient",
    prevalence: 0.4,
    sensitivity: 0.9,
    specificity: 0.9,
    note: "Same test, but you already had reason to suspect. Now a positive means something.",
  },
];

export function formatPercent(v: number, digits = 1): string {
  if (v > 0 && v < 0.001) return "<0.1%";
  return `${(v * 100).toFixed(digits)}%`;
}
