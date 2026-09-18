"use client";

import { useEffect, useReducer, useRef, useState } from "react";
import styles from "./game2048.module.css";
import SaveSlot from "../_components/SaveSlot";
import { unlock, recordPlayed, recordWin } from "@/lib/arcade";
import { summonZote } from "@/app/_components/eggs/ZoteHeckler";
import { reducer, SIZE, type Dir, type GameState } from "./engine";

// 2048 rendered as a CSS grid of tiles. Logic lives in engine.ts. No game loop
// here — it's turn-based, advancing only on arrow-key input.

const KEY_DIR: Record<string, Dir> = {
  ArrowLeft: "left",
  ArrowRight: "right",
  ArrowUp: "up",
  ArrowDown: "down",
  a: "left",
  d: "right",
  w: "up",
  s: "down",
};

const BEST_KEY = "bl:2048-best";

function readBest(): number {
  try {
    return parseInt(localStorage.getItem(BEST_KEY) ?? "0", 10) || 0;
  } catch {
    return 0;
  }
}

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
  const [best, setBest] = useState(0);
  const swipeStart = useRef<{ x: number; y: number; pointerId: number } | null>(null);
  const stateRef2048 = useRef(state);
  stateRef2048.current = state;

  useEffect(() => {
    if (!started.current) {
      started.current = true;
      dispatch({ type: "START" });
      recordPlayed("2048");
      setBest(readBest());
    }
  }, []);

  // Personal best, kept in this browser (the signed-in record lives on the
  // server, but a guest's run deserves a number to beat too).
  useEffect(() => {
    if (state.score <= best) return;
    setBest(state.score);
    try {
      localStorage.setItem(BEST_KEY, String(state.score));
    } catch { /* storage blocked — the best score just won't persist */ }
  }, [state.score, best]);

  // Progression + cameo hooks.
  const prevStatus = useRef(state.status);
  useEffect(() => {
    if (state.board.includes(2048)) {
      unlock("g2048-namesake");
      recordWin("2048");
    }
    if (state.board.includes(4096)) unlock("g2048-overachiever");

    if (state.status === "over" && prevStatus.current !== "over" && state.score < 400) {
      summonZote("score");
    }
    prevStatus.current = state.status;
  }, [state]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      if (target?.closest("input, select, textarea, [contenteditable='true']")) return;
      const dir = KEY_DIR[e.key] ?? KEY_DIR[e.key.toLowerCase()];
      if (dir) {
        e.preventDefault();
        dispatch({ type: "MOVE", dir });
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function move(dir: Dir) {
    dispatch({ type: "MOVE", dir });
  }

  function beginSwipe(e: React.PointerEvent<HTMLDivElement>) {
    if (e.pointerType === "mouse" || !e.isPrimary) return;
    swipeStart.current = { x: e.clientX, y: e.clientY, pointerId: e.pointerId };
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function finishSwipe(e: React.PointerEvent<HTMLDivElement>) {
    const start = swipeStart.current;
    swipeStart.current = null;
    if (!start || start.pointerId !== e.pointerId) return;
    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return;
    move(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : dy > 0 ? "down" : "up");
  }

  return (
    <div className={styles.layout}>
      <div className={styles.boardWrap}>
        <div
          className={styles.board}
          role="grid"
          aria-label={`2048 board, score ${state.score}${state.status === "over" ? ", game over" : ""}`}
          onPointerDown={beginSwipe}
          onPointerUp={finishSwipe}
          onPointerCancel={() => { swipeStart.current = null; }}
        >
          {state.board.map((v, i) => (
            <div
              // The move count is part of the key so a cell that merges twice
              // in a row remounts and replays its pop.
              key={`${i}-${state.moveCount ?? 0}`}
              className={`${styles.cell} ${tileClass(v)} ${
                state.merged?.includes(i) ? styles.merged : state.spawned === i ? styles.spawned : ""
              }`}
              role="gridcell"
              aria-label={`Row ${Math.floor(i / SIZE) + 1}, column ${(i % SIZE) + 1}: ${v || "empty"}`}
            >
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
          <div className={styles.stat} aria-live="polite">{state.score}</div>
        </div>
        <div className={styles.panel}>
          <h3>Best</h3>
          <div className={styles.stat}>{Math.max(best, state.score)}</div>
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
        <div className={styles.directionPad} aria-label="Slide tiles">
          <button type="button" onClick={() => move("up")} aria-label="Slide up">↑</button>
          <button type="button" onClick={() => move("left")} aria-label="Slide left">←</button>
          <button type="button" onClick={() => move("down")} aria-label="Slide down">↓</button>
          <button type="button" onClick={() => move("right")} aria-label="Slide right">→</button>
        </div>
        <p className={styles.help}>Arrow keys or WASD, swipe, or use the pad to slide. Equal tiles merge.</p>
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
