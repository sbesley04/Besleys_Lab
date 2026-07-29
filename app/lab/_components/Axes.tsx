"use client";

import { makeScale, ticks, type Scale } from "./plot";

// Graph-paper axes for an SVG plot: a faint grid, labelled ticks, and optional
// axis titles. Colors come from CSS variables so the secret themes carry
// through untouched.

export function Axes({
  scale,
  xLabel,
  yLabel,
  xTickCount = 5,
  yTickCount = 5,
  grid = true,
  format = (v: number) => String(Math.round(v * 100) / 100),
}: {
  scale: Scale;
  xLabel?: string;
  yLabel?: string;
  xTickCount?: number;
  yTickCount?: number;
  grid?: boolean;
  format?: (v: number) => string;
}) {
  const xs = ticks(scale.domain[0], scale.domain[1], xTickCount);
  const ys = ticks(scale.range[0], scale.range[1], yTickCount);
  const { pad, width, height } = scale;

  return (
    <g aria-hidden>
      {grid &&
        xs.map((t) => (
          <line
            key={`gx-${t}`}
            x1={scale.x(t)}
            x2={scale.x(t)}
            y1={pad}
            y2={height - pad}
            stroke="var(--line)"
            strokeWidth={1}
          />
        ))}
      {grid &&
        ys.map((t) => (
          <line
            key={`gy-${t}`}
            x1={pad}
            x2={width - pad}
            y1={scale.y(t)}
            y2={scale.y(t)}
            stroke="var(--line)"
            strokeWidth={1}
          />
        ))}

      {/* Frame */}
      <rect
        x={pad}
        y={pad}
        width={width - pad * 2}
        height={height - pad * 2}
        fill="none"
        stroke="var(--ink-soft)"
        strokeWidth={1.2}
        opacity={0.5}
      />

      {xs.map((t) => (
        <text
          key={`tx-${t}`}
          x={scale.x(t)}
          y={height - pad + 14}
          textAnchor="middle"
          fontSize={10}
          fill="var(--ink-soft)"
        >
          {format(t)}
        </text>
      ))}
      {ys.map((t) => (
        <text
          key={`ty-${t}`}
          x={pad - 6}
          y={scale.y(t) + 3.5}
          textAnchor="end"
          fontSize={10}
          fill="var(--ink-soft)"
        >
          {format(t)}
        </text>
      ))}

      {xLabel && (
        <text
          x={width / 2}
          y={height - 2}
          textAnchor="middle"
          fontSize={11}
          fill="var(--ink-soft)"
        >
          {xLabel}
        </text>
      )}
      {yLabel && (
        <text
          x={10}
          y={height / 2}
          textAnchor="middle"
          fontSize={11}
          fill="var(--ink-soft)"
          transform={`rotate(-90 10 ${height / 2})`}
        >
          {yLabel}
        </text>
      )}
    </g>
  );
}

/** Convenience: build a scale for the standard demo plot box. */
export function demoScale(
  domain: [number, number],
  range: [number, number],
  width = 460,
  height = 340,
  pad = 34,
): Scale {
  return makeScale(width, height, domain, range, pad);
}

/** An SVG polyline through data-space points. */
export function DataLine({
  points,
  scale,
  color,
  width = 2,
  dashed = false,
  opacity = 1,
}: {
  points: [number, number][];
  scale: Scale;
  color: string;
  width?: number;
  dashed?: boolean;
  opacity?: number;
}) {
  if (points.length < 2) return null;
  const d = points.map(([x, y]) => `${scale.x(x).toFixed(2)},${scale.y(y).toFixed(2)}`).join(" ");
  return (
    <polyline
      points={d}
      fill="none"
      stroke={color}
      strokeWidth={width}
      strokeLinejoin="round"
      strokeLinecap="round"
      strokeDasharray={dashed ? "5 4" : undefined}
      opacity={opacity}
    />
  );
}
