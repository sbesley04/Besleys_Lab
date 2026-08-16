"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import styles from "../lab.module.css";
import { useDemoVisit } from "../_components/useDemoVisit";
import { Axes, DataLine, demoScale } from "../_components/Axes";
import { Legend, Readout, Slider, Transport } from "../_components/Controls";
import { SERIES } from "../_components/plot";
import {
  SURFACES_BY_KEY, initOpt, stepOpt, scheduleLr,
  SCHEDULE_LABELS, SCHEDULE_NOTES, type ScheduleKey, type OptState,
} from "../gradient-descent/engine";

// Learning-rate schedules, three ways: the rate over time, the loss each
// schedule achieves, and the actual descent paths they trace on a shared
// surface. Same optimizer, same budget, same start — only the schedule differs.

const SCHEDULES: ScheduleKey[] = ["constant", "step", "cosine", "warmup"];
const DASHES: Record<ScheduleKey, string | undefined> = {
  constant: undefined,
  step: "7 3",
  cosine: "2 3",
  warmup: "9 3 2 3",
};

const TOTAL = 160;
const SURFACE = SURFACES_BY_KEY.get("ravine")!;

interface Run {
  opt: OptState;
  losses: number[];
}

function freshRuns(): Record<ScheduleKey, Run> {
  const mk = (): Run => ({ opt: initOpt(...SURFACE.start), losses: [SURFACE.f(...SURFACE.start)] });
  return { constant: mk(), step: mk(), cosine: mk(), warmup: mk() };
}

export default function LrSchedules() {
  const themeVersion = useDemoVisit("lr-schedules");
  const [base, setBase] = useState(0.26);
  const [running, setRunning] = useState(false);
  const [sim, setSim] = useState<{ t: number; runs: Record<ScheduleKey, Run> }>(() => ({
    t: 0,
    runs: freshRuns(),
  }));
  const [focus, setFocus] = useState<ScheduleKey>("cosine");
  const { t, runs } = sim;
  const colors = useMemo<Record<ScheduleKey, string>>(
    () => {
      // The event mutates SERIES in place; the version intentionally refreshes captured strings.
      void themeVersion;
      return { constant: SERIES.ink, step: SERIES.blue, cosine: SERIES.rust, warmup: SERIES.green };
    },
    [themeVersion],
  );

  const lrScale = useMemo(() => demoScale([0, TOTAL], [0, base * 1.08], 420, 190, 34), [base]);
  const lossScale = useMemo(() => demoScale([0, TOTAL], [0, 3.2], 420, 190, 38), []);
  const pathScale = useMemo(
    () => demoScale(SURFACE.domain, SURFACE.range, 420, 240, 30),
    [],
  );

  const reset = useCallback(() => {
    setSim({ t: 0, runs: freshRuns() });
    setRunning(false);
  }, []);

  // Changing the peak rate invalidates every run in progress.
  useEffect(() => {
    reset();
  }, [base, reset]);

  // The step counter and the four runs advance as one unit — updating them in
  // a single pure updater (rather than nesting setState calls) keeps them in
  // lockstep and stops StrictMode's double-invoke from stepping twice per tick.
  const step = useCallback(() => {
    setSim((s) => {
      if (s.t >= TOTAL) return s;
      const runs = { ...s.runs };
      for (const key of SCHEDULES) {
        const lr = scheduleLr(key, base, s.t, TOTAL);
        const opt = stepOpt(s.runs[key].opt, SURFACE, "sgd", lr, 0);
        runs[key] = {
          opt,
          losses: [...s.runs[key].losses, opt.diverged ? NaN : SURFACE.f(opt.x, opt.y)],
        };
      }
      return { t: s.t + 1, runs };
    });
  }, [base]);

  useEffect(() => {
    if (!running) return;
    const id = setInterval(step, 40);
    return () => clearInterval(id);
  }, [running, step]);

  // Stop at the end of the budget (outside the updater, where effects belong).
  useEffect(() => {
    if (t >= TOTAL) setRunning(false);
  }, [t]);

  // Schedule curves (recomputed cheaply; TOTAL is small).
  const lrCurves = useMemo(() => {
    const out: Record<ScheduleKey, [number, number][]> = {
      constant: [], step: [], cosine: [], warmup: [],
    };
    for (const s of SCHEDULES) {
      for (let i = 0; i <= TOTAL; i++) out[s].push([i, scheduleLr(s, base, i, TOTAL)]);
    }
    return out;
  }, [base]);

  const finalLosses = SCHEDULES.map((s) => ({
    key: s,
    loss: runs[s].opt.diverged ? Infinity : SURFACE.f(runs[s].opt.x, runs[s].opt.y),
  })).sort((a, b) => a.loss - b.loss);

  return (
    <div className={styles.layout}>
      <div className={styles.stage}>
        <div className={styles.stageRow}>
          <div className={styles.plotWrap}>
            <p className={styles.panelTitle}>Learning rate over training</p>
            <svg className={styles.plotSvg} viewBox={`0 0 ${lrScale.width} ${lrScale.height}`} role="img" aria-label="Learning rate schedules over time">
              <Axes scale={lrScale} xLabel="step" yLabel="lr" format={(v) => (v < 1 ? v.toFixed(2) : String(v))} />
              {SCHEDULES.map((s) => (
                <DataLine
                  key={s}
                  points={lrCurves[s]}
                  scale={lrScale}
                  color={colors[s]}
                  width={focus === s ? 2.6 : 1.5}
                  opacity={focus === s ? 1 : 0.45}
                  dash={DASHES[s]}
                />
              ))}
              {t > 0 && (
                <line
                  x1={lrScale.x(t)} x2={lrScale.x(t)}
                  y1={lrScale.pad} y2={lrScale.height - lrScale.pad}
                  stroke="var(--ink)" strokeWidth={1} strokeDasharray="3 3" opacity={0.6}
                />
              )}
            </svg>
          </div>

          <div className={styles.plotWrap}>
            <p className={styles.panelTitle}>Loss reached</p>
            <svg className={styles.plotSvg} viewBox={`0 0 ${lossScale.width} ${lossScale.height}`} role="img" aria-label="Loss curves per schedule">
              <Axes scale={lossScale} xLabel="step" yLabel="loss" />
              {SCHEDULES.map((s) => (
                <DataLine
                  key={s}
                  points={runs[s].losses
                    .map((l, i) => [i, Math.min(l, 3.2)] as [number, number])
                    .filter(([, l]) => Number.isFinite(l))}
                  scale={lossScale}
                  color={colors[s]}
                  width={focus === s ? 2.6 : 1.5}
                  opacity={focus === s ? 1 : 0.45}
                  dash={DASHES[s]}
                />
              ))}
            </svg>
          </div>
        </div>

        <div className={`${styles.plotWrap} ${styles.plotTopMargin}`}>
          <p className={styles.panelTitle}>Descent paths (same surface, same start)</p>
          <svg className={styles.plotSvg} viewBox={`0 0 ${pathScale.width} ${pathScale.height}`} role="img" aria-label="Descent paths per schedule">
            <Axes scale={pathScale} grid xLabel="x" yLabel="y" />
            {SCHEDULES.map((s) => (
              <DataLine
                key={s}
                points={runs[s].opt.path}
                scale={pathScale}
                color={colors[s]}
                width={focus === s ? 2.4 : 1.3}
                opacity={focus === s ? 1 : 0.4}
                dash={DASHES[s]}
              />
            ))}
            {SCHEDULES.map((s) => (
              <circle
                key={`d-${s}`}
                cx={pathScale.x(runs[s].opt.x)}
                cy={pathScale.y(runs[s].opt.y)}
                r={focus === s ? 5 : 3.5}
                fill={colors[s]}
                stroke="var(--paper)"
                strokeWidth={1.2}
                opacity={runs[s].opt.diverged ? 0.2 : 1}
              />
            ))}
            <circle cx={pathScale.x(0)} cy={pathScale.y(0)} r={4} fill="none" stroke="var(--ink)" strokeWidth={1.4} strokeDasharray="2 2" />
          </svg>
        </div>
      </div>

      <Transport running={running} onToggle={() => setRunning((r) => !r)} onStep={step} onReset={reset} />

      <div className={styles.sliderGrid}>
        <Slider
          label="Peak learning rate"
          value={base}
          onChange={setBase}
          min={0.02}
          max={0.6}
          step={0.005}
          format={(v) => v.toFixed(3)}
        />
        <div className={styles.readouts}>
          <Readout label="step" value={`${t} / ${TOTAL}`} />
        </div>
      </div>

      <div className={styles.controls} role="group" aria-label="Highlight a schedule">
        {SCHEDULES.map((s) => (
          <button
            key={s}
            type="button"
            className={`${styles.button} ${focus === s ? styles.buttonActive : ""}`}
            onClick={() => setFocus(s)}
            aria-pressed={focus === s}
          >
            {SCHEDULE_LABELS[s]}
          </button>
        ))}
      </div>

      <p className={styles.note}>{SCHEDULE_NOTES[focus]}</p>

      <Legend items={SCHEDULES.map((s) => ({ color: colors[s], label: SCHEDULE_LABELS[s] }))} />

      {t >= TOTAL && (
        <p className={styles.aside} role="status">
          Finished. Best final loss: {SCHEDULE_LABELS[finalLosses[0].key]} at{" "}
          {finalLosses[0].loss.toFixed(4)} — worst: {SCHEDULE_LABELS[finalLosses[finalLosses.length - 1].key]}.
        </p>
      )}

      <p className={styles.note}>
        All four runs use plain SGD on the same ravine from the same starting point, with the same
        number of steps. The only difference is how the learning rate changes along the way. Push
        the peak rate up and watch which schedules survive it — that robustness is the real
        argument for warmup.
      </p>
    </div>
  );
}
