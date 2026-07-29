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

const BOARD = 220;

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
  useDemoVisit("xor-net");
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
    const img = ctx.createImageData(BOARD, BOARD);
    for (let py = 0; py < BOARD; py++) {
      for (let px = 0; px < BOARD; px++) {
        const x0 = px / (BOARD - 1);
        const x1 = 1 - py / (BOARD - 1);
        const out = forward(net, x0, x1).out;
        // Blue (0) → cream (0.5) → rust (1)
        const k = (py * BOARD + px) * 4;
        const t = out;
        const r = Math.round(43 + t * (160 - 43) + (t > 0.5 ? (t - 0.5) * 60 : 0));
        const g = Math.round(95 + (1 - Math.abs(t - 0.5) * 2) * 90);
        const b = Math.round(139 - t * 93);
        img.data[k] = r;
        img.data[k + 1] = g;
        img.data[k + 2] = b;
        img.data[k + 3] = 190;
      }
    }
    ctx.putImageData(img, 0, 0);
  }, [net]);

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
          <div className={styles.plotWrap} style={{ flex: "1 1 330px" }}>
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
            <p className={styles.note} style={{ fontSize: "0.78rem" }}>
              Edge thickness = |weight|. <span style={{ color: SERIES.rust }}>Red</span> is positive,{" "}
              <span style={{ color: SERIES.blue }}>blue</span> negative.
            </p>
          </div>

          {/* Decision surface */}
          <div style={{ flex: "0 0 auto" }}>
            <p className={styles.panelTitle}>What it computes</p>
            <div style={{ position: "relative", width: 200, height: 200 }}>
              <canvas
                ref={canvasRef}
                width={BOARD}
                height={BOARD}
                style={{ width: 200, height: 200, borderRadius: 4, border: "1px solid var(--line)" }}
                aria-label="Decision surface over the input square"
              />
              <svg viewBox="0 0 200 200" style={{ position: "absolute", inset: 0, width: 200, height: 200 }} aria-hidden>
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
        <div className={styles.plotWrap} style={{ marginTop: "0.75rem" }}>
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

      <div className={styles.panel} style={{ flex: "1 1 auto" }}>
        <p className={styles.panelTitle}>Truth table</p>
        <table className={styles.mono} style={{ borderCollapse: "collapse", width: "100%" }}>
          <thead>
            <tr style={{ color: "var(--ink-soft)", fontSize: "0.78rem" }}>
              <th style={{ textAlign: "left", padding: "0.2rem 0.5rem 0.2rem 0" }}>x₁ x₂</th>
              <th style={{ textAlign: "left", padding: "0.2rem 0.5rem" }}>target</th>
              <th style={{ textAlign: "left", padding: "0.2rem 0.5rem" }}>predicted</th>
              <th style={{ textAlign: "left", padding: "0.2rem" }}></th>
            </tr>
          </thead>
          <tbody>
            {table.map((r, i) => {
              const right = Math.round(r.out) === r.y;
              return (
                <tr key={i}>
                  <td style={{ padding: "0.15rem 0.5rem 0.15rem 0" }}>{r.x[0]} {r.x[1]}</td>
                  <td style={{ padding: "0.15rem 0.5rem" }}>{r.y}</td>
                  <td style={{ padding: "0.15rem 0.5rem" }}>{r.out.toFixed(3)}</td>
                  <td style={{ padding: "0.15rem", color: right ? SERIES.green : SERIES.rust }}>
                    {right ? "✓" : "✗"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className={styles.aside}>
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
