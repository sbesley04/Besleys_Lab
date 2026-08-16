"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { useOnGrid } from "@/lib/grid";

// Block-level counterpart to <GridText>: renders an entirely different subtree
// on the Grid. Used by app/page.tsx to swap the paper "desk" home for the
// HUD landing (GridHome). Server Components can pass both trees as props.
export default function GridSwitch({ paper, grid }: { paper: ReactNode; grid: ReactNode }) {
  const onGrid = useOnGrid();
  const previousMode = useRef(onGrid);

  useEffect(() => {
    if (previousMode.current !== onGrid) {
      // These are different documents, not alternate skins of the same rows.
      // Keeping the paper page's deep scroll offset could land a visitor at
      // program 11 of 14 with the Grid hero entirely above the viewport.
      window.scrollTo(0, 0);
      previousMode.current = onGrid;
    }
  }, [onGrid]);

  return <>{onGrid ? grid : paper}</>;
}
