// Pure-logic tests for the Snake, 2048, and Game of Life engines. Run with:
//   npm run test:games   (node --experimental-strip-types)
// Excluded from the Next build via the "**/*.test.ts" tsconfig glob.
import { reducer as snakeReducer, createInitialState as snakeInit, placeFood, COLS as SC, type GameState as SnakeState }
  from "./snake/engine.ts";
import { collapseLine, applyMove, isGameOver, reducer as g2048Reducer, type Board }
  from "./2048/engine.ts";
import { step, emptyGrid, COLS as LC, ROWS as LR } from "./life/engine.ts";

let fail = 0;
const ok = (c: boolean, n: string) => { if (!c) { fail++; console.log("FAIL:", n); } };

// ---------- SNAKE ----------
let s = snakeInit();
s = snakeReducer(s, { type: "START" });
ok(s.status === "running", "snake starts");
// moving right one tick: head advances, length preserved (no food in front)
const len0 = s.snake.length;
let s1 = snakeReducer(s, { type: "TICK" });
ok(s1.snake[0].x === s.snake[0].x + 1, "snake head moves right");
ok(s1.snake.length === len0, "snake length preserved when not eating");
// cannot reverse into itself: facing right, press left -> ignored
const s2 = snakeReducer(s, { type: "TURN", dir: "left" });
ok(s2.pendingDir === "right", "snake ignores 180 reversal");
// eating grows + scores: place food directly ahead of head
let eat: SnakeState = { ...s, food: { x: s.snake[0].x + 1, y: s.snake[0].y } };
let s3 = snakeReducer(eat, { type: "TICK" });
ok(s3.snake.length === len0 + 1, "snake grows when eating");
ok(s3.score === 1, "snake scores when eating");
// wall collision -> over (drive snake to right wall)
let wall: SnakeState = { ...s, snake: [{ x: SC - 1, y: 5 }, { x: SC - 2, y: 5 }], dir: "right", pendingDir: "right" };
ok(snakeReducer(wall, { type: "TICK" }).status === "over", "snake hits wall");
// self collision -> over
let body: SnakeState = { ...s, dir: "right", pendingDir: "down",
  snake: [{x:5,y:5},{x:5,y:6},{x:4,y:6},{x:4,y:5}] };
// pendingDir down: head (5,5)->(5,6) which is occupied by segment -> over
ok(snakeReducer(body, { type: "TICK" }).status === "over", "snake bites itself");

// ---------- 2048 ----------
ok(JSON.stringify(collapseLine([2,2,0,0]).line) === JSON.stringify([4,0,0,0]), "2048 merge pair");
ok(collapseLine([2,2,0,0]).gained === 4, "2048 merge scores 4");
ok(JSON.stringify(collapseLine([2,2,2,2]).line) === JSON.stringify([4,4,0,0]), "2048 double merge");
ok(JSON.stringify(collapseLine([4,4,2,2]).line) === JSON.stringify([8,4,0,0]), "2048 mixed merge");
ok(JSON.stringify(collapseLine([2,0,2,0]).line) === JSON.stringify([4,0,0,0]), "2048 slide+merge gap");
ok(JSON.stringify(collapseLine([2,4,8,16]).line) === JSON.stringify([2,4,8,16]), "2048 no-merge stays");
// applyMove left on a full board row-major
const b: Board = [2,2,0,0, 0,0,0,0, 4,0,4,0, 0,0,0,0];
const mv = applyMove(b, "left");
ok(mv.moved === true, "2048 applyMove detects movement");
ok(mv.board[0] === 4 && mv.board[8] === 8, "2048 applyMove merges rows left");
// no movement on already-collapsed
const settled: Board = [4,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0];
ok(applyMove(settled, "left").moved === false, "2048 no move when nothing slides");
// game over detection: checkerboard full, no merges
const over: Board = [2,4,2,4, 4,2,4,2, 2,4,2,4, 4,2,4,2];
ok(isGameOver(over) === true, "2048 detects game over");
ok(isGameOver(b) === false, "2048 not over with empties");
// reducer: illegal move returns same state (no spawn)
const st = { board: settled, score: 0, status: "playing" as const, won: false };
ok(g2048Reducer(st, { type: "MOVE", dir: "left" }) === st, "2048 illegal move is a no-op");

// ---------- LIFE ----------
// Blinker oscillator: vertical 3 -> horizontal 3 -> vertical 3
let g = emptyGrid();
const set = (x:number,y:number) => { g[y*LC+x] = true; };
set(5,4); set(5,5); set(5,6); // vertical bar
const g1 = step(g);
// after one step should be horizontal: (4,5),(5,5),(6,5)
ok(g1[5*LC+4] && g1[5*LC+5] && g1[5*LC+6], "life blinker -> horizontal");
ok(!g1[4*LC+5] && !g1[6*LC+5], "life blinker old cells died");
const g2 = step(g1);
ok(g2[4*LC+5] && g2[5*LC+5] && g2[6*LC+5], "life blinker -> vertical (period 2)");
// Block still life: 2x2 stays
let bg = emptyGrid();
bg[2*LC+2]=true; bg[2*LC+3]=true; bg[3*LC+2]=true; bg[3*LC+3]=true;
const bs = step(bg);
ok(JSON.stringify(bs) === JSON.stringify(bg), "life block is stable");
// empty stays empty
ok(step(emptyGrid()).every((c)=>!c), "life empty stays empty");

console.log(fail === 0 ? "\nALL GAME ENGINE TESTS PASSED" : `\n${fail} failed`);
process.exit(fail?1:0);
