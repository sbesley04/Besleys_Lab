import { shuffle, type Card } from "../solitaire/engine.ts";

export type ScoundrelStatus = "playing" | "won" | "lost";
export type ScoundrelDifficulty = "apprentice" | "scoundrel" | "damned";
export type CombatChoice = "weapon" | "bare";

export interface DifficultyRules {
  label: string;
  maxHealth: number;
  tonicCap: number;
  monsterBonus: number;
  scoreMultiplier: number;
}

export const DIFFICULTIES: Record<ScoundrelDifficulty, DifficultyRules> = {
  apprentice: { label: "Apprentice", maxHealth: 24, tonicCap: 10, monsterBonus: 0, scoreMultiplier: 0.75 },
  scoundrel: { label: "Scoundrel", maxHealth: 20, tonicCap: 7, monsterBonus: 1, scoreMultiplier: 1 },
  damned: { label: "The Damned", maxHealth: 16, tonicCap: 5, monsterBonus: 2, scoreMultiplier: 1.5 },
};

export interface ScoundrelState {
  deck: Card[];
  room: Card[];
  health: number;
  weapon: number;
  cleared: number;
  fledLastRoom: boolean;
  tonicUsedThisRoom: boolean;
  roomsEntered: number;
  damageTaken: number;
  monstersDefeated: number;
  difficulty: ScoundrelDifficulty;
  status: ScoundrelStatus;
}

export function cardPower(card: Card): number {
  return card.rank === 1 ? 14 : card.rank;
}

export function cardKind(card: Card): "monster" | "weapon" | "tonic" {
  if (card.suit === 0 || card.suit === 3) return "monster";
  return card.suit === 2 ? "weapon" : "tonic";
}

export function makeDungeon(rng: () => number = Math.random): Card[] {
  const cards: Card[] = [];
  let id = 1;
  for (let suit = 0; suit < 4; suit++) {
    const max = suit === 1 || suit === 2 ? 10 : 13;
    const min = suit === 1 || suit === 2 ? 2 : 1;
    for (let rank = min; rank <= max; rank++) cards.push({ id: id++, suit, rank, faceUp: true });
  }
  return shuffle(cards, rng);
}

function refill(state: ScoundrelState, countRoom = true): ScoundrelState {
  const deck = state.deck.slice();
  const room = state.room.slice();
  while (room.length < 4 && deck.length > 0) room.push(deck.shift()!);
  const status = room.length === 0 && deck.length === 0 ? "won" : state.status;
  return {
    ...state, deck, room, status,
    tonicUsedThisRoom: countRoom ? false : state.tonicUsedThisRoom,
    roomsEntered: countRoom && room.length > 0 ? state.roomsEntered + 1 : state.roomsEntered,
  };
}

export function createScoundrel(
  rng: () => number = Math.random,
  difficulty: ScoundrelDifficulty = "scoundrel",
): ScoundrelState {
  const rules = DIFFICULTIES[difficulty];
  return refill({
    deck: makeDungeon(rng), room: [], health: rules.maxHealth, weapon: 0,
    cleared: 0, fledLastRoom: false, tonicUsedThisRoom: false,
    roomsEntered: 0, damageTaken: 0, monstersDefeated: 0,
    difficulty, status: "playing",
  });
}

export function resolveCard(
  state: ScoundrelState,
  cardId: number,
  combat: CombatChoice = "weapon",
): ScoundrelState {
  if (state.status !== "playing") return state;
  const card = state.room.find((c) => c.id === cardId);
  if (!card) return state;
  const kind = cardKind(card);
  if (kind === "tonic" && state.tonicUsedThisRoom) return state;

  const rules = DIFFICULTIES[state.difficulty];
  const power = cardPower(card);
  let health = state.health;
  let weapon = state.weapon;
  let damage = 0;
  if (kind === "monster") {
    const monster = power + rules.monsterBonus;
    damage = combat === "weapon" ? Math.max(0, monster - weapon) : monster;
    health -= damage;
    if (combat === "weapon" && weapon > 0) weapon = Math.max(0, weapon - Math.ceil(monster / 3));
  } else if (kind === "weapon") {
    weapon = power;
  } else {
    health = Math.min(rules.maxHealth, health + Math.min(power, rules.tonicCap));
  }

  const next: ScoundrelState = {
    ...state, health, weapon,
    room: state.room.filter((c) => c.id !== cardId),
    cleared: state.cleared + 1,
    fledLastRoom: false,
    tonicUsedThisRoom: state.tonicUsedThisRoom || kind === "tonic",
    damageTaken: state.damageTaken + damage,
    monstersDefeated: state.monstersDefeated + (kind === "monster" ? 1 : 0),
    status: health <= 0 ? "lost" : state.status,
  };
  if (next.status !== "playing") return next;
  return next.room.length <= 1 ? refill(next) : next;
}

export function fleeRoom(state: ScoundrelState): ScoundrelState {
  if (state.status !== "playing" || state.fledLastRoom || state.room.length < 4) return state;
  return refill({ ...state, deck: [...state.deck, ...state.room], room: [], fledLastRoom: true });
}

export function scoundrelScore(state: ScoundrelState): number {
  const base = state.cleared * 4 + Math.max(0, state.health) * 12 + state.weapon * 3 - state.damageTaken;
  return Math.max(0, Math.round(base * DIFFICULTIES[state.difficulty].scoreMultiplier));
}
