"use client";

import { useId, useRef, useState } from "react";
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
  const interactive = Boolean(onAdd || onMove || onRemove);
  const [keyboardActive, setKeyboardActive] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);
  const [cursor, setCursor] = useState(() => ({
    x: (scale.domain[0] + scale.domain[1]) / 2,
    y: (scale.range[0] + scale.range[1]) / 2,
  }));
  // The SVG itself keeps overflow visible so axis labels aren't cut off, but
  // demo overlays (fit lines, margins, decision regions) run to the edge of
  // the data range and would otherwise spill across the page — so they get
  // clipped to the plot rectangle.
  const clipId = `plot-clip-${useId()}`;
  const instructionsId = `plot-instructions-${useId()}`;

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
    svgRef.current.focus();
    const p = pointerToData(e, svgRef.current, scale);
    setCursor(p);
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

  function onKeyDown(e: React.KeyboardEvent<SVGSVGElement>) {
    if (!interactive) return;
    const xStep = (scale.domain[1] - scale.domain[0]) / (e.shiftKey ? 10 : 40);
    const yStep = (scale.range[1] - scale.range[0]) / (e.shiftKey ? 10 : 40);
    const deltas: Partial<Record<string, [number, number]>> = {
      ArrowLeft: [-xStep, 0],
      ArrowRight: [xStep, 0],
      ArrowDown: [0, -yStep],
      ArrowUp: [0, yStep],
    };
    const delta = deltas[e.key];

    if (delta) {
      e.preventDefault();
      const activePoint = selected !== null ? points[selected] : undefined;
      const origin = activePoint ?? cursor;
      const next = {
        x: Math.max(scale.domain[0], Math.min(scale.domain[1], origin.x + delta[0])),
        y: Math.max(scale.range[0], Math.min(scale.range[1], origin.y + delta[1])),
      };
      setCursor(next);
      if (activePoint && onMove && selected !== null) onMove(selected, next);
      return;
    }

    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      if (selected !== null) {
        setSelected(null);
        return;
      }
      const idx = hit(cursor.x, cursor.y);
      if (idx >= 0 && onMove) setSelected(idx);
      else if (onAdd) onAdd(cursor);
      return;
    }

    if (e.key === "Delete" || e.key === "Backspace") {
      const idx = selected ?? hit(cursor.x, cursor.y);
      if (idx >= 0 && onRemove) {
        e.preventDefault();
        onRemove(idx);
        setSelected(null);
      }
      return;
    }

    if (e.key === "Escape" && selected !== null) {
      e.preventDefault();
      setSelected(null);
    }
  }

  return (
    <svg
      ref={svgRef}
      className={`${styles.plotSvg} ${onAdd ? styles.clickable : ""} ${interactive ? styles.interactivePlot : ""}`}
      viewBox={`0 0 ${scale.width} ${scale.height}`}
      role={interactive ? "application" : "img"}
      aria-label={ariaLabel}
      aria-describedby={interactive ? instructionsId : undefined}
      aria-keyshortcuts={interactive ? "ArrowUp ArrowDown ArrowLeft ArrowRight Enter Space Delete Escape" : undefined}
      tabIndex={interactive ? 0 : undefined}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onContextMenu={(e) => e.preventDefault()}
      onKeyDown={onKeyDown}
      onFocus={() => setKeyboardActive(true)}
      onBlur={() => {
        setKeyboardActive(false);
        setSelected(null);
      }}
    >
      {interactive && (
        <desc id={instructionsId}>
          Use the arrow keys to move the crosshair. Press Enter or Space to add a point or select
          the nearest point. Arrow keys move a selected point. Delete removes it; Escape releases it.
          Hold Shift with an arrow key for a larger move.
        </desc>
      )}
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
      {keyboardActive && interactive && (
        <g aria-hidden pointerEvents="none">
          <line
            x1={scale.x(cursor.x) - 8}
            x2={scale.x(cursor.x) + 8}
            y1={scale.y(cursor.y)}
            y2={scale.y(cursor.y)}
            stroke="var(--accent)"
            strokeWidth={1.6}
          />
          <line
            x1={scale.x(cursor.x)}
            x2={scale.x(cursor.x)}
            y1={scale.y(cursor.y) - 8}
            y2={scale.y(cursor.y) + 8}
            stroke="var(--accent)"
            strokeWidth={1.6}
          />
          <circle
            cx={scale.x(cursor.x)}
            cy={scale.y(cursor.y)}
            r={selected !== null ? 11 : 6}
            fill="none"
            stroke="var(--accent)"
            strokeWidth={selected !== null ? 2.2 : 1.2}
          />
        </g>
      )}
      {children}
    </svg>
  );
}
