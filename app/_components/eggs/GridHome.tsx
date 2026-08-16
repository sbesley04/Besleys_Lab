"use client";

import { useEffect, useState, type CSSProperties } from "react";
import Link from "next/link";
import { games } from "@/app/games/registry";

// ---------------------------------------------------------------------------
// GridHome — the Konami landing page.
//
// Replaces the paper "desk" home while data-egg='tron' is active; app/page.tsx
// swaps the two subtrees through <GridSwitch>. The conceit is a JARVIS-style
// targeting HUD: a reticle and telemetry as chrome, and the arcade as the hero
// — every game is a "program" you acquire as a target and then execute. The
// rest of the site is demoted to a peripheral sector strip at the bottom,
// because the site header already carries the real navigation.
//
// Styling lives in app/_styles/grid-hud.css (global, imported from layout, and
// scoped under :root[data-egg='tron'] so none of it can reach paper mode).
// ---------------------------------------------------------------------------

// Peripheral sectors. Deliberately subordinate — small, uppercase, quiet.
const SECTORS = [
  { href: "/games", label: "Arcade" },
  { href: "/projects", label: "Projects" },
  { href: "/lab", label: "Lab" },
  { href: "/blog", label: "Blog" },
  { href: "/library", label: "Library" },
  { href: "/about", label: "About" },
];

// Programs that exist only after the Konami jump. They deliberately stay out
// of app/games/registry.ts, so the paper arcade, saves API, sitemap, Lab Rat,
// and public game count reveal nothing about them.
const GRID_ONLY_PROGRAMS = [
  {
    slug: "light-cycle",
    title: "LIGHT-CYCLE",
    blurb: "",
    gridBlurb: "Enter the arena. Preserve your trail and derezz the hostile program.",
    renderer: "dom" as const,
  },
];
const GRID_PROGRAMS = [...games, ...GRID_ONLY_PROGRAMS];

// --- Deterministic seeds ----------------------------------------------------
// The CLAUDE.md gotcha that bites hardest here: anything random or clock-derived
// has to render a *fixed* value on the server and only start moving in a mount
// effect, or hydration mismatches. Nothing below is recomputed during render,
// and Math.random() is only ever reached from inside the interval callback.
const CYCLE_SEED = 3 * 3600 + 41 * 60 + 7; // seeded so the HUD reads as already-running
const LINK_SEED = 99.4;
const FLUX_SEED = [4, 7, 5, 9, 6, 3, 8, 5, 7, 4, 6, 8]; // 12 bars, 1..9

function fmtCycle(s: number): string {
  const hh = String(Math.floor(s / 3600)).padStart(2, "0");
  const mm = String(Math.floor(s / 60) % 60).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
}

// --- Reticle geometry -------------------------------------------------------
// Only the tick ring needs real trig; every other ring is a <circle> with a dash
// pattern, which is far less markup than hand-written arc paths.
//
// Trig is *approximated* — the spec lets each JS engine pick its own precision,
// and Node renders the SVG that the browser then hydrates. Rounding to 2dp is
// coarse enough that server and client always stringify these attributes alike.
const TICK_COUNT = 48;
const round2 = (n: number) => Math.round(n * 100) / 100;
const TICKS = Array.from({ length: TICK_COUNT }, (_, i) => {
  const a = (i / TICK_COUNT) * Math.PI * 2;
  const major = i % 4 === 0;
  const inner = major ? 82 : 87;
  return {
    x1: round2(100 + Math.cos(a) * 92),
    y1: round2(100 + Math.sin(a) * 92),
    x2: round2(100 + Math.cos(a) * inner),
    y2: round2(100 + Math.sin(a) * inner),
    major,
  };
});

/** The targeting reticle. Purely decorative — every readable value lives in the
 *  telemetry block beside it. `locked` closes the brackets and spins up the
 *  inner lock ring when a program is hovered or focused. */
function Reticle({ locked }: { locked: boolean }) {
  return (
    <svg
      className="gridhud-ret"
      viewBox="0 0 200 200"
      data-locked={locked ? "1" : "0"}
      aria-hidden="true"
      focusable="false"
    >
      <g className="gridhud-ret__spin">
        {TICKS.map((t, i) => (
          <line
            key={i}
            className={t.major ? "gridhud-ret__tick gridhud-ret__tick--major" : "gridhud-ret__tick"}
            x1={t.x1}
            y1={t.y1}
            x2={t.x2}
            y2={t.y2}
          />
        ))}
      </g>

      {/* Static hairlines carry most of the structure; only three rings actually
          turn, which keeps the always-on animation budget tiny. */}
      <circle className="gridhud-ret__hair" cx="100" cy="100" r="78" />

      {/* dasharray ≈ a quarter of the circumference → two opposed 90° arcs. */}
      <circle
        className="gridhud-ret__arc gridhud-ret__spin-2"
        cx="100"
        cy="100"
        r="68"
        strokeDasharray="107 107"
      />
      {/* Fine dashes turning the other way, so the rings never visually lock up. */}
      <circle
        className="gridhud-ret__dash gridhud-ret__spin-r"
        cx="100"
        cy="100"
        r="56"
        strokeDasharray="6 10"
      />
      <circle className="gridhud-ret__dash" cx="100" cy="100" r="44" strokeDasharray="3 7" />

      {/* Lock ring: parked and invisible until a target is acquired. */}
      <circle className="gridhud-ret__lock" cx="100" cy="100" r="32" strokeDasharray="10 40" />

      {/* Crosshair spikes, gapped well clear of the centre. */}
      <g className="gridhud-ret__cross">
        <line x1="100" y1="6" x2="100" y2="26" />
        <line x1="100" y1="174" x2="100" y2="194" />
        <line x1="6" y1="100" x2="26" y2="100" />
        <line x1="174" y1="100" x2="194" y2="100" />
      </g>

      {/* Brackets scale inward on lock — transform only, so it stays cheap. */}
      <g className="gridhud-ret__brackets">
        <path d="M76 62 L62 62 L62 76" />
        <path d="M124 62 L138 62 L138 76" />
        <path d="M76 138 L62 138 L62 124" />
        <path d="M124 138 L138 138 L138 124" />
      </g>

      <circle className="gridhud-ret__core" cx="100" cy="100" r="3.5" />
    </svg>
  );
}

export default function GridHome() {
  // Telemetry. The seeded values are what the server renders; the effect below
  // is the only thing allowed to move them.
  const [cycle, setCycle] = useState(CYCLE_SEED);
  const [link, setLink] = useState(LINK_SEED);
  const [flux, setFlux] = useState<number[]>(FLUX_SEED);

  // Which program the pointer or keyboard is currently on. Drives the reticle's
  // lock state and the target readout — hover and focus are wired identically so
  // keyboard users get exactly the same acquisition feedback.
  const [target, setTarget] = useState<string | null>(null);

  useEffect(() => {
    // The flux meter is ambient motion, so it freezes for reduced-motion users;
    // the numeric readouts are text rather than animation and keep ticking.
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const id = window.setInterval(() => {
      // Jitter is computed *outside* the updaters: strict mode invokes updater
      // functions twice, so they have to stay pure (CLAUDE.md).
      const nextLink = 99 + Math.random() * 0.9;
      const nextBar = 1 + Math.floor(Math.random() * 9);
      setCycle((c) => c + 1);
      setLink(nextLink);
      if (!still) setFlux((f) => [...f.slice(1), nextBar]);
    }, 1000);
    return () => window.clearInterval(id);
  }, []);

  const acquired = GRID_PROGRAMS.find((g) => g.slug === target) ?? null;

  // Releasing is guarded by slug: pointer-out of one tile can fire after
  // pointer-in of the next, which would otherwise drop a live lock.
  const acquire = (slug: string) => () => setTarget(slug);
  const release = (slug: string) => () => setTarget((s) => (s === slug ? null : s));

  return (
    <main className="gridhud">
      {/* Corner chrome + edge tick rails. Decorative only. */}
      <div className="gridhud-frame" aria-hidden="true" />

      <section className="gridhud-head">
        <div className="gridhud-head__ret">
          <Reticle locked={acquired !== null} />
          <p className="gridhud-lockout" data-locked={acquired ? "1" : "0"} aria-hidden="true">
            {acquired ? acquired.slug.toUpperCase() : "NO TARGET"}
          </p>
        </div>

        <div className="gridhud-head__id">
          <p className="gridhud-kicker">PROGRAM // BESLEY-1 · GRID ACTIVE</p>
          <h1 className="gridhud-title">The Grid</h1>
          <p className="gridhud-sub">
            Arcade sector online. Acquire a program below and execute it — everything else on this
            system is running in the background.
          </p>
        </div>

        {/* Telemetry is pure atmosphere, and a screen reader announcing a ticking
            counter is noise, so the whole block leaves the a11y tree. */}
        <div className="gridhud-tel" aria-hidden="true">
          <p className="gridhud-tel__row">
            <span className="gridhud-tel__k">Link</span>
            <span className="gridhud-tel__v">{link.toFixed(1)}%</span>
          </p>
          <p className="gridhud-tel__row">
            <span className="gridhud-tel__k">Cycle</span>
            <span className="gridhud-tel__v">{fmtCycle(cycle)}</span>
          </p>
          <p className="gridhud-tel__row">
            <span className="gridhud-tel__k">Programs</span>
            <span className="gridhud-tel__v">{String(GRID_PROGRAMS.length).padStart(2, "0")}</span>
          </p>
          <div className="gridhud-flux">
            {flux.map((v, i) => (
              <span
                key={i}
                className="gridhud-flux__bar"
                style={{ "--gridhud-v": v / 9 } as CSSProperties}
              />
            ))}
          </div>
        </div>
      </section>

      <section className="gridhud-arcade" aria-labelledby="gridhud-arcade-label">
        <header className="gridhud-bar">
          <h2 className="gridhud-bar__label" id="gridhud-arcade-label">
            Arcade
          </h2>
          <span className="gridhud-bar__rule" aria-hidden="true" />
          <span className="gridhud-bar__count" aria-hidden="true">
            {String(GRID_PROGRAMS.length).padStart(2, "0")} PROGRAMS
          </span>
        </header>

        <ul className="gridhud-programs">
          {GRID_PROGRAMS.map((g, i) => (
            <li key={g.slug}>
              <Link
                href={`/games/${g.slug}`}
                className="gridhud-prog"
                data-locked={target === g.slug ? "1" : "0"}
                onMouseEnter={acquire(g.slug)}
                onMouseLeave={release(g.slug)}
                onFocus={acquire(g.slug)}
                onBlur={release(g.slug)}
              >
                <span className="gridhud-prog__frame" aria-hidden="true" />
                <span className="gridhud-prog__sweep" aria-hidden="true" />

                <svg
                  className="gridhud-prog__lock"
                  viewBox="0 0 44 44"
                  aria-hidden="true"
                  focusable="false"
                >
                  <circle className="gridhud-prog__lockring" cx="22" cy="22" r="16" />
                  <circle
                    className="gridhud-prog__lockspin"
                    cx="22"
                    cy="22"
                    r="20.5"
                    strokeDasharray="7 11"
                  />
                  <text className="gridhud-prog__locknum" x="22" y="22">
                    {String(i + 1).padStart(2, "0")}
                  </text>
                </svg>

                <span className="gridhud-prog__title">{g.title}</span>
                <span className="gridhud-prog__blurb">{g.gridBlurb}</span>

                <span className="gridhud-prog__stat" aria-hidden="true">
                  <span
                    className="gridhud-prog__rend"
                    data-canvas={g.renderer === "canvas" ? "1" : "0"}
                  >
                    RENDER:{g.renderer.toUpperCase()}
                  </span>
                  {/* Both states share one grid cell so the swap can't shift layout. */}
                  <span className="gridhud-prog__go">
                    <span className="gridhud-prog__go-idle">STANDBY</span>
                    <span className="gridhud-prog__go-hot">EXECUTE ▸</span>
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <nav className="gridhud-sectors" aria-label="Other sectors">
        <span className="gridhud-sectors__k" aria-hidden="true">
          Sectors
        </span>
        {SECTORS.map((s) => (
          <Link key={s.href} href={s.href} className="gridhud-sector">
            {s.label}
          </Link>
        ))}
      </nav>
    </main>
  );
}
