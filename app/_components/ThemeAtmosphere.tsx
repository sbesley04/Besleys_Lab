"use client";

import { useEffect, useState } from "react";

const NOTES: Record<string, string> = {
  copper: "Workshop notes, after hours.",
  forest: "Field notes from the greenhouse.",
  plum: "Observatory log, clear skies.",
};

// A small optional line lets the three illustrated themes feel like places,
// not merely alternate color palettes. It listens for the terminal's custom
// event as well as restoring the saved setting on first load.
export default function ThemeAtmosphere() {
  const [theme, setTheme] = useState<string | null>(null);

  useEffect(() => {
    const update = () => {
      try {
        setTheme(localStorage.getItem("bl:theme"));
      } catch {
        setTheme(document.documentElement.dataset.theme ?? null);
      }
    };
    update();
    window.addEventListener("bl:theme-change", update);
    return () => window.removeEventListener("bl:theme-change", update);
  }, []);

  const note = theme ? NOTES[theme] : undefined;
  return note ? <span className="theme-atmosphere">{note}</span> : null;
}
