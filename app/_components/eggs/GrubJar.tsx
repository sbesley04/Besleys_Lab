"use client";

import { useEffect, useState } from "react";
import { unlock } from "@/lib/arcade";
import { chirp } from "@/lib/sound";

// A grub in a jar, tucked at the bottom of the blog. One click sets it free —
// a happy chirp, the Grubsong achievement, and the jar stays empty for good.
// (No grub was harmed. It lives behind the page margin now.)

export default function GrubJar() {
  const [freed, setFreed] = useState(false);
  const [bouncing, setBouncing] = useState(false);

  useEffect(() => {
    try {
      setFreed(localStorage.getItem("bl:grub-freed") === "1");
    } catch { /* ignore */ }
  }, []);

  function free() {
    if (freed) {
      chirp(); // it still sings for you
      return;
    }
    chirp();
    setBouncing(true);
    setTimeout(() => setBouncing(false), 900);
    setFreed(true);
    unlock("egg-grubsong");
    try {
      localStorage.setItem("bl:grub-freed", "1");
    } catch { /* ignore */ }
  }

  return (
    <div style={{ display: "flex", justifyContent: "center", marginTop: "3.5rem", opacity: 0.9 }}>
      <button
        type="button"
        onClick={free}
        aria-label={freed ? "A freed grub" : "A jar with something inside"}
        title={freed ? "♪" : "…is something in there?"}
        style={{ background: "none", border: "none", padding: 0, cursor: "pointer" }}
      >
        <svg viewBox="0 0 52 60" width="56" height="64" style={bouncing ? { animation: "grub-bounce 0.9s ease" } : undefined}>
          {!freed ? (
            <>
              {/* hand-blown jar */}
              <rect x="17" y="3" width="18" height="7" rx="2" fill="#a98d68" stroke="#735d44" strokeWidth="1.2" />
              <path d="M15 11Q15 8 18 8h16q3 0 3 3l2 34q0 9-8 10H21q-8-1-8-10Z" fill="rgba(185,218,232,.3)" stroke="#698ca2" strokeWidth="1.5" />
              <path d="M18 16q8 3 16 0M18 45q8 3 17 0" fill="none" stroke="#b6d4df" strokeWidth="1" opacity=".9" />
              {/* little curled lantern-grub */}
              <path d="M28 43c-8 2-11-8-5-12 5-3 10 3 6 7-2 2-5 0-4-2" fill="none" stroke="#7daec2" strokeWidth="7" strokeLinecap="round" />
              <path d="M28 43c-8 2-11-8-5-12 5-3 10 3 6 7-2 2-5 0-4-2" fill="none" stroke="#d9f2f1" strokeWidth="4.5" strokeLinecap="round" />
              <circle cx="25.5" cy="31.5" r=".9" fill="#263c4a" />
              <circle cx="29" cy="32" r=".9" fill="#263c4a" />
              <circle cx="11" cy="29" r="1" fill="#d5edf2" opacity=".85" />
              <circle cx="40" cy="36" r="1.2" fill="#d5edf2" opacity=".7" />
            </>
          ) : (
            <>
              {/* empty open jar, grub hovering beside it */}
              <path d="M15 15q0-3 3-3h16q3 0 3 3l2 30q0 9-8 10H21q-8-1-8-10Z" fill="rgba(185,218,232,.22)" stroke="#698ca2" strokeWidth="1.5" />
              <path d="M18 19q8 3 16 0" fill="none" stroke="#b6d4df" strokeWidth="1" />
              <path d="M42 38c-5 2-8-5-4-8 4-2 7 3 4 5" fill="none" stroke="#d9f2f1" strokeWidth="5" strokeLinecap="round" />
              <circle cx="38.5" cy="30.8" r=".8" fill="#263c4a" />
              <circle cx="41" cy="31.2" r=".8" fill="#263c4a" />
              <path d="M42 22c2-2 4-2 5 0" fill="none" stroke="#7daec2" strokeWidth="1.2" strokeLinecap="round" />
            </>
          )}
        </svg>
        <style>{`@keyframes grub-bounce { 0%,100% { transform: translateY(0);} 30% { transform: translateY(-8px);} 55% { transform: translateY(0);} 75% { transform: translateY(-4px);} }`}</style>
      </button>
    </div>
  );
}
