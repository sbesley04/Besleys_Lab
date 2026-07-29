"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import styles from "../lab.module.css";
import { useDemoVisit } from "../_components/useDemoVisit";
import { unlock } from "@/lib/arcade";
import { Button, Legend, Picker, Readout, Slider, Transport } from "../_components/Controls";
import { demoScale } from "../_components/Axes";
import { SERIES, heatRamp } from "../_components/plot";
import {
  SURFACES, SURFACES_BY_KEY, initOpt, stepOpt, gradNorm,
  OPTIMIZER_LABELS, type OptState, type OptimizerKey,
} from "./engine";

// Gradient descent on a 2D loss surface. The surface is painted to a canvas as
// a heat map with contour bands; the optimizer paths are drawn as an SVG
// overlay so they stay crisp. Click anywhere to move the starting point.

const W = 520;
const H = 380;
const OPTS: OptimizerKey[] = ["sgd", "momentum", "adam"];
const PATH_COLORS: Record<OptimizerKey, string> = {
  sgd: SERIES.blue,
  momentum: SERIES.rust,
  adam: SERIES.green,
};

export default function GradientDescent() {
  useDemoVisit("gradient-descent");
  const [surfaceKey, setSurfaceKey] = useState("bowl");
  const [lr, setLr] = useState(0.12);
  const [momentum, setMomentum] = useState(0.9);
  const [running, setRunning] = useState(false);
  const [compare, setCompare] = useState(true);
  const [start, setStart] = useState<[number, number]>(SURFACES[0].start);
  const [states, setStates] = useState<Record<OptimizerKey, OptState>>(() => ({
    sgd: initOpt(...SURFACES[0].start),
    momentum: initOpt(...SURFACES[0].start),
    adam: initOpt(...SURFACES[0].start),
  }));

  const surface = SURFACES_BY_KEY.get(surfaceKey)!;
  const scale = useMemo(
    () => demoScale(surface.domain, surface.range, W, H, 34),
    [surface],
  );
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // Memoized so the auto-stop effect below doesn't re-run every render.
  const active: OptimizerKey[] = useMemo(() => (compare ? OPTS : ["sgd"]), [compare]);

  const reset = useCallback(
    (from?: [number, number]) => {
      const p = from ?? start;
      setStates({ sgd: initOpt(...p), momentum: initOpt(...p), adam: initOpt(...p) });
      setRunning(false);
    },
    [start],
  );

  // Switching surfaces resets everything to that surface's default start.
  useEffect(() => {
    setStart(surface.start);
    setStates({
      sgd: initOpt(...surface.start),
      momentum: initOpt(...surface.start),
      adam: initOpt(...surface.start),
    });
    setRunning(false);
  }, [surface]);

  const step = useCallback(() => {
    setStates((s) => ({
      sgd: stepOpt(s.sgd, surface, "sgd", lr, momentum),
      momentum: stepOpt(s.momentum, surface, "momentum", lr, momentum),
      adam: stepOpt(s.adam, surface, "adam", lr, momentum),
    }));
  }, [surface, lr, momentum]);

  // Animation loop.
  useEffect(() => {
    if (!running) return;
    const id = setInterval(step, 60);
    return () => clearInterval(id);
  }, [running, step]);

  // Stop automatically once every active path has settled or blown up.
  useEffect(() => {
    if (!running) return;
    const done = active.every((k) => {
      const s = states[k];
      return s.diverged || (s.t > 8 && gradNorm(surface, s.x, s.y) < 1e-3);
    });
    if (done) setRunning(false);
  }, [states, running, active, surface]);

  // Blowing up a run is a rite of passage, so it's worth an achievement.
  useEffect(() => {
    if (OPTS.some((k) => states[k].diverged)) unlock("lab-diverged");
  }, [states]);

  // Paint the loss surface.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const img = ctx.createImageData(W, H);
    // Sample the surface once to get its range for normalization.
    let lo = Infinity;
    let hi = -Infinity;
    const vals = new Float64Array(W * H);
    for (let py = 0; py < H; py++) {
      for (let px = 0; px < W; px++) {
        const v = surface.f(scale.invX(px), scale.invY(py));
        vals[py * W + px] = v;
        if (v < lo) lo = v;
        if (v > hi) hi = v;
      }
    }
    const span = hi - lo || 1;
    for (let i = 0; i < vals.length; i++) {
      // sqrt compresses the top end so low-loss detail stays visible.
      let t = Math.sqrt((vals[i] - lo) / span);
      // Contour banding: darken thin bands at regular loss intervals.
      const band = (t * 11) % 1;
      const isContour = band < 0.055;
      const [r, g, b] = heatRamp(t);
      const k = i * 4;
      const shade = isContour ? 0.82 : 1;
      img.data[k] = r * shade;
      img.data[k + 1] = g * shade;
      img.data[k + 2] = b * shade;
      img.data[k + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
  }, [surface, scale]);

  function onCanvasClick(e: React.MouseEvent) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * W;
    const py = ((e.clientY - rect.top) / rect.height) * H;
    const p: [number, number] = [scale.invX(px), scale.invY(py)];
    setStart(p);
    reset(p);
  }

  const lead = states[active[0]];
  const tooFast = lr > surface.divergesAbove;

  return (
    <div className={styles.layout}>
      <Picker
        label="Loss surface"
        value={surfaceKey}
        onChange={setSurfaceKey}
        options={SURFACES.map((s) => ({ value: s.key, label: s.name }))}
      />
      <p className={styles.note}>{surface.note}</p>

      <div className={styles.stage}>
        <div className={styles.plotWrap}>
          <canvas
            ref={canvasRef}
            width={W}
            height={H}
            className={`${styles.plotCanvas} ${styles.clickable}`}
            onClick={onCanvasClick}
            aria-label={`${surface.name} loss surface — click to choose a starting point`}
          />
          <svg className={styles.plotOverlay} viewBox={`0 0 ${W} ${H}`} aria-hidden>
            {active.map((k) => {
              const s = states[k];
              if (s.path.length < 2) return null;
              return (
                <polyline
                  key={k}
                  points={s.path.map(([x, y]) => `${scale.x(x)},${scale.y(y)}`).join(" ")}
                  fill="none"
                  stroke={PATH_COLORS[k]}
                  strokeWidth={2}
                  strokeLinejoin="round"
                  opacity={0.9}
                />
              );
            })}
            {active.map((k) => {
              const s = states[k];
              return (
                <circle
                  key={`dot-${k}`}
                  cx={scale.x(s.x)}
                  cy={scale.y(s.y)}
                  r={5}
                  fill={PATH_COLORS[k]}
                  stroke="#fff"
                  strokeWidth={1.5}
                  opacity={s.diverged ? 0.25 : 1}
                />
              );
            })}
            {/* Start marker */}
            <circle
              cx={scale.x(start[0])}
              cy={scale.y(start[1])}
              r={3}
              fill="none"
              stroke="#fff"
              strokeWidth={1.5}
              opacity={0.85}
            />
          </svg>
        </div>
      </div>

      <Transport
        running={running}
        onToggle={() => setRunning((r) => !r)}
        onStep={step}
        onReset={() => reset()}
      />

      <div className={styles.sliderGrid}>
        <Slider
          label="Learning rate"
          value={lr}
          onChange={setLr}
          min={0.005}
          max={1.2}
          step={0.005}
          format={(v) => v.toFixed(3)}
        />
        <Slider
          label="Momentum β"
          value={momentum}
          onChange={setMomentum}
          min={0}
          max={0.98}
          step={0.01}
          format={(v) => v.toFixed(2)}
          disabled={!compare && true}
        />
      </div>

      <div className={styles.controls}>
        <Button active={compare} onClick={() => setCompare((c) => !c)}>
          {compare ? "Comparing all three" : "SGD only"}
        </Button>
        <Button onClick={() => { setLr(surface.divergesAbove * 1.35); reset(); }}>
          💥 Make it diverge
        </Button>
      </div>

      {compare && (
        <Legend
          items={OPTS.map((k) => ({ color: PATH_COLORS[k], label: OPTIMIZER_LABELS[k] }))}
        />
      )}

      <div className={styles.readouts}>
        <Readout label="step" value={lead.t} />
        <Readout label="loss" value={lead.diverged ? "∞" : surface.f(lead.x, lead.y).toFixed(4)} />
        <Readout label="‖∇‖" value={lead.diverged ? "∞" : gradNorm(surface, lead.x, lead.y).toFixed(4)} />
        <Readout label="position" value={`(${lead.x.toFixed(2)}, ${lead.y.toFixed(2)})`} />
      </div>

      <p className={styles.aside}>
        {lead.diverged
          ? "That's divergence: each step overshoots harder than the last, and the loss runs off to infinity."
          : tooFast
            ? "This rate is past the stable limit for this surface — run it and watch the path fly apart."
            : "Click anywhere on the surface to start from there. Then try nudging the learning rate up until it breaks."}
      </p>

      <p className={styles.note}>
        Colors run cream (low loss) to deep rust (high). The bands are contour lines — where they
        bunch together, the surface is steep. Every path here follows the true analytic gradient,
        not a finite-difference approximation.
      </p>
    </div>
  );
}
