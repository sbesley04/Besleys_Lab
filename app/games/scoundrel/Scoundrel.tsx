"use client";

import { useEffect, useRef, useState } from "react";
import styles from "../_components/newGame.module.css";
import SaveSlot from "../_components/SaveSlot";
import { postResult, recordPlayed, recordWin, unlock } from "@/lib/arcade";
import { summonZote } from "@/app/_components/eggs/ZoteHeckler";
import { RANK_GLYPHS, SUIT_GLYPHS, isRed, type Card } from "../solitaire/engine";
import {
  DIFFICULTIES, cardKind, cardPower, createScoundrel, fleeRoom, resolveCard, scoundrelScore, tonicHeal,
  type CombatChoice, type ScoundrelDifficulty, type ScoundrelState,
} from "./engine";

const SUIT_NAMES = ["spades", "hearts", "diamonds", "clubs"];
const KIND_ICON = { monster: "☠", weapon: "⚔", tonic: "✚" } as const;

function fixedRng() {
  let s = 0x5c0d;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32);
}

const shortName = (card: Card) => `${RANK_GLYPHS[card.rank]}${SUIT_GLYPHS[card.suit]}`;

/** One line of feedback for the move just made — the dungeon otherwise gives
 *  no sign of what a click actually cost. */
function describe(before: ScoundrelState, after: ScoundrelState, card: Card, choice: CombatChoice): string {
  const kind = cardKind(card);
  if (kind === "weapon") return `Equipped the ${shortName(card)} — durability ${after.weapon}.`;
  if (kind === "tonic") {
    const healed = after.health - before.health;
    return healed > 0
      ? `Drank the ${shortName(card)}: +${healed} health.`
      : `Discarded the ${shortName(card)} — ${before.tonicUsedThisRoom ? "this room’s tonic is already spent" : "health was already full"}.`;
  }
  const lost = before.health - after.health;
  const how = choice === "weapon" ? "with your weapon" : "bare-handed";
  const worn = choice === "weapon" && before.weapon > 0 ? ` Weapon ${before.weapon} → ${after.weapon}.` : "";
  return `Fought the ${shortName(card)} ${how}: ${lost > 0 ? `−${lost} health` : "no damage"}.${worn}`;
}

export default function Scoundrel() {
  const [state, setState] = useState<ScoundrelState>(() => createScoundrel(fixedRng()));
  const [difficulty, setDifficulty] = useState<ScoundrelDifficulty>("scoundrel");
  const [log, setLog] = useState<string | null>(null);
  const stateRef = useRef(state);
  const reported = useRef(false);
  stateRef.current = state;
  const rules = DIFFICULTIES[state.difficulty];

  useEffect(() => { recordPlayed("scoundrel"); setState(createScoundrel()); }, []);
  useEffect(() => {
    if (state.status === "playing" || reported.current) return;
    reported.current = true;
    if (state.status === "won") {
      recordWin("scoundrel"); unlock("scd-escape");
      if (state.difficulty === "damned") unlock("scd-damned");
      postResult({ game: "scoundrel", event: "win", mode: state.difficulty, score: scoundrelScore(state), moves: state.cleared, meta: { damage: state.damageTaken, rooms: state.roomsEntered } });
    } else if (state.roomsEntered <= 3) {
      summonZote("general"); // dying in the first few rooms is exactly his business
    }
  }, [state]);

  function restart(nextDifficulty = difficulty) {
    reported.current = false; setDifficulty(nextDifficulty); setLog(null); setState(createScoundrel(Math.random, nextDifficulty));
  }

  function resolve(card: Card, choice: CombatChoice) {
    const next = resolveCard(state, card.id, choice);
    if (next === state) return;
    setLog(describe(state, next, card, choice));
    setState(next);
  }

  function flee() {
    const next = fleeRoom(state);
    if (next === state) return;
    setLog("You slipped out — those four cards wait at the bottom of the dungeon.");
    setState(next);
  }

  const remaining = state.deck.length + state.room.length;

  return (
    <div className={styles.stack}>
      <div className={styles.spread}>
        <p className={styles.help}>Preserve strong weapons by fighting weak monsters bare-handed. Only the first heart tonic in each room heals; any other is discarded.</p>
        <div className={styles.row}>
          <label className={styles.control}>Difficulty<select className={styles.select} value={difficulty} onChange={(e) => restart(e.target.value as ScoundrelDifficulty)}>{(Object.keys(DIFFICULTIES) as ScoundrelDifficulty[]).map((key) => <option value={key} key={key}>{DIFFICULTIES[key].label}</option>)}</select></label>
          <button className={styles.button} onClick={() => restart()}>↻ New dungeon</button>
        </div>
      </div>
      {state.status !== "playing" ? (
        <div className={styles.banner} role={state.status === "lost" ? "alert" : "status"}>
          <h2>{state.status === "won" ? "You escaped the dungeon." : "The dungeon claimed another scoundrel."}</h2>
          <p className={styles.help}>Score {scoundrelScore(state)} · {state.monstersDefeated} monsters · {state.damageTaken} damage · {state.status === "won" ? `${state.roomsEntered} rooms` : `fell in room ${state.roomsEntered} with ${remaining} cards left`}.</p>
          <button className={`${styles.button} ${styles.primary}`} style={{ marginTop: "0.6rem" }} onClick={() => restart()}>Descend again</button>
        </div>
      ) : null}
      <div className={styles.layout}>
        <section className={styles.dungeon} aria-label={`Dungeon room ${state.roomsEntered}`}>
          <div className={styles.room}>
            {state.room.map((card) => <DungeonCard key={card.id} card={card} weapon={state.weapon} heal={tonicHeal(state, card)} tonicSpent={state.tonicUsedThisRoom} inactive={state.status !== "playing"} monsterBonus={rules.monsterBonus} onResolve={(choice) => resolve(card, choice)} />)}
          </div>
          <p className={styles.dungeonLog} role="status" aria-live="polite">{log ?? "A new room. Face the cards in any order — when one is left, the next room deals in around it."}</p>
        </section>
        <aside className={styles.sidebar}>
          <div className={styles.panel}><p className={styles.kicker}>Health · {rules.label}</p><p className={styles.stat}>{Math.max(0, state.health)} / {rules.maxHealth}</p><div className={styles.meter} role="progressbar" aria-label="Health" aria-valuemin={0} aria-valuemax={rules.maxHealth} aria-valuenow={Math.max(0, state.health)}><span style={{ width: `${Math.max(0, state.health / rules.maxHealth) * 100}%` }} /></div></div>
          <div className={styles.panel}><p className={styles.kicker}>Weapon durability</p><p className={styles.stat}>{state.weapon || "Bare hands"}</p><p className={styles.help}>Armed fights reduce durability by one-third of the monster’s strength.</p></div>
          <div className={styles.panel}><p className={styles.kicker}>Depth</p><p className={styles.stat}>Room {state.roomsEntered}</p><p className={styles.help}>{remaining} cards remain · tonic {state.tonicUsedThisRoom ? "spent" : "ready"}</p></div>
          <button className={styles.button} disabled={state.fledLastRoom || state.room.length < 4 || state.status !== "playing"} onClick={flee}>Run from this room</button>
          <p className={styles.help}>{state.fledLastRoom ? "You must clear a card before fleeing again." : state.room.length < 4 ? "You can only flee a room you haven’t touched yet." : "Fleeing sends all four cards to the bottom of the dungeon."}</p>
          <SaveSlot<ScoundrelState> game="scoundrel" getState={() => stateRef.current} onLoad={(s) => { reported.current = s.status !== "playing"; setDifficulty(s.difficulty); setLog(null); setState(s); }} validate={isScoundrelState} />
        </aside>
      </div>
    </div>
  );
}

function DungeonCard({ card, weapon, heal, tonicSpent, inactive, monsterBonus, onResolve }: { card: Card; weapon: number; heal: number; tonicSpent: boolean; inactive: boolean; monsterBonus: number; onResolve: (choice: CombatChoice) => void }) {
  const kind = cardKind(card);
  const power = cardPower(card);
  const strength = kind === "monster" ? power + monsterBonus : power;
  const cardName = `${RANK_GLYPHS[card.rank]} of ${SUIT_NAMES[card.suit]}`;
  const face = (
    <>
      <span className={styles.cardCorner}><span>{RANK_GLYPHS[card.rank]}</span><span>{SUIT_GLYPHS[card.suit]}</span></span>
      <span className={styles.cardCenter}>
        <span className={styles.cardIcon} aria-hidden>{KIND_ICON[kind]}</span>
        <span className={styles.cardValue}>{strength}</span>
        <span className={styles.cardKind}>{kind}</span>
      </span>
    </>
  );
  if (kind !== "monster") {
    const discard = kind === "tonic" && heal === 0;
    const note = kind === "weapon" ? "Equip weapon" : discard ? (tonicSpent ? "Discard · tonic spent" : "Discard · health full") : `Restore ${heal} health`;
    return (
      <div className={styles.cardSlot}>
        <button className={`${styles.playingCard} ${isRed(card) ? styles.cardRed : ""} ${discard ? styles.cardSpent : ""}`} disabled={inactive} onClick={() => onResolve("weapon")} aria-label={`${cardName}, ${kind} ${power}. ${note}.`}>{face}</button>
        <small className={styles.cardNote}>{note}</small>
      </div>
    );
  }
  return (
    <div className={styles.cardSlot}>
      <div className={styles.playingCard} role="img" aria-label={`${cardName}, monster strength ${strength}`}>{face}</div>
      <div className={styles.cardActions}>
        <button className={styles.smallButton} onClick={() => onResolve("weapon")} disabled={inactive || weapon <= 0} aria-label={`Fight ${cardName} with weapon; take ${Math.max(0, strength - weapon)} damage`}>Weapon · {Math.max(0, strength - weapon)} dmg</button>
        <button className={styles.smallButton} onClick={() => onResolve("bare")} disabled={inactive} aria-label={`Fight ${cardName} bare-handed; take ${strength} damage`}>Bare · {strength} dmg</button>
      </div>
    </div>
  );
}

function isScoundrelState(v: unknown): v is ScoundrelState {
  const s = v as ScoundrelState;
  return !!s && typeof s === "object" && Array.isArray(s.deck) && Array.isArray(s.room) && typeof s.health === "number" && s.difficulty in DIFFICULTIES && typeof s.tonicUsedThisRoom === "boolean";
}
