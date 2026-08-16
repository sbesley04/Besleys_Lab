"use client";

import { useMemo, useState } from "react";
import styles from "../lab.module.css";
import { useDemoVisit } from "../_components/useDemoVisit";
import PointCanvas from "../_components/PointCanvas";
import { demoScale } from "../_components/Axes";
import { Button, Legend, Readout } from "../_components/Controls";
import { CLASS_COLORS, SERIES, gauss, seededRng, stablePoint } from "../_components/plot";
import { fitLinear, fitLogistic, predictLogistic, type LabeledPt } from "./engine";

// Linear vs. logistic regression on the same canvas. Linear predicts a number
// (y from x); logistic predicts a probability (class from x). Switching between
// them keeps the points so the contrast is immediate.

const W = 520;
const H = 380;
const DOMAIN: [number, number] = [-6, 6];
const RANGE: [number, number] = [-4, 4];

type Mode = "linear" | "logistic";

function initialLinearPoints(): { x: number; y: number }[] {
  const rng = seededRng(5);
  return Array.from({ length: 16 }, () => {
    const x = -5 + rng() * 10;
    return { x, y: 0.55 * x + 0.4 + gauss(rng) * 0.9 };
  }).map(stablePoint);
}

function initialLogisticPoints(): LabeledPt[] {
  const rng = seededRng(12);
  return Array.from({ length: 22 }, (_, i) => {
    const label = i % 2;
    const x = label === 0 ? -3.6 + gauss(rng) * 1.25 : 3.1 + gauss(rng) * 1.25;
    return { x, y: label === 0 ? -2.4 : 2.4, label };
  }).map(stablePoint);
}

export default function Regression() {
  useDemoVisit("regression");
  const scale = useMemo(() => demoScale(DOMAIN, RANGE, W, H, 34), []);
  const [mode, setMode] = useState<Mode>("linear");
  const [linPts, setLinPts] = useState(initialLinearPoints);
  const [logPts, setLogPts] = useState(initialLogisticPoints);
  const [brush, setBrush] = useState(0);

  const linFit = useMemo(() => fitLinear(linPts), [linPts]);
  const logFit = useMemo(() => fitLogistic(logPts, 900, 0.6), [logPts]);

  // Logistic curve mapped into the plot: probability 0..1 → y range.
  const probToY = (p: number) => RANGE[0] + p * (RANGE[1] - RANGE[0]);
  const logCurve = useMemo(() => {
    const pts: [number, number][] = [];
    for (let i = 0; i <= 120; i++) {
      const x = DOMAIN[0] + (i / 120) * (DOMAIN[1] - DOMAIN[0]);
      pts.push([x, probToY(predictLogistic(logFit, x))]);
    }
    return pts;
  }, [logFit]);
  const decisionX = logFit.w === 0 ? null : -logFit.b / logFit.w;

  const linePts: [number, number][] = [
    [DOMAIN[0], linFit.slope * DOMAIN[0] + linFit.intercept],
    [DOMAIN[1], linFit.slope * DOMAIN[1] + linFit.intercept],
  ];
  const toPath = (pts: [number, number][]) =>
    pts.map(([x, y]) => `${scale.x(x)},${scale.y(y)}`).join(" ");

  const isLinear = mode === "linear";

  return (
    <div className={styles.layout}>
      <div className={styles.controls} role="group" aria-label="Model">
        <Button active={isLinear} onClick={() => setMode("linear")}>Linear regression</Button>
        <Button active={!isLinear} onClick={() => setMode("logistic")}>Logistic regression</Button>
      </div>

      <div className={styles.stage}>
        {isLinear ? (
          <PointCanvas
            ariaLabel="Linear regression scatter plot — click to add points, drag to move them"
            points={linPts.map((p) => ({ ...p, label: 0 }))}
            scale={scale}
            colors={[SERIES.blue]}
            onAdd={(p) => setLinPts((pts) => [...pts, p])}
            onMove={(i, p) => setLinPts((pts) => pts.map((q, j) => (j === i ? p : q)))}
            onRemove={(i) => setLinPts((pts) => pts.filter((_, j) => j !== i))}
            xLabel="x"
            yLabel="y"
            underlay={
              <g>
                {/* Residuals — the vertical errors least squares is minimizing. */}
                {linPts.map((p, i) => (
                  <line
                    key={i}
                    x1={scale.x(p.x)} y1={scale.y(p.y)}
                    x2={scale.x(p.x)} y2={scale.y(linFit.slope * p.x + linFit.intercept)}
                    stroke={SERIES.rust}
                    strokeWidth={1}
                    strokeDasharray="2 2"
                    opacity={0.75}
                  />
                ))}
                <polyline points={toPath(linePts)} fill="none" stroke={SERIES.ink} strokeWidth={2.4} />
              </g>
            }
          />
        ) : (
          <PointCanvas
            ariaLabel="Logistic regression plot — click to add points, drag to move them"
            points={logPts}
            scale={scale}
            colors={CLASS_COLORS}
            onAdd={(p) => setLogPts((pts) => [...pts, { ...p, label: brush }])}
            onMove={(i, p) => setLogPts((pts) => pts.map((q, j) => (j === i ? { ...q, ...p } : q)))}
            onRemove={(i) => setLogPts((pts) => pts.filter((_, j) => j !== i))}
            xLabel="x"
            yLabel="P(class B)"
            underlay={
              <g>
                {/* p = 0.5 line and the decision threshold */}
                <line
                  x1={scale.x(DOMAIN[0])} y1={scale.y(probToY(0.5))}
                  x2={scale.x(DOMAIN[1])} y2={scale.y(probToY(0.5))}
                  stroke="var(--ink-soft)" strokeWidth={1} strokeDasharray="4 4" opacity={0.6}
                />
                {decisionX !== null && decisionX > DOMAIN[0] && decisionX < DOMAIN[1] && (
                  <line
                    x1={scale.x(decisionX)} y1={scale.y(RANGE[0])}
                    x2={scale.x(decisionX)} y2={scale.y(RANGE[1])}
                    stroke={SERIES.ink} strokeWidth={1.6} strokeDasharray="6 3"
                  />
                )}
                <polyline points={toPath(logCurve)} fill="none" stroke={SERIES.violet} strokeWidth={2.6} />
              </g>
            }
          />
        )}
      </div>

      {!isLinear && (
        <div className={styles.controls} role="group" aria-label="Class for new points">
          <span className={styles.note}>Add points as:</span>
          <Button active={brush === 0} onClick={() => setBrush(0)}>● Class A</Button>
          <Button active={brush === 1} onClick={() => setBrush(1)}>● Class B</Button>
        </div>
      )}

      <div className={styles.controls}>
        <Button
          onClick={() => (isLinear ? setLinPts([]) : setLogPts([]))}
          disabled={isLinear ? linPts.length === 0 : logPts.length === 0}
        >
          Clear
        </Button>
        {isLinear && (
          <Button
            onClick={() => {
              // Drop one wild point to show how least squares chases outliers.
              setLinPts((pts) => [...pts, { x: 4.6, y: -3.4 }]);
            }}
          >
            Add an outlier
          </Button>
        )}
      </div>

      <div className={styles.readouts}>
        {isLinear ? (
          <>
            <Readout label="fit" value={`y = ${linFit.slope.toFixed(3)}x + ${linFit.intercept.toFixed(3)}`} />
            <Readout label="r²" value={linFit.r2.toFixed(3)} />
            <Readout label="MSE" value={linFit.mse.toFixed(3)} />
            <Readout label="points" value={linPts.length} />
          </>
        ) : (
          <>
            <Readout label="fit" value={`P = σ(${logFit.w.toFixed(2)}x + ${logFit.b.toFixed(2)})`} />
            <Readout label="cross-entropy" value={logFit.loss.toFixed(3)} />
            <Readout label="threshold at x" value={decisionX === null ? "—" : decisionX.toFixed(2)} />
            <Readout label="points" value={logPts.length} />
          </>
        )}
      </div>

      <Legend
        items={
          isLinear
            ? [
                { color: SERIES.ink, label: "Least-squares fit" },
                { color: SERIES.rust, label: "Residuals" },
              ]
            : [
                { color: CLASS_COLORS[0], label: "Class A" },
                { color: CLASS_COLORS[1], label: "Class B" },
                { color: SERIES.violet, label: "P(class B)" },
              ]
        }
      />

      <p className={styles.aside}>
        {isLinear
          ? "Drop an outlier far from the line and watch the whole fit tilt toward it — squared error punishes big misses disproportionately."
          : "Drag a point across the threshold and watch the curve slide. The output can never leave 0–1, no matter how far you drag."}
      </p>

      <p className={styles.note}>
        {isLinear ? (
          <>
            The plot supports pointer dragging and keyboard editing. Linear regression minimizes
            the sum of the <em>squared</em> dashed residuals. Squaring is
            what makes it solvable in closed form — and also what makes it fragile: one point twice
            as far away contributes four times the error, so outliers get a vote far larger than
            their share.
          </>
        ) : (
          <>
            The plot supports pointer dragging and keyboard editing. Logistic regression runs the same linear expression through a sigmoid, turning an
            unbounded number into a probability. The fit is found by gradient descent on
            cross-entropy rather than in closed form — and unlike a straight line, the prediction
            saturates instead of running off to ±∞, which is exactly what you want when the answer
            is &ldquo;which class.&rdquo;
          </>
        )}
      </p>
    </div>
  );
}
