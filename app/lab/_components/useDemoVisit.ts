"use client";

import { useEffect, useReducer } from "react";
import { recordDemoVisit } from "@/lib/arcade";

// Records that a demo was opened, for the Lab Notebook achievement. One line
// per demo component instead of repeating the effect nine times.
export function useDemoVisit(slug: string) {
  const [themeVersion, refreshTheme] = useReducer((version: number) => version + 1, 0);

  useEffect(() => {
    recordDemoVisit(slug);
    // The plotting palette is updated by the same custom event. Trigger one
    // render afterwards so colors captured in SVG props and canvases follow
    // the site's hidden themes without keeping duplicate listeners per plot.
    const onThemeChange = () => refreshTheme();
    window.addEventListener("bl:egg-change", onThemeChange);
    return () => window.removeEventListener("bl:egg-change", onThemeChange);
  }, [slug]);

  return themeVersion;
}
