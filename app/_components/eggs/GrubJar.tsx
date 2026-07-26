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
        <svg viewBox="0 0 40 48" width="46" height="55" style={bouncing ? { animation: "grub-bounce 0.9s ease" } : undefined}>
          {!freed ? (
            <>
              {/* corked jar */}
              <rect x="13" y="2" width="14" height="5" rx="1.5" fill="#a98d68" stroke="#7a6a52" />
              <path d="M10 8 Q10 6 12 6 L28 6 Q30 6 30 8 L31 40 Q31 45 26 45 L14 45 Q9 45 9 40 Z" fill="rgba(190,215,230,0.35)" stroke="#7a89a0" strokeWidth="1.4" />
              {/* grub inside */}
              <ellipse cx="20" cy="34" rx="6" ry="7.5" fill="#cfe4ef" stroke="#5a7d95" strokeWidth="1.2" />
              <circle cx="17.6" cy="32" r="1.2" fill="#22333f" />
              <circle cx="22.4" cy="32" r="1.2" fill="#22333f" />
              <path d="M17.5 36.5 Q20 38.3 22.5 36.5" fill="none" stroke="#22333f" strokeWidth="1" strokeLinecap="round" />
            </>
          ) : (
            <>
              {/* empty open jar, grub beside it, delighted */}
              <path d="M10 12 Q10 10 12 10 L28 10 Q30 10 30 12 L31 40 Q31 45 26 45 L14 45 Q9 45 9 40 Z" fill="rgba(190,215,230,0.25)" stroke="#7a89a0" strokeWidth="1.4" />
              <ellipse cx="34" cy="38" rx="5" ry="6.5" fill="#cfe4ef" stroke="#5a7d95" strokeWidth="1.2" />
              <path d="M31.8 35.5 Q32.6 34.3 33.4 35.5" fill="none" stroke="#22333f" strokeWidth="1.1" strokeLinecap="round" />
              <path d="M34.6 35.5 Q35.4 34.3 36.2 35.5" fill="none" stroke="#22333f" strokeWidth="1.1" strokeLinecap="round" />
              <ellipse cx="34" cy="40.5" rx="1.5" ry="1.9" fill="#22333f" />
              <text x="33" y="28" fontSize="7" fill="#5a7d95">♪</text>
            </>
          )}
        </svg>
        <style>{`@keyframes grub-bounce { 0%,100% { transform: translateY(0);} 30% { transform: translateY(-8px);} 55% { transform: translateY(0);} 75% { transform: translateY(-4px);} }`}</style>
      </button>
    </div>
  );
}
