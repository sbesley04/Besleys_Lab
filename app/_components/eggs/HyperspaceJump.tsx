"use client";

import { useEffect, useRef } from "react";
import { warpCharge, warpDown, warpBoom, warpLand } from "@/lib/sound";
import { setGrid } from "@/lib/grid";

// The Konami "hyperspace jump" — a full-screen perspective starfield that
// streaks the viewer into (and back out of) the Grid. EggEffects owns the
// trigger and the reduced-motion / Esc paths; this component owns the
// cinematic only.
//
// Five beats on the way in (~2.46s):
//   charge   0–760ms    #bl-stage blurs and falls away, the field barely
//                       drifts, the whine starts
//   run-up   760–1560   real acceleration — speed on a p^2.6 curve, streaks
//                       lengthen, chromatic fringing separates at the tips
//   stretch  1560–1760  trail length spikes ~3.8x and the whole field punches
//                       forward: the "about to break" frame
//   flash    1760–1950  white-out. setGrid() fires at 1855ms, inside the hold,
//                       so the paper→Grid repaint is never seen
//   land     1855–2460  horizon line snaps in, the grid floor rezzes outward
//                       from it, #bl-stage settles back to 1:1
// The reverse jump is the same shape, compressed to ~1.24s.
//
// Two things make it smooth. First, the starfield is a real camera model: a
// star is a point in 3D and its screen position is the perspective divide
// (m / z), so it accelerates away from the vanishing point on its own instead
// of being pushed along a flat radial line. Second, the simulation runs on a
// fixed 120Hz sub-step decoupled from rAF, and the trail-persistence wipe is
// solved per second rather than per frame — so 60, 120 and 144Hz all produce
// the same picture at the same wall-clock moment.
//
// The CSS side is keyed off one-shot data-* flags on the overlay root
// (data-punch, data-boom, data-land) rather than a single changing phase, so
// no keyframe ever restarts or snaps back mid-flight. cleanup() is the one
// teardown path — natural end, Esc abort and unmount all go through it.

type Dir = "in" | "out";

/** One star in camera space. `ux/uy` is its unit direction from the vanishing
 *  point, `m` how far off-axis it sits on the z = 1 plane, `z` its depth, and
 *  `mag` its intrinsic brightness so the field isn't uniform. Everything is in
 *  world units, never pixels — which is why a mid-jump resize costs nothing:
 *  re-projecting is enough, no reseeding and no popping. */
interface Star {
  ux: number;
  uy: number;
  m: number;
  z: number;
  mag: number;
}

// Timeline milestones, ms from the start of each direction. The flash window
// is rise (flash→peak) / hold (peak→hold) / fade (hold→end); `attr` sits inside
// the hold, which is what keeps the theme swap invisible.
const IN = {
  runUp: 760,
  stretch: 1560,
  flash: 1760,
  peak: 1815,
  attr: 1855,
  hold: 1950,
  land: 1950,
  end: 2460,
};
const OUT = {
  runUp: 0,
  stretch: 560,
  flash: 700,
  peak: 750,
  attr: 790,
  hold: 870,
  land: 870,
  end: 1240,
};

// Camera. Z_FAR is deliberately deep so new stars are born as sub-pixel embers
// at the vanishing point and fade up out of nothing — spawning them any closer
// makes them pop into existence mid-screen.
const Z_NEAR = 0.045;
const Z_FAR = 6;
const PROJ = 0.5; // focal length as a fraction of the viewport half-diagonal
const SPEED_MIN = 0.28; // world units/sec at rest
const SPEED_MAX = 9.6; // …at full lightspeed
const TRAIL_BASE = 0.016; // seconds of travel drawn as a streak, at rest
const TRAIL_GAIN = 0.082; // …added at full lightspeed
const STRETCH_TRAIL = 2.8; // extra trail multiplier at the peak of the stretch

const SIM_STEP = 1000 / 120;
const SIM_STEP_SEC = SIM_STEP / 1000;
// 8 sub-steps absorbs a ~66ms hiccup smoothly; anything worse is a real stall
// and gets resynced rather than caught up on.
const MAX_STEPS = 8;
const MAX_FRAME_MS = 100; // a backgrounded tab can hand us a 2s "frame"

const clamp01 = (n: number) => (n < 0 ? 0 : n > 1 ? 1 : n);
const easeOutCubic = (p: number) => 1 - Math.pow(1 - p, 3);

/** How deep into lightspeed we are, 0–1. Everything else (speed, trail length,
 *  fringing, bloom) is a function of this, so the beats stay in sync. */
function warpAmount(t: number, dir: Dir): number {
  if (dir === "out") {
    const p = clamp01(t / OUT.flash);
    return 0.34 + 0.66 * p * p;
  }
  if (t < IN.runUp) {
    const p = clamp01(t / IN.runUp); // barely moving while the page falls away
    return 0.16 * p * p;
  }
  if (t < IN.stretch) {
    const p = clamp01((t - IN.runUp) / (IN.stretch - IN.runUp));
    return 0.16 + 0.78 * Math.pow(p, 2.6); // the long build
  }
  return 0.94 + 0.06 * clamp01((t - IN.stretch) / (IN.flash - IN.stretch));
}

/** Seconds of the star's own past path drawn as a streak. Deriving the streak
 *  from time-of-travel (rather than "wherever it was last frame") is what makes
 *  the trails identical at every refresh rate. */
function trailSeconds(t: number, dir: Dir, w: number): number {
  const m = dir === "in" ? IN : OUT;
  const base = TRAIL_BASE + TRAIL_GAIN * Math.pow(w, 1.7);
  if (t < m.stretch) return base;
  const p = clamp01((t - m.stretch) / (m.flash - m.stretch));
  return base * (1 + STRETCH_TRAIL * easeOutCubic(p));
}

export default function HyperspaceJump() {
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const flashRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const rootEl = rootRef.current;
    const canvasEl = canvasRef.current;
    const flashEl = flashRef.current;
    if (!rootEl || !canvasEl || !flashEl) return;
    const ctx = canvasEl.getContext("2d");
    if (!ctx) return;

    // Re-bound as plainly-typed consts: the loop below lives in hoisted
    // function declarations, and TypeScript won't carry a null-narrowing
    // across those. Doing it once here beats a `!` on every draw call.
    const root: HTMLDivElement = rootEl;
    const canvas: HTMLCanvasElement = canvasEl;
    const flash: HTMLDivElement = flashEl;
    const g: CanvasRenderingContext2D = ctx;

    let raf = 0;
    let running = false;
    let dir: Dir = "in";
    let start = 0;
    let last = 0;
    let acc = 0; // wall time not yet handed to the simulation, ms
    let simTime = 0; // where the simulation's own clock has got to, ms
    let stars: Star[] = [];
    let cx = 0;
    let cy = 0;
    let cw = 0;
    let ch = 0;
    let maxR = 1;
    let cullR = 1;
    let projScale = 1;
    let dpr = 1;
    let bloom: CanvasGradient | null = null;
    const did = { boom: false, attr: false, land: false };

    function stage(): HTMLElement | null {
      return document.getElementById("bl-stage");
    }

    function sizeCanvas() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      cw = Math.max(1, Math.floor(window.innerWidth * dpr));
      ch = Math.max(1, Math.floor(window.innerHeight * dpr));
      canvas.width = cw;
      canvas.height = ch;
      cx = cw / 2;
      cy = ch / 2;
      maxR = Math.hypot(cx, cy);
      cullR = maxR * 1.3;
      projScale = maxR * PROJ;
      // Built once per size and reused every frame — allocating a gradient in
      // the draw loop is exactly the kind of garbage that shows up as jitter
      // once you're trying to hit 144Hz.
      const bg = g.createRadialGradient(cx, cy, 0, cx, cy, maxR * 0.95);
      bg.addColorStop(0, "rgba(214, 252, 255, 0.45)");
      bg.addColorStop(0.16, "rgba(125, 249, 255, 0.18)");
      bg.addColorStop(0.55, "rgba(0, 184, 212, 0.05)");
      bg.addColorStop(1, "rgba(0, 184, 212, 0)");
      bloom = bg;
    }

    /** Scale the field with the viewport, but bounded — this has to stay cheap
     *  on a laptop and there is no point drawing 700 streaks on a 5K display. */
    function starCount(): number {
      const area = window.innerWidth * window.innerHeight;
      return Math.round(Math.min(360, Math.max(200, area / 5600)));
    }

    function placeStar(s: Star, d: Dir, initial: boolean) {
      const a = Math.random() * Math.PI * 2;
      s.ux = Math.cos(a);
      s.uy = Math.sin(a);
      // sqrt spreads the off-axis distance evenly over the disc instead of
      // clumping everything near the axis.
      s.m = 0.12 + Math.sqrt(Math.random()) * 1.05;
      s.mag = 0.5 + Math.random() * 0.5;
      if (d === "in") {
        // Recycled stars are reborn far away; the initial field is spread over
        // the whole depth range so the first frame is already a starfield.
        s.z = initial
          ? 0.5 + Math.random() * (Z_FAR - 0.5)
          : Z_FAR * (0.84 + Math.random() * 0.16);
      } else {
        // Going out we fly backwards: stars start close (and therefore near or
        // past the rim) and recede toward the vanishing point.
        s.z = initial ? 0.22 + Math.random() * 2.4 : 0.1 + Math.random() * 0.07;
      }
    }

    function seedStars(d: Dir) {
      const n = starCount();
      stars = new Array<Star>(n);
      for (let i = 0; i < n; i++) {
        const s: Star = { ux: 0, uy: 0, m: 0, z: 0, mag: 0 };
        placeStar(s, d, true);
        stars[i] = s;
      }
    }

    /** One fixed simulation tick. `tMs` is the simulation's own clock, not the
     *  frame's, so the speed curve is sampled at the same points regardless of
     *  how many ticks a given frame happens to run. */
    function step(dtSec: number, tMs: number, d: Dir) {
      const v = (SPEED_MIN + (SPEED_MAX - SPEED_MIN) * warpAmount(tMs, d)) * dtSec;
      for (let i = 0; i < stars.length; i++) {
        const s = stars[i];
        if (d === "in") {
          s.z -= v;
          if (s.z <= Z_NEAR || (s.m / s.z) * projScale > cullR) placeStar(s, d, false);
        } else {
          s.z += v;
          if (s.z >= Z_FAR) placeStar(s, d, false);
        }
      }
    }

    function strokeRadial(ux: number, uy: number, ra: number, rb: number) {
      g.beginPath();
      g.moveTo(cx + ux * ra, cy + uy * ra);
      g.lineTo(cx + ux * rb, cy + uy * rb);
      g.stroke();
    }

    function paint(t: number, d: Dir, frameMs: number) {
      const w = warpAmount(t, d);

      // Trail persistence. `destination-out` decays what's already there toward
      // transparency instead of painting fresh black over it, which matters for
      // two reasons: the streaks fade without their colour crawling toward the
      // background, and the canvas never becomes an opaque sheet — so the real
      // page keeps blurring and falling away visibly underneath. Taking the
      // screen to space is the veil's job (CSS, its own curve), not the wipe's.
      //
      // Solving for the alpha that leaves the same residue per *second* keeps
      // the smear identical at 60/120/144Hz; a flat per-frame alpha would halve
      // the trail length on a 120Hz panel.
      const ref = 0.42 - 0.3 * w;
      const wipe = 1 - Math.pow(1 - ref, Math.max(frameMs, 4) / 16.667);
      g.globalCompositeOperation = "destination-out";
      g.globalAlpha = 1;
      g.fillStyle = `rgba(0, 0, 0, ${wipe.toFixed(4)})`;
      g.fillRect(0, 0, cw, ch);

      const trailZ = (SPEED_MIN + (SPEED_MAX - SPEED_MIN) * w) * trailSeconds(t, d, w);
      const fringe = clamp01((w - 0.42) / 0.5);
      const gain = 0.72 + 0.28 * w;
      const maxTail = cullR * 3;

      // Additive blending does the bloom for us: overlapping streaks pile up
      // into white-hot cores. canvas shadowBlur would look similar and cost an
      // order of magnitude more, so the halo is just a wide, faint stroke.
      g.globalCompositeOperation = "lighter";
      g.lineCap = "round";

      for (let i = 0; i < stars.length; i++) {
        const s = stars[i];
        const depth = clamp01((Z_FAR / s.z - 1) / 8);
        if (depth <= 0.004) continue;
        const b = depth * s.mag * gain;

        const rHead = (s.m / s.z) * projScale;
        // Where the star was `trailSeconds` ago, projected the same way — the
        // streak therefore has true perspective foreshortening along its length.
        const zTail =
          d === "in"
            ? Math.min(s.z + trailZ, Z_FAR * 1.3)
            : Math.max(s.z - trailZ, Z_NEAR);
        let rTail = (s.m / zTail) * projScale;
        if (rTail > maxTail) rTail = maxTail;
        if (Math.min(rHead, rTail) > cullR) continue;

        const core = (0.5 + 2.2 * b) * dpr;

        g.strokeStyle = `rgba(125, 249, 255, ${(0.14 * b).toFixed(3)})`;
        g.lineWidth = core * 3;
        strokeRadial(s.ux, s.uy, rTail, rHead);

        g.strokeStyle = `rgba(238, 253, 255, ${(0.34 + 0.66 * b).toFixed(3)})`;
        g.lineWidth = core;
        strokeRadial(s.ux, s.uy, rTail, rHead);

        // Chromatic fringing: once we're properly moving, the streak's leading
        // tip runs violet and its tail runs blue, as if the light were being
        // pulled apart. Only the bright half of the field gets the extra two
        // strokes — on the dim ones it's invisible and just costs frame time.
        if (fringe > 0.02 && b > 0.2) {
          const span = rHead - rTail;
          const sp = span * 0.08 * fringe;
          g.lineWidth = core * 0.85;
          g.strokeStyle = `rgba(192, 125, 255, ${(0.34 * fringe * b).toFixed(3)})`;
          strokeRadial(s.ux, s.uy, rTail + span * 0.72, rHead + sp);
          g.lineWidth = core * 0.95;
          g.strokeStyle = `rgba(90, 200, 255, ${(0.3 * fringe * b).toFixed(3)})`;
          strokeRadial(s.ux, s.uy, rTail - sp, rTail + span * 0.3);
        }
      }

      // The vanishing point burns hotter the faster we go, which is what makes
      // the flash feel like an arrival rather than a cut.
      if (bloom) {
        g.globalAlpha = 0.06 + 0.34 * Math.pow(w, 2.4);
        g.fillStyle = bloom;
        g.fillRect(0, 0, cw, ch);
        g.globalAlpha = 1;
      }
      g.globalCompositeOperation = "source-over";
    }

    /** Rise → hold → fade. The fade is easeOut rather than a symmetric curve on
     *  purpose: it has to clear fast enough that the landing choreography plays
     *  in the open (the floor is still rezzing 500ms after the hold ends) while
     *  leaving a long, faint bloom behind it. */
    function flashOpacity(t: number, m: typeof IN | typeof OUT): number {
      if (t < m.flash) return 0;
      if (t < m.peak) return easeOutCubic((t - m.flash) / (m.peak - m.flash));
      if (t < m.hold) return 1;
      return 1 - easeOutCubic(clamp01((t - m.hold) / (m.end - m.hold)));
    }

    function onResize() {
      if (running) sizeCanvas();
    }

    /** The moment the theme actually changes — always inside the flash hold —
     *  plus the page-side landing choreography the CSS keyframes hang off. */
    function arrive() {
      setGrid(dir === "in");
      const st = stage();
      st?.classList.remove("bl-stage--warp-in", "bl-stage--warp-out");
      st?.classList.add(dir === "in" ? "bl-stage--land-in" : "bl-stage--land-out");
      root.dataset.land = "1";
      // Grid-scoped in CSS, so on the way out (data-egg already removed) this
      // class matches nothing and paper mode lands with a plain settle.
      document.documentElement.classList.add("bl-landing");
    }

    /** The single teardown path: natural end, Esc abort, and unmount. Anything
     *  this misses is a stuck overlay swallowing every click on the site, so it
     *  clears state unconditionally rather than trusting where it was called
     *  from. */
    function cleanup() {
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      const wasRunning = running;
      running = false;
      window.removeEventListener("resize", onResize);
      g.globalAlpha = 1;
      g.globalCompositeOperation = "source-over";
      g.clearRect(0, 0, cw, ch);
      flash.style.opacity = "0";
      root.dataset.active = "0";
      root.removeAttribute("data-dir");
      root.removeAttribute("data-punch");
      root.removeAttribute("data-boom");
      root.removeAttribute("data-land");
      document.documentElement.classList.remove("bl-jumping", "bl-landing");
      stage()?.classList.remove(
        "bl-stage--warp-in",
        "bl-stage--warp-out",
        "bl-stage--land-in",
        "bl-stage--land-out",
      );
      if (wasRunning) window.dispatchEvent(new Event("bl:hyperspace-end"));
    }

    function frame(now: number) {
      // Queued first so the loop survives a throw in paint(); cleanup() cancels
      // whatever id is current, including this one.
      raf = requestAnimationFrame(frame);

      const m = dir === "in" ? IN : OUT;
      const t = now - start;
      let frameMs = now - last;
      last = now;
      if (!(frameMs > 0)) frameMs = SIM_STEP;
      if (frameMs > MAX_FRAME_MS) frameMs = MAX_FRAME_MS;

      // Fixed-step simulation, decoupled from render.
      acc += frameMs;
      let steps = 0;
      while (acc >= SIM_STEP && steps < MAX_STEPS) {
        step(SIM_STEP_SEC, simTime, dir);
        simTime += SIM_STEP;
        acc -= SIM_STEP;
        steps += 1;
      }
      if (steps >= MAX_STEPS) {
        // A real stall (tab restored, long GC). Drop the backlog and snap the
        // simulation clock onto wall time instead of grinding through it — the
        // beats are what have to stay on schedule, not every intermediate tick.
        acc = 0;
        simTime = t;
      }

      // Once we've arrived the field is behind an opaque flash and a CSS fade;
      // freezing the last frame saves the entire landing beat of drawing.
      if (!did.attr) paint(t, dir, frameMs);
      flash.style.opacity = flashOpacity(t, m).toFixed(3);

      if (t >= m.stretch && root.dataset.punch !== "1") root.dataset.punch = "1";
      if (t >= m.flash && !did.boom) {
        did.boom = true;
        root.dataset.boom = "1";
        warpBoom();
      }
      if (t >= m.attr && !did.attr) {
        did.attr = true;
        arrive();
      }
      if (t >= m.land && !did.land) {
        did.land = true;
        warpLand();
      }
      if (t >= m.end) cleanup();
    }

    function run(d: Dir) {
      if (running) return;
      running = true;
      dir = d;
      did.boom = false;
      did.attr = false;
      did.land = false;
      acc = 0;
      simTime = 0;
      window.dispatchEvent(new Event("bl:hyperspace-start"));
      sizeCanvas();
      seedStars(d);
      flash.style.opacity = "0";
      root.dataset.active = "1";
      root.dataset.dir = d;
      document.documentElement.classList.add("bl-jumping");
      stage()?.classList.add(d === "in" ? "bl-stage--warp-in" : "bl-stage--warp-out");
      window.addEventListener("resize", onResize);
      if (d === "in") warpCharge();
      else warpDown();
      start = performance.now();
      last = start;
      raf = requestAnimationFrame(frame);
    }

    function onTrigger(e: Event) {
      const d = (e as CustomEvent<{ dir: Dir }>).detail?.dir ?? "in";
      run(d);
    }
    function onAbort() {
      if (running) cleanup();
    }

    window.addEventListener("bl:hyperspace", onTrigger as EventListener);
    window.addEventListener("bl:hyperspace-abort", onAbort);
    return () => {
      window.removeEventListener("bl:hyperspace", onTrigger as EventListener);
      window.removeEventListener("bl:hyperspace-abort", onAbort);
      cleanup();
    };
  }, []);

  return (
    <div className="hyperspace" ref={rootRef} data-active="0" aria-hidden="true">
      {/* The field is wrapped so the stretch "punch" (a transform) and the
          canvas fade-out (an opacity) can never restart each other. */}
      <div className="hyperspace-field">
        <canvas ref={canvasRef} />
      </div>
      <div className="hyperspace-flash" ref={flashRef} />
      <div className="hyperspace-bloom" />
      <div className="hyperspace-horizon" />
    </div>
  );
}
