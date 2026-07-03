"use client";

import { useEffect, useReducer, useRef } from "react";
import styles from "./tetris.module.css";
import SaveSlot from "../_components/SaveSlot";
import {
  reducer,
  createInitialState,
  renderBoard,
  gravityIntervalMs,
  cellsFor,
  type Cell,
  type GameState,
  type TetrominoKey,
} from "./engine";

// Tetris rendered with a CSS grid (no canvas, no engine). React holds only the
// view; all rules live in engine.ts. The game loop is a single interval that
// dispatches TICK at a level-dependent cadence.

const PIECE_CLASS: Record<TetrominoKey, string> = {
  I: styles.I,
  O: styles.O,
  T: styles.T,
  S: styles.S,
  Z: styles.Z,
  J: styles.J,
  L: styles.L,
};

export default function Tetris() {
  const [state, dispatch] = useReducer(reducer, undefined, createInitialState);
  const stateRef = useRef(state);
  stateRef.current = state;

  // --- Gravity loop: re-armed whenever level or status changes. ---
  useEffect(() => {
    if (state.status !== "running") return;
    const id = setInterval(() => dispatch({ type: "TICK" }), gravityIntervalMs(state.level));
    return () => clearInterval(id);
  }, [state.status, state.level]);

  // --- Keyboard controls. ---
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
      if (status !== "running") return;

      switch (e.key) {
        case "ArrowLeft":
          e.preventDefault();
          dispatch({ type: "MOVE", dir: -1 });
          break;
        case "ArrowRight":
          e.preventDefault();
          dispatch({ type: "MOVE", dir: 1 });
          break;
        case "ArrowDown":
          e.preventDefault();
          dispatch({ type: "SOFT_DROP" });
          break;
        case "ArrowUp":
          e.preventDefault();
          dispatch({ type: "ROTATE" });
          break;
        case " ":
          e.preventDefault();
          dispatch({ type: "HARD_DROP" });
          break;
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const view = renderBoard(state);

  return (
    <div className={styles.layout}>
      <div className={styles.boardWrap}>
        <div
          className={styles.board}
          role="grid"
          aria-label="Tetris board"
          style={{ ["--cell" as string]: "26px" }}
        >
          {view.flatMap((row, r) =>
            row.map((cell, c) => (
              <div
                key={`${r}-${c}`}
                className={`${styles.cell} ${cell ? `${styles.filled} ${PIECE_CLASS[cell]}` : ""}`}
              />
            )),
          )}
        </div>

        {state.status !== "running" && (
          <div className={styles.overlay}>
            <div className={styles.overlayInner}>
              <h2>
                {state.status === "over"
                  ? "Game over"
                  : state.status === "paused"
                    ? "Paused"
                    : "Tetris"}
              </h2>
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
        <div className={styles.panel}>
          <h3>Lines / Level</h3>
          <div className={styles.stat}>
            {state.lines} / {state.level}
          </div>
        </div>
        <div className={styles.panel}>
          <h3>Next</h3>
          <NextPreview piece={state.next} />
        </div>
        <p className={styles.help}>
          ← → move · ↑ rotate · ↓ soft drop · space hard drop · P pause
        </p>
        <SaveSlot<GameState>
          game="tetris"
          getState={() => stateRef.current}
          onLoad={(s) => dispatch({ type: "LOAD", state: s })}
          validate={(s): s is GameState =>
            !!s && typeof s === "object" && Array.isArray((s as GameState).board) && "score" in s
          }
        />
      </aside>
    </div>
  );
}

// Mini 4×4 preview of the upcoming piece.
function NextPreview({ piece }: { piece: TetrominoKey }) {
  const cells = cellsFor({ key: piece, rotation: 0, row: 0, col: 0 });
  const filled = new Set(cells.map(([r, c]) => `${r}-${c}`));
  const grid: Cell[] = [];
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 4; c++) {
      grid.push(filled.has(`${r}-${c}`) ? piece : null);
    }
  }
  return (
    <div className={styles.nextGrid}>
      {grid.map((cell, i) => (
        <div
          key={i}
          className={`${styles.nextCell} ${cell ? `${styles.filled} ${PIECE_CLASS[cell]}` : ""}`}
        />
      ))}
    </div>
  );
}
