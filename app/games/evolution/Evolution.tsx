"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import styles from "./evolution.module.css";
import SaveSlot from "../_components/SaveSlot";
import { unlock, recordPlayed, recordWin } from "@/lib/arcade";
import {
  createWorld, stepWorld, nextGeneration, runGeneration, averageTraits, energyCost,
  DEFAULT_PARAMS, TICKS_PER_GENERATION, type World, type WorldParams,
} from "./engine";

// The evolution sandbox: set the environment, then watch selection do the rest.
// You never edit a creature — only the world it has to survive in.

const FIELD = 100;
const VIEW = 420;
const TRAIT_COLORS = { speed: "#2b5f8b", size: "#a03c2e", sense: "#3f7d4f" };

export interface SavePayload {
  world: World;
}

export default function Evolution() {
  const [params, setParams] = useState<WorldParams>(DEFAULT_PARAMS);
  const [world, setWorld] = useState<World>(() => createWorld(DEFAULT_PARAMS, 12, seededFrom(1)));
  const [running, setRunning] = useState(false);
  const [speed, setSpeed] = useState(3);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const worldRef = useRef(world);
  worldRef.current = world;

  useEffect(() => recordPlayed("evolution"), []);

  // Fresh randomized world after mount (SSR renders the deterministic one).
  useEffect(() => {
    setWorld(createWorld(DEFAULT_PARAMS, 12));
  }, []);

  const reset = useCallback((p: WorldParams) => {
    setWorld(createWorld(p, 12));
    setRunning(false);
  }, []);

  // Param edits apply to the live world without restarting it.
  useEffect(() => {
    setWorld((w) => ({ ...w, params }));
  }, [params]);

  const tick = useCallback(() => {
    setWorld((w) => {
      if (w.extinct) return w;
      let next = stepWorld(w);
      const everyoneDone = next.creatures.every((c) => !c.alive || c.eaten >= 2);
      if (next.tick >= TICKS_PER_GENERATION || everyoneDone) next = nextGeneration(next);
      return next;
    });
  }, []);

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      for (let i = 0; i < speed; i++) tick();
    }, 40);
    return () => clearInterval(id);
  }, [running, speed, tick]);

  useEffect(() => {
    if (world.extinct) setRunning(false);
  }, [world.extinct]);

  // Achievements: longevity, big populations, and trait extremes.
  useEffect(() => {
    if (world.generation >= 25 && !world.extinct) {
      unlock("evo-dynasty");
      recordWin("evolution");
    }
    if (world.generation >= 100 && !world.extinct) unlock("evo-deep-time");
    if (world.extinct) unlock("evo-extinction");
    const avg = averageTraits(world.creatures);
    if (world.generation > 8 && avg.speed >= 2) unlock("evo-cheetah");
    if (world.generation > 8 && avg.size >= 2) unlock("evo-titan");
  }, [world]);

  // Render the field.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const s = VIEW / FIELD;
    ctx.clearRect(0, 0, VIEW, VIEW);

    // Food
    ctx.fillStyle = "#3f7d4f";
    for (const f of world.food) {
      if (f.eaten) continue;
      ctx.beginPath();
      ctx.arc(f.x * s, f.y * s, 2.6, 0, Math.PI * 2);
      ctx.fill();
    }

    // Creatures — radius tracks size, ring brightness tracks energy.
    for (const c of world.creatures) {
      if (!c.alive) continue;
      const r = 3 + c.traits.size * 2.6;
      // Sense radius, faintly.
      ctx.strokeStyle = "rgba(63,125,79,0.10)";
      ctx.beginPath();
      ctx.arc(c.x * s, c.y * s, c.traits.sense * 22 * s, 0, Math.PI * 2);
      ctx.stroke();

      // Speed → blue, size → rust; blend so the population's makeup is visible.
      const t = Math.min(1, Math.max(0, (c.traits.speed - c.traits.size + 1.5) / 3));
      const rr = Math.round(43 + (160 - 43) * (1 - t));
      const gg = Math.round(95 + (60 - 95) * (1 - t));
      const bb = Math.round(139 + (46 - 139) * (1 - t));
      ctx.fillStyle = `rgb(${rr},${gg},${bb})`;
      ctx.beginPath();
      ctx.arc(c.x * s, c.y * s, r, 0, Math.PI * 2);
      ctx.fill();
      if (c.eaten >= 2) {
        ctx.strokeStyle = "#b08829";
        ctx.lineWidth = 2;
        ctx.stroke();
      }
      ctx.lineWidth = 1;
    }
  }, [world]);

  const avg = averageTraits(world.creatures);
  const alive = world.creatures.filter((c) => c.alive).length;
  const fed = world.creatures.filter((c) => c.eaten >= 1).length;

  // Trait history chart.
  const chart = useMemo(() => {
    const h = world.history.slice(-80);
    if (h.length < 2) return null;
    const w = 300;
    const ht = 90;
    const maxT = Math.max(1.2, ...h.flatMap((r) => [r.avgSpeed, r.avgSize, r.avgSense]));
    const path = (key: "avgSpeed" | "avgSize" | "avgSense") =>
      h
        .map((r, i) => `${(i / (h.length - 1)) * w},${ht - (r[key] / maxT) * ht}`)
        .join(" ");
    return { w, ht, path, maxT, first: h[0].generation, last: h[h.length - 1].generation };
  }, [world.history]);

  return (
    <div className={styles.layout}>
      <div className={styles.stageRow}>
        <canvas
          ref={canvasRef}
          width={VIEW}
          height={VIEW}
          className={styles.field}
          aria-label="Evolution field: creatures foraging for food"
        />

        <div className={styles.side}>
          <div className={styles.panel}>
            <p className={styles.panelTitle}>Average traits</p>
            {(["speed", "size", "sense"] as const).map((k) => (
              <div key={k} className={styles.traitRow}>
                <span style={{ textTransform: "capitalize" }}>{k}</span>
                <span className={styles.traitBar}>
                  <span
                    className={styles.traitFill}
                    style={{ width: `${Math.min(100, (avg[k] / 3) * 100)}%`, background: TRAIT_COLORS[k] }}
                  />
                </span>
                <span className={styles.statValue}>{avg[k].toFixed(2)}</span>
              </div>
            ))}
            <p className={styles.help} style={{ marginTop: "0.4rem", fontSize: "0.76rem" }}>
              Energy burn: <span className={styles.statValue}>{energyCost(avg).toFixed(2)}</span>/tick
            </p>
          </div>

          {chart && (
            <div className={styles.panel}>
              <p className={styles.panelTitle}>
                Trait drift · gen {chart.first}–{chart.last}
              </p>
              <svg viewBox={`0 0 ${chart.w} ${chart.ht}`} style={{ width: "100%", height: "auto" }} role="img" aria-label="Average traits over generations">
                {(["avgSpeed", "avgSize", "avgSense"] as const).map((k, i) => (
                  <polyline
                    key={k}
                    points={chart.path(k)}
                    fill="none"
                    stroke={[TRAIT_COLORS.speed, TRAIT_COLORS.size, TRAIT_COLORS.sense][i]}
                    strokeWidth={1.8}
                  />
                ))}
              </svg>
            </div>
          )}
        </div>
      </div>

      <div className={styles.statusRow}>
        <span>generation <span className={styles.statValue}>{world.generation}</span></span>
        <span>alive <span className={styles.statValue}>{alive}</span></span>
        <span>fed <span className={styles.statValue}>{fed}</span></span>
        <span>tick <span className={styles.statValue}>{world.tick}/{TICKS_PER_GENERATION}</span></span>
      </div>

      {world.extinct && (
        <div className={styles.banner}>
          <strong style={{ fontFamily: "var(--font-display)", fontSize: "1.2rem" }}>
            Extinction at generation {world.generation}.
          </strong>
          <p className={styles.help} style={{ margin: "0.3rem auto 0" }}>
            Nobody ate enough to reproduce. Add food, cut the energy cost, or start again.
          </p>
        </div>
      )}

      <div className={styles.controls}>
        <button type="button" className={styles.button} onClick={() => setRunning((r) => !r)} disabled={world.extinct}>
          {running ? "⏸ Pause" : "▶ Run"}
        </button>
        <button type="button" className={styles.button} onClick={tick} disabled={running || world.extinct}>
          ⏭ Tick
        </button>
        <button
          type="button"
          className={styles.button}
          onClick={() => setWorld((w) => runGeneration(w))}
          disabled={running || world.extinct}
          title="Forage, then select — a whole generation at once"
        >
          ⏭ Generation
        </button>
        <button type="button" className={styles.button} onClick={() => reset(params)}>
          ↻ Restart
        </button>
        <button
          type="button"
          className={`${styles.button} ${params.predation ? styles.buttonActive : ""}`}
          onClick={() => setParams((p) => ({ ...p, predation: !p.predation }))}
        >
          🦖 Predation {params.predation ? "on" : "off"}
        </button>
      </div>

      <div className={styles.sliderGrid}>
        <Slider label="Food per generation" value={params.foodCount} min={0} max={140} step={5}
          onChange={(v) => setParams((p) => ({ ...p, foodCount: v }))} format={(v) => String(v)} />
        <Slider label="Mutation rate" value={params.mutationRate} min={0} max={0.4} step={0.01}
          onChange={(v) => setParams((p) => ({ ...p, mutationRate: v }))} format={(v) => `${(v * 100).toFixed(0)}%`} />
        <Slider label="Energy budget" value={params.energyBudget} min={200} max={1400} step={20}
          onChange={(v) => setParams((p) => ({ ...p, energyBudget: v }))} format={(v) => String(v)} />
        <Slider label="Sim speed" value={speed} min={1} max={12} step={1}
          onChange={setSpeed} format={(v) => `${v}×`} />
      </div>

      <p className={styles.aside}>
        {world.generation < 3
          ? "Every creature starts identical. Any difference you see later, the simulation invented."
          : avg.speed > avg.size * 1.4
            ? "Speed is winning here — food is worth chasing, and being big isn't paying for itself."
            : avg.size > avg.speed * 1.4
              ? "Size is winning. Check whether predation is on — that changes what 'fit' means entirely."
              : "Traits are drifting. Starve them or flood them with food and watch the balance shift."}
      </p>

      <p className={styles.help}>
        Each generation, a creature that finds no food dies, one food survives, and two or more
        survives <em>and</em> reproduces with a small mutation. Bigger and faster creatures reach
        more food but burn energy far quicker — speed costs roughly v², size roughly s³ — so there
        is no strictly best creature, only one that fits this environment. Change the environment
        and the population will chase it, but only as fast as mutation and death allow.
      </p>

      <SaveSlot<SavePayload>
        game="evolution"
        getState={() => ({ world: worldRef.current })}
        onLoad={(p) => {
          setWorld(p.world);
          setParams(p.world.params);
          setRunning(false);
        }}
        validate={(s): s is SavePayload =>
          !!s && typeof s === "object" && Array.isArray((s as SavePayload).world?.creatures)
        }
      />
    </div>
  );
}

function Slider({
  label, value, onChange, min, max, step, format,
}: {
  label: string; value: number; onChange: (v: number) => void;
  min: number; max: number; step: number; format: (v: number) => string;
}) {
  return (
    <label className={styles.slider}>
      <span>{label}</span>
      <span className={styles.sliderValue}>{format(value)}</span>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(Number(e.target.value))} />
    </label>
  );
}

/** Deterministic rng for the SSR world so server and client markup agree. */
function seededFrom(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}
