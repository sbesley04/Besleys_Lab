// ---------------------------------------------------------------------------
// The prize counter — everything zinc can buy. Pure data + pure pickers, so
// the wallet engine (and its tests) can import it without React or the DOM.
//
// EXTEND HERE: append a Prize. Kinds:
//   "decor"      — one-off; appears in the game room once owned (the room
//                  looks items up by id, so add the drawing in
//                  app/games/_room/Decor.tsx too).
//   "upgrade"    — one-off; changes the economy (see rateOf / capHoursOf in
//                  lib/wallet.ts).
//   "consumable" — buy as often as you like; resolves to a random outcome.
// Never rename an id — wallets store what they own by id.
// ---------------------------------------------------------------------------

export type PrizeKind = "decor" | "upgrade" | "consumable";

export interface Prize {
  id: string;
  name: string;
  desc: string;
  price: number;
  kind: PrizeKind;
  /** Emoji stamp for the counter card. */
  icon: string;
}

export const PRIZES: Prize[] = [
  // --- consumables: the "random things" ---
  { id: "fortune-cookie", kind: "consumable", price: 10, icon: "🥠", name: "Fortune cookie", desc: "Crack one open. Advice of variable quality." },
  { id: "capsule", kind: "consumable", price: 40, icon: "🥚", name: "Capsule toy", desc: "Turn the crank, get a tiny thing. Collect all of them." },

  // --- upgrades ---
  { id: "piggy-bank", kind: "upgrade", price: 250, icon: "🐖", name: "Bigger piggy bank", desc: "Zinc keeps trickling in for 24 hours away instead of 12." },
  { id: "coin-hopper", kind: "upgrade", price: 400, icon: "⚙️", name: "Coin hopper", desc: "Passive income goes from 20 to 35 Zn an hour." },

  // --- room decor ---
  { id: "lava-lamp", kind: "decor", price: 120, icon: "🫧", name: "Lava lamp", desc: "Sits on the desk and does its slow thing." },
  { id: "neon-sign", kind: "decor", price: 180, icon: "💡", name: "Neon sign", desc: "Hangs on the back wall. Buzzes faintly." },
  { id: "rug", kind: "decor", price: 220, icon: "🟫", name: "Card-room rug", desc: "Goes under the poker table. Ties the room together." },
  { id: "disco-ball", kind: "decor", price: 450, icon: "🪩", name: "Disco ball", desc: "Hangs from the ceiling and throws light around." },
  { id: "jukebox", kind: "decor", price: 650, icon: "🎵", name: "Jukebox", desc: "Stands against the wall. Click it for a tune." },
  { id: "aquarium", kind: "decor", price: 900, icon: "🐟", name: "Aquarium", desc: "A tank with a bladderfish and a peeper in it. Nobody asked where they came from." },
  { id: "golden-fleece", kind: "decor", price: 1500, icon: "✨", name: "Golden fleece", desc: "The sheep's wool grows back gold. The sheep has no opinion about this." },
];

export const PRIZES_BY_ID = new Map(PRIZES.map((p) => [p.id, p]));
export const DECOR_IDS = PRIZES.filter((p) => p.kind === "decor").map((p) => p.id);

// --- consumable outcomes -------------------------------------------------------

export const FORTUNES = [
  "The house always wins. You are not the house.",
  "A watched loss curve never converges.",
  "You will find a bug in code you were sure was fine.",
  "Your next seed will be lucky. Probably.",
  "Water the plants on the desk. They can't do it themselves.",
  "Somewhere a sheep is thinking about you.",
  "The answer is in the validation set. Don't look.",
  "Precipitate first, ask questions later.",
  "A lake is calling. Don't answer after midnight.",
  "Save before the boss fight.",
  "Correlation is not a strategy.",
  "Three cherries are closer than they look.",
  "Past performance does not guarantee future spins.",
  "Take a break. The reels will still be here.",
];

export type Rarity = "common" | "uncommon" | "rare";

export interface Capsule {
  id: string;
  name: string;
  icon: string;
  rarity: Rarity;
}

/** Relative odds per capsule of each rarity. */
export const RARITY_WEIGHT: Record<Rarity, number> = { common: 6, uncommon: 3, rare: 1 };

export const CAPSULES: Capsule[] = [
  { id: "rubber-duck", name: "Rubber debugging duck", icon: "🦆", rarity: "common" },
  { id: "pet-rock", name: "Pet rock (named Gary)", icon: "🪨", rarity: "common" },
  { id: "d20", name: "Loaded d20", icon: "🎲", rarity: "common" },
  { id: "cheese-curd", name: "A single cheese curd", icon: "🧀", rarity: "common" },
  { id: "zinc-crystal", name: "Zinc iodide crystal", icon: "💎", rarity: "uncommon" },
  { id: "mask-shard", name: "Mask shard", icon: "🎭", rarity: "uncommon" },
  { id: "peeper", name: "Peeper (dried)", icon: "🐠", rarity: "uncommon" },
  { id: "owl-feather", name: "Owl feather", icon: "🪶", rarity: "uncommon" },
  { id: "framed-loss", name: "Framed loss curve", icon: "📉", rarity: "rare" },
  { id: "stardrop", name: "Strange purple fruit", icon: "🍇", rarity: "rare" },
];

export const CAPSULES_BY_ID = new Map(CAPSULES.map((c) => [c.id, c]));

/** Key a capsule is stored under in `wallet.owned`. */
export const capsuleKey = (id: string) => `capsule:${id}`;

export function pickFortune(rng: () => number): string {
  return FORTUNES[Math.min(FORTUNES.length - 1, Math.floor(rng() * FORTUNES.length))];
}

export function pickCapsule(rng: () => number): Capsule {
  const total = CAPSULES.reduce((sum, c) => sum + RARITY_WEIGHT[c.rarity], 0);
  let roll = rng() * total;
  for (const c of CAPSULES) {
    roll -= RARITY_WEIGHT[c.rarity];
    if (roll < 0) return c;
  }
  return CAPSULES[CAPSULES.length - 1];
}
