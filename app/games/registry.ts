// Single source of truth for the arcade. The hub page maps over this list, so
// adding a game is a one-line change here plus a folder at app/games/<slug>/.
//
// EXTEND HERE: when you add a game (DOM-based or, later, a 2D-engine game),
// append an entry. `renderer` is informational for now but lets the hub badge
// engine-based games differently down the line.
export interface GameMeta {
  slug: string;
  title: string;
  blurb: string;
  /** In-world copy shown on the Grid (the Konami egg). */
  gridBlurb: string;
  renderer: "dom" | "canvas";
}

export const games: GameMeta[] = [
  {
    slug: "hunger-games",
    title: "Hunger Games Simulator",
    blurb: "Build a roster of tributes and watch the arena decide. Save rosters and replay runs.",
    gridBlurb: "Assemble a roster of programs and watch the arena resolve. Save rosters, replay runs.",
    renderer: "dom",
  },
  {
    slug: "tetris",
    title: "Tetris",
    blurb: "Paper-grid tetrominoes. Built with a useReducer game loop.",
    gridBlurb: "Falling data blocks. A useReducer loop keeps the stack honest.",
    renderer: "dom",
  },
  {
    slug: "snake",
    title: "Snake",
    blurb: "Guide the ink line, eat the rust dots, don't bite yourself.",
    gridBlurb: "Guide the light-cycle, absorb the nodes, don't cross your own trail.",
    renderer: "dom",
  },
  {
    slug: "2048",
    title: "2048",
    blurb: "Slide and merge tiles. The rust deepens as the numbers climb.",
    gridBlurb: "Slide and merge tiles. The glow intensifies as the numbers climb.",
    renderer: "dom",
  },
  {
    slug: "life",
    title: "Game of Life",
    blurb: "Draw a pattern on the graph paper and watch it evolve.",
    gridBlurb: "Seed a pattern on the grid and watch cellular logic propagate.",
    renderer: "dom",
  },
  {
    slug: "solitaire",
    title: "Solitaire",
    blurb: "Klondike, Spider, and FreeCell. Fifty-two cards — on a good day.",
    gridBlurb: "Klondike, Spider, FreeCell. Fifty-two cards — on a good cycle.",
    renderer: "dom",
  },
  {
    slug: "sudoku",
    title: "Sudoku",
    blurb: "Pencil marks welcome. Four difficulties, a daily puzzle, and streaks.",
    gridBlurb: "Constraint solving by hand. Four difficulties, a daily seed, streaks.",
    renderer: "dom",
  },
  {
    slug: "minesweeper",
    title: "Minesweeper",
    blurb: "Pencil grid, hidden mines. The first click is always safe — after that you're on your own.",
    gridBlurb: "Hidden mines on a grid. The first probe is always safe — after that you're on your own.",
    renderer: "dom",
  },
  {
    slug: "evolution",
    title: "Evolution",
    blurb: "Creatures forage, breed, and mutate. You set the world; selection writes the rest.",
    gridBlurb: "Agents forage, breed, and mutate. You set the parameters; selection compiles the rest.",
    renderer: "canvas",
  },
];
