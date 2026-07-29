// ---------------------------------------------------------------------------
// Achievement registry — the single source of truth for every unlockable.
// Shared by the API route (key validation), the client hook (unlock + toast),
// and the profile trophy case (rendering, locked/hidden states).
//
// `hidden` achievements render as "???" until unlocked — easter-egg rewards.
// EXTEND HERE: append a definition and start calling unlock("your-key") from
// a game. Never reuse or rename a key — rows in the DB reference it.
// ---------------------------------------------------------------------------

export interface AchievementDef {
  key: string;
  title: string;
  desc: string;
  /** Game slug, or "meta" for site-wide, or "secret" for easter eggs. */
  game: string;
  /** Shown as ??? in the trophy case until unlocked. */
  hidden?: boolean;
  /** Emoji stamp shown in the trophy case + unlock toast. */
  icon: string;
}

export const ACHIEVEMENTS: AchievementDef[] = [
  // --- Solitaire ---
  { key: "sol-clean-sweep", game: "solitaire", icon: "🧹", title: "Clean Sweep", desc: "Win a solitaire game without using undo." },
  { key: "sol-speed-run", game: "solitaire", icon: "⏱", title: "Speed Run", desc: "Win Klondike in under 3 minutes." },
  { key: "sol-thoughtful", game: "solitaire", icon: "🐢", title: "Thoughtful", desc: "Win a game that took over 30 minutes." },
  { key: "sol-vegas", game: "solitaire", icon: "🎰", title: "Vegas Rules", desc: "Win a Klondike draw-3 game." },
  { key: "sol-triple-crown", game: "solitaire", icon: "👑", title: "Triple Crown", desc: "Win at least once in Klondike, Spider, and FreeCell." },
  { key: "sol-comeback", game: "solitaire", icon: "🔥", title: "Comeback", desc: "Win after having 40+ cards still face-down mid-game." },
  { key: "sol-centurion", game: "solitaire", icon: "💯", title: "Centurion", desc: "Deal 100 solitaire games, win or lose." },
  { key: "sol-card-53", game: "solitaire", icon: "🃏", title: "The 53rd Card", desc: "Find the card that shouldn't exist.", hidden: true },

  // --- Sudoku ---
  { key: "sud-no-notes", game: "sudoku", icon: "🚫", title: "No Notes", desc: "Solve a puzzle without using pencil marks." },
  { key: "sud-flawless", game: "sudoku", icon: "✨", title: "Flawless", desc: "Solve a puzzle with zero wrong entries." },
  { key: "sud-ascension", game: "sudoku", icon: "🪜", title: "Ascension", desc: "Solve at least one puzzle on every difficulty." },
  { key: "sud-daily-habit", game: "sudoku", icon: "📅", title: "Daily Habit", desc: "Keep a 7-day daily-puzzle streak." },
  { key: "sud-under-pressure", game: "sudoku", icon: "⚡", title: "Under Pressure", desc: "Solve an easy puzzle in under 3 minutes." },
  { key: "sud-long-game", game: "sudoku", icon: "🧠", title: "The Long Game", desc: "Solve an expert puzzle with no hints." },

  // --- Minesweeper ---
  { key: "mine-first-sweep", game: "minesweeper", icon: "🚩", title: "All Clear", desc: "Sweep a board without hitting a mine." },
  { key: "mine-expert", game: "minesweeper", icon: "💣", title: "Bomb Disposal", desc: "Clear an expert board — all 99 of them." },
  { key: "mine-speed", game: "minesweeper", icon: "⚡", title: "Steady Hands", desc: "Sweep a beginner board in under 15 seconds." },
  { key: "mine-cartographer", game: "minesweeper", icon: "🗺", title: "Cartographer", desc: "Win with every single mine correctly flagged." },

  // --- Evolution ---
  { key: "evo-dynasty", game: "evolution", icon: "🧬", title: "Dynasty", desc: "Keep a population alive for 25 generations." },
  { key: "evo-deep-time", game: "evolution", icon: "⏳", title: "Deep Time", desc: "Reach generation 100 without extinction." },
  { key: "evo-extinction", game: "evolution", icon: "☄️", title: "Mass Extinction", desc: "Wipe out an entire population. It happens." },
  { key: "evo-cheetah", game: "evolution", icon: "🐆", title: "Built for Speed", desc: "Evolve an average speed of 2.0 or higher." },
  { key: "evo-titan", game: "evolution", icon: "🐘", title: "Titan", desc: "Evolve an average size of 2.0 or higher." },

  // --- The Lab ---
  { key: "lab-visitor", game: "lab", icon: "🔬", title: "Lab Notebook", desc: "Try every experiment on the bench." },
  { key: "lab-diverged", game: "lab", icon: "📈", title: "Diverged", desc: "Blow up a training run with too high a learning rate." },
  { key: "lab-xor", game: "lab", icon: "🧠", title: "Hidden Layer", desc: "Train the little network until it actually solves XOR." },
  { key: "lab-policy", game: "lab", icon: "🗺️", title: "Optimal Policy", desc: "Train a Q-learning agent to an 80% success rate." },

  // --- Tetris ---
  { key: "tet-tetris", game: "tetris", icon: "🟦", title: "Tetris!", desc: "Clear four lines at once." },
  { key: "tet-marathon", game: "tetris", icon: "🏃", title: "Marathon", desc: "Reach level 10." },

  // --- Snake ---
  { key: "snk-ouroboros", game: "snake", icon: "🐍", title: "Ouroboros", desc: "Fill a quarter of the board with your own body." },

  // --- 2048 ---
  { key: "g2048-namesake", game: "2048", icon: "🔢", title: "The Namesake", desc: "Make the 2048 tile." },
  { key: "g2048-overachiever", game: "2048", icon: "🚀", title: "Overachiever", desc: "Reach 4096." },

  // --- Game of Life ---
  { key: "life-immortalist", game: "life", icon: "♾️", title: "Immortalist", desc: "Run a pattern still alive after 1,000 generations." },
  { key: "life-gliderwright", game: "life", icon: "🛩", title: "Gliderwright", desc: "Draw a working glider from scratch." },

  // --- Hunger Games ---
  { key: "hg-sole-survivor", game: "hunger-games", icon: "🏆", title: "Sole Survivor", desc: "A tribute named after you wins the arena." },
  { key: "hg-bloodbath", game: "hunger-games", icon: "🩸", title: "Bloodbath", desc: "Six or more tributes fall on day one." },

  // --- Site-wide ---
  { key: "meta-lab-rat", game: "meta", icon: "🐀", title: "Lab Rat", desc: "Play every game in the arcade at least once." },
  { key: "meta-night-shift", game: "meta", icon: "🌙", title: "Night Shift", desc: "Play any game between 2am and 5am." },
  { key: "meta-renaissance", game: "meta", icon: "🎨", title: "Renaissance Scientist", desc: "Hold a win in four different games." },
  { key: "meta-anniversary", game: "meta", icon: "🎂", title: "One Year In", desc: "Visit on the anniversary of your account." },

  // --- Easter eggs (all hidden) ---
  { key: "egg-shear", game: "secret", icon: "🐑", title: "Just Shear Luck", desc: "Somebody had to shear it.", hidden: true },
  { key: "egg-grubsong", game: "secret", icon: "🫙", title: "Grubsong", desc: "Free a small friend from a jar.", hidden: true },
  { key: "egg-chemist", game: "secret", icon: "⚗️", title: "Zinc & Iodine", desc: "Reproduce a classic synthesis in the terminal.", hidden: true },
  { key: "egg-overfit", game: "secret", icon: "📉", title: "Suspiciously Low Loss", desc: "Train a model that learned a little too well.", hidden: true },
  { key: "egg-rusty", game: "secret", icon: "🦌", title: "The Lake Is Calling", desc: "Ask the terminal about a certain lake.", hidden: true },
  { key: "egg-jeb", game: "secret", icon: "🌈", title: "jeb_", desc: "An old name tag still works here.", hidden: true },
];

export const ACHIEVEMENT_KEYS = new Set(ACHIEVEMENTS.map((a) => a.key));
export const ACHIEVEMENTS_BY_KEY = new Map(ACHIEVEMENTS.map((a) => [a.key, a]));

/** Display sections for the trophy case, in render order. */
export const ACHIEVEMENT_SECTIONS: { game: string; label: string }[] = [
  { game: "solitaire", label: "Solitaire" },
  { game: "sudoku", label: "Sudoku" },
  { game: "minesweeper", label: "Minesweeper" },
  { game: "evolution", label: "Evolution" },
  { game: "lab", label: "The Lab" },
  { game: "tetris", label: "Tetris" },
  { game: "snake", label: "Snake" },
  { game: "2048", label: "2048" },
  { game: "life", label: "Game of Life" },
  { game: "hunger-games", label: "Hunger Games" },
  { game: "meta", label: "Around the Lab" },
  { game: "secret", label: "???" },
];
