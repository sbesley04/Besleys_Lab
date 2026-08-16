"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import styles from "../lab.module.css";
import { useDemoVisit } from "../_components/useDemoVisit";
import { unlock } from "@/lib/arcade";
import { Axes, DataLine, demoScale } from "../_components/Axes";
import { Button, Picker, Readout, Slider, Transport } from "../_components/Controls";
import { SERIES, seededRng } from "../_components/plot";
import {
  initNet, forward, trainStep, loss as netLoss, truthTable, accuracy,
  DATASETS, type DatasetKey, type Net,
} from "./engine";

// A 2-2-1 network training in front of you. Three views, updating together:
// the network diagram (weights as edge thickness/color), the loss curve, and
// the decision surface the network currently computes.

// The surface is CSS-scaled to 200px. A 144px backing grid stays visually
// smooth while cutting live forward passes by more than half versus 220px.
const BOARD = 144;

type Rgb = [number, number, number];

function parseHexColor(value: string, fallback: Rgb): Rgb {
  const hex = value.trim().replace(/^#/, "");
  const normalized = hex.length === 3 ? [...hex].map((c) => c + c).join("") : hex;
  if (!/^[0-9a-f]{6}$/i.test(normalized)) return fallback;
  return [
    Number.parseInt(normalized.slice(0, 2), 16),
    Number.parseInt(normalized.slice(2, 4), 16),
    Number.parseInt(normalized.slice(4, 6), 16),
  ];
}

// Net, epoch counter, and loss history advance together, so they live in one
// state object. Keeping them separate tempted a setState call *inside* another
// state updater — updaters must be pure, and React invokes them twice in
// StrictMode, which silently double-counted every epoch.
interface Training {
  net: Net;
  epoch: number;
  losses: number[];
}

function freshTraining(seed: number): Training {
  return { net: initNet(seededRng(seed)), epoch: 0, losses: [] };
}

export default function XorNet() {
  const themeVersion = useDemoVisit("xor-net");
  const [dataset, setDataset] = useState<DatasetKey>("xor");
  const [training, setTraining] = useState<Training>(() => freshTraining(42));
  const [lr, setLr] = useState(0.9);
  const [running, setRunning] = useState(false);
  const [seed, setSeed] = useState(42);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const { net, epoch, losses } = training;
  const data = DATASETS[dataset].data;
  const lossScale = useMemo(() => demoScale([0, Math.max(60, losses.length)], [0, 0.8], 380, 200, 38), [losses.length]);

  const reset = useCallback(
    (s?: number) => {
      setTraining(freshTraining(s ?? seed));
      setRunning(false);
    },
    [seed],
  );

  useEffect(() => {
    reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataset, seed]);

  const step = useCallback(
    (times = 1) => {
      setTraining((t) => {
        let cur = t.net;
        const added: number[] = [];
        for (let i = 0; i < times; i++) {
          const r = trainStep(cur, data, lr);
          cur = r.net;
          added.push(r.loss);
        }
        return {
          net: cur,
          epoch: t.epoch + times,
          losses: [...t.losses, ...added].slice(-600),
        };
      });
    },
    [data, lr],
  );

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => step(12), 50);
    return () => clearInterval(id);
  }, [running, step]);

  // Decision surface: evaluate the net across the unit square.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const rootStyles = getComputedStyle(document.documentElement);
    const low = parseHexColor(SERIES.blue, [43, 95, 139]);
    const middle = parseHexColor(rootStyles.getPropertyValue("--paper"), [245, 240, 232]);
    const high = parseHexColor(SERIES.rust, [160, 60, 46]);
    const img = ctx.createImageData(BOARD, BOARD);
    for (let py = 0; py < BOARD; py++) {
      for (let px = 0; px < BOARD; px++) {
        const x0 = px / (BOARD - 1);
        const x1 = 1 - py / (BOARD - 1);
        const out = forward(net, x0, x1).out;
        // Blue (0) → the current theme's paper (0.5) → rust (1).
        const k = (py * BOARD + px) * 4;
        const t = out;
        const from = t < 0.5 ? low : middle;
        const to = t < 0.5 ? middle : high;
        const blend = t < 0.5 ? t * 2 : (t - 0.5) * 2;
        img.data[k] = Math.round(from[0] + (to[0] - from[0]) * blend);
        img.data[k + 1] = Math.round(from[1] + (to[1] - from[1]) * blend);
        img.data[k + 2] = Math.round(from[2] + (to[2] - from[2]) * blend);
        img.data[k + 3] = 190;
      }
    }
    ctx.putImageData(img, 0, 0);
  }, [net, themeVersion]);

  const table = truthTable(net, data);
  const acc = accuracy(net, data);
  const currentLoss = netLoss(net, data);
  const solved = acc === 1 && currentLoss < 0.05;

  // Solving XOR specifically — AND/OR don't count, a single layer can do those.
  useEffect(() => {
    if (solved && dataset === "xor") unlock("lab-xor");
  }, [solved, dataset]);

  // Network diagram geometry.
  const nodes = {
    in: [{ x: 40, y: 55 }, { x: 40, y: 145 }],
    hid: [{ x: 165, y: 55 }, { x: 165, y: 145 }],
    out: { x: 290, y: 100 },
  };
  const edgeStyle = (w: number) => ({
    stroke: w >= 0 ? SERIES.rust : SERIES.blue,
    strokeWidth: Math.min(7, 0.6 + Math.abs(w) * 1.15),
    opacity: 0.85,
  });

  return (
    <div className={styles.layout}>
      <Picker
        label="Dataset"
        value={dataset}
        onChange={setDataset}
        options={(Object.keys(DATASETS) as DatasetKey[]).map((k) => ({ value: k, label: DATASETS[k].label }))}
      />
      <p className={styles.note}>{DATASETS[dataset].note}</p>

      <div className={styles.stage}>
        <div className={styles.stageRow}>
          {/* Network diagram */}
          <div className={`${styles.plotWrap} ${styles.flexWide}`}>
            <p className={styles.panelTitle}>The network</p>
            <svg className={styles.plotSvg} viewBox="0 0 340 200" role="img" aria-label="Network diagram with live weights">
              {nodes.in.map((a, i) =>
                nodes.hid.map((b, j) => (
                  <line key={`e1-${i}-${j}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} {...edgeStyle(net.w1[j][i])} />
                )),
              )}
              {nodes.hid.map((b, j) => (
                <line key={`e2-${j}`} x1={b.x} y1={b.y} x2={nodes.out.x} y2={nodes.out.y} {...edgeStyle(net.w2[j])} />
              ))}

              {nodes.in.map((n, i) => (
                <g key={`in-${i}`}>
                  <circle cx={n.x} cy={n.y} r={19} fill="var(--paper)" stroke="var(--ink)" strokeWidth={1.4} />
                  <text x={n.x} y={n.y + 4} textAnchor="middle" fontSize={12} fill="var(--ink)">x{i + 1}</text>
                </g>
              ))}
              {nodes.hid.map((n, j) => (
                <g key={`hid-${j}`}>
                  <circle cx={n.x} cy={n.y} r={19} fill="var(--paper)" stroke="var(--ink)" strokeWidth={1.4} />
                  <text x={n.x} y={n.y + 4} textAnchor="middle" fontSize={11} fill="var(--ink)">h{j + 1}</text>
                </g>
              ))}
              <circle cx={nodes.out.x} cy={nodes.out.y} r={19} fill="var(--paper)" stroke="var(--ink)" strokeWidth={1.4} />
              <text x={nodes.out.x} y={nodes.out.y + 4} textAnchor="middle" fontSize={12} fill="var(--ink)">ŷ</text>

              <text x={40} y={192} textAnchor="middle" fontSize={9} fill="var(--ink-soft)">inputs</text>
              <text x={165} y={192} textAnchor="middle" fontSize={9} fill="var(--ink-soft)">hidden (tanh)</text>
              <text x={290} y={192} textAnchor="middle" fontSize={9} fill="var(--ink-soft)">output (σ)</text>
            </svg>
            <p className={`${styles.note} ${styles.compactNote}`}>
              Edge thickness = |weight|. <span style={{ color: SERIES.rust }}>Red</span> is positive,{" "}
              <span style={{ color: SERIES.blue }}>blue</span> negative.
            </p>
          </div>

          {/* Decision surface */}
          <div className={styles.decisionColumn}>
            <p className={styles.panelTitle}>What it computes</p>
            <div className={styles.decisionSurface}>
              <canvas
                ref={canvasRef}
                width={BOARD}
                height={BOARD}
                className={styles.decisionCanvas}
                role="img"
                aria-label="Decision surface over the input square"
              >
                A color map of the network&apos;s output probability across both inputs.
              </canvas>
              <svg viewBox="0 0 200 200" className={styles.decisionOverlay} aria-hidden>
                {data.map((d, i) => (
                  <circle
                    key={i}
                    cx={d.x[0] * 180 + 10}
                    cy={190 - d.x[1] * 180}
                    r={8}
                    fill={d.y === 1 ? SERIES.rust : SERIES.blue}
                    stroke="#fff"
                    strokeWidth={2}
                  />
                ))}
              </svg>
            </div>
          </div>
        </div>

        {/* Loss curve */}
        <div className={`${styles.plotWrap} ${styles.plotTopMargin}`}>
          <p className={styles.panelTitle}>Loss</p>
          <svg className={styles.plotSvg} viewBox={`0 0 ${lossScale.width} ${lossScale.height}`} role="img" aria-label="Training loss curve">
            <Axes scale={lossScale} xLabel="epoch" yLabel="cross-entropy" />
            <DataLine
              points={losses.map((l, i) => [i, Math.min(l, 0.8)] as [number, number])}
              scale={lossScale}
              color={SERIES.violet}
              width={2}
            />
          </svg>
        </div>
      </div>

      <Transport
        running={running}
        onToggle={() => setRunning((r) => !r)}
        onStep={() => step(1)}
        onReset={() => reset()}
        stepLabel="Epoch"
      />

      <div className={styles.sliderGrid}>
        <Slider label="Learning rate" value={lr} onChange={setLr} min={0.05} max={3} step={0.05} format={(v) => v.toFixed(2)} />
        <div className={styles.readouts}>
          <Readout label="epoch" value={epoch} />
          <Readout label="loss" value={currentLoss.toFixed(4)} />
          <Readout label="accuracy" value={`${(acc * 100).toFixed(0)}%`} />
        </div>
      </div>

      <div className={styles.controls}>
        <Button onClick={() => step(500)}>⏩ 500 epochs</Button>
        <Button onClick={() => setSeed((s) => s + 1)}>🎲 New random init</Button>
      </div>

      <div className={`${styles.panel} ${styles.fullPanel}`}>
        <p className={styles.panelTitle}>Truth table</p>
        <table className={`${styles.mono} ${styles.truthTable}`}>
          <caption className={styles.srOnly}>Current predictions for every input pair</caption>
          <thead>
            <tr>
              <th scope="col">x₁ x₂</th>
              <th scope="col">target</th>
              <th scope="col">predicted</th>
              <th scope="col">result</th>
            </tr>
          </thead>
          <tbody>
            {table.map((r, i) => {
              const right = Math.round(r.out) === r.y;
              return (
                <tr key={i}>
                  <td>{r.x[0]} {r.x[1]}</td>
                  <td>{r.y}</td>
                  <td>{r.out.toFixed(3)}</td>
                  <td style={{ color: right ? SERIES.green : SERIES.rust }}>
                    {right ? "✓" : "✗"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className={styles.aside} aria-live="polite">
        {solved
          ? "Solved. Look at the decision surface — it isn't a line. The hidden layer bent the space until XOR became separable."
          : epoch === 0
            ? "Press Run. Watch the hidden-layer weights first: nothing much happens, then suddenly everything does."
            : "Still working. If it stalls near 0.69 loss, that's the network stuck predicting 0.5 for everything — reset with a new init."}
      </p>

      <p className={styles.note}>
        XOR is the classic proof that one layer isn&rsquo;t enough: no single straight line separates
        (0,1) and (1,0) from (0,0) and (1,1). The two hidden units each learn a line, and the output
        unit combines them — which is why the finished decision surface has a corner in it. Try a
        few different random inits: some runs solve it in a few hundred epochs, some stall for
        thousands, and that variance is a real property of training, not a bug in the demo.
      </p>
    </div>
  );
}
