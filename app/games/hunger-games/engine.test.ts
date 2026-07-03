// Hunger Games engine + roster validation tests.
// Run directly:  node --experimental-strip-types app/games/hunger-games/engine.test.ts
// (wired into `npm test` alongside the other engine tests)

import { simulate, RNG, buildArena, GRID } from "./engine.ts";
import {
  SAMPLE_ROSTER,
  rosterProblems,
  parseRosterJson,
  rosterToJson,
  blankPlayer,
  MIN_PLAYERS,
  MAX_PLAYERS,
  type RosterPlayer,
} from "./roster.ts";

let failures = 0;

function check(name: string, cond: boolean, detail?: string) {
  if (cond) {
    console.log(`  ✓ ${name}`);
  } else {
    failures += 1;
    console.error(`  ✗ ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

function mini(names: string[]): RosterPlayer[] {
  return names.map((name, i) => ({
    name,
    district: (i % 12) + 1,
    stats: { judge: 6, sponsor: 5, advantages: 5, kill: 5, fight: 5, survival: 5 },
  }));
}

// --- RNG ------------------------------------------------------------------

console.log("RNG");
{
  const a = new RNG(42);
  const b = new RNG(42);
  const seqA = Array.from({ length: 5 }, () => a.random());
  const seqB = Array.from({ length: 5 }, () => b.random());
  check("same seed → same sequence", JSON.stringify(seqA) === JSON.stringify(seqB));
  check("values in [0,1)", seqA.every((v) => v >= 0 && v < 1));
  const c = new RNG(7);
  const ints = Array.from({ length: 200 }, () => c.randint(1, 6));
  check("randint stays in range", ints.every((v) => v >= 1 && v <= 6));
  check("randint hits both ends", ints.includes(1) && ints.includes(6));
}

// --- Arena ------------------------------------------------------------------

console.log("Arena");
{
  const arena = buildArena(new RNG(42));
  check("arena is GRID×GRID", arena.length === GRID && arena.every((r) => r.length === GRID));
  const center = arena[GRID / 2][GRID / 2];
  check("cornucopia at centre", center === "cornucopia");
  const biomes = new Set(arena.flat());
  check("multiple biomes generated", biomes.size >= 4, `got ${[...biomes].join(",")}`);
}

// --- Simulation ------------------------------------------------------------------

console.log("Simulation");
{
  const result = simulate(SAMPLE_ROSTER, 42);
  check("produces snapshots", result.snapshots.length > 1);
  check(
    "concludes with a single winner",
    result.winner !== null,
    `winner=${result.winner}, turns=${result.snapshots.length}`,
  );
  check(
    "placements cover the full roster",
    result.placements.length === SAMPLE_ROSTER.length,
  );
  check("winner is placement #1", result.placements[0].name === result.winner);
  const last = result.snapshots[result.snapshots.length - 1];
  check("final snapshot has one tribute alive", last.aliveCount === 1);

  // Determinism: same roster + seed → identical run.
  const again = simulate(SAMPLE_ROSTER, 42);
  check("deterministic for same seed", JSON.stringify(again) === JSON.stringify(result));

  // Different seed → (almost certainly) different story.
  const other = simulate(SAMPLE_ROSTER, 43);
  check(
    "different seed varies the run",
    JSON.stringify(other.snapshots) !== JSON.stringify(result.snapshots),
  );

  // Health/positions stay in bounds on every snapshot.
  const inBounds = result.snapshots.every((s) =>
    s.players.every(
      (p) => p.x >= 0 && p.x < GRID && p.y >= 0 && p.y < GRID && p.health >= 0 && p.health <= 100,
    ),
  );
  check("positions and health stay in bounds", inBounds);

  // Alive count never increases.
  let monotonic = true;
  for (let i = 1; i < result.snapshots.length; i++) {
    if (result.snapshots[i].aliveCount > result.snapshots[i - 1].aliveCount) monotonic = false;
  }
  check("alive count never increases", monotonic);

  // Deaths recorded in snapshots match placements.
  const deadInSnaps = result.snapshots.flatMap((s) => s.deaths);
  const deadInPlacements = result.placements.filter((p) => p.deathTurn !== null).map((p) => p.name);
  check(
    "snapshot deaths match placements",
    deadInSnaps.length === deadInPlacements.length &&
      deadInSnaps.every((n) => deadInPlacements.includes(n)),
  );

  // Dying players get a final narrative line.
  const deathTurnLines = result.snapshots.every((s) =>
    s.players.every((p) => !s.deaths.includes(p.name) || typeof p.dialogue === "string"),
  );
  check("dying tributes get a final line", deathTurnLines);
}

console.log("Simulation — edge cases");
{
  const duel = simulate(mini(["A", "B"]), 7);
  check("2-player duel resolves", duel.winner !== null && duel.placements.length === 2);

  // A run "resolves" when ≤1 tribute is left: either a winner or a wipeout
  // (the arena killing the last tributes in the same turn is legitimate).
  const big = simulate(mini(Array.from({ length: MAX_PLAYERS }, (_, i) => `T${i + 1}`)), 3);
  const bigLast = big.snapshots[big.snapshots.length - 1];
  check(
    `${MAX_PLAYERS}-player game resolves`,
    bigLast.aliveCount <= 1 && (big.outcome === "winner" || big.outcome === "wipeout"),
    `outcome=${big.outcome}`,
  );

  // Multiple seeds always conclude (ring guarantees an ending).
  const seeds = [1, 2, 3, 10, 999, 123456];
  const allConclude = seeds.every((s) => {
    const r = simulate(SAMPLE_ROSTER, s);
    return r.snapshots[r.snapshots.length - 1].aliveCount <= 1;
  });
  check("many seeds all conclude", allConclude);

  // A hard turn cap can end without a winner — result stays well-formed.
  const capped = simulate(SAMPLE_ROSTER, 42, 1);
  check(
    "turn-capped run has no winner but valid placements",
    capped.winner === null && capped.outcome === "cap" && capped.placements.length === SAMPLE_ROSTER.length,
  );
}

// --- Roster validation ------------------------------------------------------------------

console.log("Roster validation");
{
  check("sample roster is valid", rosterProblems(SAMPLE_ROSTER).length === 0);
  check("too few players rejected", rosterProblems(mini(["Solo"])).some((e) => e.includes(`${MIN_PLAYERS}`)));
  check(
    "too many players rejected",
    rosterProblems(mini(Array.from({ length: MAX_PLAYERS + 1 }, (_, i) => `T${i}`))).length > 0,
  );
  check(
    "empty name rejected",
    rosterProblems(mini(["", "B"])).some((e) => e.toLowerCase().includes("name is required")),
  );
  check(
    "duplicate names rejected (case-insensitive)",
    rosterProblems(mini(["Sam", "sam"])).some((e) => e.includes("Duplicate")),
  );
  const badStat = mini(["A", "B"]);
  badStat[0].stats.fight = 11;
  check("out-of-range stat rejected", rosterProblems(badStat).some((e) => e.includes("combat")));
  const badDistrict = mini(["A", "B"]);
  badDistrict[0].district = 13;
  check("district 13 rejected", rosterProblems(badDistrict).some((e) => e.includes("district")));
  const fractional = mini(["A", "B"]);
  fractional[0].stats.kill = 4.5;
  check("fractional stat rejected", rosterProblems(fractional).length > 0);

  const blank = blankPlayer();
  check("blank player template needs only a name", playersNeedOnlyName(blank));
  function playersNeedOnlyName(p: RosterPlayer): boolean {
    const errs = rosterProblems([{ ...p, name: "Test" }, { ...p, name: "Test2" }]);
    return errs.length === 0;
  }
}

console.log("Roster import/export");
{
  const json = rosterToJson(SAMPLE_ROSTER);
  const parsed = parseRosterJson(json);
  check("export → import round-trips", !parsed.error && JSON.stringify(parsed.players) === JSON.stringify(SAMPLE_ROSTER));
  check("bare array accepted", !parseRosterJson(JSON.stringify(SAMPLE_ROSTER)).error);
  check("invalid JSON rejected gracefully", Boolean(parseRosterJson("not json {").error));
  check("wrong shape rejected gracefully", Boolean(parseRosterJson('{"nope": 1}').error));
  check("valid JSON, invalid roster rejected", Boolean(parseRosterJson('[{"name":"", "district": 99}]').error));
}

if (failures > 0) {
  console.error(`\n${failures} hunger-games test(s) failed`);
  process.exit(1);
}
console.log("\nAll hunger-games engine tests passed ✅");
