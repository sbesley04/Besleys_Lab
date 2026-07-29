"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import styles from "../lab.module.css";
import { useDemoVisit } from "../_components/useDemoVisit";
import PointCanvas from "../_components/PointCanvas";
import { demoScale } from "../_components/Axes";
import { Button, Readout, Slider, Transport } from "../_components/Controls";
import { CLUSTER_COLORS, seededRng } from "../_components/plot";
import {
  assign, updateCentroids, inertia, converged, kmeansInit, kmeansBadInit,
  kmeansPlusPlus, sampleBlobs, type Pt,
} from "./engine";

// k-means with the two half-steps exposed separately. The whole point is to
// watch "assign" and "update" alternate — and to see a bad initialization
// converge confidently to a bad answer.

const W = 520;
const H = 400;
const DOMAIN: [number, number] = [-6, 6];
const RANGE: [number, number] = [-5, 5];

type Phase = "assign" | "update";
type InitMode = "plusplus" | "random" | "bad";

const INIT_LABELS: Record<InitMode, string> = {
  plusplus: "k-means++",
  random: "Random",
  bad: "Bad corner",
};

export default function KMeans() {
  useDemoVisit("k-means");
  const scale = useMemo(() => demoScale(DOMAIN, RANGE, W, H, 34), []);
  const [points, setPoints] = useState<Pt[]>([]);
  const [k, setK] = useState(3);
  const [centroids, setCentroids] = useState<Pt[]>([]);
  const [labels, setLabels] = useState<number[]>([]);
  const [phase, setPhase] = useState<Phase>("assign");
  const [iteration, setIteration] = useState(0);
  const [running, setRunning] = useState(false);
  const [settled, setSettled] = useState(false);
  const [initMode, setInitMode] = useState<InitMode>("plusplus");
  const [seed, setSeed] = useState(1);

  // Seed a dataset after mount (keeps SSR markup deterministic).
  useEffect(() => {
    const rng = seededRng(7);
    setPoints(sampleBlobs(90, 3, rng, DOMAIN, RANGE));
  }, []);

  const seedCentroids = useCallback(
    (pts: Pt[], kk: number, mode: InitMode, s: number) => {
      const rng = seededRng(s);
      const c =
        mode === "plusplus" ? kmeansPlusPlus(pts, kk, rng)
        : mode === "bad" ? kmeansBadInit(pts, kk, rng)
        : kmeansInit(pts, kk, rng);
      setCentroids(c);
      setLabels([]);
      setPhase("assign");
      setIteration(0);
      setSettled(false);
      setRunning(false);
    },
    [],
  );

  // (Re)seed whenever the data, k, init strategy, or seed changes.
  useEffect(() => {
    if (points.length === 0) return;
    seedCentroids(points, k, initMode, seed);
  }, [points, k, initMode, seed, seedCentroids]);

  const step = useCallback(() => {
    if (points.length === 0 || centroids.length === 0) return;
    if (phase === "assign") {
      const next = assign(points, centroids);
      if (labels.length > 0 && converged(next, labels)) {
        setSettled(true);
        setRunning(false);
      }
      setLabels(next);
      setPhase("update");
    } else {
      setCentroids((c) => updateCentroids(points, labels, k, c));
      setPhase("assign");
      setIteration((i) => i + 1);
    }
  }, [phase, points, centroids, labels, k]);

  useEffect(() => {
    if (!running) return;
    const id = setInterval(step, 600);
    return () => clearInterval(id);
  }, [running, step]);

  const currentInertia = labels.length > 0 ? inertia(points, labels, centroids) : 0;

  // Points are colored by cluster only after the first assignment.
  const shown = points.map((p, i) => ({ ...p, label: labels[i] ?? -1 }));
  const colors = labels.length > 0 ? CLUSTER_COLORS : ["#9a948a"];
  const pointsForCanvas = labels.length > 0 ? shown : points.map((p) => ({ ...p, label: 0 }));

  return (
    <div className={styles.layout}>
      <div className={styles.stage}>
        <PointCanvas
          ariaLabel="k-means scatter plot — click to add points"
          points={pointsForCanvas}
          scale={scale}
          colors={colors}
          onAdd={(p) => setPoints((pts) => [...pts, p])}
          onRemove={(i) => setPoints((pts) => pts.filter((_, j) => j !== i))}
          xLabel="x₁"
          yLabel="x₂"
          underlay={
            labels.length > 0 ? (
              <g opacity={0.35}>
                {points.map((p, i) => {
                  const c = centroids[labels[i]];
                  if (!c) return null;
                  return (
                    <line
                      key={i}
                      x1={scale.x(p.x)} y1={scale.y(p.y)}
                      x2={scale.x(c.x)} y2={scale.y(c.y)}
                      stroke={CLUSTER_COLORS[labels[i] % CLUSTER_COLORS.length]}
                      strokeWidth={0.8}
                    />
                  );
                })}
              </g>
            ) : null
          }
        >
          {centroids.map((c, i) => (
            <g key={i}>
              <path
                d={`M ${scale.x(c.x)} ${scale.y(c.y) - 9} L ${scale.x(c.x) + 9} ${scale.y(c.y)} L ${scale.x(c.x)} ${scale.y(c.y) + 9} L ${scale.x(c.x) - 9} ${scale.y(c.y)} Z`}
                fill={CLUSTER_COLORS[i % CLUSTER_COLORS.length]}
                stroke="var(--paper)"
                strokeWidth={2}
              />
            </g>
          ))}
        </PointCanvas>
      </div>

      <Transport
        running={running}
        onToggle={() => setRunning((r) => !r)}
        onStep={step}
        onReset={() => seedCentroids(points, k, initMode, seed)}
        stepLabel={phase === "assign" ? "Assign" : "Update"}
        disabled={points.length === 0}
      />

      <div className={styles.sliderGrid}>
        <Slider label="Clusters (k)" value={k} onChange={(v) => setK(Math.round(v))} min={2} max={6} step={1} format={(v) => String(v)} />
        <div className={styles.readouts}>
          <Readout label="iteration" value={iteration} />
          <Readout label="inertia" value={currentInertia.toFixed(2)} />
          <Readout label="points" value={points.length} />
        </div>
      </div>

      <div className={styles.controls} role="group" aria-label="Initialization">
        {(["plusplus", "random", "bad"] as InitMode[]).map((m) => (
          <Button key={m} active={initMode === m} onClick={() => setInitMode(m)}>
            {INIT_LABELS[m]}
          </Button>
        ))}
        <Button onClick={() => setSeed((s) => s + 1)}>🎲 Re-seed</Button>
        <Button onClick={() => setPoints(sampleBlobs(90, 3, seededRng(Date.now() % 9999), DOMAIN, RANGE))}>
          Scatter blobs
        </Button>
        <Button onClick={() => setPoints([])} disabled={points.length === 0}>
          Clear
        </Button>
      </div>

      <p className={styles.aside}>
        {settled
          ? initMode === "bad"
            ? "Converged — and look where. Nothing changed on the last pass, so the algorithm is finished, confidently, on a bad answer."
            : "Converged: no point changed cluster, so the centroids can't move again."
          : phase === "assign"
            ? "Next: assign each point to its nearest centroid."
            : "Next: move each centroid to the mean of the points that chose it."}
      </p>

      <p className={styles.note}>
        Click empty space to add a point; alt-click a point to remove it. The faint lines show which
        centroid currently owns each point, and <em>inertia</em> is the total squared distance along
        those lines — the quantity k-means is minimizing. It never increases, which is exactly why
        the algorithm can get stuck: from a bad start, every step is an improvement right up until
        it stops at the wrong answer. Try &ldquo;Bad corner&rdquo; a few times with re-seed.
      </p>
    </div>
  );
}
