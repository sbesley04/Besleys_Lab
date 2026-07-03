"use client";

import { useEffect, useReducer, useRef } from "react";
import styles from "./snake.module.css";
import SaveSlot from "../_components/SaveSlot";
import { reducer, createInitialState, COLS, ROWS, type Dir, type GameState } from "./engine";

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
      if (key === headKey) cls += ` ${styles.head}`;
      else if (bodyKeys.has(key)) cls += ` ${styles.body}`;
      else if (key === foodKey) cls += ` ${styles.food}`;
      cells.push(<div key={key} className={cls} />);
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
