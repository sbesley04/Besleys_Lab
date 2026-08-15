"use client";

import { useEffect } from "react";
import { setGrid } from "@/lib/grid";

// Site-wide easter-egg listeners, mounted once in the root layout.
//
// 1. Watches for the Konami code — ↑↑↓↓←→←→BA — and launches the "hyperspace
//    jump" into the Grid (data-egg="tron"). Entering it again jumps back out.
//    The cinematic itself lives in HyperspaceJump; this file only decides the
//    direction and dispatches "bl:hyperspace". Persists for the session.
// 2. prefers-reduced-motion → skip the animation, snap the attribute instantly.
// 3. Esc while on the Grid bails straight back to paper (aborts any running
//    jump), an escape hatch for anyone who finds it too much.
// 4. Types `sudo` as a global terminal shortcut; the terminal itself is
//    mounted in the shared layout, so this works on every page.
//
// The initial data-egg / data-theme restore happens in a beforeInteractive
// script in layout.tsx (no flash of the wrong theme), so it's not repeated here.

const KONAMI = [
  "ArrowUp", "ArrowUp", "ArrowDown", "ArrowDown",
  "ArrowLeft", "ArrowRight", "ArrowLeft", "ArrowRight",
  "b", "a",
];

function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

export default function EggEffects() {
  useEffect(() => {
    let progress = 0;
    let sudoBuffer = "";

    function isTyping(target: HTMLElement | null): boolean {
      return (
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        !!target?.isContentEditable
      );
    }

    function onGrid(): boolean {
      return document.documentElement.dataset.egg === "tron";
    }
    function isJumping(): boolean {
      return document.documentElement.classList.contains("bl-jumping");
    }

    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;

      // Esc bails out of the Grid instantly (no reverse animation). Fires when
      // fully on the Grid OR mid-jump — during a forward jump the attribute
      // isn't set until the flash, so onGrid() alone would miss an early bail.
      if (e.key === "Escape" && !isTyping(target) && (onGrid() || isJumping())) {
        window.dispatchEvent(new Event("bl:hyperspace-abort"));
        setGrid(false);
        return;
      }

      // Never listen for the code while someone is typing — arrow-keys-then-"ba"
      // is a plausible thing to type into a comment box, and repainting the
      // whole site mid-sentence is not a fun surprise.
      if (isTyping(target)) {
        progress = 0;
        return;
      }

      const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      if (e.key.length === 1) {
        sudoBuffer = (sudoBuffer + key).slice(-4);
        if (sudoBuffer === "sudo") {
          sudoBuffer = "";
          window.dispatchEvent(new Event("bl:open-terminal"));
        }
      }

      progress = key === KONAMI[progress] ? progress + 1 : key === KONAMI[0] ? 1 : 0;
      if (progress === KONAMI.length) {
        progress = 0;
        if (isJumping()) return; // ignore re-triggers mid-jump
        const goingIn = !onGrid();
        if (prefersReducedMotion()) {
          setGrid(goingIn); // snap, no cinematic
        } else {
          window.dispatchEvent(
            new CustomEvent("bl:hyperspace", { detail: { dir: goingIn ? "in" : "out" } }),
          );
        }
      }
    }

    // html.bl-idle pauses every ambient Grid animation while the tab is hidden.
    // grid-motion.css and grid-hud.css both ship `animation-play-state: paused`
    // rules keyed on this class — each written assuming the other pass had added
    // the listener, so until now ~11 selectors were dead and the haze, floor
    // drift, scan sweep, CRT flicker and reticle rings all kept animating in
    // background tabs. This is the missing half.
    function onVisibility() {
      document.documentElement.classList.toggle("bl-idle", document.hidden);
    }
    document.addEventListener("visibilitychange", onVisibility);
    onVisibility();

    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("visibilitychange", onVisibility);
      document.documentElement.classList.remove("bl-idle");
    };
  }, []);

  return null;
}
