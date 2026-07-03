export const WEIGHTS = {
  fight: 0.22, kill: 0.20, survival: 0.18,
  sponsor: 0.16, advantages: 0.13, judge: 0.11,
};

export const STAT_ORDER = [
  ["fight",      "FIGHT",  10],
  ["kill",       "KILL",   10],
  ["survival",   "SURVIVE",10],
  ["sponsor",    "SPONSOR",10],
  ["advantages", "ADVANTG",10],
  ["judge",      "JUDGE",  12],
];

export const DISTRICT_COLORS = {
  1: "#b8760a",  2: "#b02820",  3: "#1870a0",  4: "#107888",
  5: "#a89010",  6: "#c06010",  7: "#3a7810",  8: "#8038b0",
  9: "#a07828", 10: "#904828", 11: "#607018", 12: "#505870",
};

export const DISTRICT_INDUSTRIES = {
  1:  "Luxury Goods",     2:  "Masonry & Weapons", 3:  "Technology",
  4:  "Fishing",          5:  "Power",              6:  "Transportation",
  7:  "Lumber",           8:  "Textiles",           9:  "Grain",
  10: "Livestock",        11: "Agriculture",        12: "Coal Mining",
};

export function computeOverall(stats) {
  return Math.round(
    Object.keys(WEIGHTS).reduce((a, k) => {
      const max = k === "judge" ? 12 : 10;
      return a + (stats[k] / max) * WEIGHTS[k];
    }, 0) * 1000
  ) / 10;
}

export function computeArchetype(stats, district) {
  const career = [1, 2, 4].includes(district);
  const { fight, kill, survival, advantages, sponsor } = stats;
  if (fight >= 7 && kill >= 7)           return ["HUNTER", "Lethal and durable. The field's nightmare."];
  if (kill >= 7 && advantages >= 9)      return ["SCHEMER",        "Kills through cunning, not force."];
  if (kill >= 7 && fight <= 4)           return ["GLASS CANNON",   "Deadly early, fragile late."];
  if (career && fight >= 5 && kill >= 5) return ["CAREER",         "Bred for the arena. Hunts from turn one."];
  if (kill <= 2 && survival >= 7)        return ["GHOST",           "Avoids every fight. Outlives the bloodshed."];
  if (fight >= 7 && survival >= 7)       return ["JUGGERNAUT",      "Durable and dangerous. Wins wars of attrition."];
  if (kill <= 2)                          return ["PACIFIST",        "Won't strike first. Survival means staying unseen."];
  if (advantages >= 9)                    return ["WILDCARD",        "An unknown edge that could swing the Games."];
  if (survival >= 7)                      return ["SURVIVOR",        "Reads the arena. Rarely overextends."];
  if (sponsor >= 9)                       return ["CROWD DARLING",   "The parachutes come when it counts."];
  return                                         ["CONTENDER",       "Balanced, unremarkable, easy to underestimate."];
}

export const DEFAULT_ROSTER = [
  { id:  1, name: "Daniela",   district:  1, stats: { judge:  6, sponsor:  6, advantages:  7, kill:  9, fight:  4, survival:  3 } },
  { id:  2, name: "Kushal",    district:  1, stats: { judge:  7, sponsor: 10, advantages:  4, kill:  2, fight:  6, survival:  4 } },
  { id:  3, name: "Kailash",   district:  2, stats: { judge: 11, sponsor:  9, advantages:  6, kill:  9, fight:  9, survival:  9 } },
  { id:  4, name: "Bella",     district:  3, stats: { judge:  5, sponsor:  4, advantages:  3, kill:  5, fight:  4, survival:  3 } },
  { id:  5, name: "Sahana",    district:  3, stats: { judge:  4, sponsor:  4, advantages:  7, kill: 10, fight:  3, survival:  2 } },
  { id:  6, name: "Connor",    district:  4, stats: { judge:  6, sponsor: 10, advantages:  8, kill:  6, fight:  7, survival: 10 } },
  { id:  7, name: "Hanna",     district:  5, stats: { judge:  5, sponsor:  4, advantages:  6, kill:  7, fight:  7, survival:  6 } },
  { id:  8, name: "Virat",     district:  6, stats: { judge:  8, sponsor:  2, advantages:  9, kill:  7, fight:  6, survival:  4 } },
  { id:  9, name: "Ananya",    district:  7, stats: { judge:  6, sponsor:  3, advantages:  7, kill:  7, fight:  5, survival:  6 } },
  { id: 10, name: "Sasha",     district:  8, stats: { judge:  7, sponsor:  7, advantages:  4, kill:  4, fight:  6, survival:  6 } },
  { id: 11, name: "Meadow",    district:  9, stats: { judge:  8, sponsor:  3, advantages:  2, kill:  3, fight:  6, survival:  7 } },
  { id: 12, name: "Aanya",     district:  9, stats: { judge:  7, sponsor:  9, advantages:  6, kill:  2, fight:  7, survival:  7 } },
  { id: 13, name: "Sam",       district: 10, stats: { judge: 10, sponsor:  6, advantages:  6, kill:  8, fight:  9, survival: 10 } },
  { id: 14, name: "Michelina", district: 11, stats: { judge:  8, sponsor:  8, advantages:  7, kill:  1, fight:  8, survival: 10 } },
  { id: 15, name: "Zoe",       district: 12, stats: { judge:  6, sponsor:  1, advantages:  9, kill: 10, fight:  6, survival:  5 } },
];
