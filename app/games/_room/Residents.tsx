"use client";

import { useEffect, useRef, useState } from "react";
import styles from "../arcade.module.css";
import room from "./room.module.css";
import { unlock } from "@/lib/arcade";
import { baa } from "@/lib/sound";

// The game room's residents, moved in from the old card-grid hub: the Junimo
// that naps on the furniture and the sheep that grazes on the floor. Both are
// easter eggs (see CLAUDE.md) — keep them.

// A small original moss sprite, very much asleep on the job.
export function Junimo() {
  return (
    <svg viewBox="0 0 38 36" width="38" height="36" aria-hidden>
      <path d="M18 9 C16 4 19 1 23 1" fill="none" stroke="#49683f" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M23 2 C29 1 30 6 25 8" fill="#88a953" stroke="#49683f" strokeWidth="1.1" />
      <path d="M5 27 C3 17 8 9 18 8 C29 8 35 17 33 27 C31 33 8 34 5 27Z" fill="#789a4d" stroke="#3e5d39" strokeWidth="1.6" />
      <path d="M8 20 C11 14 15 12 18 12 C24 12 28 15 30 20" fill="none" stroke="#b5cb76" strokeWidth="1" opacity=".85" />
      <ellipse cx="13.5" cy="21" rx="2.1" ry="1.35" fill="#253526" />
      <ellipse cx="23.5" cy="21" rx="2.1" ry="1.35" fill="#253526" />
      <path d="M15 26 Q18.5 28 22 26" fill="none" stroke="#253526" strokeWidth="1.25" strokeLinecap="round" />
      <circle cx="8" cy="27" r="1.2" fill="#d8ba62" opacity=".8" />
    </svg>
  );
}

// --- the sheep ---------------------------------------------------------------

const SHEAR_CLICKS = 5;

export function Sheep({ golden = false }: { golden?: boolean }) {
  const [clicks, setClicks] = useState(0);
  const [shorn, setShorn] = useState(false);
  const [popping, setPopping] = useState(false);
  const [jeb, setJeb] = useState(false);
  const [shaking, setShaking] = useState(false);
  const shakeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const woolTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    try {
      // Wool grows back overnight.
      setShorn(localStorage.getItem("bl:sheep-shorn") === new Date().toDateString());
      setJeb(localStorage.getItem("bl:jeb") === "1");
    } catch { /* ignore */ }

    return () => {
      if (shakeTimer.current) clearTimeout(shakeTimer.current);
      if (woolTimer.current) clearTimeout(woolTimer.current);
    };
  }, []);

  function poke() {
    if (shorn) {
      baa();
      return;
    }
    setShaking(true);
    if (shakeTimer.current) clearTimeout(shakeTimer.current);
    shakeTimer.current = setTimeout(() => setShaking(false), 320);
    const n = clicks + 1;
    setClicks(n);
    if (n >= SHEAR_CLICKS) {
      baa();
      setPopping(true);
      woolTimer.current = setTimeout(() => {
        setShorn(true);
        setPopping(false);
      }, 650);
      unlock("egg-shear");
      try {
        localStorage.setItem("bl:sheep-shorn", new Date().toDateString());
      } catch { /* ignore */ }
    }
  }

  return (
    <button
        type="button"
        className={`${styles.sheep} ${shaking ? styles.sheepShake : ""}`}
        onClick={poke}
        aria-label={shorn ? "A shorn sheep; its wool grows back tomorrow" : golden ? "A sheep with a golden fleece" : "A sheep, inexplicably"}
        title="baa"
      >
        <svg viewBox="0 0 68 46" width="86" height="58" aria-hidden>
          {/* legs and small hooves */}
          <path d="M19 33v8m17-8v8" stroke="#594a3e" strokeWidth="4" strokeLinecap="round" />
          <path d="M16.5 41h5m11.5 0h5" stroke="#332b25" strokeWidth="2" strokeLinecap="round" />
          {/* wool, laid up as a loose field sketch rather than square blocks */}
          {!shorn && (
            <g className={`${popping ? styles.woolPop : ""}`}>
              <path d="M8 29 C4 25 7 18 12 18 C8 12 14 7 19 10 C21 4 29 5 31 10 C37 5 44 10 43 16 C50 17 52 26 46 30 C42 35 15 35 8 29Z" fill="#f4f0e5" stroke="#b8af9b" strokeWidth="1.3" className={jeb ? styles.jebWool : golden ? room.goldenWool : ""} />
              <path d="M14 18c4-4 8 2 12-2s8 2 13-1M13 25c4-3 9 2 13-1s8 3 15-1" fill="none" stroke="#d3cab6" strokeWidth="1" opacity=".9" />
            </g>
          )}
          {/* shorn body */}
          {shorn && <path d="M10 29C8 20 15 14 29 15c12 0 17 6 15 14-7 5-27 5-34 0Z" fill="#e5bda9" stroke="#bb8d7b" strokeWidth="1.2" />}
          {/* head */}
          <path d="M43 14c4-6 13-2 14 4v8c-2 5-10 6-14 1Z" fill="#dfd1b8" stroke="#ad9d86" strokeWidth="1.2" />
          <path d="M47 14l-1-5m6 5 3-4" stroke="#8b7865" strokeWidth="2" strokeLinecap="round" />
          <ellipse cx="49" cy="20" rx="1.3" ry="1.7" fill="#2b2b2b" />
          <ellipse cx="54" cy="20" rx="1.3" ry="1.7" fill="#2b2b2b" />
          <ellipse cx="52" cy="25" rx="3.2" ry="1.5" fill="#c88888" />
        </svg>
    </button>
  );
}

