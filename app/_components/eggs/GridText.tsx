"use client";

import type { ReactNode } from "react";
import { useOnGrid } from "@/lib/grid";

// Swaps a piece of copy when the site is on the Grid. Renders `paper` normally
// and `grid` under data-egg="tron". Usable inside Server Components (it's a
// client boundary), so pages can pass plain strings for each variant.
export default function GridText({ paper, grid }: { paper: ReactNode; grid: ReactNode }) {
  return <>{useOnGrid() ? grid : paper}</>;
}
