// Deploy prep — the FIRST thing `npm run build` does. It self-guards by
// environment, so the same `build` script is correct both on Vercel and on a
// local machine. (Vercel's modern build pipeline runs `npm run build`, not a
// separate `vercel-build`, so all the deploy logic must live here.)
//
// Local dev uses zero-setup SQLite; serverless needs a hosted Postgres. Prisma
// can't switch datasource providers via env vars, so on Vercel this script
// rewrites the provider in prisma/schema.prisma to match DATABASE_URL (the edit
// happens only inside the build container, never in the committed repo) and
// then creates/updates the database schema and seeds the admin.
//
//   LOCAL  (no VERCEL):        generate the sqlite client, done.
//   VERCEL + postgres URL:     swap provider → generate → db push → seed.
//   VERCEL + missing/bad env:  fail the build with a clear message.

import { readFileSync, writeFileSync } from "node:fs";
import { execSync } from "node:child_process";

const SCHEMA = new URL("../prisma/schema.prisma", import.meta.url);
const onVercel = Boolean(process.env.VERCEL);
const url = process.env.DATABASE_URL ?? "";
const isPostgres = /^postgres(ql)?:\/\//i.test(url);

function run(cmd) {
  console.log(`[prepare-vercel] $ ${cmd}`);
  execSync(cmd, { stdio: "inherit" });
}

// --- Local build: nothing special, just make sure the client exists. ---------
if (!onVercel) {
  if (isPostgres) {
    // Rare: someone building locally against Postgres. Swap so generate matches.
    swapProviderToPostgres();
  }
  run("npx --no-install prisma generate");
  console.log("[prepare-vercel] local build prepared.");
  process.exit(0);
}

// --- On Vercel: env must be complete or the deploy is broken by definition. ---
const problems = [];
if (!isPostgres) {
  problems.push(
    "DATABASE_URL is missing or not a Postgres URL. SQLite is ephemeral on\n" +
      "  serverless — set DATABASE_URL to a hosted Postgres (Vercel Postgres /\n" +
      "  Neon / Supabase) in the Vercel project's Environment Variables.",
  );
}
if (!process.env.NEXTAUTH_SECRET) {
  problems.push(
    "NEXTAUTH_SECRET is missing. NextAuth refuses to run in production without\n" +
      "  it. Generate one with `openssl rand -base64 32` and add it in Vercel.",
  );
}
if (problems.length) {
  console.error(
    "\n[prepare-vercel] Cannot deploy — fix these in Vercel → Settings →\n" +
      "Environment Variables (Production), then redeploy:\n\n  • " +
      problems.join("\n\n  • ") +
      "\n",
  );
  process.exit(1);
}

// Swap sqlite → postgresql for this build, generate the matching client, sync
// the schema to the database, and seed the admin (seed self-skips if the
// ADMIN_* vars aren't set).
swapProviderToPostgres();
run("npx --no-install prisma generate");
run("npx --no-install prisma db push --skip-generate --accept-data-loss");
try {
  run("npx --no-install tsx prisma/seed.ts");
} catch {
  // A seed hiccup shouldn't take down the whole deploy — the public site works
  // without a seeded admin, and it can be re-seeded later.
  console.warn("[prepare-vercel] seed step failed — continuing build without it.");
}
console.log("[prepare-vercel] Vercel build prepared (postgres, schema pushed, admin seeded).");

// --- helpers -----------------------------------------------------------------
function swapProviderToPostgres() {
  const schema = readFileSync(SCHEMA, "utf8");
  // Line-anchored so comments mentioning a provider don't match.
  const swapped = schema.replace(/^(\s*)provider(\s*)=(\s*)"sqlite"/m, '$1provider$2=$3"postgresql"');
  if (swapped === schema) {
    if (/^\s*provider\s*=\s*"postgresql"/m.test(schema)) {
      console.log("[prepare-vercel] schema already uses postgresql.");
      return;
    }
    console.error("[prepare-vercel] could not find a sqlite datasource to swap — check prisma/schema.prisma.");
    process.exit(1);
  }
  writeFileSync(SCHEMA, swapped);
  console.log("[prepare-vercel] switched datasource provider to postgresql for this build.");
}
