"use client";

import { useId, useRef } from "react";
import styles from "../lab.module.css";
import { Axes } from "./Axes";
import { pointerToData, type Scale } from "./plot";

// The click-to-place-data surface shared by k-means, SVM, and the regression
// demos. The parent owns the points; this component handles hit-testing,
// clicking, and dragging, then renders whatever overlay the demo supplies
// underneath the dots (boundaries, centroids, fit lines).

export interface LabPoint {
  x: number;
  y: number;
  /** Class/cluster index — drives the dot color. */
  label?: number;
}

export default function PointCanvas({
  points,
  scale,
  colors,
  onAdd,
  onMove,
  onRemove,
  children,
  underlay,
  xLabel,
  yLabel,
  radius = 5,
  ariaLabel,
  format,
}: {
  points: LabPoint[];
  scale: Scale;
  /** Color per label index; unlabelled points use colors[0]. */
  colors: readonly string[];
  onAdd?: (p: { x: number; y: number }) => void;
  onMove?: (index: number, p: { x: number; y: number }) => void;
  onRemove?: (index: number) => void;
  /** Drawn above the points (annotations). */
  children?: React.ReactNode;
  /** Drawn below the points (decision regions, fit lines). */
  underlay?: React.ReactNode;
  xLabel?: string;
  yLabel?: string;
  radius?: number;
  ariaLabel: string;
  format?: (v: number) => string;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const dragging = useRef<number | null>(null);
  // The SVG itself keeps overflow visible so axis labels aren't cut off, but
  // demo overlays (fit lines, margins, decision regions) run to the edge of
  // the data range and would otherwise spill across the page — so they get
  // clipped to the plot rectangle.
  const clipId = `plot-clip-${useId()}`;

  function hit(dataX: number, dataY: number): number {
    // Hit radius in data units, derived from the pixel radius.
    const rx = Math.abs(scale.invX(radius + 4) - scale.invX(0));
    const ry = Math.abs(scale.invY(radius + 4) - scale.invY(0));
    for (let i = points.length - 1; i >= 0; i--) {
      const dx = (points[i].x - dataX) / rx;
      const dy = (points[i].y - dataY) / ry;
      if (dx * dx + dy * dy <= 1) return i;
    }
    return -1;
  }

  function onPointerDown(e: React.PointerEvent<SVGSVGElement>) {
    if (!svgRef.current) return;
    const p = pointerToData(e, svgRef.current, scale);
    const idx = hit(p.x, p.y);

    // Alt/right-click removes; plain click on empty space adds.
    if (idx >= 0 && (e.altKey || e.button === 2)) {
      onRemove?.(idx);
      return;
    }
    if (idx >= 0 && onMove) {
      dragging.current = idx;
      svgRef.current.setPointerCapture(e.pointerId);
      return;
    }
    if (idx < 0 && onAdd && e.button === 0) {
      const inX = p.x >= scale.domain[0] && p.x <= scale.domain[1];
      const inY = p.y >= scale.range[0] && p.y <= scale.range[1];
      if (inX && inY) onAdd(p);
    }
  }

  function onPointerMove(e: React.PointerEvent<SVGSVGElement>) {
    if (dragging.current === null || !svgRef.current || !onMove) return;
    const p = pointerToData(e, svgRef.current, scale);
    onMove(dragging.current, {
      x: Math.max(scale.domain[0], Math.min(scale.domain[1], p.x)),
      y: Math.max(scale.range[0], Math.min(scale.range[1], p.y)),
    });
  }

  function endDrag(e: React.PointerEvent<SVGSVGElement>) {
    if (dragging.current !== null && svgRef.current?.hasPointerCapture(e.pointerId)) {
      svgRef.current.releasePointerCapture(e.pointerId);
    }
    dragging.current = null;
  }

  return (
    <svg
      ref={svgRef}
      className={`${styles.plotSvg} ${onAdd ? styles.clickable : ""}`}
      viewBox={`0 0 ${scale.width} ${scale.height}`}
      role="img"
      aria-label={ariaLabel}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onContextMenu={(e) => e.preventDefault()}
    >
      <defs>
        <clipPath id={clipId}>
          <rect
            x={scale.pad}
            y={scale.pad}
            width={scale.width - scale.pad * 2}
            height={scale.height - scale.pad * 2}
          />
        </clipPath>
      </defs>
      <Axes scale={scale} xLabel={xLabel} yLabel={yLabel} format={format} />
      <g clipPath={`url(#${clipId})`}>{underlay}</g>
      {points.map((p, i) => (
        <circle
          key={i}
          cx={scale.x(p.x)}
          cy={scale.y(p.y)}
          r={radius}
          fill={colors[(p.label ?? 0) % colors.length]}
          stroke="var(--paper)"
          strokeWidth={1.2}
        />
      ))}
      {children}
    </svg>
  );
}
