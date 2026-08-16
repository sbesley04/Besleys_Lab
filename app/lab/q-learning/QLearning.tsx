"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import styles from "../lab.module.css";
import { useDemoVisit } from "../_components/useDemoVisit";
import { unlock } from "@/lib/arcade";
import { Axes, DataLine, demoScale } from "../_components/Axes";
import { Button, Readout, Slider, Transport } from "../_components/Controls";
import { SERIES, heatRamp, seededRng } from "../_components/plot";
import {
  makeGrid, initQ, qStep, runEpisodes, greedyPolicy, values, successRate,
  evaluatePolicy, ACTION_LABELS, DEFAULT_GRID, MAX_EPISODE_STEPS, type QState,
} from "./engine";

// Tabular Q-learning on a gridworld. The agent starts knowing nothing: the
// arrows are its current policy, the shading is its value estimate, and both
// sharpen from noise into a plan as episodes accumulate.

const CELL = 62;

export default function QLearning() {
  useDemoVisit("q-learning");
  const grid = useMemo(() => makeGrid(DEFAULT_GRID), []);
  const [q, setQ] = useState<QState>(() => initQ(grid));
  const [epsilon, setEpsilon] = useState(0.25);
  const [alpha, setAlpha] = useState(0.5);
  const [gamma, setGamma] = useState(0.95);
  const [running, setRunning] = useState(false);
  const [showValues, setShowValues] = useState(true);
  const rng = useMemo(() => seededRng(2024), []);

  const params = useMemo(() => ({ epsilon, alpha, gamma }), [epsilon, alpha, gamma]);

  const step = useCallback(() => {
    setQ((s) => qStep(s, grid, params, rng).q);
  }, [grid, params, rng]);

  const train = useCallback(
    (episodes: number) => {
      setQ((s) => runEpisodes(s, grid, params, episodes, rng));
    },
    [grid, params, rng],
  );

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      // A few steps per frame so it's watchable but not glacial.
      setQ((s) => {
        let cur = s;
        for (let i = 0; i < 6; i++) cur = qStep(cur, grid, params, rng).q;
        return cur;
      });
    }, 55);
    return () => clearInterval(id);
  }, [running, grid, params, rng]);

  const policy = greedyPolicy(q, grid);
  const vals = values(q);
  const maxV = Math.max(0.001, ...vals.map(Math.abs));
  const rate = successRate(q);
  // What the policy does with exploration switched off — the real measure.
  const evaluation = useMemo(() => evaluatePolicy(q, grid), [q, grid]);

  // A policy that actually solves the grid is a real accomplishment.
  useEffect(() => {
    if (q.episode >= 20 && evaluation.reached) unlock("lab-policy");
  }, [q.episode, evaluation.reached]);

  const curveScale = useMemo(
    () => demoScale([0, Math.max(40, q.history.length)], [-1.4, 1.2], 420, 180, 36),
    [q.history.length],
  );
  // Smoothed reward per episode.
  const curve = useMemo(() => {
    const out: [number, number][] = [];
    const win = 12;
    let sum = 0;
    for (let i = 0; i < q.history.length; i++) {
      sum += q.history[i].reward;
      if (i > win) sum -= q.history[i - win - 1].reward;
      out.push([i, sum / Math.min(i + 1, win + 1)]);
    }
    return out;
  }, [q.history]);

  return (
    <div className={styles.layout}>
      <div className={styles.stage}>
        <div className={styles.stageRow}>
          <svg
            viewBox={`0 0 ${grid.cols * CELL} ${grid.rows * CELL}`}
            className={`${styles.plotSvg} ${styles.flexWide}`}
            role="img"
            aria-label={`Gridworld after ${q.episode} episodes. ${evaluation.reached ? `The greedy policy reaches the goal in ${evaluation.steps} steps.` : "The greedy policy does not reach the goal yet."}`}
          >
            {grid.cells.map((cell, i) => {
              const c = i % grid.cols;
              const r = Math.floor(i / grid.cols);
              const x = c * CELL;
              const y = r * CELL;
              let fill = "var(--paper)";
              if (cell.wall) fill = "var(--ink-soft)";
              else if (cell.pit) fill = "rgba(160,60,46,0.75)";
              else if (cell.goal) fill = "rgba(63,125,79,0.8)";
              else if (showValues) {
                const v = vals[i];
                const [rr, gg, bb] = heatRamp(Math.max(0, v) / maxV);
                fill = `rgb(${rr},${gg},${bb})`;
              }
              return (
                <g key={i}>
                  <rect x={x} y={y} width={CELL - 1} height={CELL - 1} fill={fill} stroke="var(--line)" strokeWidth={1} />
                  {!cell.wall && !cell.pit && !cell.goal && q.episode > 0 && (
                    <text
                      x={x + CELL / 2}
                      y={y + CELL / 2 + 7}
                      textAnchor="middle"
                      fontSize={20}
                      fill="var(--ink)"
                      opacity={0.75}
                    >
                      {ACTION_LABELS[policy[i]]}
                    </text>
                  )}
                  {cell.goal && (
                    <text x={x + CELL / 2} y={y + CELL / 2 + 8} textAnchor="middle" fontSize={22}>🏁</text>
                  )}
                  {cell.pit && (
                    <text x={x + CELL / 2} y={y + CELL / 2 + 7} textAnchor="middle" fontSize={18}>✖</text>
                  )}
                  {i === grid.start && (
                    <text x={x + 6} y={y + 14} fontSize={9} fill="var(--ink-soft)">start</text>
                  )}
                  {showValues && !cell.wall && (
                    <text x={x + 4} y={y + CELL - 5} fontSize={8} fill="var(--ink-soft)" opacity={0.8}>
                      {vals[i].toFixed(2)}
                    </text>
                  )}
                </g>
              );
            })}
            {/* The agent */}
            <circle
              cx={(q.s % grid.cols) * CELL + CELL / 2}
              cy={Math.floor(q.s / grid.cols) * CELL + CELL / 2}
              r={13}
              fill={SERIES.blue}
              stroke="#fff"
              strokeWidth={2.5}
            />
          </svg>
        </div>
      </div>

      <Transport
        running={running}
        onToggle={() => setRunning((r) => !r)}
        onStep={step}
        onReset={() => { setQ(initQ(grid)); setRunning(false); }}
      />

      <div className={styles.controls}>
        <Button onClick={() => train(50)}>⏩ 50 episodes</Button>
        <Button onClick={() => train(500)}>⏩⏩ 500 episodes</Button>
        <Button active={showValues} onClick={() => setShowValues((v) => !v)}>
          {showValues ? "Showing values" : "Values hidden"}
        </Button>
      </div>

      <div className={styles.sliderGrid}>
        <Slider label="ε — exploration" value={epsilon} onChange={setEpsilon} min={0} max={1} step={0.01} format={(v) => v.toFixed(2)} />
        <Slider label="α — learning rate" value={alpha} onChange={setAlpha} min={0.05} max={1} step={0.05} format={(v) => v.toFixed(2)} />
        <Slider label="γ — discount" value={gamma} onChange={setGamma} min={0.5} max={0.999} step={0.005} format={(v) => v.toFixed(3)} />
      </div>

      <div className={styles.readouts}>
        <Readout label="episode" value={q.episode} />
        <Readout label="steps this episode" value={`${q.stepsThisEpisode} / ${MAX_EPISODE_STEPS}`} />
        <Readout label="success while exploring" value={`${(rate * 100).toFixed(0)}%`} />
        <Readout
          label="greedy policy"
          value={
            q.episode === 0
              ? "—"
              : evaluation.reached
                ? `reaches goal in ${evaluation.steps} steps`
                : "doesn't reach the goal yet"
          }
        />
      </div>
      <p className={`${styles.note} ${styles.compactNote}`}>
        Those two numbers measure different things: the first includes the random moves ε forces
        the agent to make, so it stays low by design. The second switches exploration off and asks
        what the agent has actually <em>learned</em>.
      </p>

      {q.history.length > 1 && (
        <div className={styles.stage}>
          <p className={styles.panelTitle}>Reward per episode (smoothed)</p>
          <svg className={styles.plotSvg} viewBox={`0 0 ${curveScale.width} ${curveScale.height}`} role="img" aria-label="Learning curve">
            <Axes scale={curveScale} xLabel="episode" yLabel="reward" />
            <line
              x1={curveScale.x(0)} y1={curveScale.y(0)}
              x2={curveScale.x(Math.max(40, q.history.length))} y2={curveScale.y(0)}
              stroke="var(--ink-soft)" strokeWidth={1} strokeDasharray="3 3" opacity={0.5}
            />
            <DataLine points={curve} scale={curveScale} color={SERIES.green} width={2} />
          </svg>
        </div>
      )}

      <p className={styles.aside} aria-live="polite">
        {q.episode === 0
          ? "Right now the agent knows nothing — no map, no rules, not even which way the goal is. Press Run."
          : rate > 0.8
            ? "It has a policy. Follow the arrows from the start: that path was never programmed, only rewarded."
            : "Learning. Early episodes are mostly flailing into pits — that's the cost of exploration."}
      </p>

      <p className={styles.note}>
        The agent only ever receives a number: +1 at the flag, −1 in a pit, and a small penalty for
        every step (which is why it learns to hurry rather than wander). Each cell&rsquo;s shading is{" "}
        <em>V(s) = max Q(s,a)</em>, its estimate of how good it is to stand there. Notice the value
        spreading <em>backwards</em> from the goal — that&rsquo;s the discount γ propagating reward
        one cell at a time, and it&rsquo;s the whole mechanism.
      </p>
      <p className={styles.note}>
        Set <strong>ε = 0</strong> and reset: with no exploration the agent commits to the first
        mediocre thing it finds and never discovers better. Set <strong>ε = 1</strong> and it never
        exploits what it learned. That tension is the exploration/exploitation tradeoff, and there
        is no setting that escapes it.
      </p>
    </div>
  );
}
