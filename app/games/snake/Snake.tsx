"use client";

import { useEffect, useReducer, useRef } from "react";
import styles from "./snake.module.css";
import SaveSlot from "../_components/SaveSlot";
import { unlock, recordPlayed, recordWin } from "@/lib/arcade";
import { bloop } from "@/lib/sound";
import { summonZote } from "@/app/_components/eggs/ZoteHeckler";
import { reducer, createInitialState, COLS, ROWS, FISH_SCORE, type Dir, type GameState } from "./engine";

// Snake rendered as a CSS grid. Logic lives in engine.ts; this component owns
// the tick loop, keyboard input, and painting.

const BASE_SPEED = 130; // ms per step; eases down as the score climbs
const KEY_DIR: Record<string, Dir> = {
  ArrowUp: "up",
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right",
  w: "up",
  s: "down",
  a: "left",
  d: "right",
};

export default function Snake() {
  const [state, dispatch] = useReducer(reducer, undefined, createInitialState);
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => recordPlayed("snake"), []);

  // Progression + cameo hooks, driven by state transitions.
  const prevScore = useRef(state.score);
  const prevStatus = useRef(state.status);
  useEffect(() => {
    if (state.score === prevScore.current + FISH_SCORE) bloop(); // that was no dot
    prevScore.current = state.score;

    if (state.snake.length >= Math.floor((COLS * ROWS) / 4)) unlock("snk-ouroboros");
    if (state.score >= 10) recordWin("snake");

    if (state.status === "over" && prevStatus.current !== "over" && state.score <= 2) {
      summonZote("score");
    }
    prevStatus.current = state.status;
  }, [state]);

  // Tick loop — speed scales gently with score, re-armed when either changes.
  const speed = Math.max(70, BASE_SPEED - state.score * 3);
  useEffect(() => {
    if (state.status !== "running") return;
    const id = setInterval(() => dispatch({ type: "TICK" }), speed);
    return () => clearInterval(id);
  }, [state.status, speed]);

  // Keyboard controls.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      if (target?.closest("input, select, textarea, [contenteditable='true']")) return;
      const status = stateRef.current.status;
      if (e.key === "Enter" && (status === "idle" || status === "over")) {
        dispatch({ type: "START" });
        return;
      }
      if (e.key === "p" || e.key === "P") {
        dispatch({ type: "TOGGLE_PAUSE" });
        return;
      }
      const dir = KEY_DIR[e.key] ?? KEY_DIR[e.key.toLowerCase()];
      if (dir) {
        e.preventDefault();
        dispatch({ type: "TURN", dir });
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Build a lookup for fast per-cell classification.
  const headKey = `${state.snake[0].x},${state.snake[0].y}`;
  const bodyKeys = new Set(state.snake.slice(1).map((p) => `${p.x},${p.y}`));
  const foodKey = `${state.food.x},${state.food.y}`;
  // Habitats step forward with the score, so the board gains a little sense of
  // journey without changing the game rules or distracting from the cells.
  const habitatStage = Math.min(3, Math.floor(state.score / 5));

  const cells = [];
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      const key = `${x},${y}`;
      let cls = styles.cell;
      const isFish = key === foodKey && state.foodKind === "fish";
      if (key === headKey) cls += ` ${styles.head}`;
      else if (bodyKeys.has(key)) cls += ` ${styles.body}`;
      else if (key === foodKey && !isFish) cls += ` ${styles.food}`;
      cells.push(
        <div key={key} className={cls}>
          {isFish ? <Bladderfish /> : null}
        </div>,
      );
    }
  }

  return (
    <div className={styles.layout}>
      <div className={styles.boardWrap}>
        <div
          className={styles.board}
          role="img"
          aria-label={`Snake board. Score ${state.score}. Snake length ${state.snake.length}. ${state.status}.`}
          data-habitat-stage={habitatStage}
          // Purely presentational: the Grid skin aims the head's leading edge
          // off this. The committed dir (not pendingDir) is the one the head
          // actually travelled this tick.
          data-dir={state.dir}
        >
          {cells}
        </div>

        {state.status !== "running" && (
          <div className={styles.overlay}>
            <div className={styles.overlayInner}>
              <h2>{state.status === "over" ? "Game over" : state.status === "paused" ? "Paused" : "Snake"}</h2>
              {state.status === "paused" ? (
                <button type="button" className={styles.button} onClick={() => dispatch({ type: "TOGGLE_PAUSE" })}>
                  Resume
                </button>
              ) : (
                <button type="button" className={styles.button} onClick={() => dispatch({ type: "START" })}>
                  {state.status === "over" ? "Play again" : "Start"}
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      <aside className={styles.sidebar}>
        <div className={styles.panel}>
          <h3>Score</h3>
          <div className={styles.stat}>{state.score}</div>
        </div>
        <div className={styles.touchControls} aria-label="Snake controls">
          <button type="button" onClick={() => dispatch({ type: "TURN", dir: "up" })} aria-label="Steer up">↑</button>
          <button type="button" onClick={() => dispatch({ type: "TURN", dir: "left" })} aria-label="Steer left">←</button>
          <button type="button" onClick={() => dispatch({ type: "TURN", dir: "down" })} aria-label="Steer down">↓</button>
          <button type="button" onClick={() => dispatch({ type: "TURN", dir: "right" })} aria-label="Steer right">→</button>
          <button type="button" className={styles.pauseControl} onClick={() => dispatch({ type: "TOGGLE_PAUSE" })} disabled={state.status === "idle" || state.status === "over"}>
            {state.status === "paused" ? "Resume" : "Pause"}
          </button>
        </div>
        <p className={styles.help}>Arrows or WASD steer · P pauses · Enter starts</p>
        <SaveSlot<GameState>
          game="snake"
          getState={() => stateRef.current}
          onLoad={(s) => dispatch({ type: "LOAD", state: s })}
          validate={(s): s is GameState =>
            !!s && typeof s === "object" && Array.isArray((s as GameState).snake) && "food" in s
          }
        />
      </aside>
    </div>
  );
}

// A rare visitor from a wetter biome. Worth five — it knows what it's worth.
function Bladderfish() {
  return (
    <svg viewBox="0 0 20 20" width="100%" height="100%" aria-label="Bladderfish" style={{ display: "block" }}>
      <ellipse cx="9" cy="10" rx="6.5" ry="5.5" fill="var(--fish-fill)" stroke="var(--fish-line)" strokeWidth="1" />
      <ellipse cx="9" cy="8.2" rx="3.4" ry="2.2" fill="rgba(255,255,255,0.5)" />
      <path d="M15 10 L19 7 L19 13 Z" fill="var(--fish-line)" />
      <circle cx="6.4" cy="9.4" r="1.1" fill="var(--fish-eye)" />
      <path d="M9 4.6 Q9.6 2.8 11 2.4" fill="none" stroke="var(--fish-line)" strokeWidth="1" strokeLinecap="round" />
    </svg>
  );
}
