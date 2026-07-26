"use client";

import { useEffect, useState } from "react";

// Zote the Mighty, loss heckler. Games report an embarrassing defeat via
// summonZote(); with modest probability the Knight of Great Renown appears
// and recites a Precept loosely aimed at your failure. Mounted once in the
// root layout. A cameo, not a system — pure garnish.

export const ZOTE_EVENT = "bl:zote";

/** Call on a *bad* loss. ~30% chance Zote deigns to appear. */
export function summonZote(topic: "score" | "speed" | "general" = "general") {
  if (Math.random() > 0.3) return;
  window.dispatchEvent(new CustomEvent(ZOTE_EVENT, { detail: { topic } }));
}

const PRECEPTS: Record<string, string[]> = {
  score: [
    "Precept Thirty-Two: 'Names Have Power.' Your score, however, has none.",
    "Precept Six: 'Choose Your Own Fate.' You appear to have chosen this one.",
    "Precept Forty-One: 'Learn To Detect Lies.' Your scoreboard is being quite honest with you.",
  ],
  speed: [
    "Precept Fifteen: 'One Foe, One Blow.' You used considerably more blows than foes.",
    "Precept Twenty: 'Speak Only The Truth.' Truthfully — that was slow.",
  ],
  general: [
    "Precept One: 'Always Win Your Battles.' I notice you have not.",
    "Precept Three: 'Never Be Defeated.' We shall workshop this one together.",
    "Precept Nine: 'Keep Your Home Tidy.' Look at the state of this board.",
    "Precept Seventeen: 'Believe In Your Strength.' Someone has to.",
    "Precept Fifty-Seven: 'Obey No Law But Your Own.' The rules of this game, alas, disagree.",
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
    <div className="zote-wrap" role="status" onClick={() => setLine(null)}>
      {/* Grey mask, stubby horns, permanent scowl — rendered in ink. */}
      <svg viewBox="0 0 64 64" width="52" height="52" aria-hidden className="zote-head">
        <path d="M20 8 L14 22 L18 24 Z" fill="#8a8578" stroke="#1A1A1A" strokeWidth="2" />
        <path d="M44 8 L50 22 L46 24 Z" fill="#8a8578" stroke="#1A1A1A" strokeWidth="2" />
        <ellipse cx="32" cy="38" rx="19" ry="22" fill="#d9d4c7" stroke="#1A1A1A" strokeWidth="2.5" />
        <ellipse cx="25" cy="36" rx="3.4" ry="6" fill="#1A1A1A" />
        <ellipse cx="39" cy="36" rx="3.4" ry="6" fill="#1A1A1A" />
        <path d="M24 50 Q32 46 40 50" fill="none" stroke="#1A1A1A" strokeWidth="2" strokeLinecap="round" />
      </svg>
      <div className="zote-bubble">
        <strong>Zote the Mighty:</strong> {line}
      </div>
    </div>
  );
}
