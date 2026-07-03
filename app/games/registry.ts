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
  renderer: "dom" | "canvas";
}

export const games: GameMeta[] = [
  {
    slug: "hunger-games",
    title: "Hunger Games Simulator",
    blurb: "Build a roster of tributes and watch the arena decide. Save rosters and replay runs.",
    renderer: "dom",
  },
  {
    slug: "tetris",
    title: "Tetris",
    blurb: "Paper-grid tetrominoes. Built with a useReducer game loop.",
    renderer: "dom",
  },
  {
    slug: "snake",
    title: "Snake",
    blurb: "Guide the ink line, eat the rust dots, don't bite yourself.",
    renderer: "dom",
  },
  {
    slug: "2048",
    title: "2048",
    blurb: "Slide and merge tiles. The rust deepens as the numbers climb.",
    renderer: "dom",
  },
  {
    slug: "life",
    title: "Game of Life",
    blurb: "Draw a pattern on the graph paper and watch it evolve.",
    renderer: "dom",
  },
];
