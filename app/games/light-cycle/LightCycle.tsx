"use client";

import { useEffect, useRef, useState } from "react";
import { useOnGrid } from "@/lib/grid";
import styles from "../_components/newGame.module.css";
import { COLS, ROWS, WINS_TO_MATCH, initialCycleState, startNextRound, tickCycle, turnCycle, type CycleDifficulty, type CycleState, type Dir } from "./engine";

const KEY_DIR: Record<string, Dir> = { ArrowUp: "up", w: "up", ArrowRight: "right", d: "right", ArrowDown: "down", s: "down", ArrowLeft: "left", a: "left" };

export default function LightCycle() {
  const onGrid = useOnGrid();
  const onGridRef = useRef(onGrid);
  const [state, setState] = useState<CycleState>(initialCycleState);
  onGridRef.current = onGrid;

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (!onGridRef.current || event.metaKey || event.ctrlKey || event.altKey || target?.isContentEditable || ["INPUT", "SELECT", "TEXTAREA"].includes(target?.tagName ?? "")) return;
      const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
      const dir = KEY_DIR[key];
      if (dir) { event.preventDefault(); setState((s) => turnCycle(s, dir)); return; }
      if (event.code === "Space" && !target?.closest("header, footer, a")) {
        if (event.repeat) return;
        event.preventDefault(); setState((s) => startNextRound(s));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  useEffect(() => {
    if (!onGrid || state.status !== "running") return;
    const speed = Math.max(state.difficulty === "expert" ? 58 : 68, (state.difficulty === "expert" ? 94 : 108) - Math.floor(state.ticks / 12) * 3);
    const id = window.setTimeout(() => setState(tickCycle), speed);
    return () => window.clearTimeout(id);
  }, [onGrid, state.status, state.ticks, state.difficulty]);

  if (!onGrid) return <div className={styles.offline}><p className={styles.kicker}>Program unavailable</p><p>LIGHT-CYCLE only executes from inside the Grid.</p></div>;

  const player = new Set(state.player.map((p) => `${p.x},${p.y}`));
  const ai = new Set(state.ai.map((p) => `${p.x},${p.y}`));
  const pHead = `${state.player[0].x},${state.player[0].y}`;
  const aHead = `${state.ai[0].x},${state.ai[0].y}`;
  const cells = [];
  for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
    const k = `${x},${y}`;
    cells.push(<span key={k} aria-hidden="true" className={[styles.cycleCell, player.has(k) ? styles.cyclePlayer : "", ai.has(k) ? styles.cycleAi : "", k === pHead || k === aHead ? styles.cycleHead : ""].join(" ")} />);
  }
  const label = state.matchWinner ? (state.matchWinner === "player" ? "MATCH WON // USER" : "MATCH LOST // HOSTILE") : state.status === "idle" ? "Awaiting rider" : state.status === "running" ? `Round ${state.round} · cycle ${state.ticks}` : state.status === "player" ? "ROUND WON" : state.status === "ai" ? "ROUND LOST" : "MUTUAL DEREZZ";
  const startLabel = state.matchWinner ? "New match [Space]" : state.status === "idle" ? "Start match [Space]" : state.status === "running" ? "Round live" : "Next round [Space]";
  return (
    <div className={styles.stack}>
      <div className={styles.cycleHud}>
        <div><p className={styles.kicker}>First to {WINS_TO_MATCH}</p><p className={styles.stat} role="status" aria-live="polite">{label}</p></div>
        <div className={styles.cycleScore}><span>USER <strong>{state.playerScore}</strong></span><span>HOSTILE <strong>{state.aiScore}</strong></span></div>
        <label className={styles.control}>Hostile intelligence<select className={styles.select} value={state.difficulty} disabled={state.status === "running"} onChange={(e) => setState(initialCycleState(e.target.value as CycleDifficulty))}><option value="standard">Standard</option><option value="expert">Expert</option></select></label>
        <button className={`${styles.button} ${styles.primary}`} disabled={state.status === "running"} aria-keyshortcuts="Space" onClick={() => setState((s) => startNextRound(s))}>{startLabel}</button>
      </div>
      <div className={styles.cycleBoard} role="img" aria-label={`Light-cycle arena. User ${state.playerScore}, hostile ${state.aiScore}. ${label}.`}>{cells}</div>
      <div className={styles.directionPad} role="group" aria-label="Touch steering">{(["up", "left", "down", "right"] as Dir[]).map((dir) => <button key={dir} className={styles.smallButton} disabled={state.status !== "running"} aria-label={`Steer ${dir}`} onClick={() => setState((s) => turnCycle(s, dir))}>{dir === "up" ? "↑" : dir === "down" ? "↓" : dir === "left" ? "←" : "→"}</button>)}</div>
      <p className={styles.help}>Arrow keys or WASD steer. Space starts every round. The arena accelerates as trails grow; Expert actively contests your territory.</p>
    </div>
  );
}
