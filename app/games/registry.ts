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
  category: "arcade" | "cards" | "logic" | "simulations";
  renderer: "dom" | "canvas";
}

export const GAME_CATEGORY_LABELS: Record<GameMeta["category"], string> = {
  arcade: "Arcade classics",
  cards: "Card table",
  logic: "Logic & strategy",
  simulations: "Living systems",
};

export const GAME_CATEGORY_ORDER: GameMeta["category"][] = [
  "arcade",
  "cards",
  "logic",
  "simulations",
];

export const games: GameMeta[] = [
  {
    slug: "hunger-games",
    title: "Hunger Games Simulator",
    blurb: "Build a roster of tributes and watch the arena decide. Save rosters and replay runs.",
    gridBlurb: "Assemble a roster of programs and watch the arena resolve. Save rosters, replay runs.",
    category: "simulations",
    renderer: "dom",
  },
  {
    slug: "tetris",
    title: "Tetris",
    blurb: "Paper-grid tetrominoes. Built with a useReducer game loop.",
    gridBlurb: "Falling data blocks. A useReducer loop keeps the stack honest.",
    category: "arcade",
    renderer: "dom",
  },
  {
    slug: "snake",
    title: "Snake",
    blurb: "Guide the ink line, eat the rust dots, don't bite yourself.",
    gridBlurb: "Guide the light-cycle, absorb the nodes, don't cross your own trail.",
    category: "arcade",
    renderer: "dom",
  },
  {
    slug: "2048",
    title: "2048",
    blurb: "Slide and merge tiles. The rust deepens as the numbers climb.",
    gridBlurb: "Slide and merge tiles. The glow intensifies as the numbers climb.",
    category: "arcade",
    renderer: "dom",
  },
  {
    slug: "life",
    title: "Game of Life",
    blurb: "Draw a pattern on the graph paper and watch it evolve.",
    gridBlurb: "Seed a pattern on the grid and watch cellular logic propagate.",
    category: "simulations",
    renderer: "dom",
  },
  {
    slug: "solitaire",
    title: "Solitaire",
    blurb: "Klondike, Spider, and FreeCell. Fifty-two cards — on a good day.",
    gridBlurb: "Klondike, Spider, FreeCell. Fifty-two cards — on a good cycle.",
    category: "cards",
    renderer: "dom",
  },
  {
    slug: "sudoku",
    title: "Sudoku",
    blurb: "Pencil marks welcome. Four difficulties, a daily puzzle, and streaks.",
    gridBlurb: "Constraint solving by hand. Four difficulties, a daily seed, streaks.",
    category: "logic",
    renderer: "dom",
  },
  {
    slug: "minesweeper",
    title: "Minesweeper",
    blurb: "Pencil grid, hidden mines. The first click is always safe — after that you're on your own.",
    gridBlurb: "Hidden mines on a grid. The first probe is always safe — after that you're on your own.",
    category: "logic",
    renderer: "dom",
  },
  {
    slug: "evolution",
    title: "Evolution",
    blurb: "Creatures forage, breed, and mutate. You set the world; selection writes the rest.",
    gridBlurb: "Agents forage, breed, and mutate. You set the parameters; selection compiles the rest.",
    category: "simulations",
    renderer: "canvas",
  },
  {
    slug: "scoundrel",
    title: "Scoundrel",
    blurb: "A standard deck becomes a dungeon. Manage weapons, ration tonics, and survive all forty-four cards.",
    gridBlurb: "A forty-four sector dungeon encoded in cards. Clear every hostile program.",
    category: "cards",
    renderer: "dom",
  },
  {
    slug: "loss-surface-golf",
    title: "Loss-Surface Golf",
    blurb: "Choose an optimizer and schedule, then converge before the compute allocation runs dry.",
    gridBlurb: "Navigate five optimization fields. Converge with minimal compute.",
    category: "logic",
    renderer: "dom",
  },
  {
    slug: "bayesian-detective",
    title: "Bayesian Detective",
    blurb: "Four cases, scarce inquiry budgets, and one accusation. Update your beliefs carefully.",
    gridBlurb: "Acquire evidence, update suspect probabilities, resolve the anomaly.",
    category: "logic",
    renderer: "dom",
  },
  {
    slug: "genetic-garden",
    title: "Genetic Garden",
    blurb: "Cross-pollinate, assay hidden genes, manage mutations, and fill an advanced seed catalogue.",
    gridBlurb: "Combine plant genomes. Compile requested phenotypes across generations.",
    category: "simulations",
    renderer: "dom",
  },
];
