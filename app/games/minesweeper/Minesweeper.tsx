"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import styles from "./minesweeper.module.css";
import { unlock, recordPlayed, recordWin, postResult } from "@/lib/arcade";
import { summonZote } from "@/app/_components/eggs/ZoteHeckler";
import {
  createBoard, reveal, toggleFlag, chord, minesRemaining, progress,
  LEVELS, LEVELS_BY_KEY, type Board, type Level,
} from "./engine";

// Minesweeper on graph paper. Left click reveals, right click (or long-press)
// flags, and clicking a satisfied number chords. Mines are placed on the first
// click, so the opening move is always safe.

const CELL_PX: Record<string, number> = { beginner: 34, intermediate: 30, expert: 26 };

function fmtTime(ms: number): string {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export default function Minesweeper() {
  const [levelKey, setLevelKey] = useState("beginner");
  const level = LEVELS_BY_KEY.get(levelKey)!;
  const [board, setBoard] = useState<Board>(() => createBoard(LEVELS[0]));
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [now, setNow] = useState(0);
  const [scoreRefresh, setScoreRefresh] = useState(0);
  const longPress = useRef<ReturnType<typeof setTimeout> | null>(null);
  const suppressClick = useRef(false);

  useEffect(() => recordPlayed("minesweeper"), []);

  const newGame = useCallback((l: Level) => {
    setBoard(createBoard(l));
    setStartedAt(null);
    setNow(0);
  }, []);

  useEffect(() => {
    newGame(level);
  }, [level, newGame]);

  // Timer runs only while a game is genuinely in progress.
  useEffect(() => {
    if (board.status !== "playing" || startedAt === null) return;
    const id = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(id);
  }, [board.status, startedAt]);

  const elapsed =
    startedAt === null ? 0 : (board.status === "playing" ? now || Date.now() : now) - startedAt;

  // End-of-game effects, once per finished board.
  const finishedRef = useRef<Board | null>(null);
  useEffect(() => {
    if (board.status !== "won" && board.status !== "lost") return;
    if (finishedRef.current === board) return;
    finishedRef.current = board;

    const timeMs = startedAt === null ? 0 : Date.now() - startedAt;
    if (board.status === "won") {
      postResult({ game: "minesweeper", mode: levelKey, event: "win", timeMs });
      recordWin("minesweeper");
      unlock("mine-first-sweep");
      if (levelKey === "expert") unlock("mine-expert");
      if (levelKey === "beginner" && timeMs < 15_000) unlock("mine-speed");
      if (board.cells.every((c) => !c.mine || c.state === "flagged")) unlock("mine-cartographer");
      setScoreRefresh((n) => n + 1);
    } else if (progress(board) < 0.12) {
      // Losing on a nearly-untouched board is exactly Zote's business.
      summonZote("general");
    }
  }, [board, levelKey, startedAt]);

  /** First interaction with a board: start the clock and record the attempt,
   *  so "deals" counts games played rather than (as it did) games lost. */
  function begin() {
    if (startedAt === null) {
      const t = Date.now();
      setStartedAt(t);
      setNow(t);
      postResult({ game: "minesweeper", mode: levelKey, event: "deal" });
    }
  }

  function onReveal(i: number) {
    if (suppressClick.current) {
      suppressClick.current = false;
      return;
    }
    begin();
    setBoard((b) => (b.cells[i].state === "revealed" ? chord(b, i) : reveal(b, i)));
  }

  function onFlag(i: number, e: React.MouseEvent) {
    e.preventDefault();
    begin();
    setBoard((b) => toggleFlag(b, i));
  }

  // Touch: long-press to flag.
  function onTouchStart(i: number) {
    longPress.current = setTimeout(() => {
      suppressClick.current = true;
      begin();
      setBoard((b) => toggleFlag(b, i));
    }, 380);
  }
  function onTouchEnd() {
    if (longPress.current) clearTimeout(longPress.current);
    longPress.current = null;
  }

  const cellPx = CELL_PX[levelKey] ?? 30;
  const done = board.status === "won" || board.status === "lost";

  return (
    <div className={styles.layout}>
      <div className={styles.controls} role="group" aria-label="Difficulty">
        {LEVELS.map((l) => (
          <button
            key={l.key}
            type="button"
            className={`${styles.button} ${levelKey === l.key ? styles.buttonActive : ""}`}
            onClick={() => setLevelKey(l.key)}
          >
            {l.name}
          </button>
        ))}
        <button type="button" className={styles.button} onClick={() => newGame(level)}>
          ↻ New game
        </button>
      </div>

      <div className={styles.statusRow}>
        <span>
          💣 <span className={styles.statValue}>{minesRemaining(board)}</span>
        </span>
        <span>
          ⏱ <span className={styles.statValue}>{fmtTime(elapsed)}</span>
        </span>
        <span>
          cleared <span className={styles.statValue}>{Math.round(progress(board) * 100)}%</span>
        </span>
      </div>

      {done && (
        <div className={styles.banner}>
          <strong style={{ fontFamily: "var(--font-display)", fontSize: "1.25rem" }}>
            {board.status === "won" ? "Swept! 🎉" : "Boom. 💥"}
          </strong>
          <p className={styles.help} style={{ margin: "0.3rem auto 0" }}>
            {board.status === "won"
              ? `${level.name} in ${fmtTime(elapsed)}.`
              : "Mines are placed after your first click — so that one was genuinely on you."}
          </p>
        </div>
      )}

      <div className={styles.boardWrap}>
        <div
          className={styles.board}
          role="grid"
          aria-label="Minesweeper board"
          style={{
            gridTemplateColumns: `repeat(${board.cols}, ${cellPx}px)`,
            ["--cell" as string]: `${cellPx}px`,
          }}
        >
          {board.cells.map((cell, i) => {
            const revealed = cell.state === "revealed";
            const isMine = revealed && cell.mine;
            const cls = [
              styles.cell,
              revealed ? styles.revealed : "",
              cell.state === "flagged" ? styles.flagged : "",
              isMine ? styles.mine : "",
              board.detonated === i ? styles.boom : "",
              revealed && !cell.mine && cell.adjacent > 0 ? styles[`n${cell.adjacent}`] : "",
            ].join(" ");
            return (
              <button
                key={i}
                type="button"
                className={cls}
                onClick={() => onReveal(i)}
                onContextMenu={(e) => onFlag(i, e)}
                onTouchStart={() => onTouchStart(i)}
                onTouchEnd={onTouchEnd}
                aria-label={
                  cell.state === "flagged"
                    ? "Flagged cell"
                    : revealed
                      ? cell.mine ? "Mine" : `${cell.adjacent} adjacent mines`
                      : "Hidden cell"
                }
              >
                {cell.state === "flagged"
                  ? "⚑"
                  : revealed
                    ? cell.mine ? "✷" : cell.adjacent > 0 ? cell.adjacent : ""
                    : ""}
              </button>
            );
          })}
        </div>
      </div>

      <p className={styles.help}>
        Left click reveals · right click flags (long-press on touch) · click a number with the right
        number of flags around it to clear its neighbours at once.
      </p>

      <BestTimes refresh={scoreRefresh} />
    </div>
  );
}

// --- personal bests ----------------------------------------------------------

interface Summary {
  byMode: Record<string, { wins: number; deals: number; bestTimeMs: number | null }>;
}

function BestTimes({ refresh }: { refresh: number }) {
  const { data: session } = useSession();
  const [summary, setSummary] = useState<Summary | null>(null);

  useEffect(() => {
    if (!session?.user) return;
    fetch("/api/results?game=minesweeper")
      .then((r) => (r.ok ? r.json() : null))
      .then(setSummary)
      .catch(() => {});
  }, [session?.user, refresh]);

  if (!session?.user) {
    return <p className={styles.help}>Sign in and your best times per difficulty collect here.</p>;
  }
  const rows = LEVELS.filter((l) => summary?.byMode[l.key]);
  if (rows.length === 0) return null;

  return (
    <div>
      <h3 style={{ fontFamily: "var(--font-display)", fontSize: "1.15rem", margin: "0 0 0.4rem" }}>
        Best times
      </h3>
      <table className={styles.scoreTable}>
        <thead>
          <tr><th>Level</th><th>Wins</th><th>Best time</th></tr>
        </thead>
        <tbody>
          {rows.map((l) => {
            const s = summary!.byMode[l.key];
            return (
              <tr key={l.key}>
                <td>{l.name}</td>
                <td>{s.wins}</td>
                <td>{s.bestTimeMs != null ? fmtTime(s.bestTimeMs) : "—"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
