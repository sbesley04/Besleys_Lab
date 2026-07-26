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
      const status = stateRef.current.status;
      if (e.key === "Enter" && (status === "idle" || status === "over")) {
        dispatch({ type: "START" });
        return;
      }
      if (e.key === "p" || e.key === "P") {
        dispatch({ type: "TOGGLE_PAUSE" });
        return;
      }
      const dir = KEY_DIR[e.key];
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
          role="grid"
          aria-label="Snake board"
          style={{ ["--cell" as string]: "22px" }}
        >
          {cells}
        </div>

        {state.status !== "running" && (
          <div className={styles.overlay}>
            <div className={styles.overlayInner}>
              <h2>{state.status === "over" ? "Game over" : state.status === "paused" ? "Paused" : "Snake"}</h2>
              {state.status === "paused" ? (
                <p className={styles.help}>Press P to resume.</p>
              ) : (
                <button className={styles.button} onClick={() => dispatch({ type: "START" })}>
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
        <p className={styles.help}>← ↑ ↓ → to steer · P pause · Enter start</p>
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
      <ellipse cx="9" cy="10" rx="6.5" ry="5.5" fill="rgba(238,170,185,0.85)" stroke="#b06a80" strokeWidth="1" />
      <ellipse cx="9" cy="8.2" rx="3.4" ry="2.2" fill="rgba(255,255,255,0.5)" />
      <path d="M15 10 L19 7 L19 13 Z" fill="#b06a80" />
      <circle cx="6.4" cy="9.4" r="1.1" fill="#3a2530" />
      <path d="M9 4.6 Q9.6 2.8 11 2.4" fill="none" stroke="#b06a80" strokeWidth="1" strokeLinecap="round" />
    </svg>
  );
}
