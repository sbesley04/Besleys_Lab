"use client";

import { useEffect, useRef, useState } from "react";
import styles from "../_components/newGame.module.css";
import SaveSlot from "../_components/SaveSlot";
import { postResult, recordPlayed, recordWin, unlock } from "@/lib/arcade";
import { RANK_GLYPHS, SUIT_GLYPHS, isRed, type Card } from "../solitaire/engine";
import {
  DIFFICULTIES, cardKind, cardPower, createScoundrel, fleeRoom, resolveCard, scoundrelScore,
  type CombatChoice, type ScoundrelDifficulty, type ScoundrelState,
} from "./engine";

const SUIT_NAMES = ["spades", "hearts", "diamonds", "clubs"];

function fixedRng() {
  let s = 0x5c0d;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32);
}

export default function Scoundrel() {
  const [state, setState] = useState<ScoundrelState>(() => createScoundrel(fixedRng()));
  const [difficulty, setDifficulty] = useState<ScoundrelDifficulty>("scoundrel");
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
    }
  }, [state]);

  function restart(nextDifficulty = difficulty) {
    reported.current = false; setDifficulty(nextDifficulty); setState(createScoundrel(Math.random, nextDifficulty));
  }

  return (
    <div className={styles.stack}>
      <div className={styles.spread}>
        <p className={styles.help}>Preserve strong weapons by fighting weak monsters bare-handed. Only one heart tonic works in each room.</p>
        <div className={styles.row}>
          <label className={styles.control}>Difficulty<select className={styles.select} value={difficulty} onChange={(e) => restart(e.target.value as ScoundrelDifficulty)}>{(Object.keys(DIFFICULTIES) as ScoundrelDifficulty[]).map((key) => <option value={key} key={key}>{DIFFICULTIES[key].label}</option>)}</select></label>
          <button className={styles.button} onClick={() => restart()}>↻ New dungeon</button>
        </div>
      </div>
      {state.status !== "playing" ? <div className={styles.banner} role={state.status === "lost" ? "alert" : "status"}><h2>{state.status === "won" ? "You escaped the dungeon." : "The dungeon claimed another scoundrel."}</h2><p className={styles.help}>Score {scoundrelScore(state)} · {state.monstersDefeated} monsters · {state.damageTaken} damage.</p></div> : null}
      <div className={styles.layout}>
        <section className={styles.dungeon} aria-label={`Dungeon room ${state.roomsEntered}`}>
          <div className={styles.room}>
            {state.room.map((card) => <DungeonCard key={card.id} card={card} weapon={state.weapon} tonicBlocked={state.tonicUsedThisRoom} healthFull={state.health >= rules.maxHealth} inactive={state.status !== "playing"} monsterBonus={rules.monsterBonus} onResolve={(choice) => setState((s) => resolveCard(s, card.id, choice))} />)}
          </div>
        </section>
        <aside className={styles.sidebar}>
          <div className={styles.panel}><p className={styles.kicker}>Health · {rules.label}</p><p className={styles.stat}>{Math.max(0, state.health)} / {rules.maxHealth}</p><div className={styles.meter} role="progressbar" aria-label="Health" aria-valuemin={0} aria-valuemax={rules.maxHealth} aria-valuenow={Math.max(0, state.health)}><span style={{ width: `${Math.max(0, state.health / rules.maxHealth) * 100}%` }} /></div></div>
          <div className={styles.panel}><p className={styles.kicker}>Weapon durability</p><p className={styles.stat}>{state.weapon || "Bare hands"}</p><p className={styles.help}>Armed fights reduce durability by one-third of the monster’s strength.</p></div>
          <div className={styles.panel}><p className={styles.kicker}>Depth</p><p className={styles.stat}>Room {state.roomsEntered}</p><p className={styles.help}>{state.deck.length + state.room.length} cards remain · tonic {state.tonicUsedThisRoom ? "spent" : "ready"}</p></div>
          <button className={styles.button} disabled={state.fledLastRoom || state.room.length < 4 || state.status !== "playing"} onClick={() => setState((s) => fleeRoom(s))}>Run from this room</button>
          <p className={styles.help}>{state.fledLastRoom ? "You must clear a card before fleeing again." : "Fleeing sends all four cards to the bottom of the dungeon."}</p>
          <SaveSlot<ScoundrelState> game="scoundrel" getState={() => stateRef.current} onLoad={(s) => { reported.current = false; setDifficulty(s.difficulty); setState(s); }} validate={isScoundrelState} />
        </aside>
      </div>
    </div>
  );
}

function DungeonCard({ card, weapon, tonicBlocked, healthFull, inactive, monsterBonus, onResolve }: { card: Card; weapon: number; tonicBlocked: boolean; healthFull: boolean; inactive: boolean; monsterBonus: number; onResolve: (choice: CombatChoice) => void }) {
  const kind = cardKind(card);
  const power = cardPower(card);
  const blocked = kind === "tonic" && (tonicBlocked || healthFull);
  const cardName = `${RANK_GLYPHS[card.rank]} of ${SUIT_NAMES[card.suit]}`;
  const face = <><span className={styles.cardCorner}><span>{RANK_GLYPHS[card.rank]}</span><span>{SUIT_GLYPHS[card.suit]}</span></span><span className={styles.cardCenter}><span style={{ fontSize: "2rem" }}>{kind === "monster" ? "☠" : kind === "weapon" ? "⚔" : "✚"}</span><strong>{kind} · {kind === "monster" ? power + monsterBonus : power}</strong></span></>;
  if (kind !== "monster") return <div className={styles.cardSlot}><button className={`${styles.playingCard} ${isRed(card) ? styles.cardRed : ""}`} disabled={inactive || blocked} onClick={() => onResolve("weapon")} aria-label={`${cardName}, ${kind} ${power}. ${kind === "tonic" ? "Restore health" : "Equip weapon"}.`}>{face}</button><small className={styles.cardNote}>{kind === "tonic" && tonicBlocked ? "Tonic already used" : kind === "tonic" && healthFull ? "Health already full" : kind === "tonic" ? "Restore health" : "Equip weapon"}</small></div>;
  const strength = power + monsterBonus;
  return <div className={styles.cardSlot}><div className={styles.playingCard} role="img" aria-label={`${cardName}, monster strength ${strength}`}>{face}</div><div className={styles.cardActions}><button className={styles.smallButton} onClick={() => onResolve("weapon")} disabled={inactive || weapon <= 0} aria-label={`Fight ${cardName} with weapon; take ${Math.max(0, strength - weapon)} damage`}>Weapon · {Math.max(0, strength - weapon)} dmg</button><button className={styles.smallButton} onClick={() => onResolve("bare")} disabled={inactive} aria-label={`Fight ${cardName} bare-handed; take ${strength} damage`}>Bare · {strength} dmg</button></div></div>;
}

function isScoundrelState(v: unknown): v is ScoundrelState {
  const s = v as ScoundrelState;
  return !!s && typeof s === "object" && Array.isArray(s.deck) && Array.isArray(s.room) && typeof s.health === "number" && s.difficulty in DIFFICULTIES && typeof s.tonicUsedThisRoom === "boolean";
}
