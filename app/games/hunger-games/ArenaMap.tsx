"use client";

import { useEffect, useRef } from "react";
import { GRID, type Biome, type TurnSnapshot, type GameParams } from "./engine";
import styles from "./hungerGames.module.css";

// Canvas mini-map: biome terrain, the shrinking safe zone, hazard flash, and
// tribute dots for the current turn. Redraws on every turn change — 64×64
// cells is cheap enough to repaint outright.

export const BIOME_COLORS: Record<Biome, string> = {
  water: "#8aa6ba",
  toxic_bog: "#75804e",
  swamp: "#84906a",
  plains: "#cfc196",
  forest: "#65805a",
  hills: "#b3a37c",
  mountain: "#948a7d",
  desert: "#dcc795",
  ruins: "#a2978c",
  cornucopia: "#c9a227",
};

const SCALE = 6; // canvas pixels per arena cell

export default function ArenaMap({
  arena,
  snapshot,
  params,
}: {
  arena: Biome[][];
  snapshot: TurnSnapshot;
  params: GameParams;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    // Terrain
    for (let y = 0; y < GRID; y++) {
      for (let x = 0; x < GRID; x++) {
        ctx.fillStyle = BIOME_COLORS[arena[y][x]];
        ctx.fillRect(x * SCALE, y * SCALE, SCALE, SCALE);
      }
    }

    const c = (GRID / 2) * SCALE;

    // Danger zone shading outside the safe radius
    const rad = snapshot.safeRadius;
    if (rad < GRID) {
      ctx.save();
      ctx.fillStyle = "rgba(122, 45, 35, 0.30)";
      ctx.beginPath();
      ctx.rect(0, 0, GRID * SCALE, GRID * SCALE);
      const r = rad * SCALE;
      if (params.borderShape === "circle") {
        ctx.arc(c, c, r, 0, Math.PI * 2, true); // counter-clockwise = hole
      } else if (params.borderShape === "north_south") {
        ctx.moveTo(0, c - r);
        ctx.lineTo(GRID * SCALE, c - r);
        ctx.lineTo(GRID * SCALE, c + r);
        ctx.lineTo(0, c + r);
        ctx.closePath();
      } else {
        ctx.moveTo(c - r, c - r);
        ctx.lineTo(c - r, c + r);
        ctx.lineTo(c + r, c + r);
        ctx.lineTo(c + r, c - r);
        ctx.closePath();
      }
      ctx.fill("evenodd");
      ctx.restore();
    }

    // Hazard flash
    if (snapshot.hazard) {
      const h = snapshot.hazard;
      ctx.strokeStyle = "rgba(155, 58, 47, 0.9)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(h.x * SCALE, h.y * SCALE, h.radius * SCALE, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Night dimming
    if (snapshot.isNight) {
      ctx.fillStyle = "rgba(20, 24, 40, 0.28)";
      ctx.fillRect(0, 0, GRID * SCALE, GRID * SCALE);
    }

    // Tributes
    for (const p of snapshot.players) {
      if (!p.alive && !snapshot.deaths.includes(p.name)) continue;
      const px = p.x * SCALE;
      const py = p.y * SCALE;
      if (!p.alive) {
        // died this turn — draw a small cross
        ctx.strokeStyle = "#7c2d23";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(px - 4, py - 4);
        ctx.lineTo(px + 4, py + 4);
        ctx.moveTo(px + 4, py - 4);
        ctx.lineTo(px - 4, py + 4);
        ctx.stroke();
        continue;
      }
      ctx.fillStyle = "#1a1a1a";
      ctx.strokeStyle = "#f5f0e8";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(px, py, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
  }, [arena, snapshot, params]);

  const legendEntries: [Biome, string][] = [
    ["forest", "forest"],
    ["plains", "plains"],
    ["water", "water"],
    ["mountain", "mountain"],
    ["desert", "desert"],
    ["swamp", "swamp"],
    ["ruins", "ruins"],
    ["toxic_bog", "toxic bog"],
    ["cornucopia", "cornucopia"],
  ];

  return (
    <div>
      <canvas
        ref={canvasRef}
        width={GRID * SCALE}
        height={GRID * SCALE}
        className={styles.mapCanvas}
        role="img"
        aria-label={`Arena map, turn ${snapshot.turn}: ${snapshot.aliveCount} tributes alive${
          snapshot.safeRadius < GRID ? ", the safe zone is shrinking" : ""
        }`}
      />
      <div className={styles.legend} aria-hidden>
        {legendEntries.map(([biome, label]) => (
          <span key={biome}>
            <span className={styles.swatch} style={{ background: BIOME_COLORS[biome] }} />
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}
