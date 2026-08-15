# Besley's Lab — working notes

Personal site of Samuel Besley: blog, projects, digital library, an arcade of
browser games, and `/lab` — interactive machine-learning demos. Next.js App
Router + Prisma + NextAuth. Built by hand; no UI framework, no chart library,
no game engine.

## Commands

```bash
npm run dev          # dev server
npm test             # all engine test suites (pure logic, no browser)
npm run typecheck    # tsc --noEmit
npm run lint         # next lint
npm run prisma:migrate   # after editing prisma/schema.prisma
```

Always run `npm test && npm run typecheck && npm run lint` before calling work
done.

## Aesthetic: "Paper Lab"

Cream parchment, ink-black type, rust/aged-green accents, graph paper, photos
taped in like prints, handwriting (Caveat) for margin notes. **Every color,
font, and shadow comes from a CSS variable in `app/globals.css`** — never
hardcode a hex in a component unless it's data-viz series color (those live in
`app/lab/_components/plot.ts`). Token-driven styling is what lets the two
secret themes work for free (see Easter eggs).

## Architecture

```
app/
  games/          arcade — registry.ts drives the hub; one folder per game
    _components/  GameFrame (page chrome), SaveSlot (save/load to account)
    registry.ts   ← add a game here + a folder; hub needs no edits
    ArcadeHub.tsx client hub: game cards + Junimo + sheep + terminal + glider
  lab/            ML demos — same pattern, own registry
    _components/  LabFrame, PointCanvas, Axes, Controls, plot.ts (scales/palette)
    registry.ts   ← add a demo here + a folder
  api/            route handlers; every query scoped to the session user
lib/
  achievements.ts achievement definitions (single source of truth)
  arcade.ts       client-side progression: unlock(), recordPlayed(), postResult()
  saves.ts        save-payload rules; GAME_SLUGS derives from the registry
  sound.ts        tiny WebAudio effects (no audio assets)
prisma/schema.prisma
```

### The engine/component split (important)

Every game and demo separates **pure logic** from **React**:

- `engine.ts` — no React, no DOM, deterministic, `rng` injectable as a
  parameter so tests can seed it. All rules live here.
- `Component.tsx` — owns the loop, input, and painting. A dumb router.
- `engine.test.ts` — plain `node --experimental-strip-types`, no test
  framework. Style: `const ok = (cond, name) => ...` then a `fail` counter and
  `process.exit(fail ? 1 : 0)`. Register the script in package.json and append
  it to the `test` chain.

This is why the engines are trustworthy: gradient math is checked against
finite differences, k-means inertia is asserted non-increasing, Minesweeper's
first-click safety is swept over 25 seeds, etc.

## Adding a game

1. Append to `app/games/registry.ts` (slug, title, blurb, renderer).
2. Create `app/games/<slug>/` with `engine.ts`, `engine.test.ts`,
   `<Name>.tsx`, `page.tsx` (wrap in `GameFrame`), `<name>.module.css`.
3. Add the test script to package.json and the `test` chain.
4. In the component: `recordPlayed("<slug>")` on mount, `postResult(...)` on
   finish, `unlock(...)` for achievements, `<SaveSlot>` if it has state worth
   keeping.
5. Add achievements to `lib/achievements.ts` and the slug to `LAB_RAT_SLUGS`
   in `lib/arcade.ts`.

Adding a `/lab` demo is the same shape with `LabFrame`, `useDemoVisit(slug)`,
and `LAB_DEMO_SLUGS`.

## Progression system

- **`Achievement`** (Prisma) — one row per user per key. Keys come from
  `lib/achievements.ts`; the API rejects unknown ones. Never rename a key.
- **`GameResult`** — one row per finished game: `event` is `"deal"` (started)
  or `"win"`, plus `mode` (variant/difficulty), `timeMs`, `moves`, `score`,
  and a small JSON `meta`. `/api/results` aggregates **in SQL** (`groupBy`) so
  a personal best survives any number of later games.
- **`lib/arcade.ts`** — `unlock()` writes to localStorage first (guests earn
  achievements too), fires the toast event, then POSTs. `syncLocalToServer()`
  flushes guest unlocks to the account once per browser session.
- Trophy case renders on `/profile`; hidden achievements show as `???`.

## Easter eggs and cameos (don't delete by accident)

| Where | What |
|---|---|
| Anywhere | Konami code → "hyperspace jump" into **the Grid**, a Tron theme (`data-egg="tron"`). Konami again reverses it; Esc bails to paper; session-only. Jump cinematic in `HyperspaceJump.tsx`, SFX in `lib/sound.ts` (`warp*`), all Grid styling in `globals.css`. Grid state + `useOnGrid()` hook live in `lib/grid.ts` (call `setGrid()` to toggle — it fires `bl:egg-change` and grants the hidden `egg-grid` achievement on first entry); `<GridText paper grid>` swaps copy per-mode; SiteHeader shows a HUD readout on the Grid. Full restyle done: cards (corner brackets + derezz hover), header HUD + bracketed nav, photos (cyan holograms + tear), arcade cameos (wireframe Junimo/sheep, `arcade.module.css` `:global([data-egg='tron'])`), the secret terminal (native cyan console), and `/lab` charts — `plot.ts` mutates its palette arrays in place on `bl:egg-change` (neon cyan/magenta/lime), so no per-demo edits. In-world copy swaps live in the home hero, arcade registry (`gridBlurb`), games page, and footer. |
| `/games` | Type `besley` → secret terminal. `theme blueprint` unlocks the dark theme; `synthesize`, `train`, `lake`, `jeb_` are unlisted and grant hidden achievements |
| Solitaire | ~1/100 Klondike deals contain a Joker (rank 0, wild, can't reach a foundation); playing it stamps the win "assisted" |
| Game of Life | Draw a real glider → permanent drifting glider on the arcade hub |
| `/games` hub | Junimo asleep behind a random card; sheep shears after 5 clicks |
| Snake | 1/50 food pellets is a bladderfish (worth 5, plays a bloop) |
| Blog footer | Grub in a jar — click to free it |
| Any bad loss | Zote the Mighty recites a Precept (~30% chance) |

Sprites are hand-rolled inline SVG placeholders — Sam intends to replace them.

## Gotchas learned the hard way

- **SSR/hydration:** anything random (card deals, puzzle generation, creature
  spawns) must render a *fixed-seed* placeholder on the server and swap to a
  real random one in a mount effect. Otherwise hydration mismatches.
- **`reactStrictMode: true`** — state updater functions are invoked twice in
  dev. Never call `setState` inside another `setState` updater; updaters must
  be pure. This silently double-counted epochs in the XOR demo until it was
  found. Keep values that advance together in one state object.
- **Freeze end-of-game timers.** Displaying `won ? 0 : now - startedAt` shows
  `0:00` on the win banner. Capture a `finalElapsed` when the game ends.
- **SVG overlays must be clipped.** `.plotSvg` uses `overflow: visible` so axis
  labels aren't cut off; fit lines and margin bands therefore spill across the
  page unless clipped (`PointCanvas` has a `clipPath` for the underlay).
- **Don't render >1000 marks as DOM/SVG nodes.** The Bayes demo shipped 1 MB of
  HTML as 10,000 `<rect>`s; painting to a canvas took it to 17 KB.
- **`distDir` is `.next.nosync` locally** because iCloud corrupts `.next`
  mid-session (symptom: sudden MODULE_NOT_FOUND / login breaking).
- **Vercel deploy** runs `scripts/prepare-vercel.mjs`, which rewrites the
  Prisma datasource sqlite → postgresql *in the build container only*. Keep
  the datasource block line-anchored and SQLite-compatible (no enums, no
  scalar lists — JSON goes in `String` columns).
- **Verifying in the browser:** background tabs are timer-throttled, so
  animation-driven demos look frozen. Front the tab (`tabs_select`) before
  timing anything.

## Testing philosophy

Engine tests are the safety net; browser checks prove the wiring. When
verifying a game, actually drive it (a constraint solver won a Minesweeper
board to exercise the win path) rather than asserting the page renders.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
