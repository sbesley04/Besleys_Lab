"use client";

import { useEffect, useRef, useState } from "react";
import { SURFACES_BY_KEY, OPTIMIZER_LABELS, SCHEDULE_LABELS, type OptimizerKey, type ScheduleKey } from "@/app/lab/gradient-descent/engine";
import { postResult, recordPlayed, recordWin, unlock } from "@/lib/arcade";
import SaveSlot from "../_components/SaveSlot";
import styles from "../_components/newGame.module.css";
import { HOLES, createGolf, golfScore, holeBudget, holeTolerance, nextHole, retryHole, takeShot, type GolfDifficulty, type GolfState } from "./engine";

const W = 400;
const H = 300;

export default function LossSurfaceGolf() {
  const [game, setGame] = useState<GolfState>(createGolf);
  const [difficulty, setDifficulty] = useState<GolfDifficulty>("field");
  const [optimizer, setOptimizer] = useState<OptimizerKey>("sgd");
  const [schedule, setSchedule] = useState<ScheduleKey>("constant");
  const [lr, setLr] = useState(0.12);
  const [momentum, setMomentum] = useState(0.8);
  const [steps, setSteps] = useState(18);
  const gameRef = useRef(game);
  const reported = useRef(false);
  gameRef.current = game;
  useEffect(() => recordPlayed("loss-surface-golf"), []);
  useEffect(() => {
    if (game.status !== "complete" || reported.current) return;
    reported.current = true; recordWin("loss-surface-golf");
    if (golfScore(game) < 0) unlock("golf-under-par");
    if (game.difficulty === "grant") unlock("golf-grant");
    postResult({ game: "loss-surface-golf", event: "win", mode: `${game.difficulty}-five-hole`, score: -golfScore(game), moves: game.strokes.reduce((a, b) => a + b, 0), meta: { compute: game.computeUsed.reduce((a, b) => a + b, 0) } });
  }, [game]);

  const hole = HOLES[Math.min(game.hole, HOLES.length - 1)];
  const surface = SURFACES_BY_KEY.get(hole.surface)!;
  const budget = holeBudget(hole, game.difficulty);
  const remaining = Math.max(0, budget - game.currentCompute);
  const shotSteps = Math.min(steps, Math.max(1, remaining));
  const distance = Math.hypot(game.ball.x, game.ball.y);
  const sx = (x: number) => ((x - surface.domain[0]) / (surface.domain[1] - surface.domain[0])) * W;
  const sy = (y: number) => H - ((y - surface.range[0]) / (surface.range[1] - surface.range[0])) * H;
  const points = game.ball.path.map(([x, y]) => `${sx(x)},${sy(y)}`).join(" ");
  const restart = (nextDifficulty = difficulty) => { reported.current = false; setDifficulty(nextDifficulty); setGame(createGolf(nextDifficulty)); };

  return (
    <div className={styles.stack}>
      <div className={styles.spread}>
        <div><p className={styles.kicker}>Hole {Math.min(game.hole + 1, HOLES.length)} of {HOLES.length} · par {hole.par}</p><p className={styles.stat}>{hole.name}</p></div>
        <div className={styles.row}><label className={styles.control}>Course<select className={styles.select} value={difficulty} onChange={(e) => restart(e.target.value as GolfDifficulty)}><option value="field">Field course</option><option value="grant">Grant review</option></select></label><button className={styles.button} onClick={() => restart()}>↻ New round</button></div>
      </div>
      {game.status === "complete" ? <div className={styles.banner} role="status"><h2>Course complete · {formatScore(golfScore(game))}</h2><p className={styles.help}>{game.strokes.reduce((a, b) => a + b, 0)} shots · {game.computeUsed.reduce((a, b) => a + b, 0)} gradient evaluations.</p></div> : null}
      {game.status === "hole" ? <div className={styles.banner} role="status"><h2>Converged in {game.currentStrokes} shots using {game.currentCompute} evaluations.</h2><button className={`${styles.button} ${styles.primary}`} onClick={() => setGame((g) => nextHole(g))}>{game.hole === HOLES.length - 1 ? "Finish round" : "Next hole →"}</button></div> : null}
      {game.status === "failed" ? <div className={styles.banner} role="alert"><h2>{game.ball.diverged ? "Shot diverged." : "Compute allocation exhausted."}</h2><p className={styles.help}>Take a two-stroke penalty and retry this surface with a different optimizer or schedule.</p><button className={styles.button} onClick={() => setGame((g) => retryHole(g))}>Penalty + retry</button></div> : null}
      <div className={styles.layout}>
        <section className={styles.course} aria-label={`Loss-surface golf course: ${hole.name}`}>
          <svg viewBox={`0 0 ${W} ${H}`} className={styles.pathSvg} aria-hidden="true" focusable="false"><circle className={styles.holeTarget} cx={sx(0)} cy={sy(0)} r="14" /><polyline className={styles.pathLine} points={points} />{game.ball.path.map(([x, y], i) => <circle key={i} className={styles.pathPoint} cx={sx(x)} cy={sy(y)} r={i === game.ball.path.length - 1 ? 0 : 2.2} />)}{!game.ball.diverged ? <circle className={styles.ball} cx={sx(game.ball.x)} cy={sy(game.ball.y)} r="6" /> : null}</svg>
        </section>
        <aside className={styles.sidebar}>
          <div className={styles.panel}>
            <p className={styles.kicker}>Shot {game.currentStrokes + 1} · target radius {holeTolerance(hole, game.difficulty).toFixed(3)}</p>
            <p className={styles.courseReadout} aria-live="polite"><strong>{distance.toFixed(3)}</strong> distance to target</p>
            <label className={styles.control}>Optimizer<select className={styles.select} value={optimizer} onChange={(e) => setOptimizer(e.target.value as OptimizerKey)}>{(Object.keys(OPTIMIZER_LABELS) as OptimizerKey[]).map((key) => <option key={key} value={key}>{OPTIMIZER_LABELS[key]}</option>)}</select></label>
            <label className={styles.control}>Schedule<select className={styles.select} value={schedule} onChange={(e) => setSchedule(e.target.value as ScheduleKey)}>{(Object.keys(SCHEDULE_LABELS) as ScheduleKey[]).map((key) => <option key={key} value={key}>{SCHEDULE_LABELS[key]}</option>)}</select></label>
            <label className={styles.control}>Peak learning rate · {lr.toFixed(2)}<input className={styles.range} type="range" min="0.01" max="0.7" step="0.01" value={lr} onChange={(e) => setLr(Number(e.target.value))} /></label>
            {optimizer === "momentum" ? <label className={styles.control}>Momentum · {momentum.toFixed(2)}<input className={styles.range} type="range" min="0" max="0.98" step="0.02" value={momentum} onChange={(e) => setMomentum(Number(e.target.value))} /></label> : null}
            <label className={styles.control}>Evaluations this shot · {shotSteps}<input className={styles.range} type="range" min="1" max={Math.max(1, Math.min(60, remaining))} step="1" value={shotSteps} disabled={game.status !== "playing"} onChange={(e) => setSteps(Number(e.target.value))} /></label>
            <div className={styles.meter} role="progressbar" aria-label="Compute budget used" aria-valuemin={0} aria-valuemax={budget} aria-valuenow={game.currentCompute}><span style={{ width: `${Math.min(100, (game.currentCompute / budget) * 100)}%` }} /></div><p className={styles.help}>Compute {game.currentCompute} / {budget} · {remaining} remaining</p>
            <button className={`${styles.button} ${styles.primary}`} disabled={game.status !== "playing"} onClick={() => setGame((g) => takeShot(g, optimizer, schedule, lr, momentum, shotSteps))}>Take shot · {shotSteps} evals</button>
          </div>
          <div className={`${styles.panel} ${styles.scorecard}`}><p className={styles.kicker}>Scorecard</p>{HOLES.map((h, i) => <div className={styles.scoreRow} key={h.key}><span>{i + 1}. {h.name}</span><span>par {h.par}</span><strong>{game.strokes[i] ?? (i === game.hole ? game.currentStrokes : "—")}</strong></div>)}</div>
          <p className={styles.help}>{surface.note}</p>
          <SaveSlot<GolfState> game="loss-surface-golf" getState={() => gameRef.current} onLoad={(s) => { reported.current = false; setDifficulty(s.difficulty); setGame(s); }} validate={isGolfState} />
        </aside>
      </div>
    </div>
  );
}

const formatScore = (n: number) => n === 0 ? "even par" : n > 0 ? `+${n}` : String(n);
const isGolfState = (v: unknown): v is GolfState => { const s = v as GolfState; return !!s && typeof s === "object" && typeof s.hole === "number" && !!s.ball && Array.isArray(s.computeUsed) && (s.difficulty === "field" || s.difficulty === "grant"); };
