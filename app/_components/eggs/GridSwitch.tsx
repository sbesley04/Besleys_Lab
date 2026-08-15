"use client";

import type { ReactNode } from "react";
import { useOnGrid } from "@/lib/grid";

// Block-level counterpart to <GridText>: renders an entirely different subtree
// on the Grid. Used by app/page.tsx to swap the paper "desk" home for the
// HUD landing (GridHome). Server Components can pass both trees as props.
export default function GridSwitch({ paper, grid }: { paper: ReactNode; grid: ReactNode }) {
  return <>{useOnGrid() ? grid : paper}</>;
}
