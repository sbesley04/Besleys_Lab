"use client";

import { useEffect } from "react";

// Site-wide easter-egg listeners, mounted once in the root layout.
//
// 1. Restores the saved color theme (set from the arcade's secret terminal)
//    onto <html data-theme="...">.
// 2. Watches for the Konami code — ↑↑↓↓←→←→BA — and flips the site into
//    "burned lab" mode (green ink, scorched paper, CRT scanlines). Entering
//    it again flips back. Persists for the session only.

const KONAMI = [
  "ArrowUp", "ArrowUp", "ArrowDown", "ArrowDown",
  "ArrowLeft", "ArrowRight", "ArrowLeft", "ArrowRight",
  "b", "a",
];

export default function EggEffects() {
  useEffect(() => {
    try {
      const theme = localStorage.getItem("bl:theme");
      if (theme) document.documentElement.dataset.theme = theme;
      if (sessionStorage.getItem("bl:konami") === "1") {
        document.documentElement.dataset.egg = "konami";
      }
    } catch { /* storage blocked — cosmetic only */ }

    let progress = 0;
    function onKey(e: KeyboardEvent) {
      // Never listen while someone is typing — arrow-keys-then-"ba" is a
      // plausible thing to type into a comment box, and repainting the whole
      // site green mid-sentence is not a fun surprise.
      const target = e.target as HTMLElement | null;
      if (
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.isContentEditable
      ) {
        progress = 0;
        return;
      }
      const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      progress = key === KONAMI[progress] ? progress + 1 : key === KONAMI[0] ? 1 : 0;
      if (progress === KONAMI.length) {
        progress = 0;
        const html = document.documentElement;
        const on = html.dataset.egg !== "konami";
        if (on) html.dataset.egg = "konami";
        else delete html.dataset.egg;
        try {
          sessionStorage.setItem("bl:konami", on ? "1" : "0");
        } catch { /* ignore */ }
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return null;
}
