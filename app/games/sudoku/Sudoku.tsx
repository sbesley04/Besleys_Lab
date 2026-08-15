"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import styles from "./sudoku.module.css";
import SaveSlot from "../_components/SaveSlot";
import { unlock, recordPlayed, recordWin, postResult } from "@/lib/arcade";
import {
  generate, seededRng, dailySeed, todayString, isSolved, streakEndingToday,
  DIFFICULTIES, type Difficulty, type Grid,
} from "./engine";

// Sudoku with pencil marks, hints, mistake tracking, four difficulties, and a
// shared daily puzzle (seeded from the date, so every visitor gets the same
// board). Solves post to /api/results; streaks and stats render below.

interface Game {
  puzzle: Grid;
  solution: Grid;
  difficulty: Difficulty;
  daily: string | null; // YYYY-MM-DD when this is the daily puzzle
}

export interface SavePayload {
  game: Game;
  entries: Grid;
  notes: number[]; // bitmask per cell (bit v-1 = candidate v)
  mistakes: number;
  hints: number;
  notesUsed: boolean;
  elapsed: number;
}

const DIFF_LABELS: Record<Difficulty, string> = {
  easy: "Easy", medium: "Medium", hard: "Hard", expert: "Expert",
};

function fmtTime(ms: number): string {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

function addDate(key: string, date: string): Set<string> {
  try {
    const set = new Set<string>(JSON.parse(localStorage.getItem(key) ?? "[]"));
    set.add(date);
    localStorage.setItem(key, JSON.stringify([...set].slice(-400)));
    return set;
  } catch {
    return new Set([date]);
  }
}

export default function Sudoku() {
  // SSR placeholder puzzle from a fixed seed — server and client must render
  // the same markup. The real random puzzle deals after mount (see below).
  const [game, setGame] = useState<Game>(() => ({
    ...pick(generate("easy", seededRng(0x5eed)), "easy"), daily: null,
  }));
  const [entries, setEntries] = useState<Grid>(() => game.puzzle.slice());
  const [notes, setNotes] = useState<number[]>(() => Array(81).fill(0));
  const [selected, setSelected] = useState<number | null>(null);
  const [pencil, setPencil] = useState(false);
  const [mistakes, setMistakes] = useState(0);
  const [hints, setHints] = useState(0);
  const [notesUsed, setNotesUsed] = useState(false);
  const [wrongCells, setWrongCells] = useState<Set<number>>(new Set());
  const [startedAt, setStartedAt] = useState(Date.now());
  const [baseElapsed, setBaseElapsed] = useState(0);
  const [finalElapsed, setFinalElapsed] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());
  const [statRefresh, setStatRefresh] = useState(0);
  const [generating, setGenerating] = useState(false);

  function pick(p: { puzzle: Grid; solution: Grid }, difficulty: Difficulty) {
    return { puzzle: p.puzzle, solution: p.solution, difficulty };
  }

  const solved = isSolved(entries, game.solution);

  useEffect(() => {
    recordPlayed("sudoku");
    newGame("easy");
  }, []);

  useEffect(() => {
    if (solved) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [solved]);
  // Once solved the clock stops, but it must keep *showing* the finishing
  // time — hence finalElapsed, frozen by the win effect below. (Reading the
  // live expression here would collapse to baseElapsed, i.e. 0:00 on a fresh
  // puzzle, which is exactly what the win banner used to display.)
  const elapsed = solved && finalElapsed !== null ? finalElapsed : baseElapsed + (now - startedAt);

  const stateRef = useRef({ game, entries, notes, mistakes, hints, notesUsed, startedAt, baseElapsed });
  stateRef.current = { game, entries, notes, mistakes, hints, notesUsed, startedAt, baseElapsed };

  function newGame(difficulty: Difficulty, daily = false) {
    setGenerating(true);
    // Let the button repaint before the generator blocks the main thread.
    setTimeout(() => {
      const date = daily ? todayString() : null;
      const g = daily
        ? generate("medium", seededRng(dailySeed(date!)))
        : generate(difficulty);
      setGame({ puzzle: g.puzzle, solution: g.solution, difficulty: daily ? "medium" : difficulty, daily: date });
      setEntries(g.puzzle.slice());
      setNotes(Array(81).fill(0));
      setSelected(null);
      setMistakes(0);
      setHints(0);
      setNotesUsed(false);
      setWrongCells(new Set());
      setStartedAt(Date.now());
      setBaseElapsed(0);
      setFinalElapsed(null);
      setGenerating(false);
    }, 30);
  }

  const given = useCallback((i: number) => game.puzzle[i] !== 0, [game.puzzle]);

  function enter(i: number, v: number) {
    if (given(i) || solved) return;
    if (pencil && v !== 0) {
      setNotesUsed(true);
      setNotes((n) => {
        const next = n.slice();
        next[i] ^= 1 << (v - 1);
        return next;
      });
      return;
    }
    setEntries((e) => {
      const next = e.slice();
      next[i] = v;
      return next;
    });
    setNotes((n) => {
      if (n[i] === 0) return n;
      const next = n.slice();
      next[i] = 0;
      return next;
    });
    setWrongCells((w) => {
      const next = new Set(w);
      if (v !== 0 && v !== game.solution[i]) next.add(i);
      else next.delete(i);
      return next;
    });
    if (v !== 0 && v !== game.solution[i]) setMistakes((m) => m + 1);
  }

  function hint() {
    if (solved) return;
    // Fill the selected cell if empty/wrong, else the first empty cell.
    let target = selected;
    if (target == null || given(target) || entries[target] === game.solution[target]) {
      target = entries.findIndex((v, i) => v !== game.solution[i]);
    }
    if (target == null || target < 0) return;
    setHints((h) => h + 1);
    const t = target;
    setEntries((e) => {
      const next = e.slice();
      next[t] = game.solution[t];
      return next;
    });
    setWrongCells((w) => {
      const next = new Set(w);
      next.delete(t);
      return next;
    });
  }

  // Keyboard input.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (selected == null) return;
      if (e.key >= "1" && e.key <= "9") {
        e.preventDefault();
        enter(selected, parseInt(e.key, 10));
      } else if (e.key === "Backspace" || e.key === "Delete" || e.key === "0") {
        e.preventDefault();
        enter(selected, 0);
      } else if (e.key === "n" || e.key === "N") {
        setPencil((p) => !p);
      } else if (e.key.startsWith("Arrow")) {
        e.preventDefault();
        const d = { ArrowUp: -9, ArrowDown: 9, ArrowLeft: -1, ArrowRight: 1 }[e.key]!;
        setSelected((s) => (s == null ? 0 : Math.max(0, Math.min(80, s + d))));
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, pencil, game, solved]);

  // Win effects — once per puzzle.
  const solvedRef = useRef<Game | null>(null);
  useEffect(() => {
    if (!solved || solvedRef.current === game) return;
    solvedRef.current = game;
    const timeMs = baseElapsed + (Date.now() - startedAt);
    setFinalElapsed(timeMs); // freeze the clock at the finishing time
    const mode = game.daily ? "daily" : game.difficulty;

    postResult({
      game: "sudoku", mode, event: "win", timeMs,
      meta: { mistakes, hints, notesUsed, date: game.daily ?? undefined },
    });
    recordWin("sudoku");

    if (!notesUsed) unlock("sud-no-notes");
    if (mistakes === 0) unlock("sud-flawless");
    if (game.difficulty === "easy" && !game.daily && timeMs < 3 * 60_000) unlock("sud-under-pressure");
    if (game.difficulty === "expert" && hints === 0) unlock("sud-long-game");
    if (!game.daily) {
      const done = addDate("bl:sudoku-diffs", game.difficulty);
      if (DIFFICULTIES.every((d) => done.has(d))) unlock("sud-ascension");
    } else {
      const dates = addDate("bl:sudoku-daily", game.daily);
      if (streakEndingToday(dates, game.daily) >= 7) unlock("sud-daily-habit");
    }
    setStatRefresh((n) => n + 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [solved]);

  const selectedValue = selected != null ? entries[selected] : 0;

  return (
    <div className={styles.layout}>
      <div className={styles.controls} role="group" aria-label="Difficulty">
        {DIFFICULTIES.map((d) => (
          <button
            key={d}
            type="button"
            className={`${styles.button} ${!game.daily && game.difficulty === d ? styles.buttonActive : ""}`}
            onClick={() => newGame(d)}
            disabled={generating}
          >
            {DIFF_LABELS[d]}
          </button>
        ))}
        <button
          type="button"
          className={`${styles.button} ${game.daily ? styles.buttonActive : ""}`}
          onClick={() => newGame("medium", true)}
          disabled={generating}
        >
          📅 Daily
        </button>
        {generating && <span className={styles.help}>dealing…</span>}
      </div>

      <div className={styles.statusRow}>
        <span>⏱ {fmtTime(elapsed)}</span>
        <span>✗ {mistakes} mistakes</span>
        <span>💡 {hints} hints</span>
        {game.daily && <span>Daily puzzle · {game.daily}</span>}
      </div>

      {solved && (
        <div className={styles.winBanner}>
          <strong style={{ fontFamily: "var(--font-display)", fontSize: "1.3rem" }}>Solved! 🎉</strong>
          <p className={styles.help} style={{ marginTop: "0.3rem" }}>
            {game.daily ? "Daily puzzle" : DIFF_LABELS[game.difficulty]} · {fmtTime(elapsed)} ·{" "}
            {mistakes === 0 ? "flawless" : `${mistakes} mistakes`}
            {hints > 0 ? ` · ${hints} hints` : ""}
          </p>
        </div>
      )}

      <div className={styles.boardWrap}>
        <div className={styles.board} role="grid" aria-label="Sudoku board">
          {entries.map((v, i) => {
            const isPeer =
              selected != null &&
              selected !== i &&
              (Math.floor(selected / 9) === Math.floor(i / 9) ||
                selected % 9 === i % 9 ||
                (Math.floor(selected / 27) === Math.floor(i / 27) &&
                  Math.floor((selected % 9) / 3) === Math.floor((i % 9) / 3)));
            const cls = [
              styles.cell,
              given(i) ? styles.given : "",
              selected === i ? styles.selectedCell : "",
              isPeer ? styles.peerCell : "",
              selectedValue !== 0 && v === selectedValue && selected !== i ? styles.sameNumber : "",
              wrongCells.has(i) ? styles.wrong : "",
            ].join(" ");
            return (
              <button key={i} type="button" className={cls} onClick={() => setSelected(i)} aria-label={`Cell ${Math.floor(i / 9) + 1},${(i % 9) + 1}`}>
                {v !== 0 ? (
                  v
                ) : notes[i] !== 0 ? (
                  <span className={styles.notes} aria-hidden>
                    {Array.from({ length: 9 }, (_, k) => (
                      <span key={k}>{notes[i] & (1 << k) ? k + 1 : ""}</span>
                    ))}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>

        <div className={styles.pad}>
          {Array.from({ length: 9 }, (_, k) => (
            <button key={k} type="button" className={styles.padButton} onClick={() => selected != null && enter(selected, k + 1)}>
              {k + 1}
            </button>
          ))}
          <button type="button" className={styles.padButton} onClick={() => selected != null && enter(selected, 0)} aria-label="Erase">
            ⌫
          </button>
          <button
            type="button"
            className={`${styles.padButton} ${pencil ? styles.padActive : ""}`}
            onClick={() => setPencil((p) => !p)}
            aria-pressed={pencil}
            title="Pencil marks (N)"
          >
            ✏️
          </button>
          <button type="button" className={styles.padButton} onClick={hint} title="Fill one correct cell">
            💡
          </button>
          <p className={`${styles.help} ${styles.padWide}`}>
            1–9 to write · ✏️ or N for pencil marks · arrows move
          </p>
        </div>
      </div>

      <SaveSlot<SavePayload>
        game="sudoku"
        getState={() => {
          const s = stateRef.current;
          return {
            game: s.game, entries: s.entries, notes: s.notes, mistakes: s.mistakes,
            hints: s.hints, notesUsed: s.notesUsed,
            elapsed: s.baseElapsed + (Date.now() - s.startedAt),
          };
        }}
        onLoad={(p) => {
          setGame(p.game);
          setEntries(p.entries);
          setNotes(p.notes);
          setMistakes(p.mistakes);
          setHints(p.hints);
          setNotesUsed(p.notesUsed);
          setWrongCells(new Set(p.entries.map((v, i) => (v !== 0 && !p.game.puzzle[i] && v !== p.game.solution[i] ? i : -1)).filter((i) => i >= 0)));
          setBaseElapsed(p.elapsed);
          setFinalElapsed(null);
          setStartedAt(Date.now());
          setSelected(null);
        }}
        validate={(s): s is SavePayload =>
          !!s && typeof s === "object" &&
          Array.isArray((s as SavePayload).entries) &&
          (s as SavePayload).entries.length === 81 &&
          !!(s as SavePayload).game?.solution
        }
      />

      <Stats refresh={statRefresh} />
    </div>
  );
}

// --- stats panel -------------------------------------------------------------

interface Summary {
  byMode: Record<string, { wins: number; bestTimeMs: number | null }>;
  recent: { mode: string; event: string; meta: string; createdAt: string }[];
}

function Stats({ refresh }: { refresh: number }) {
  const { data: session } = useSession();
  const [summary, setSummary] = useState<Summary | null>(null);

  useEffect(() => {
    if (!session?.user) return;
    fetch("/api/results?game=sudoku")
      .then((r) => (r.ok ? r.json() : null))
      .then(setSummary)
      .catch(() => {});
  }, [session?.user, refresh]);

  if (!session?.user) {
    return <p className={styles.help}>Sign in to keep solve counts, best times, and your daily streak.</p>;
  }
  if (!summary) return null;

  // Daily streak from server rows (falls back gracefully if meta is odd).
  const dailyDates = new Set<string>();
  for (const r of summary.recent) {
    if (r.mode !== "daily" || r.event !== "win") continue;
    try {
      const date = JSON.parse(r.meta)?.date;
      if (typeof date === "string") dailyDates.add(date);
    } catch { /* ignore */ }
  }
  const streak = streakEndingToday(dailyDates, todayString());

  const rows = [...DIFFICULTIES, "daily"].filter((m) => summary.byMode[m]);
  if (rows.length === 0) return null;

  return (
    <div>
      <h3 style={{ fontFamily: "var(--font-display)", fontSize: "1.15rem", margin: "0 0 0.4rem" }}>
        Your stats{streak > 0 ? ` · 🔥 ${streak}-day streak` : ""}
      </h3>
      <table className={styles.statTable}>
        <thead>
          <tr><th>Mode</th><th>Solves</th><th>Best time</th></tr>
        </thead>
        <tbody>
          {rows.map((m) => {
            const s = summary.byMode[m];
            return (
              <tr key={m}>
                <td>{m === "daily" ? "Daily" : DIFF_LABELS[m as Difficulty]}</td>
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
