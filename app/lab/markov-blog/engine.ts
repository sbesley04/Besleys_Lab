// ---------------------------------------------------------------------------
// Word-level Markov chain — pure logic, no React. Trained in the browser on
// whatever corpus the page hands it (this site's own blog posts by default).
//
// State = the previous `order` words; the chain stores the observed successors
// so sampling is just "pick one of the words that actually followed this".
// ---------------------------------------------------------------------------

export type Chain = Map<string, string[]>;

/** Split into words, keeping sentence punctuation as its own token. */
export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[`*_>#\[\]()]/g, " ") // strip markdown noise
    .replace(/\s+/g, " ")
    .replace(/([.!?;:,])/g, " $1")
    .split(" ")
    .map((w) => w.trim())
    .filter(Boolean);
}

/**
 * Build an order-n chain. Keys are `order` words joined by a space; values are
 * every word observed immediately after that key (duplicates kept, so sampling
 * uniformly from the list reproduces the true conditional distribution).
 */
export function buildChain(text: string, order: number): Chain {
  const words = tokenize(text);
  const chain: Chain = new Map();
  if (words.length <= order) return chain;

  for (let i = 0; i + order < words.length; i++) {
    const key = words.slice(i, i + order).join(" ");
    const next = words[i + order];
    const bucket = chain.get(key);
    if (bucket) bucket.push(next);
    else chain.set(key, [next]);
  }
  return chain;
}

/** Keys that look like the start of a sentence, for a natural opening. */
function sentenceStarts(chain: Chain): string[] {
  const starts: string[] = [];
  for (const key of chain.keys()) {
    if (!/^[.!?;:,]/.test(key)) starts.push(key);
  }
  return starts.length > 0 ? starts : [...chain.keys()];
}

/** Generate up to `maxWords` words from the chain. */
export function generate(
  chain: Chain,
  order: number,
  maxWords: number,
  rng: () => number = Math.random,
  seedKey?: string,
): string {
  if (chain.size === 0) return "";
  const starts = sentenceStarts(chain);
  let key = seedKey && chain.has(seedKey) ? seedKey : starts[Math.floor(rng() * starts.length)];

  const out: string[] = key.split(" ");
  while (out.length < maxWords) {
    const options = chain.get(key);
    if (!options || options.length === 0) {
      // Dead end — restart from another state rather than stopping short.
      const fresh = starts[Math.floor(rng() * starts.length)];
      if (out.length + order > maxWords) break;
      key = fresh;
      out.push(...fresh.split(" "));
      continue;
    }
    const next = options[Math.floor(rng() * options.length)];
    out.push(next);
    key = out.slice(-order).join(" ");
  }
  return detokenize(out.slice(0, maxWords));
}

/** Re-join tokens into something readable: no space before punctuation. */
export function detokenize(words: string[]): string {
  let out = "";
  for (const w of words) {
    if (/^[.!?;:,]$/.test(w)) out += w;
    else out += (out ? " " : "") + w;
  }
  // Capitalize sentence starts.
  return out.replace(/(^|[.!?]\s+)([a-z])/g, (_m, p, c) => p + c.toUpperCase());
}

export interface ChainStats {
  states: number;
  tokens: number;
  vocabulary: number;
  /** Average number of choices available per state — the "creativity" measure. */
  branching: number;
  /** Share of states with exactly one continuation (pure memorization). */
  deterministicShare: number;
}

export function chainStats(chain: Chain, text: string): ChainStats {
  const tokens = tokenize(text);
  let total = 0;
  let deterministic = 0;
  for (const options of chain.values()) {
    total += options.length;
    if (options.length === 1) deterministic++;
  }
  return {
    states: chain.size,
    tokens: tokens.length,
    vocabulary: new Set(tokens).size,
    branching: chain.size === 0 ? 0 : total / chain.size,
    deterministicShare: chain.size === 0 ? 0 : deterministic / chain.size,
  };
}

/** Fallback corpus so the demo still works on a site with no published posts. */
export const FALLBACK_CORPUS = `
The lab is quiet in the morning, which is when the best debugging happens.
A model is only as good as the question you asked it, and most of the work is
in the asking. I keep a notebook of things that did not work, because the
failures are more instructive than the wins. Data is never clean. The farm
taught me more about systems than any lecture did: feed the thing, watch it
grow, notice when it stops growing. Every project here started as a small
experiment that got out of hand. Building software by hand is slower and
better. The arcade began as a single game of tetris on a rainy afternoon.
`;
