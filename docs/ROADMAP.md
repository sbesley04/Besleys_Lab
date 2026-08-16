# Arcade & Lab — roadmap

Ideas generated and triaged in planning sessions. **Everything under "Built"
is done and verified; everything below it was explicitly considered and not
started yet**, so nothing here needs re-deriving from scratch.

## Built

**Games** (`app/games/`): Hunger Games simulator, Tetris, Snake, 2048, Game of
Life, Solitaire (Klondike draw-1/draw-3, Spider 1/2/4-suit, FreeCell), Sudoku
(4 difficulties + shared daily puzzle + streaks), Minesweeper (3 sizes,
chording, first-click-safe), Evolution sandbox, Scoundrel (3 difficulty modes),
Loss-Surface Golf (5 constrained holes), Bayesian Detective (4 cases, 3
investigation modes), and Genetic Garden (hidden genotypes, assays, mutation,
6 commissions). The Grid also contains a hidden first-to-three Light-Cycle
duel that is absent from the paper arcade.

**Lab** (`app/lab/`): gradient descent on a loss surface, learning-rate
schedules, k-means, SVM + kernel trick, linear vs. logistic regression, a 2-2-1
net learning XOR, Bayes' theorem, Markov chain trained on the blog, Q-learning
gridworld.

**Systems**: achievements + trophy case, per-account high scores/stats, the
easter eggs and cameos listed in CLAUDE.md.

## Next up — highest value per effort

The data model already supports these; they're mostly UI:

1. **Global leaderboards.** `GameResult` already stores every win with
   time/moves/score per user. "Fastest Klondike this week" is one query and one
   page. Highest value-per-effort item on this list.
2. **Daily challenge for every game.** Sudoku already has a date-seeded daily
   puzzle; extend the same trick to Solitaire (same deal for everyone), 2048,
   Snake. Pairs with leaderboards.
3. **Achievement rarity** — "4% of players have this" under each trophy. One
   `groupBy` over the Achievement table.
4. **Public profile pages** at `/u/<username>` — someone's trophy case and
   personal bests, linkable.
5. **Replays.** The Hunger Games sim is already deterministic from
   (seed, roster); record input sequences for Snake/Tetris to get shareable
   "watch this run" links.
6. **Game-of-the-week spotlight** on the hub, rotating by ISO week number.

## More games (considered, not built)

Chess vs. a minimax engine (+ mate-in-2 puzzles reusing the daily machinery),
Wordle (streak system already exists), Blackjack or Poker squares (the
solitaire card engine is reusable), typing test with a WPM history chart,
nonograms, dots and boxes, Breakout, Asteroids, falling-sand, boids, Hexcells.

## More lab demos (considered, not built)

Bias–variance tradeoff slider, decision tree / random forest boundary explorer,
k-NN boundary, backprop step-by-step, activation function playground,
convolution kernel explorer (using a farm photo), central limit theorem
sampler, p-hacking simulator, MCMC sampler, tokenizer visualizer, word
embeddings in 2D, attention heatmap, multi-armed bandit vs. the player.

## Beyond the arcade

Interactive ML demos are the strongest career signal on the site — keep
investing there. Also considered: a "now" page, reading stats for the library
(books/year, rating distribution), an RSS feed for the blog, site-wide search.

## Known loose ends

- **Sprites are placeholders.** Junimo, sheep, bladderfish, grub, and Zote are
  hand-rolled inline SVG. Sam plans to replace them with real pixel art.
- **Markov demo runs on its fallback corpus** until more blog posts are
  published; it retrains on real posts automatically once there are enough.
- **Signed-in persistence is untested end-to-end.** The achievement/score
  routes follow the same pattern as the existing save routes and the migration
  is applied, but no session has actually exercised them in a browser.
- **`/api/results` recent rows cap at 60** — used only for client-side daily
  streak math. Aggregates are unbounded (SQL `groupBy`), so this is fine.
