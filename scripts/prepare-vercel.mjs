// Runs first in the Vercel build (see "vercel-build" in package.json).
//
// Local dev uses zero-setup SQLite, but serverless needs a hosted Postgres.
// Prisma can't switch datasource providers via env vars, so this script flips
// the provider in prisma/schema.prisma to match DATABASE_URL at build time —
// the edit happens only inside the build container, never in the repo.
//
//   DATABASE_URL=postgres://…  → provider becomes "postgresql"
//   DATABASE_URL=file:…        → no-op (schema already says sqlite)
//
// After the swap, vercel-build runs `prisma generate` (provider-aware client)
// and `prisma db push` (creates/updates tables directly from the schema — this
// project uses db push in production instead of SQLite-flavoured migrations).

import { readFileSync, writeFileSync } from "node:fs";

const SCHEMA = new URL("../prisma/schema.prisma", import.meta.url);

const url = process.env.DATABASE_URL ?? "";
const isPostgres = /^postgres(ql)?:\/\//i.test(url);

if (!isPostgres) {
  if (process.env.VERCEL) {
    // On Vercel a SQLite file would be ephemeral — every deploy/invocation
    // would lose all data. Fail loudly instead of shipping a broken site.
    console.error(
      "[prepare-vercel] DATABASE_URL is missing or not a Postgres URL.\n" +
        "  Set DATABASE_URL to a hosted Postgres (Vercel Postgres / Neon / Supabase)\n" +
        "  in the Vercel project's environment variables, then redeploy.",
    );
    process.exit(1);
  }
  console.log("[prepare-vercel] DATABASE_URL is not Postgres — keeping sqlite provider.");
  process.exit(0);
}

const schema = readFileSync(SCHEMA, "utf8");

// Line-anchored so comments that merely mention a provider don't match.
const swapped = schema.replace(
  /^(\s*)provider(\s*)=(\s*)"sqlite"/m,
  '$1provider$2=$3"postgresql"',
);
if (swapped === schema) {
  if (/^\s*provider\s*=\s*"postgresql"/m.test(schema)) {
    console.log("[prepare-vercel] schema already uses postgresql.");
    process.exit(0);
  }
  console.error("[prepare-vercel] could not find a sqlite datasource to swap — check prisma/schema.prisma.");
  process.exit(1);
}

writeFileSync(SCHEMA, swapped);
console.log("[prepare-vercel] switched datasource provider to postgresql for this build.");
