"use client";

import { useEffect } from "react";
import { recordDemoVisit } from "@/lib/arcade";

// Records that a demo was opened, for the Lab Notebook achievement. One line
// per demo component instead of repeating the effect nine times.
export function useDemoVisit(slug: string) {
  useEffect(() => recordDemoVisit(slug), [slug]);
}
