# Besley's Lab

The personal site of Samuel Besley — data scientist & full-stack developer.
Part notebook, part workshop: a markdown blog with a live-preview editor, a
projects/lab-work shelf, a photo-notebook design system, and an arcade whose
headline act is a fully playable **Hunger Games simulator** with per-user
saved rosters and replayable runs.

**Stack:** Next.js 14 (App Router) · TypeScript · Prisma (SQLite locally,
Postgres in production) · NextAuth.js (credentials) · zero UI dependencies.

## Features

- **Home / About / Projects / Contact / Resume** — personal pages with photos
  from `photos/` treated as prints taped into a field notebook. The resume is
  served both as a web page (`/resume`) and a PDF (`/resume.pdf`).
- **Blog** — markdown posts rendered server-side; drafts stay private, staff
  can preview them. The admin editor has write/preview tabs, slug preview,
  inline validation, and explicit draft/publish actions.
- **Arcade** (`/games`) — Tetris, Snake, 2048, Game of Life, and the Hunger
  Games simulator. Signed-in players get a save slot per game.
- **Hunger Games simulator** (`/games/hunger-games`) — build a roster (or use
  the sample), tune six traits per tribute, and watch a deterministic,
  seed-driven simulation: procedural biome terrain, weather and night cycles, a
  shrinking border, alliances, betrayals, hazards, and a narrative feed.
  Rosters import/export as JSON; signed-in users can save rosters, save
  mid-run progress, and replay recorded runs from the dashboard.
- **Library** (`/library`) — a digital bookshelf. Every book is a CSS spine on
  a wooden shelf (with bookends and plants); the spine's color, size, and
  design are set in the admin book editor, which shows a live preview. Spines
  click through to the owner's review, and signed-in visitors can post their
  own review (one per account, editable). Admins arrange books across shelves
  from `/admin/books`.
- **Field notebook** — the home-page photo strip is admin-managed
  (`/admin/field-notes`): add/upload photos, edit captions and alt text,
  reorder. Visitors click any print to expand it full-screen (Esc or click to
  close, arrows to browse).
- **Accounts** — email/username + password via NextAuth. Roles: `USER`
  (save game state, post book reviews), `EDITOR` (manage own content), `ADMIN`
  (everything, including accounts).
- **Dashboard** (`/profile`) — saved games, saved rosters, recent simulations,
  profile settings, and admin links where applicable.
- **Admin** (`/admin`) — content dashboard with live draft/published counts and
  editors for posts, projects, and accounts.

## Getting started

```bash
# 1. Install dependencies (runs `prisma generate` via postinstall)
npm install

# 2. Configure environment
cp .env.example .env
#    Edit ADMIN_EMAIL / ADMIN_PASSWORD; generate NEXTAUTH_SECRET with
#    `openssl rand -base64 32`. DATABASE_URL="file:./dev.db" works as-is.

# 3. Create the database and tables
npm run prisma:migrate

# 4. Seed the first admin user (from the ADMIN_* env vars)
npm run db:seed

# 5. Run it
npm run dev                # http://localhost:3000
```

Sign in at `/login` with the seeded credentials. Public signup (`/signup`)
creates `USER` accounts; promote users from `/admin/users`.

## How saved state works

All persistence is per-user and lives in three Prisma models:

- `GameSave` — one named JSON slot per user per game (the arcade uses a single
  `autosave` slot). Engines expose a `LOAD` action; the shared `SaveSlot`
  component does the fetch/persist.
- `Roster` — a saved cast of Hunger Games tributes (name-scoped upsert).
- `SimulationRun` — a recorded run stored as `(seed, roster, summary)`. The
  engine is deterministic, so `/games/hunger-games?run=<id>` re-simulates the
  identical game instead of storing megabytes of turn logs. Runs are capped at
  25 per user (oldest pruned).

API routes under `/api/saves`, `/api/rosters`, and `/api/simulations` are
session-guarded and only ever touch rows owned by the caller.

## Blog workflow

1. `/admin/blog/new` — write markdown in the **Write** tab, check the
   **Preview** tab (same renderer as the public page).
2. **Save draft** keeps it private; **Publish** makes it public and stamps
   `publishedAt` the first time.
3. Drafts are visible to staff at their future URL with a "draft preview"
   badge, so you can proofread in place before publishing.

## Tests, lint, build

```bash
npm test            # engine tests: tetris, games registry, hunger games
npm run lint        # next lint
npm run typecheck   # tsc --noEmit
npm run build       # prisma generate && next build (what Vercel runs)
```

The Hunger Games engine tests cover determinism, conclusion guarantees, roster
validation (min/max counts, duplicate/empty names, out-of-range stats), and
JSON import/export round-trips.

## Deploying to Vercel

Import the repo with the **Next.js** framework preset (auto-detected; keep all
build defaults) and set four environment variables — that's the whole deploy:

| Variable | Value |
| --- | --- |
| `DATABASE_URL` | A hosted Postgres URL (Vercel Postgres / Neon / Supabase) |
| `NEXTAUTH_SECRET` | A fresh secret: `openssl rand -base64 32` |
| `NEXT_PUBLIC_SITE_URL` | Your production URL (used by OG tags + sitemap) |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | Credentials for the admin account (optional but recommended) |

Everything else is automatic. The `vercel-build` script:

1. detects the Postgres `DATABASE_URL` and switches the Prisma provider for
   that build (`scripts/prepare-vercel.mjs` — the repo itself stays on SQLite
   for local dev),
2. syncs the schema to the database with `prisma db push`,
3. seeds/updates the admin account from `ADMIN_EMAIL`/`ADMIN_PASSWORD`
   (skipped with a warning if unset or still the placeholder),
4. builds the site.

The build fails fast with a clear message if `DATABASE_URL` isn't Postgres, so
you can't accidentally ship an ephemeral database. `NEXTAUTH_URL` is provided
by Vercel automatically; set it explicitly only for a custom domain.

### Known limitations

- **Thumbnail uploads** (`/api/upload` → `public/uploads`) write to the local
  filesystem, which is ephemeral on Vercel. Use external image URLs in
  production, or swap in Vercel Blob/S3.
- The legacy Python prototype of the simulator lives in `hungergames/` for
  reference; the site uses the TypeScript port in
  `app/games/hunger-games/engine.ts` and doesn't need Python.

## Project layout

```
app/
  page.tsx               Home — hero, section cards, photo strip
  about/ contact/ resume/  Personal pages
  blog/                  Public list + [slug] post (markdown → .prose)
  projects/              Featured lab work + admin-managed shelf
  games/                 Arcade hub (registry-driven)
    hunger-games/        engine.ts (pure sim) · roster.ts (validation)
                         HungerGames.tsx (UI) · ArenaMap.tsx (canvas map)
    tetris/ snake/ …     engine.ts + component per game, LOAD-able
    _components/         GameFrame, SaveSlot
  profile/               Signed-in dashboard (+ /profile/edit)
  admin/                 Staff area: posts, projects, accounts
  api/                   Session-guarded CRUD: posts, projects, users,
                         saves, rosters, simulations, upload, signup
  error.tsx not-found.tsx global-error.tsx   Failure fallbacks
lib/                     prisma, auth, session/api guards, validation, saves
prisma/                  schema + migrations + seed
public/photos/           Web-optimized exports of the photo library
photos/                  Original photos (source assets, not served)
```

Search the codebase for `EXTEND HERE` comments — they mark the intended
extension points (new games, new content types, new sections).
