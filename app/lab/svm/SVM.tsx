"use client";

import { useEffect, useMemo, useState } from "react";
import styles from "../lab.module.css";
import { useDemoVisit } from "../_components/useDemoVisit";
import PointCanvas from "../_components/PointCanvas";
import { Axes, demoScale } from "../_components/Axes";
import { Button, Legend, Readout, Slider } from "../_components/Controls";
import { CLASS_COLORS, SERIES, seededRng } from "../_components/plot";
import {
  fitSVM, svmMargin, svmDecision, supportVectors, sampleTwoBlobs, sampleRings,
  type LabeledPt,
} from "../regression/engine";

// Linear SVM with a live margin, plus the kernel view: the same ring dataset
// re-plotted with radius as an axis, where a straight line suddenly works.

const W = 480;
const H = 380;
const DOMAIN: [number, number] = [-5, 5];
const RANGE: [number, number] = [-4, 4];

export default function SVM() {
  useDemoVisit("svm");
  const scale = useMemo(() => demoScale(DOMAIN, RANGE, W, H, 34), []);
  const [points, setPoints] = useState<LabeledPt[]>([]);
  const [brush, setBrush] = useState(0);
  const [C, setC] = useState(1);
  const [mode, setMode] = useState<"linear" | "rings">("linear");

  useEffect(() => {
    setPoints(sampleTwoBlobs(24, seededRng(3)));
  }, []);

  const fit = useMemo(() => fitSVM(points, 1500, C), [points, C]);
  const margin = svmMargin(fit);
  const svIdx = useMemo(() => new Set(supportVectors(fit, points)), [fit, points]);

  // Boundary and margin lines: w·x + b = {0, +1, -1}, solved for y across the plot.
  const lineFor = (offset: number): [number, number][] | null => {
    const [w1, w2] = fit.w;
    if (Math.abs(w2) < 1e-6) {
      if (Math.abs(w1) < 1e-6) return null;
      const x = (offset - fit.b) / w1;
      return [[x, RANGE[0]], [x, RANGE[1]]];
    }
    const yAt = (x: number) => (offset - fit.b - w1 * x) / w2;
    return [[DOMAIN[0], yAt(DOMAIN[0])], [DOMAIN[1], yAt(DOMAIN[1])]];
  };

  const boundary = lineFor(0);
  const upper = lineFor(1);
  const lower = lineFor(-1);
  const toPath = (pts: [number, number][] | null) =>
    pts ? pts.map(([x, y]) => `${scale.x(x)},${scale.y(y)}`).join(" ") : "";

  // --- Kernel view ---
  const kernelScale = useMemo(() => demoScale([0, 4], [0, 14], 420, 300, 38), []);
  const kernelPoints = points.map((p) => ({
    x: Math.hypot(p.x, p.y),
    y: p.x * p.x + p.y * p.y,
    label: p.label,
  }));

  const misclassified = points.filter(
    (p) => (svmDecision(fit, p.x, p.y) > 0 ? 1 : 0) !== p.label,
  ).length;

  return (
    <div className={styles.layout}>
      <div className={styles.controls} role="group" aria-label="Dataset">
        <Button active={mode === "linear"} onClick={() => { setMode("linear"); setPoints(sampleTwoBlobs(24, seededRng(3))); }}>
          Separable blobs
        </Button>
        <Button active={mode === "rings"} onClick={() => { setMode("rings"); setPoints(sampleRings(40, seededRng(9))); }}>
          Concentric rings
        </Button>
        <Button onClick={() => setPoints([])} disabled={points.length === 0}>Clear</Button>
      </div>

      <div className={styles.stage}>
        <PointCanvas
          ariaLabel="SVM classification plot — click to add points, drag to move them"
          points={points}
          scale={scale}
          colors={CLASS_COLORS}
          onAdd={(p) => setPoints((pts) => [...pts, { ...p, label: brush }])}
          onMove={(i, p) => setPoints((pts) => pts.map((q, j) => (j === i ? { ...q, ...p } : q)))}
          onRemove={(i) => setPoints((pts) => pts.filter((_, j) => j !== i))}
          xLabel="x₁"
          yLabel="x₂"
          underlay={
            <g>
              {/* Margin band */}
              {upper && lower && (
                <polygon
                  points={`${toPath(upper)} ${toPath([...lower].reverse())}`}
                  fill={SERIES.gold}
                  opacity={0.12}
                />
              )}
              {boundary && <polyline points={toPath(boundary)} fill="none" stroke={SERIES.ink} strokeWidth={2.2} />}
              {upper && <polyline points={toPath(upper)} fill="none" stroke={SERIES.ink} strokeWidth={1} strokeDasharray="5 4" opacity={0.7} />}
              {lower && <polyline points={toPath(lower)} fill="none" stroke={SERIES.ink} strokeWidth={1} strokeDasharray="5 4" opacity={0.7} />}
            </g>
          }
        >
          {/* Ring the support vectors */}
          {points.map((p, i) =>
            svIdx.has(i) ? (
              <circle
                key={`sv-${i}`}
                cx={scale.x(p.x)}
                cy={scale.y(p.y)}
                r={9}
                fill="none"
                stroke={SERIES.ink}
                strokeWidth={1.4}
                opacity={0.75}
              />
            ) : null,
          )}
        </PointCanvas>
      </div>

      <div className={styles.controls}>
        <span className={styles.note}>Add points as:</span>
        <Button active={brush === 0} onClick={() => setBrush(0)}>● Class A</Button>
        <Button active={brush === 1} onClick={() => setBrush(1)}>● Class B</Button>
      </div>

      <div className={styles.sliderGrid}>
        <Slider
          label="C (violation penalty)"
          value={C}
          onChange={setC}
          min={0.05}
          max={12}
          step={0.05}
          format={(v) => v.toFixed(2)}
        />
        <div className={styles.readouts}>
          <Readout label="margin width" value={Number.isFinite(margin) ? margin.toFixed(3) : "—"} />
          <Readout label="support vectors" value={svIdx.size} />
          <Readout label="misclassified" value={misclassified} />
        </div>
      </div>

      <Legend
        items={[
          { color: CLASS_COLORS[0], label: "Class A" },
          { color: CLASS_COLORS[1], label: "Class B" },
          { color: SERIES.gold, label: "Margin" },
        ]}
      />

      <p className={styles.aside}>
        Drag a circled point — those are the support vectors. Move one and the boundary follows;
        move any other point and nothing happens at all.
      </p>

      <p className={styles.note}>
        The SVM doesn&rsquo;t just find <em>a</em> separating line, it finds the one with the widest
        empty street between the classes. Only the points touching that street matter — everything
        else could be deleted without changing the answer. Lowering <strong>C</strong> makes the
        model tolerate violations in exchange for a wider margin; raising it forces a tighter fit
        around awkward points.
      </p>

      {mode === "rings" && (
        <>
          <h2 style={{ fontFamily: "var(--font-display)", fontSize: "1.4rem", margin: "1.5rem 0 0.3rem" }}>
            The kernel trick
          </h2>
          <p className={styles.note}>
            No straight line can separate two concentric rings — you can see the SVM above failing.
            But nothing says the line has to live in <em>these</em> coordinates. Re-plot every point
            using its distance from the origin, and the problem falls apart:
          </p>
          <div className={styles.stage}>
            <svg className={styles.plotSvg} viewBox={`0 0 ${kernelScale.width} ${kernelScale.height}`} role="img" aria-label="Rings lifted into a separable space">
              <Axes scale={kernelScale} xLabel="r = √(x₁² + x₂²)" yLabel="r²" />
              {/* A hand-placed separating line in the lifted space. */}
              <line
                x1={kernelScale.x(0)} y1={kernelScale.y(3.4)}
                x2={kernelScale.x(4)} y2={kernelScale.y(3.4)}
                stroke={SERIES.ink} strokeWidth={2.2} strokeDasharray="6 4"
              />
              {kernelPoints.map((p, i) => (
                <circle
                  key={i}
                  cx={kernelScale.x(p.x)}
                  cy={kernelScale.y(Math.min(p.y, 14))}
                  r={4.5}
                  fill={CLASS_COLORS[p.label]}
                  stroke="var(--paper)"
                  strokeWidth={1}
                />
              ))}
            </svg>
          </div>
          <p className={styles.note}>
            Same points, same labels, one new axis — and now a single straight line does the job. A
            kernel is just this idea done implicitly: it computes distances <em>as if</em> the points
            had been lifted into that higher-dimensional space, without ever building the
            coordinates.
          </p>
        </>
      )}
    </div>
  );
}
