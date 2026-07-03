"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { simulate, randomSeed, type SimResult } from "./engine";
import {
  SAMPLE_ROSTER,
  blankPlayer,
  rosterProblems,
  parseRosterJson,
  rosterToJson,
  statMax,
  STAT_KEYS,
  STAT_LABELS,
  MAX_PLAYERS,
  type RosterPlayer,
  type StatKey,
} from "./roster";
import ArenaMap from "./ArenaMap";
import styles from "./hungerGames.module.css";

// The interactive simulator. Two stages:
//   setup — roster editor (add/edit/remove tributes, import/export, save/load)
//   sim   — step-through playback of a finished deterministic run
//
// Signed-in users can save rosters, save mid-playback progress, and get their
// finished runs recorded to the dashboard. Guests can play everything — the
// save controls simply point them at sign-in.

interface SavedRosterMeta {
  id: string;
  name: string;
  playerCount: number;
}

interface Message {
  kind: "ok" | "error";
  text: string;
}

const SIM_SAVE_SLOT = "autosave";

export default function HungerGames({
  initialRunId,
  initialRosterId,
}: {
  initialRunId?: string;
  initialRosterId?: string;
}) {
  const { data: session, status: authStatus } = useSession();
  const signedIn = Boolean(session?.user);

  // --- setup state ---
  const [players, setPlayers] = useState<RosterPlayer[]>(SAMPLE_ROSTER);
  const [errors, setErrors] = useState<string[]>([]);
  const [seedInput, setSeedInput] = useState<string>("");
  const [rosterName, setRosterName] = useState("");
  const [savedRosters, setSavedRosters] = useState<SavedRosterMeta[]>([]);
  const [message, setMessage] = useState<Message | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // --- simulation state ---
  const [result, setResult] = useState<SimResult | null>(null);
  const [turn, setTurn] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);

  const flash = useCallback((kind: Message["kind"], text: string) => {
    setMessage({ kind, text });
  }, []);

  // --- saved rosters (signed-in only) ---
  const refreshRosters = useCallback(async () => {
    try {
      const res = await fetch("/api/rosters");
      if (!res.ok) return;
      setSavedRosters(await res.json());
    } catch {
      // network hiccup — the list just stays stale; saves still surface errors
    }
  }, []);

  useEffect(() => {
    if (signedIn) void refreshRosters();
  }, [signedIn, refreshRosters]);

  // --- deep links: ?run= replays a recorded simulation, ?roster= loads a roster ---
  useEffect(() => {
    if (!initialRunId || authStatus === "loading") return;
    (async () => {
      try {
        const res = await fetch(`/api/simulations/${initialRunId}`);
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          flash("error", data.error || "Couldn't load that simulation.");
          return;
        }
        const run = await res.json();
        setPlayers(run.players);
        setSeedInput(String(run.seed));
        const sim = simulate(run.players, run.seed);
        setResult(sim);
        setTurn(0);
        setPlaying(true);
      } catch {
        flash("error", "Couldn't load that simulation — check your connection and try again.");
      }
    })();
  }, [initialRunId, authStatus, flash]);

  useEffect(() => {
    if (!initialRosterId || authStatus === "loading") return;
    (async () => {
      try {
        const res = await fetch(`/api/rosters/${initialRosterId}`);
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          flash("error", data.error || "Couldn't load that roster.");
          return;
        }
        const roster = await res.json();
        setPlayers(roster.players);
        setRosterName(roster.name);
        flash("ok", `Loaded roster "${roster.name}".`);
      } catch {
        flash("error", "Couldn't load that roster — check your connection and try again.");
      }
    })();
  }, [initialRosterId, authStatus, flash]);

  // --- playback loop ---
  useEffect(() => {
    if (!playing || !result) return;
    if (turn >= result.snapshots.length - 1) {
      setPlaying(false);
      return;
    }
    const id = window.setTimeout(() => setTurn((t) => t + 1), 1100 / speed);
    return () => window.clearTimeout(id);
  }, [playing, turn, speed, result]);

  // --- roster editing ---
  function updatePlayer(index: number, patch: Partial<RosterPlayer>) {
    setPlayers((ps) => ps.map((p, i) => (i === index ? { ...p, ...patch } : p)));
  }

  function updateStat(index: number, key: StatKey, value: number) {
    setPlayers((ps) =>
      ps.map((p, i) => (i === index ? { ...p, stats: { ...p.stats, [key]: value } } : p)),
    );
  }

  function addPlayer() {
    if (players.length >= MAX_PLAYERS) return;
    setPlayers((ps) => [...ps, blankPlayer()]);
  }

  function removePlayer(index: number) {
    setPlayers((ps) => ps.filter((_, i) => i !== index));
  }

  // --- import / export ---
  function exportRoster() {
    const blob = new Blob([rosterToJson(players)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "hunger-games-roster.json";
    a.click();
    URL.revokeObjectURL(url);
  }

  async function importRoster(file: File) {
    const text = await file.text();
    const parsed = parseRosterJson(text);
    if (parsed.error) {
      flash("error", `Import failed: ${parsed.error}`);
      return;
    }
    setPlayers(parsed.players!);
    setErrors([]);
    flash("ok", `Imported ${parsed.players!.length} tributes.`);
  }

  // --- save / load rosters ---
  async function saveRoster() {
    const name = rosterName.trim();
    if (!name) {
      flash("error", "Give the roster a name before saving.");
      return;
    }
    const problems = rosterProblems(players);
    if (problems.length) {
      setErrors(problems);
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/rosters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, players }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        flash("error", data.error || "Save failed — please try again.");
      } else {
        flash("ok", `Roster "${name}" saved.`);
        void refreshRosters();
      }
    } catch {
      flash("error", "Save failed — check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  async function loadRoster(id: string) {
    if (!id) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/rosters/${id}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        flash("error", data.error || "Couldn't load that roster.");
      } else {
        setPlayers(data.players);
        setRosterName(data.name);
        setErrors([]);
        flash("ok", `Loaded roster "${data.name}".`);
      }
    } catch {
      flash("error", "Couldn't load that roster — check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  async function deleteRoster(id: string) {
    if (!id) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/rosters/${id}`, { method: "DELETE" });
      if (res.ok) {
        flash("ok", "Roster deleted.");
        void refreshRosters();
      } else {
        const data = await res.json().catch(() => ({}));
        flash("error", data.error || "Delete failed.");
      }
    } catch {
      flash("error", "Delete failed — check your connection.");
    } finally {
      setBusy(false);
    }
  }

  // --- run / save / restore simulations ---
  function startSimulation(seedOverride?: number) {
    const problems = rosterProblems(players);
    if (problems.length) {
      setErrors(problems);
      setMessage(null);
      return;
    }
    setErrors([]);
    let seed = seedOverride;
    if (seed === undefined) {
      seed = seedInput.trim() === "" ? randomSeed() : Number(seedInput.trim());
      if (!Number.isInteger(seed) || seed < 0) {
        setErrors(["Seed must be a non-negative whole number (or leave it blank for random)."]);
        return;
      }
    }
    setSeedInput(String(seed));
    const sim = simulate(players, seed);
    setResult(sim);
    setTurn(0);
    setPlaying(true);
    setMessage(null);

    // Record the finished run for the dashboard (signed-in, fire-and-forget).
    if (signedIn) {
      void fetch("/api/simulations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          seed,
          players,
          winner: sim.winner,
          turns: sim.snapshots.length - 1,
        }),
      }).catch(() => {});
    }
  }

  async function saveProgress() {
    if (!result) return;
    setBusy(true);
    try {
      const res = await fetch("/api/saves", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          game: "hunger-games",
          name: SIM_SAVE_SLOT,
          data: JSON.stringify({ players, seed: result.seed, turn }),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) flash("error", data.error || "Couldn't save progress.");
      else flash("ok", "Progress saved — resume any time from here or your dashboard.");
    } catch {
      flash("error", "Couldn't save progress — check your connection.");
    } finally {
      setBusy(false);
    }
  }

  const loadProgress = useCallback(async () => {
    setBusy(true);
    try {
      const res = await fetch(`/api/saves?game=hunger-games&name=${SIM_SAVE_SLOT}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        flash("error", data.error === "No save found." ? "No saved game yet." : data.error || "Couldn't load your save.");
        return;
      }
      const state = JSON.parse(data.data) as { players: RosterPlayer[]; seed: number; turn: number };
      const problems = rosterProblems(state.players);
      if (problems.length || !Number.isInteger(state.seed)) {
        flash("error", "That save is from an older version and can't be restored.");
        return;
      }
      setPlayers(state.players);
      setSeedInput(String(state.seed));
      const sim = simulate(state.players, state.seed);
      setResult(sim);
      setTurn(Math.max(0, Math.min(state.turn ?? 0, sim.snapshots.length - 1)));
      setPlaying(false);
      flash("ok", "Save loaded — picking up where you left off.");
    } catch {
      flash("error", "Couldn't load your save — check your connection.");
    } finally {
      setBusy(false);
    }
  }, [flash]);

  function backToSetup() {
    setPlaying(false);
    setResult(null);
    setMessage(null);
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  const alert = message && (
    <p role="status" className={message.kind === "error" ? styles.errorBox : styles.notice}>
      {message.text}
    </p>
  );

  if (result) {
    const snap = result.snapshots[turn];
    const finished = turn >= result.snapshots.length - 1;
    const feed = snap.players.filter((p) => p.dialogue !== null);
    const deathsThisTurn = new Set(snap.deaths);

    return (
      <div className={styles.wrap}>
        {alert}

        <section className={styles.panel} aria-label="Simulation playback">
          <div className={styles.turnHeader} aria-live="polite">
            <h2 className={styles.turnTitle}>
              {snap.turn === 0 ? "The games begin" : `Turn ${snap.turn}`}
              <span className={styles.feedMeta}>hour {snap.hour}</span>
            </h2>
            <span className={styles.badge}>{snap.aliveCount} alive</span>
            {snap.isNight && <span className={styles.badgeNight}>night</span>}
            {snap.weather.type !== "clear" && (
              <span className={styles.badge}>{snap.weather.type.replace("_", " ")}</span>
            )}
            {snap.safeRadius < 64 && (
              <span className={styles.badgeDanger}>
                {result.params.borderDisaster} closing in
              </span>
            )}
            {snap.hazard && <span className={styles.badgeDanger}>{snap.hazard.kind}</span>}
          </div>

          <div className={styles.playbar}>
            <button type="button" className={styles.btn} onClick={() => setTurn(0)} disabled={turn === 0}>
              ⏮ Start
            </button>
            <button
              type="button"
              className={styles.btn}
              onClick={() => setTurn((t) => Math.max(0, t - 1))}
              disabled={turn === 0}
            >
              ◀ Prev
            </button>
            <button
              type="button"
              className={styles.btnPrimary}
              onClick={() => (finished ? setTurn(0) : setPlaying((p) => !p))}
            >
              {finished ? "↻ Replay" : playing ? "❚❚ Pause" : "▶ Play"}
            </button>
            <button
              type="button"
              className={styles.btn}
              onClick={() => setTurn((t) => Math.min(result.snapshots.length - 1, t + 1))}
              disabled={finished}
            >
              Next ▶
            </button>
            <label className={styles.feedMeta}>
              Speed{" "}
              <select
                className={styles.districtSelect}
                value={speed}
                onChange={(e) => setSpeed(Number(e.target.value))}
              >
                <option value={0.5}>0.5×</option>
                <option value={1}>1×</option>
                <option value={2}>2×</option>
                <option value={4}>4×</option>
              </select>
            </label>
            <input
              type="range"
              min={0}
              max={result.snapshots.length - 1}
              value={turn}
              onChange={(e) => {
                setPlaying(false);
                setTurn(Number(e.target.value));
              }}
              className={styles.scrubber}
              aria-label={`Turn ${turn} of ${result.snapshots.length - 1}`}
            />
          </div>

          <div className={styles.simGrid}>
            <div>
              <ArenaMap arena={result.arena} snapshot={snap} params={result.params} />
              <ul className={styles.statusList} aria-label="Tribute health">
                {snap.players.map((p) => (
                  <li key={p.name} className={p.alive ? styles.statusRow : styles.statusDead}>
                    <span className={styles.statusName}>
                      {p.name} <span className={styles.feedMeta}>D{p.district}</span>
                    </span>
                    <span className={styles.hpTrack} aria-hidden>
                      <span
                        className={p.health < 30 ? styles.hpLow : styles.hpFill}
                        style={{ width: `${p.health}%` }}
                      />
                    </span>
                    <span className={styles.feedMeta}>
                      {p.alive ? `${p.health} hp` : "fallen"}
                      {p.kills > 0 && ` · ${p.kills} ⚔`}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <ul className={styles.feed} aria-label={`Events for turn ${snap.turn}`}>
                {feed.map((p) => (
                  <li
                    key={p.name}
                    className={deathsThisTurn.has(p.name) ? styles.feedDeath : styles.feedItem}
                  >
                    <span className={styles.feedName}>
                      {deathsThisTurn.has(p.name) && "☠ "}
                      {p.name}
                    </span>
                    <span className={styles.feedMeta}>District {p.district}</span>
                    <br />
                    {p.dialogue}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {finished && (
          <section className={styles.panel} aria-label="Final results">
            <div className={styles.winnerBanner}>
              {result.outcome === "winner" ? (
                <>
                  <span className={styles.feedMeta}>Victor of the arena</span>
                  <p className={styles.winnerName}>🏆 {result.winner}</p>
                </>
              ) : result.outcome === "wipeout" ? (
                <p className={styles.winnerName}>No survivors — the arena wins.</p>
              ) : (
                <p className={styles.winnerName}>The Gamemakers call it a draw.</p>
              )}
              <p className={styles.feedMeta}>
                Seed {result.seed} · {result.snapshots.length - 1} turns
              </p>
            </div>

            <table className={styles.placeTable}>
              <caption className={styles.srOnly}>Final placements</caption>
              <thead>
                <tr>
                  <th scope="col">Place</th>
                  <th scope="col">Tribute</th>
                  <th scope="col">District</th>
                  <th scope="col">Kills</th>
                  <th scope="col">Fate</th>
                </tr>
              </thead>
              <tbody>
                {result.placements.map((p) => (
                  <tr key={p.name}>
                    <td>#{p.place}</td>
                    <td>{p.name}</td>
                    <td>D{p.district}</td>
                    <td>{p.kills}</td>
                    <td>
                      {p.deathTurn === null
                        ? "Survived"
                        : p.killedBy
                          ? `Killed by ${p.killedBy}, turn ${p.deathTurn}`
                          : `Died turn ${p.deathTurn}`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        <div className={styles.toolbar}>
          <button
            type="button"
            className={styles.btn}
            onClick={() => startSimulation(randomSeed())}
          >
            🎲 New simulation
          </button>
          <button type="button" className={styles.btn} onClick={backToSetup}>
            ✎ Edit roster
          </button>
          {signedIn ? (
            <button type="button" className={styles.btn} onClick={saveProgress} disabled={busy}>
              💾 Save progress
            </button>
          ) : (
            <span className={styles.feedMeta}>
              <Link href="/login?callbackUrl=/games/hunger-games">Sign in</Link> to save progress
              and record runs.
            </span>
          )}
        </div>
      </div>
    );
  }

  // --- setup stage ---
  return (
    <div className={styles.wrap}>
      {alert}

      <section className={styles.panel} aria-label="Roster editor">
        <h2 className={styles.panelTitle}>Tributes</h2>
        <p className={styles.hint}>
          Build your own cast or start from the sample roster. Judge score runs 0–12; every other
          trait runs 0–10. Traits drive behaviour: killer instinct picks fights, survival finds
          caches and dodges hazards, sponsors send help when health runs low.
        </p>

        <div className={styles.rosterScroll}>
          <table className={styles.rosterTable}>
            <thead>
              <tr>
                <th scope="col">Name</th>
                <th scope="col">District</th>
                {STAT_KEYS.map((k) => (
                  <th key={k} scope="col" title={STAT_LABELS[k]}>
                    {STAT_LABELS[k]}
                  </th>
                ))}
                <th scope="col">
                  <span className={styles.srOnly}>Remove</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {players.map((p, i) => (
                <tr key={i}>
                  <td>
                    <input
                      className={`${styles.nameInput}${p.name.trim() ? "" : ` ${styles.invalid}`}`}
                      value={p.name}
                      onChange={(e) => updatePlayer(i, { name: e.target.value })}
                      placeholder={`Tribute ${i + 1}`}
                      aria-label={`Tribute ${i + 1} name`}
                      maxLength={24}
                    />
                  </td>
                  <td>
                    <select
                      className={styles.districtSelect}
                      value={p.district}
                      onChange={(e) => updatePlayer(i, { district: Number(e.target.value) })}
                      aria-label={`Tribute ${i + 1} district`}
                    >
                      {Array.from({ length: 12 }, (_, d) => (
                        <option key={d + 1} value={d + 1}>
                          {d + 1}
                        </option>
                      ))}
                    </select>
                  </td>
                  {STAT_KEYS.map((k) => (
                    <td key={k}>
                      <input
                        className={styles.numInput}
                        type="number"
                        min={0}
                        max={statMax(k)}
                        value={p.stats[k]}
                        onChange={(e) => updateStat(i, k, Number(e.target.value))}
                        aria-label={`${p.name || `Tribute ${i + 1}`} ${STAT_LABELS[k]}`}
                      />
                    </td>
                  ))}
                  <td>
                    <button
                      type="button"
                      className={styles.removeBtn}
                      onClick={() => removePlayer(i)}
                      aria-label={`Remove ${p.name || `tribute ${i + 1}`}`}
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {errors.length > 0 && (
          <div role="alert" className={styles.errorBox} style={{ marginTop: "0.9rem" }}>
            Fix these before starting:
            <ul>
              {errors.slice(0, 6).map((e) => (
                <li key={e}>{e}</li>
              ))}
              {errors.length > 6 && <li>…and {errors.length - 6} more.</li>}
            </ul>
          </div>
        )}

        <div className={styles.toolbar} style={{ marginTop: "1rem" }}>
          <button
            type="button"
            className={styles.btn}
            onClick={addPlayer}
            disabled={players.length >= MAX_PLAYERS}
          >
            + Add tribute
          </button>
          <button type="button" className={styles.btn} onClick={() => setPlayers(SAMPLE_ROSTER)}>
            Sample roster
          </button>
          <button
            type="button"
            className={styles.btnDanger}
            onClick={() => setPlayers([blankPlayer(), blankPlayer()])}
          >
            Clear all
          </button>
          <button type="button" className={styles.btn} onClick={exportRoster}>
            ⇩ Export JSON
          </button>
          <button type="button" className={styles.btn} onClick={() => fileRef.current?.click()}>
            ⇧ Import JSON
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void importRoster(f);
              e.target.value = "";
            }}
          />
        </div>
      </section>

      <section className={styles.panel} aria-label="Saved rosters">
        <h2 className={styles.panelTitle}>Saved rosters</h2>
        {!signedIn ? (
          <p className={styles.hint} style={{ margin: 0 }}>
            <Link href="/login?callbackUrl=/games/hunger-games">Sign in</Link> or{" "}
            <Link href="/signup">create an account</Link> to save rosters, resume simulations, and
            keep a history of your runs.
          </p>
        ) : (
          <>
            <div className={styles.saveRow}>
              <input
                className={styles.textInput}
                value={rosterName}
                onChange={(e) => setRosterName(e.target.value)}
                placeholder="Roster name"
                aria-label="Roster name"
                maxLength={40}
              />
              <button type="button" className={styles.btn} onClick={saveRoster} disabled={busy}>
                💾 Save roster
              </button>
              <button type="button" className={styles.btn} onClick={loadProgress} disabled={busy}>
                ⏯ Resume saved game
              </button>
            </div>
            {savedRosters.length > 0 && (
              <ul className={styles.statusList}>
                {savedRosters.map((r) => (
                  <li key={r.id} className={styles.statusRow}>
                    <span className={styles.statusName}>{r.name}</span>
                    <span className={styles.feedMeta}>{r.playerCount} tributes</span>
                    <button
                      type="button"
                      className={styles.btn}
                      onClick={() => loadRoster(r.id)}
                      disabled={busy}
                    >
                      Load
                    </button>
                    <button
                      type="button"
                      className={styles.removeBtn}
                      onClick={() => deleteRoster(r.id)}
                      disabled={busy}
                      aria-label={`Delete roster ${r.name}`}
                    >
                      ✕
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </section>

      <section className={styles.panel} aria-label="Start simulation">
        <h2 className={styles.panelTitle}>Run the games</h2>
        <div className={styles.saveRow}>
          <label className={styles.feedMeta} htmlFor="hg-seed">
            Seed (optional)
          </label>
          <input
            id="hg-seed"
            className={styles.textInput}
            value={seedInput}
            onChange={(e) => setSeedInput(e.target.value)}
            placeholder="random"
            inputMode="numeric"
            style={{ maxWidth: 140 }}
          />
          <button type="button" className={styles.btnPrimary} onClick={() => startSimulation()}>
            ▶ Start simulation
          </button>
        </div>
        <p className={styles.hint} style={{ margin: "0.75rem 0 0" }}>
          The same seed and roster always replay the same game — share a seed to compare fates.
        </p>
      </section>
    </div>
  );
}
