"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import styles from "../lab.module.css";
import { useDemoVisit } from "../_components/useDemoVisit";
import { Button, Legend, Readout, Slider } from "../_components/Controls";
import { SERIES } from "../_components/plot";
import {
  posterior, negativePosterior, confusionCounts, likelihoodRatio,
  SCENARIOS, formatPercent,
} from "./engine";

// Bayes' theorem as proportional area. A grid of 10,000 people, colored by
// what the test said and whether they actually have the disease — the
// false-positive block is the whole lesson.

const POP = 10_000;
const COLS = 100;
const CELL = 4.6;

export default function Bayes() {
  useDemoVisit("bayes");
  const [prevalence, setPrevalence] = useState(0.01);
  const [sensitivity, setSensitivity] = useState(0.99);
  const [specificity, setSpecificity] = useState(0.95);
  const [scenario, setScenario] = useState("textbook");
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const counts = useMemo(
    () => confusionCounts(POP, prevalence, sensitivity, specificity),
    [prevalence, sensitivity, specificity],
  );
  const post = posterior(prevalence, sensitivity, specificity);
  const negPost = negativePosterior(prevalence, sensitivity, specificity);
  const lr = likelihoodRatio(sensitivity, specificity);
  const positives = counts.tp + counts.fp;

  function applyScenario(key: string) {
    const s = SCENARIOS.find((x) => x.key === key);
    if (!s) return;
    setScenario(key);
    setPrevalence(s.prevalence);
    setSensitivity(s.sensitivity);
    setSpecificity(s.specificity);
  }

  const COLORS: Record<string, string> = {
    tp: SERIES.rust,
    fn: SERIES.gold,
    fp: SERIES.blue,
    tn: "rgba(120,116,108,0.30)",
  };
  const rows = Math.ceil(POP / COLS);

  // 10,000 people is 10,000 marks — far too many DOM nodes, so the population
  // grid is painted to a canvas. Drawn in a fixed order (true positives, missed
  // cases, false positives, then healthy negatives) so each group stays a
  // contiguous block you can compare by area.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const groups: [string, number][] = [
      ["tp", counts.tp],
      ["fn", counts.fn],
      ["fp", counts.fp],
      ["tn", counts.tn],
    ];
    let i = 0;
    for (const [kind, n] of groups) {
      ctx.fillStyle = COLORS[kind];
      for (let k = 0; k < n; k++, i++) {
        const x = (i % COLS) * CELL;
        const y = Math.floor(i / COLS) * CELL;
        ctx.fillRect(x, y, CELL - 0.6, CELL - 0.6);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [counts]);

  return (
    <div className={styles.layout}>
      <div className={styles.controls} role="group" aria-label="Scenario">
        {SCENARIOS.map((s) => (
          <Button key={s.key} active={scenario === s.key} onClick={() => applyScenario(s.key)}>
            {s.name}
          </Button>
        ))}
      </div>
      <p className={styles.note}>{SCENARIOS.find((s) => s.key === scenario)?.note}</p>

      <div className={styles.stage}>
        <canvas
          ref={canvasRef}
          width={COLS * CELL}
          height={rows * CELL}
          className={styles.plotCanvas}
          role="img"
          aria-label={`Ten thousand people: ${counts.tp} correctly identified as sick, ${counts.fp} healthy people wrongly flagged, ${counts.fn} sick people missed, ${counts.tn} healthy people correctly cleared`}
        />
      </div>

      <Legend
        items={[
          { color: SERIES.rust, label: `Sick, tested positive (${counts.tp})` },
          { color: SERIES.blue, label: `Healthy, tested positive (${counts.fp})` },
          { color: SERIES.gold, label: `Sick, tested negative (${counts.fn})` },
          { color: "rgba(120,116,108,0.35)", label: `Healthy, tested negative (${counts.tn})` },
        ]}
      />

      <div className={styles.sliderGrid}>
        <Slider
          label="Prevalence — how common the disease is"
          value={prevalence}
          onChange={(v) => { setPrevalence(v); setScenario("custom"); }}
          min={0.0005}
          max={0.5}
          step={0.0005}
          format={(v) => formatPercent(v, 2)}
        />
        <Slider
          label="Sensitivity — catches the sick"
          value={sensitivity}
          onChange={(v) => { setSensitivity(v); setScenario("custom"); }}
          min={0.5}
          max={1}
          step={0.005}
          format={(v) => formatPercent(v)}
        />
        <Slider
          label="Specificity — clears the healthy"
          value={specificity}
          onChange={(v) => { setSpecificity(v); setScenario("custom"); }}
          min={0.5}
          max={1}
          step={0.005}
          format={(v) => formatPercent(v)}
        />
      </div>

      <div
        className="paper-card"
        style={{ padding: "1.1rem 1.25rem", textAlign: "center" }}
      >
        <p style={{ margin: 0, color: "var(--ink-soft)", fontSize: "0.9rem" }}>
          You tested positive. The chance you actually have it:
        </p>
        <p
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "2.6rem",
            margin: "0.2rem 0 0.1rem",
            color: post < 0.5 ? SERIES.blue : SERIES.rust,
          }}
        >
          {formatPercent(post)}
        </p>
        <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--ink-soft)" }}>
          {counts.tp} of the {positives.toLocaleString()} people who tested positive are actually sick.
        </p>
      </div>

      <div className={styles.readouts}>
        <Readout label="P(healthy | negative)" value={formatPercent(negPost, 2)} />
        <Readout label="likelihood ratio" value={Number.isFinite(lr) ? `${lr.toFixed(1)}×` : "∞"} />
        <Readout label="false positives" value={counts.fp.toLocaleString()} />
        <Readout label="missed cases" value={counts.fn.toLocaleString()} />
      </div>

      <p className={styles.aside}>
        {post < 0.3
          ? "Most of the positives are blue — healthy people the test got wrong. There are simply far more healthy people to be wrong about."
          : post < 0.7
            ? "Roughly a coin flip. This is the region where a second, independent test earns its keep."
            : "Now a positive result means something — because you started with real reason to suspect."}
      </p>

      <p className={styles.note}>
        The trap is that &ldquo;99% accurate&rdquo; describes the test, not your situation.
        What matters is how many <em>healthy</em> people get tested, because even a small error rate
        applied to a large healthy population can swamp the true positives entirely. Slide
        prevalence up and watch the answer transform without touching the test&rsquo;s accuracy at
        all — same test, same person, completely different meaning.
      </p>
    </div>
  );
}
