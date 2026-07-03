"use client";

import { useEffect, useReducer, useRef } from "react";
import styles from "./life.module.css";
import SaveSlot from "../_components/SaveSlot";
import { reducer, createInitialState, COLS, ROWS, type GameState } from "./engine";

// Conway's Game of Life. A drawable grid plus play/step/clear/randomize. The
// generation loop is a single interval that dispatches STEP while running.

const STEP_MS = 110;

export default function Life() {
  const [state, dispatch] = useReducer(reducer, undefined, createInitialState);
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    if (!state.running) return;
    const id = setInterval(() => dispatch({ type: "STEP" }), STEP_MS);
    return () => clearInterval(id);
  }, [state.running]);

  const liveCount = state.grid.reduce((n, alive) => n + (alive ? 1 : 0), 0);

  return (
    <div className={styles.layout}>
      <div className={styles.boardWrap}>
        <div
          className={styles.board}
          role="grid"
          aria-label="Game of Life grid"
          style={{ ["--cell" as string]: "18px" }}
        >
          {state.grid.map((alive, i) => (
            <button
              key={i}
              type="button"
              aria-label={`cell ${i}`}
              className={`${styles.cell} ${alive ? styles.alive : ""}`}
              onClick={() => dispatch({ type: "TOGGLE", index: i })}
              tabIndex={-1}
            />
          ))}
        </div>
      </div>

      <div className={styles.controls}>
        {state.running ? (
          <button className={styles.button} onClick={() => dispatch({ type: "PAUSE" })}>
            Pause
          </button>
        ) : (
          <button className={styles.button} onClick={() => dispatch({ type: "PLAY" })}>
            Play
          </button>
        )}
        <button className={`${styles.button} ${styles.ghost}`} onClick={() => dispatch({ type: "STEP" })}>
          Step
        </button>
        <button className={`${styles.button} ${styles.ghost}`} onClick={() => dispatch({ type: "RANDOMIZE" })}>
          Randomize
        </button>
        <button className={`${styles.button} ${styles.ghost}`} onClick={() => dispatch({ type: "CLEAR" })}>
          Clear
        </button>
        <span className={styles.stat}>
          gen {state.generation} · {liveCount} alive
        </span>
      </div>

      <p className={styles.help}>
        Click cells to draw a pattern (while paused), then press Play. {COLS}×{ROWS} grid; cells off
        the edge count as dead.
      </p>

      <SaveSlot<GameState>
        game="life"
        getState={() => stateRef.current}
        onLoad={(s) => dispatch({ type: "LOAD", state: s })}
        validate={(s): s is GameState =>
          !!s && typeof s === "object" && Array.isArray((s as GameState).grid) &&
          (s as GameState).grid.length === COLS * ROWS
        }
      />
    </div>
  );
}
