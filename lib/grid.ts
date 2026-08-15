"use client";

// Shared state for "the Grid" (the Konami/Tron egg). The active flag lives on
// <html data-egg="tron">; this module is the one place that flips it, persists
// it for the session, and announces the change so React components can react
// (the HUD, the GridText copy swaps). EggEffects and HyperspaceJump both call
// setGrid; SiteHeader / GridText subscribe via useOnGrid.

import { useEffect, useState } from "react";
import { unlock } from "@/lib/arcade";

export const GRID_EGG = "tron";
export const GRID_EVENT = "bl:egg-change";

export function isOnGrid(): boolean {
  if (typeof document === "undefined") return false;
  return document.documentElement.dataset.egg === GRID_EGG;
}

/** Toggle the Grid on/off: sets the attribute, persists for the session, and
 *  fires GRID_EVENT so subscribers update. */
export function setGrid(on: boolean): void {
  const el = document.documentElement;
  if (on) el.dataset.egg = GRID_EGG;
  else delete el.dataset.egg;
  try {
    if (on) sessionStorage.setItem("bl:egg", GRID_EGG);
    else sessionStorage.removeItem("bl:egg");
  } catch {
    /* storage blocked — cosmetic only */
  }
  if (on) unlock("egg-grid"); // idempotent — toasts "End of Line" on first jump in
  window.dispatchEvent(new Event(GRID_EVENT));
}

/** Reactive "are we on the Grid?" for client components. Starts false (matches
 *  SSR) and syncs on mount, so a restored Grid may flash one paper frame — fine
 *  for an easter egg. */
export function useOnGrid(): boolean {
  const [on, setOn] = useState(false);
  useEffect(() => {
    const update = () => setOn(isOnGrid());
    update();
    window.addEventListener(GRID_EVENT, update);
    return () => window.removeEventListener(GRID_EVENT, update);
  }, []);
  return on;
}
