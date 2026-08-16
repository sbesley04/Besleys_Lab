"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

// The Lab Gremlin, a gentle loss heckler. Games report an embarrassing defeat
// via summonZote(); with modest probability it appears and recites a rule
// loosely aimed at the failure. Mounted once in the root layout.

export const ZOTE_EVENT = "bl:zote";

/** Call on a *bad* loss. ~30% chance Zote deigns to appear. */
export function summonZote(topic: "score" | "speed" | "general" = "general") {
  if (Math.random() > 0.3) return;
  window.dispatchEvent(new CustomEvent(ZOTE_EVENT, { detail: { topic } }));
}

const PRECEPTS: Record<string, string[]> = {
  score: [
    "Rule 32: 'Numbers Tell Stories.' Yours asked for a shorter ending.",
    "Rule 6: 'Choose Your Variables.' You chose chaos.",
    "Rule 41: 'Trust the Data.' The scoreboard is being quite honest.",
  ],
  speed: [
    "Rule 15: 'Measure Twice.' We did. That was slow.",
    "Rule 20: 'Spend Compute Wisely.' Considerably more cycles than needed.",
  ],
  general: [
    "Rule 1: 'Always Label Your Axes.' This result needs no label.",
    "Rule 3: 'Every Failure Is Data.' You are gathering an impressive sample.",
    "Rule 9: 'Keep Your Workspace Tidy.' Look at the state of this board.",
    "Rule 17: 'Trust Your Method.' We shall workshop the method.",
    "Rule 57: 'Read the Manual.' The game, alas, has other ideas.",
  ],
};

export default function ZoteHeckler() {
  const [line, setLine] = useState<string | null>(null);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    function onSummon(e: Event) {
      const topic = (e as CustomEvent<{ topic: string }>).detail?.topic ?? "general";
      const pool = [...(PRECEPTS[topic] ?? []), ...PRECEPTS.general];
      setLine(pool[Math.floor(Math.random() * pool.length)]);
      clearTimeout(timer);
      timer = setTimeout(() => setLine(null), 9000);
    }
    window.addEventListener(ZOTE_EVENT, onSummon);
    return () => {
      window.removeEventListener(ZOTE_EVENT, onSummon);
      clearTimeout(timer);
    };
  }, []);

  if (!line) return null;

  return (
    <div className="zote-wrap">
      <Image src="/artifacts/lab-gremlin.png" alt="" width={66} height={66} aria-hidden className="zote-head" />
      <div className="zote-bubble" role="status">
        <strong>Lab Gremlin:</strong> {line}
        <button
          type="button"
          className="zote-dismiss"
          onClick={() => setLine(null)}
          aria-label="Dismiss Lab Gremlin"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
