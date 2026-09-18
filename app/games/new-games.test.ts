import { createScoundrel, fleeRoom, makeDungeon, resolveCard, tonicHeal, type ScoundrelState } from "./scoundrel/engine.ts";
import { initialCycleState, startNextRound, tickCycle, turnCycle, type CycleState } from "./light-cycle/engine.ts";
import { createGolf, takeShot } from "./loss-surface-golf/engine.ts";
import { CASES, clueCost, initialBeliefs, updateBeliefs } from "./bayesian-detective/engine.ts";
import { CONTRACTS, crossPlants, matchingContracts, phenotype, starterPlants } from "./genetic-garden/engine.ts";

let fail = 0;
const ok = (condition: boolean, name: string) => { if (!condition) { fail++; console.log("FAIL:", name); } };
const seeded = (seed: number) => { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32); };

// Scoundrel
ok(makeDungeon(seeded(1)).length === 44, "scoundrel builds a 44-card dungeon");
let sc = createScoundrel(seeded(2));
ok(sc.room.length === 4 && sc.deck.length === 40, "scoundrel deals a four-card room");
const fled = fleeRoom(sc);
ok(fled.room.length === 4 && fled.fledLastRoom, "scoundrel can flee one full room");
ok(fleeRoom(fled) === fled, "scoundrel cannot flee twice in succession");
const tonic: ScoundrelState = { ...sc, health: 5, room: [{ id: 100, suit: 1, rank: 7, faceUp: true }], deck: [] };
ok(resolveCard(tonic, 100).health === 12, "scoundrel tonic restores health");
const twoTonics: ScoundrelState = { ...sc, health: 4, room: [{ id: 101, suit: 1, rank: 5, faceUp: true }, { id: 102, suit: 1, rank: 6, faceUp: true }, { id: 104, suit: 2, rank: 3, faceUp: true }, { id: 105, suit: 0, rank: 3, faceUp: true }], deck: [] };
const afterTonic = resolveCard(twoTonics, 101);
const secondTonic = resolveCard(afterTonic, 102);
ok(secondTonic.health === afterTonic.health && !secondTonic.room.some((c) => c.id === 102), "scoundrel discards a second tonic in the same room without healing");
ok(tonicHeal(afterTonic, afterTonic.room.find((c) => c.id === 102)!) === 0, "scoundrel reports a spent tonic heals nothing");
// Two hearts left after the room's tonic is spent used to be a softlock: the
// room couldn't refill (needs one card) or be fled (needs four).
const strandedHearts: ScoundrelState = { ...sc, health: 10, tonicUsedThisRoom: true, fledLastRoom: false, room: [{ id: 106, suit: 1, rank: 4, faceUp: true }, { id: 107, suit: 1, rank: 8, faceUp: true }], deck: [{ id: 108, suit: 0, rank: 2, faceUp: true }, { id: 109, suit: 3, rank: 3, faceUp: true }, { id: 110, suit: 2, rank: 5, faceUp: true }] };
const unstuck = resolveCard(strandedHearts, 106);
ok(unstuck.room.length === 4 && !unstuck.tonicUsedThisRoom, "scoundrel never strands a room of spent tonics");
const fullHealth: ScoundrelState = { ...sc, health: 20, room: [{ id: 111, suit: 1, rank: 9, faceUp: true }, { id: 112, suit: 0, rank: 2, faceUp: true }], deck: [] };
ok(resolveCard(fullHealth, 111).room.length === 1, "scoundrel lets a tonic be discarded at full health");
// With the deck spent, clearing down to one card must not open a phantom room.
const endgame: ScoundrelState = { ...sc, roomsEntered: 9, tonicUsedThisRoom: true, room: [{ id: 113, suit: 0, rank: 2, faceUp: true }, { id: 114, suit: 3, rank: 2, faceUp: true }], deck: [] };
const lastCard = resolveCard(endgame, 113, "bare");
ok(lastCard.roomsEntered === 9 && lastCard.tonicUsedThisRoom, "scoundrel's final card stays in the same room");
ok(resolveCard(lastCard, 114, "bare").status === "won", "scoundrel is won when the last card is cleared");
const monster: ScoundrelState = { ...sc, weapon: 10, room: [{ id: 103, suit: 0, rank: 2, faceUp: true }], deck: [] };
ok(resolveCard(monster, 103, "bare").weapon === 10, "scoundrel bare-handed combat preserves weapon durability");
ok(createScoundrel(seeded(3), "damned").health === 16, "scoundrel difficulty changes starting health");

// Light-cycle simultaneous collision rules
let cycle = { ...initialCycleState(), status: "running" as const };
ok(turnCycle(cycle, "left") === cycle, "light-cycle blocks instant reversal");
const doubleTurn = turnCycle(turnCycle(cycle, "up"), "left");
ok(doubleTurn.pendingDir === "up" && doubleTurn.queuedDir === "left", "light-cycle buffers a second turn inside one tick");
ok(tickCycle(doubleTurn).pendingDir === "left", "light-cycle applies the buffered turn on the next tick");
const wall: CycleState = { ...cycle, player: [{ x: 27, y: 4 }], playerDir: "right", pendingDir: "right", ai: [{ x: 10, y: 10 }], aiDir: "left" };
ok(tickCycle(wall).status === "ai", "light-cycle player crashes at arena wall");
const roundTwo = startNextRound({ ...tickCycle(wall), aiScore: 1 });
ok(roundTwo.status === "running" && roundTwo.round === 2 && roundTwo.aiScore === 1, "light-cycle starts a new round while preserving match score");
ok(startNextRound(roundTwo) === roundTwo, "light-cycle start control cannot reset a live round");

// Loss-surface golf
let golf = createGolf();
golf = takeShot(golf, "sgd", "constant", 0.2, 0, 80);
ok(golf.status === "hole", "golf sinks the calibration bowl with a sensible shot");
let exhausted = createGolf("grant");
exhausted = takeShot(exhausted, "sgd", "constant", 0.01, 0, 999);
ok(exhausted.status === "failed", "golf enforces the compute allocation");
const diverged = takeShot(createGolf(), "sgd", "constant", 0.7, 0, 60);
ok(diverged.ball.diverged && diverged.currentCompute < 60, "golf charges only evaluations actually run before divergence");
const poisoned = { ...createGolf(), activeOptimizer: "momentum" as const, ball: { ...createGolf().ball, vx: 99, vy: -99, sx: 50, sy: 50, t: 30 } };
const switched = takeShot(poisoned, "adam", "constant", 0.02, 0, 1);
const cleanSwitch = takeShot({ ...poisoned, activeOptimizer: null }, "adam", "constant", 0.02, 0, 1);
ok(Math.abs(switched.ball.x - cleanSwitch.ball.x) < 1e-10 && Math.abs(switched.ball.y - cleanSwitch.ball.y) < 1e-10, "golf resets incompatible optimizer state when methods change");

// Bayesian detective
const c = CASES[0];
const before = initialBeliefs(c);
const after = updateBeliefs(before, c.clues[0]);
ok(Math.abs(Object.values(after).reduce((a, b) => a + b, 0) - 1) < 1e-10, "detective posteriors normalize");
ok(after.mara > before.mara, "diagnostic clue raises supported suspect probability");
ok(CASES.length === 4 && CASES[2].suspects.length === 4, "detective includes advanced four-suspect cases");
ok(clueCost(c.clues[0], "cold") > clueCost(c.clues[0], "guided"), "detective difficulty changes evidence costs");

// Genetic garden
const starters = starterPlants();
const child = crossPlants(starters[0], starters[3], 7, () => 0);
ok(phenotype(child).color === "white", "garden offspring inherits pigment alleles");
ok(phenotype(child).drought, "garden recessive drought trait requires two alleles");
ok(matchingContracts(child).includes("dry-white"), "garden detects completed phenotype contract");
const mutant = crossPlants(starters[0], starters[3], 8, () => 0, 1);
ok((mutant.mutations ?? 0) > 0, "garden mutation pressure alters inherited alleles");
ok(CONTRACTS.length === 6 && matchingContracts(starters[4]).includes("plum-seven"), "advanced garden commissions extend the starter genetics");

console.log(fail === 0 ? "\nALL NEW GAME ENGINE TESTS PASSED" : `\n${fail} failed`);
process.exit(fail ? 1 : 0);
