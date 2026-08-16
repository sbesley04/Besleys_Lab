export interface Suspect { id: string; name: string; prior: number; note: string }
export interface Clue {
  id: string;
  label: string;
  finding: string;
  cost: number;
  likelihood: Record<string, number>;
}
export interface DetectiveCase {
  id: string;
  title: string;
  setup: string;
  culprit: string;
  suspects: Suspect[];
  clues: Clue[];
}

export type DetectiveDifficulty = "guided" | "detective" | "cold";
export const DETECTIVE_MODES: Record<DetectiveDifficulty, { label: string; budget: number; costMultiplier: number; revealLikelihoods: boolean }> = {
  guided: { label: "Guided inquiry", budget: 125, costMultiplier: 0.85, revealLikelihoods: true },
  detective: { label: "Detective", budget: 100, costMultiplier: 1, revealLikelihoods: false },
  cold: { label: "Cold case", budget: 76, costMultiplier: 1.18, revealLikelihoods: false },
};

export const CASES: DetectiveCase[] = [
  {
    id: "greenhouse", title: "The Greenhouse Ledger",
    setup: "A rare seed ledger vanished during the evening watering round. Determine who removed it.",
    culprit: "mara",
    suspects: [
      { id: "mara", name: "Mara Vale", prior: 0.2, note: "A visiting botanist with temporary access." },
      { id: "olin", name: "Olin Reed", prior: 0.5, note: "The greenhouse keeper; usually alone after six." },
      { id: "ves", name: "Ves North", prior: 0.3, note: "An archivist who catalogued the ledger last week." },
    ],
    clues: [
      { id: "mud", label: "Analyze the mud", finding: "The sample contains imported volcanic grit.", cost: 22, likelihood: { mara: 0.82, olin: 0.18, ves: 0.12 } },
      { id: "lock", label: "Inspect the cabinet lock", finding: "The lock was opened cleanly with a cataloguing key.", cost: 26, likelihood: { mara: 0.25, olin: 0.45, ves: 0.78 } },
      { id: "pollen", label: "Test the coat pollen", finding: "Night-blooming cereus pollen is present.", cost: 18, likelihood: { mara: 0.72, olin: 0.5, ves: 0.08 } },
      { id: "clock", label: "Check the irrigation clock", finding: "The logged watering time was manually overwritten.", cost: 30, likelihood: { mara: 0.45, olin: 0.76, ves: 0.2 } },
    ],
  },
  {
    id: "observatory", title: "Signal from the Plum Observatory",
    setup: "Someone redirected the telescope during a once-a-year transit. Identify the operator before the data window closes.",
    culprit: "ida",
    suspects: [
      { id: "ida", name: "Ida Quill", prior: 0.25, note: "Designed the tracking software." },
      { id: "cal", name: "Cal Mercer", prior: 0.45, note: "Was scheduled on the telescope." },
      { id: "ren", name: "Ren Ash", prior: 0.3, note: "Maintains the mechanical drive." },
    ],
    clues: [
      { id: "log", label: "Recover the command log", finding: "The command used an undocumented software alias.", cost: 28, likelihood: { ida: 0.9, cal: 0.25, ren: 0.1 } },
      { id: "oil", label: "Sample the control oil", finding: "Fresh machine oil is on the override lever.", cost: 20, likelihood: { ida: 0.15, cal: 0.35, ren: 0.82 } },
      { id: "badge", label: "Audit badge entries", finding: "A shared service badge entered at 02:14.", cost: 16, likelihood: { ida: 0.55, cal: 0.42, ren: 0.48 } },
      { id: "note", label: "Examine the margin note", finding: "The coordinate shorthand matches the software documentation.", cost: 24, likelihood: { ida: 0.78, cal: 0.2, ren: 0.16 } },
    ],
  },
  {
    id: "specimen", title: "The Mislabelled Specimen",
    setup: "A preserved lake specimen was swapped for a common decoy before an external review. Four people handled the collection.",
    culprit: "niko",
    suspects: [
      { id: "niko", name: "Niko Bell", prior: 0.12, note: "A junior technician assigned to cold storage." },
      { id: "sela", name: "Sela Ward", prior: 0.38, note: "The collection curator and final signatory." },
      { id: "tomas", name: "Tomas Pike", prior: 0.3, note: "Transported the specimen from the lake." },
      { id: "june", name: "June Orra", prior: 0.2, note: "Photographed the collection for the review." },
    ],
    clues: [
      { id: "frost", label: "Read the freezer telemetry", finding: "The case was opened during the junior night shift.", cost: 18, likelihood: { niko: 0.82, sela: 0.24, tomas: 0.18, june: 0.2 } },
      { id: "label", label: "Analyze label adhesive", finding: "The replacement label came from the transport kit.", cost: 23, likelihood: { niko: 0.3, sela: 0.18, tomas: 0.75, june: 0.22 } },
      { id: "photo", label: "Enhance the intake photograph", finding: "The original jar was still present after transport.", cost: 27, likelihood: { niko: 0.72, sela: 0.44, tomas: 0.08, june: 0.58 } },
      { id: "print", label: "Dust the cabinet latch", finding: "A partial print is consistent with small nitrile gloves.", cost: 16, likelihood: { niko: 0.58, sela: 0.3, tomas: 0.26, june: 0.42 } },
      { id: "motive", label: "Audit accession corrections", finding: "Someone concealed an earlier logging mistake by the junior technician.", cost: 31, likelihood: { niko: 0.9, sela: 0.15, tomas: 0.12, june: 0.1 } },
    ],
  },
  {
    id: "server", title: "The Vanishing Training Run",
    setup: "A record-setting model disappeared hours before a demonstration. The deletion token was valid, but its owner is disputed.",
    culprit: "aoife",
    suspects: [
      { id: "aoife", name: "Aoife Lin", prior: 0.18, note: "Built the baseline model and opposed the demo." },
      { id: "ben", name: "Ben Rook", prior: 0.42, note: "Owned the production token used for deletion." },
      { id: "cy", name: "Cy Moss", prior: 0.25, note: "Maintained experiment tracking." },
      { id: "dev", name: "Dev Ives", prior: 0.15, note: "Prepared slides from the missing run." },
    ],
    clues: [
      { id: "token", label: "Trace the deletion token", finding: "The token was copied from an unlocked production shell.", cost: 16, likelihood: { aoife: 0.52, ben: 0.78, cy: 0.38, dev: 0.24 } },
      { id: "cache", label: "Recover the command cache", finding: "The command used an alias documented only in baseline notes.", cost: 25, likelihood: { aoife: 0.84, ben: 0.18, cy: 0.3, dev: 0.14 } },
      { id: "slides", label: "Inspect slide revision history", finding: "The suspicious chart was added after the run vanished.", cost: 21, likelihood: { aoife: 0.2, ben: 0.2, cy: 0.25, dev: 0.72 } },
      { id: "metrics", label: "Recompute held-out metrics", finding: "The record score came from data leakage in the new pipeline.", cost: 29, likelihood: { aoife: 0.76, ben: 0.32, cy: 0.6, dev: 0.22 } },
      { id: "door", label: "Check laboratory entry logs", finding: "Aoife entered nine minutes before the token was copied.", cost: 19, likelihood: { aoife: 0.74, ben: 0.28, cy: 0.2, dev: 0.18 } },
    ],
  },
];

export function clueCost(clue: Clue, difficulty: DetectiveDifficulty): number {
  return Math.ceil(clue.cost * DETECTIVE_MODES[difficulty].costMultiplier);
}

export function initialBeliefs(c: DetectiveCase): Record<string, number> {
  return Object.fromEntries(c.suspects.map((s) => [s.id, s.prior]));
}

export function updateBeliefs(
  beliefs: Record<string, number>,
  clue: Clue,
): Record<string, number> {
  const weighted = Object.fromEntries(Object.keys(beliefs).map((id) => [id, beliefs[id] * (clue.likelihood[id] ?? 0)]));
  const total = Object.values(weighted).reduce((a, b) => a + b, 0);
  if (total <= 0) return beliefs;
  return Object.fromEntries(Object.entries(weighted).map(([id, value]) => [id, value / total]));
}

export function confidence(beliefs: Record<string, number>, suspect: string): number {
  return beliefs[suspect] ?? 0;
}
