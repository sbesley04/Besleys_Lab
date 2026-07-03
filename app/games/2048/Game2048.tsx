"use client";

import { useEffect, useReducer, useRef } from "react";
import styles from "./game2048.module.css";
import SaveSlot from "../_components/SaveSlot";
import { reducer, SIZE, type Dir, type GameState } from "./engine";

// 2048 rendered as a CSS grid of tiles. Logic lives in engine.ts. No game loop
// here — it's turn-based, advancing only on arrow-key input.

const KEY_DIR: Record<string, Dir> = {
  ArrowLeft: "left",
  ArrowRight: "right",
  ArrowUp: "up",
  ArrowDown: "down",
};

function tileClass(v: number): string {
  if (v === 0) return styles.empty;
  if (v > 2048) return styles.vbig;
  return styles[`v${v}` as keyof typeof styles] as string;
}

export default function Game2048() {
  // Seed lazily on the client so server and client markup agree (the initial
  // board is random; rendering it only after mount avoids hydration mismatch).
  const [state, dispatch] = useReducer(reducer, undefined, () => ({
    board: Array<number>(SIZE * SIZE).fill(0),
    score: 0,
    status: "playing" as const,
    won: false,
  }));
  const started = useRef(false);
  const stateRef2048 = useRef(state);
  stateRef2048.current = state;

  useEffect(() => {
    if (!started.current) {
      started.current = true;
      dispatch({ type: "START" });
    }
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const dir = KEY_DIR[e.key];
      if (dir) {
        e.preventDefault();
        dispatch({ type: "MOVE", dir });
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className={styles.layout}>
      <div className={styles.boardWrap}>
        <div
          className={styles.board}
          role="grid"
          aria-label="2048 board"
          style={{ ["--cell" as string]: "78px" }}
        >
          {state.board.map((v, i) => (
            <div key={i} className={`${styles.cell} ${tileClass(v)}`}>
              {v !== 0 ? v : ""}
            </div>
          ))}
        </div>

        {state.status === "over" && (
          <div className={styles.overlay}>
            <div className={styles.overlayInner}>
              <h2>Game over</h2>
              <button className={styles.button} onClick={() => dispatch({ type: "START" })}>
                Play again
              </button>
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
          <h3>Status</h3>
          <div className={styles.stat} style={{ fontSize: "1.1rem" }}>
            {state.won ? "2048 reached ✦" : "Keep merging"}
          </div>
        </div>
        <button className={styles.button} onClick={() => dispatch({ type: "START" })}>
          New game
        </button>
        <p className={styles.help}>← ↑ ↓ → to slide tiles. Equal tiles merge.</p>
        <SaveSlot<GameState>
          game="2048"
          getState={() => stateRef2048.current}
          onLoad={(s) => dispatch({ type: "LOAD", state: s })}
          validate={(s): s is GameState =>
            !!s && typeof s === "object" && Array.isArray((s as GameState).board) &&
            (s as GameState).board.length === SIZE * SIZE
          }
        />
      </aside>
    </div>
  );
}
