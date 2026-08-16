export type Pigment = 0 | 1 | 2;
export type Vigor = 0 | 1 | 2;
export interface Genes {
  pigment: [Pigment, Pigment];
  vigor: [Vigor, Vigor];
  petals: [Vigor, Vigor];
  drought: [boolean, boolean];
}
export interface Plant {
  id: number;
  name: string;
  generation: number;
  genes: Genes;
  parents?: [number, number];
  mutations?: number;
}
export interface Phenotype { color: "white" | "rose" | "plum"; height: number; petals: number; drought: boolean }
export interface Contract { id: string; title: string; description: string; tier: 1 | 2; matches: (p: Phenotype) => boolean }

export const CONTRACTS: Contract[] = [
  { id: "plum-seven", tier: 1, title: "Plum Exhibition", description: "Plum flower with at least seven petals.", matches: (p) => p.color === "plum" && p.petals >= 7 },
  { id: "tall", tier: 1, title: "The Long Stem", description: "Plant at least 1.75 units tall.", matches: (p) => p.height >= 1.75 },
  { id: "dry-white", tier: 1, title: "Drought Moon", description: "White, drought-resistant flower.", matches: (p) => p.color === "white" && p.drought },
  { id: "white-nine", tier: 2, title: "Ninefold Moon", description: "White flower with exactly nine petals.", matches: (p) => p.color === "white" && p.petals === 9 },
  { id: "plum-survivor", tier: 2, title: "Plum Prairie", description: "Tall, drought-resistant plum flower.", matches: (p) => p.color === "plum" && p.height >= 1.75 && p.drought },
  { id: "rose-balance", tier: 2, title: "Balanced Rose", description: "Rose flower with eight petals and height from 1.40–1.80.", matches: (p) => p.color === "rose" && p.petals === 8 && p.height >= 1.4 && p.height <= 1.8 },
];

export function phenotype(plant: Plant): Phenotype {
  const pigment = Math.max(...plant.genes.pigment);
  return {
    color: pigment === 2 ? "plum" : pigment === 1 ? "rose" : "white",
    height: 0.75 + (plant.genes.vigor[0] + plant.genes.vigor[1]) * 0.35,
    petals: 5 + plant.genes.petals[0] + plant.genes.petals[1],
    drought: plant.genes.drought[0] && plant.genes.drought[1],
  };
}

export function starterPlants(): Plant[] {
  return [
    { id: 1, name: "Field White", generation: 0, genes: { pigment: [0, 0], vigor: [0, 1], petals: [0, 1], drought: [true, false] } },
    { id: 2, name: "Rust Rose", generation: 0, genes: { pigment: [1, 1], vigor: [1, 2], petals: [1, 1], drought: [false, false] } },
    { id: 3, name: "Plum Star", generation: 0, genes: { pigment: [2, 1], vigor: [1, 1], petals: [1, 2], drought: [false, true] } },
    { id: 4, name: "Prairie Stock", generation: 0, genes: { pigment: [0, 0], vigor: [2, 2], petals: [0, 1], drought: [true, true] } },
    { id: 5, name: "Dusky Seven", generation: 0, genes: { pigment: [1, 2], vigor: [0, 2], petals: [2, 2], drought: [false, true] } },
    { id: 6, name: "Dry Rose", generation: 0, genes: { pigment: [1, 0], vigor: [1, 1], petals: [1, 0], drought: [true, true] } },
  ];
}

function inherit<T>(a: [T, T], b: [T, T], rng: () => number): [T, T] {
  return [a[Math.floor(rng() * 2)], b[Math.floor(rng() * 2)]];
}
function mutateLevel(value: Vigor, rng: () => number, rate: number): [Vigor, boolean] {
  if (rng() >= rate) return [value, false];
  const delta = rng() < 0.5 ? -1 : 1;
  return [Math.max(0, Math.min(2, value + delta)) as Vigor, true];
}
function mutatePair(pair: [Vigor, Vigor], rng: () => number, rate: number): [[Vigor, Vigor], number] {
  const a = mutateLevel(pair[0], rng, rate); const b = mutateLevel(pair[1], rng, rate);
  return [[a[0], b[0]], Number(a[1]) + Number(b[1])];
}

export function crossPlants(a: Plant, b: Plant, id: number, rng: () => number = Math.random, mutationRate = 0): Plant {
  const pigmentBase = inherit(a.genes.pigment, b.genes.pigment, rng);
  const vigorBase = inherit(a.genes.vigor, b.genes.vigor, rng);
  const petalsBase = inherit(a.genes.petals, b.genes.petals, rng);
  const drought = inherit(a.genes.drought, b.genes.drought, rng);
  const pigment = mutatePair(pigmentBase, rng, mutationRate);
  const vigor = mutatePair(vigorBase, rng, mutationRate);
  const petals = mutatePair(petalsBase, rng, mutationRate);
  let droughtMutations = 0;
  for (let i = 0; i < 2; i++) if (rng() < mutationRate) { drought[i] = !drought[i]; droughtMutations++; }
  return {
    id, name: `Cross ${id}`, generation: Math.max(a.generation, b.generation) + 1,
    parents: [a.id, b.id], mutations: pigment[1] + vigor[1] + petals[1] + droughtMutations,
    genes: { pigment: pigment[0] as [Pigment, Pigment], vigor: vigor[0], petals: petals[0], drought },
  };
}

export function genotypeLabel(plant: Plant): string {
  const p = plant.genes.pigment.join("");
  const v = plant.genes.vigor.join("");
  const petals = plant.genes.petals.join("");
  const drought = plant.genes.drought.map((x) => x ? "D" : "d").join("");
  return `P:${p} · H:${v} · N:${petals} · ${drought}`;
}

export function matchingContracts(plant: Plant): string[] {
  const p = phenotype(plant);
  return CONTRACTS.filter((c) => c.matches(p)).map((c) => c.id);
}
