"use client";

import { useEffect, useMemo, useState } from "react";
import styles from "../lab.module.css";
import { useDemoVisit } from "../_components/useDemoVisit";
import { Button, Readout, Slider } from "../_components/Controls";
import { buildChain, generate, chainStats } from "./engine";

// A word-level Markov chain trained in the browser on this site's own writing.
// The order slider is the whole demo: at n=1 it's word salad, at n=4 it's
// quoting the source back verbatim, and somewhere in between it sounds like a
// person having a slightly unreliable day.

export default function MarkovBlog({
  corpus,
  postCount,
  usingFallback,
}: {
  corpus: string;
  postCount: number;
  usingFallback: boolean;
}) {
  useDemoVisit("markov-blog");
  const [order, setOrder] = useState(2);
  const [length, setLength] = useState(60);
  const [text, setText] = useState("");
  const [nonce, setNonce] = useState(0);

  const chain = useMemo(() => buildChain(corpus, order), [corpus, order]);
  const stats = useMemo(() => chainStats(chain, corpus), [chain, corpus]);

  // Regenerate whenever the chain or the requested length changes.
  useEffect(() => {
    setText(generate(chain, order, length));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chain, order, length, nonce]);

  const flavor =
    order === 1
      ? "Order 1 — each word only knows the one before it. Grammatical fragments, no memory, no point."
      : order === 2
        ? "Order 2 — phrases start holding together. This is usually the sweet spot for sounding almost-human."
        : order === 3
          ? "Order 3 — recognizably the source's voice, but it's beginning to recite rather than invent."
          : "Order 4 — with a corpus this size there's usually only one possible next word, so it mostly replays whole sentences verbatim.";

  return (
    <div className={styles.layout}>
      <div className={styles.stage}>
        <p className={styles.panelTitle}>Generated</p>
        <div className={styles.output}>{text || "…"}</div>
      </div>

      <div className={styles.controls}>
        <Button onClick={() => setNonce((n) => n + 1)}>🎲 Generate again</Button>
      </div>

      <div className={styles.sliderGrid}>
        <Slider
          label="Order (n words of context)"
          value={order}
          onChange={(v) => setOrder(Math.round(v))}
          min={1}
          max={4}
          step={1}
          format={(v) => String(v)}
        />
        <Slider
          label="Length"
          value={length}
          onChange={(v) => setLength(Math.round(v))}
          min={20}
          max={160}
          step={10}
          format={(v) => `${v} words`}
        />
      </div>

      <p className={styles.aside}>{flavor}</p>

      <div className={styles.readouts}>
        <Readout label="corpus" value={`${stats.tokens.toLocaleString()} words`} />
        <Readout label="vocabulary" value={stats.vocabulary.toLocaleString()} />
        <Readout label="states" value={stats.states.toLocaleString()} />
        <Readout label="avg. choices per state" value={stats.branching.toFixed(2)} />
        <Readout label="dead-certain states" value={`${(stats.deterministicShare * 100).toFixed(0)}%`} />
      </div>

      <p className={styles.note}>
        {usingFallback ? (
          <>
            There aren&rsquo;t enough published posts on this site yet, so this is running on a
            small stand-in corpus. Publish a few posts and this demo retrains itself on them
            automatically.
          </>
        ) : (
          <>
            Trained on {postCount} published post{postCount === 1 ? "" : "s"} from this blog — the
            chain is built in your browser, from scratch, every time you move the slider.
          </>
        )}{" "}
        Watch the <em>dead-certain states</em> number as you raise the order: when most states have
        exactly one possible continuation, the model has stopped generalizing and started
        memorizing. That&rsquo;s overfitting, visible in a single statistic — and it&rsquo;s the same
        failure mode a language model has, just without the billions of parameters hiding it.
      </p>
    </div>
  );
}
