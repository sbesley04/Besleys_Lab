"use client";

import { useEffect, useReducer, useRef, useState } from "react";
import styles from "./life.module.css";
import SaveSlot from "../_components/SaveSlot";
import { unlock, recordPlayed, recordWin } from "@/lib/arcade";
import { reducer, createInitialState, containsGlider, COLS, ROWS, type GameState } from "./engine";

// Conway's Game of Life. A drawable grid plus play/step/clear/randomize. The
// generation loop is a single interval that dispatches STEP while running.

const STEP_MS = 110;

export default function Life() {
  const [state, dispatch] = useReducer(reducer, undefined, createInitialState);
  const stateRef = useRef(state);
  const drawingRef = useRef<{ pointerId: number; alive: boolean; index: number } | null>(null);
  const [cursor, setCursor] = useState(Math.floor(ROWS / 2) * COLS + Math.floor(COLS / 2));
  stateRef.current = state;

  useEffect(() => {
    if (!state.running) return;
    const id = setInterval(() => dispatch({ type: "STEP" }), STEP_MS);
    return () => clearInterval(id);
  }, [state.running]);

  const liveCount = state.grid.reduce((n, alive) => n + (alive ? 1 : 0), 0);

  useEffect(() => recordPlayed("life"), []);

  // Progression: a 1,000-generation survivor, and the glider salute — draw a
  // working glider and a little one takes up permanent residence on the
  // arcade hub's header.
  useEffect(() => {
    if (state.generation >= 1000 && liveCount > 0) {
      unlock("life-immortalist");
      recordWin("life");
    }
    if (liveCount >= 5 && liveCount <= 24 && containsGlider(state.grid)) {
      unlock("life-gliderwright");
      try {
        localStorage.setItem("bl:glider", "1");
      } catch { /* cosmetic */ }
    }
  }, [state.grid, state.generation, liveCount]);

  function indexAt(e: React.PointerEvent<HTMLDivElement>): number | null {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.floor(((e.clientX - rect.left) / rect.width) * COLS);
    const y = Math.floor(((e.clientY - rect.top) / rect.height) * ROWS);
    return x >= 0 && x < COLS && y >= 0 && y < ROWS ? y * COLS + x : null;
  }

  function startDrawing(e: React.PointerEvent<HTMLDivElement>) {
    if (e.button !== 0 || stateRef.current.running) return;
    const index = indexAt(e);
    if (index == null) return;
    e.preventDefault();
    const alive = !stateRef.current.grid[index];
    drawingRef.current = { pointerId: e.pointerId, alive, index };
    e.currentTarget.setPointerCapture(e.pointerId);
    setCursor(index);
    dispatch({ type: "PAINT", index, alive });
  }

  function continueDrawing(e: React.PointerEvent<HTMLDivElement>) {
    const drawing = drawingRef.current;
    if (!drawing || drawing.pointerId !== e.pointerId) return;
    const index = indexAt(e);
    if (index == null || index === drawing.index) return;
    drawing.index = index;
    setCursor(index);
    dispatch({ type: "PAINT", index, alive: drawing.alive });
  }

  function stopDrawing(e: React.PointerEvent<HTMLDivElement>) {
    if (drawingRef.current?.pointerId !== e.pointerId) return;
    drawingRef.current = null;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
  }

  function onBoardKey(e: React.KeyboardEvent<HTMLDivElement>) {
    const row = Math.floor(cursor / COLS);
    const col = cursor % COLS;
    let next = cursor;
    if (e.key === "ArrowUp") next = Math.max(0, row - 1) * COLS + col;
    else if (e.key === "ArrowDown") next = Math.min(ROWS - 1, row + 1) * COLS + col;
    else if (e.key === "ArrowLeft") next = row * COLS + Math.max(0, col - 1);
    else if (e.key === "ArrowRight") next = row * COLS + Math.min(COLS - 1, col + 1);
    else if (e.key === " " || e.key === "Enter") {
      e.preventDefault();
      dispatch({ type: "TOGGLE", index: cursor });
      return;
    } else return;
    e.preventDefault();
    setCursor(next);
  }

  return (
    <div className={styles.layout}>
      <div className={styles.boardWrap}>
        <div
          className={styles.board}
          role="grid"
          aria-label="Game of Life grid. Use arrow keys to choose a cell and Space to toggle it."
          aria-activedescendant={`life-cell-${cursor}`}
          aria-disabled={state.running}
          tabIndex={0}
          onKeyDown={onBoardKey}
          onPointerDown={startDrawing}
          onPointerMove={continueDrawing}
          onPointerUp={stopDrawing}
          onPointerCancel={stopDrawing}
        >
          {state.grid.map((alive, i) => (
            <div
              key={i}
              id={`life-cell-${i}`}
              role="gridcell"
              aria-label={`Row ${Math.floor(i / COLS) + 1}, column ${(i % COLS) + 1}: ${alive ? "alive" : "dead"}`}
              aria-selected={i === cursor}
              className={`${styles.cell} ${alive ? styles.alive : ""} ${i === cursor ? styles.cursor : ""}`}
            />
          ))}
        </div>
      </div>

      <div className={styles.controls}>
        {state.running ? (
          <button type="button" className={styles.button} onClick={() => dispatch({ type: "PAUSE" })}>
            Pause
          </button>
        ) : (
          <button type="button" className={styles.button} onClick={() => dispatch({ type: "PLAY" })}>
            Play
          </button>
        )}
        <button type="button" className={`${styles.button} ${styles.ghost}`} onClick={() => dispatch({ type: "STEP" })} disabled={state.running}>
          Step
        </button>
        <button type="button" className={`${styles.button} ${styles.ghost}`} onClick={() => dispatch({ type: "RANDOMIZE" })}>
          Randomize
        </button>
        <button type="button" className={`${styles.button} ${styles.ghost}`} onClick={() => dispatch({ type: "CLEAR" })}>
          Clear
        </button>
        <span className={styles.stat}>
          gen {state.generation} · {liveCount} alive
        </span>
      </div>

      <p className={styles.help}>
        Click or drag to draw a pattern while paused, then press Play. Keyboard: arrows + Space. {COLS}×{ROWS} grid; cells off
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
