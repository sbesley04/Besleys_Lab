import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import SAMPLE_DATA from "./sampleData.js";
import { STAT_ORDER, DISTRICT_COLORS, computeArchetype } from "./rosterData.js";

// ─── palette ──────────────────────────────────────────────────────────────────
const C = {
  bg:          "#f5f0e8",
  surface:     "#ede8dc",
  surfaceHi:   "#e4dece",
  border:      "#c8bfa8",
  borderDark:  "#a89878",
  ink:         "#1a1410",
  inkMid:      "#4a3e32",
  inkDim:      "#7a6858",
  amber:       "#b8820a",
  amberDim:    "#8a6108",
  amberLight:  "#e8d498",
  danger:      "#a82020",
  dangerLight: "#f0d8d0",
  safe:        "#2e6820",
};

const mono = "ui-monospace,'SF Mono',Menlo,Consolas,monospace";

// ─── pixel map constants ───────────────────────────────────────────────────────
const PX = 16; // pixels per cell on the offscreen canvas (doubled for richer tiles)

const ALLY_HUES = ["#1888c8","#c02858","#389820","#d05810","#6838c8","#089870","#c09020","#b02840"];

const WEATHER_ICONS = {
  fog: "🌫", rain: "🌧", storm: "⛈", sandstorm: "🌪",
  blizzard: "❄", heat_wave: "☀", dry_lightning: "⚡", freezing_mist: "🌨",
};
const SOLO      = "#907868";

// Base display color per glyph — used in legend and transition blending
const BIOME_BASE = {
  ".": "#a0b840", "T": "#2c5a18", "^": "#686070",
  "~": "#2468a0", "C": "#c09020", "S": "#2e3e1a", "H": "#7a8c38",
  "D": "#c8a858", "R": "#887870", "B": "#1c2c14",
};
// Colour that bleeds from this biome INTO a neighbouring tile at their shared edge
const BIOME_BLEND = {
  ".": "#8aaa30", "T": "#1e4010", "^": "#585060",
  "~": "#3070a0", "C": "#b08018", "S": "#243018", "H": "#5a6828",
  "D": "#a08840", "R": "#605848", "B": "#182210",
};

function hpColor(hp) {
  if (hp <= 0)  return "#b0a898";
  if (hp < 30)  return "#b82828";
  if (hp < 60)  return "#b87010";
  return "#2e7028";
}

// ─── pixel art drawing helpers (16×16 per cell) ────────────────────────────────
function drawBiomeTile(g, type, cx, cy) {
  const p = (c, x, y, w = 1, h = 1) => { g.fillStyle = c; g.fillRect(cx+x, cy+y, w, h); };
  switch (type) {
    case ".": // PLAINS
      p("#a0b840",  0,  0, 16, 16);
      p("#b8d050",  4,  2,  4,  3);   // sunny patch
      p("#c0d858", 10,  8,  3,  2);   // second bright patch
      p("#d8e870",  6,  5,  2,  1);   // sparkle
      p("#608020",  2,  4,  2,  1);  p("#608020",  2,  5,  1,  3);  // tuft 1
      p("#608020",  9, 11,  2,  1);  p("#608020",  9, 12,  1,  3);  // tuft 2
      p("#608020", 14,  2,  2,  1);  p("#608020", 14,  3,  1,  2);  // tuft 3
      p("#88a028",  0,  9,  3,  1);
      p("#88a028",  7, 14,  4,  1);
      break;
    case "T": // FOREST
      p("#2c5a18",  0,  0, 16, 16);
      p("#1a3808",  5,  1,  6,  1);   // crown top
      p("#1a3808",  4,  2,  8,  2);   // crown 2
      p("#1a3808",  3,  4, 10,  3);   // mid canopy
      p("#1a3808",  4,  7,  8,  2);   // low canopy
      p("#1a3808",  5,  9,  6,  1);   // base canopy
      p("#4a8030",  6,  2,  4,  1);   // sunlit top
      p("#4a8030",  5,  5,  3,  1);   // interior highlight
      p("#3c2010",  7, 10,  2,  5);   // trunk
      p("#241808",  9, 11,  1,  4);   // trunk shadow
      p("#1a4010",  0, 12,  4,  4);   // ground flora L
      p("#1a4010", 11, 13,  4,  3);   // ground flora R
      p("#1a3808",  0,  0,  2,  4);   // dark corner TL
      p("#1a3808", 14,  0,  2,  5);   // dark corner TR
      p("#386820",  0,  7,  3,  5);   // side foliage L
      p("#386820", 13,  8,  3,  4);   // side foliage R
      break;
    case "^": // MOUNTAIN
      p("#686070",  0,  0, 16, 16);
      p("#e8e4f0",  7,  0,  2,  1);   // peak tip
      p("#d8d4e8",  6,  1,  4,  1);   // snow line 1
      p("#c8c4d8",  5,  2,  6,  1);   // snow line 2
      p("#b8b4c8",  4,  3,  8,  1);   // snow line 3
      p("#a8a4b8",  3,  4, 10,  1);   // snow line 4
      p("#484050",  0,  5,  3,  7);   // dark left face
      p("#504858",  0, 12,  5,  4);   // dark base L
      p("#807888", 12,  3,  4,  4);   // light right face
      p("#706870", 11,  7,  4,  4);   // mid-right face
      p("#909098",  9,  5,  2,  2);   // rock highlight
      p("#383040",  2, 13,  3,  3);   // deep shadow
      p("#585060",  6,  9,  3,  2);   // mid rock
      p("#505860", 10, 11,  3,  2);   // rock cleft
      p("#787080",  4,  6,  2,  3);   // rock face detail
      break;
    case "~": // WATER
      p("#2468a0",  0,  0, 16, 16);
      p("#1a5090",  4,  4,  8,  7);   // deep center
      p("#184888",  6,  6,  4,  3);   // deepest
      p("#3880b8",  0,  0, 16,  1);   // top rim
      p("#60a8d0",  1,  1,  4,  1);   // shimmer 1
      p("#58a0c8",  8,  5,  5,  1);   // shimmer 2
      p("#60a8d0",  2, 10,  3,  1);   // shimmer 3
      p("#50a0c8", 11, 12,  4,  1);   // shimmer 4
      p("#90c8e0",  0,  3,  2,  1);   // foam 1
      p("#90c8e0", 13,  8,  2,  1);   // foam 2
      p("#90c8e0",  5, 13,  3,  1);   // foam 3
      break;
    case "C": // CORNUCOPIA
      p("#6a4808",  0,  0, 16, 16);   // outer frame
      p("#9a7018",  1,  1, 14, 14);   // inner frame
      p("#c09020",  3,  3, 10, 10);   // gold
      p("#d8a820",  4,  4,  8,  8);   // bright gold
      p("#f0c030",  5,  5,  6,  6);   // shine
      p("#ffe840",  6,  6,  4,  4);   // gem center
      p("#fff890",  7,  7,  2,  2);   // gem highlight
      p("#c8a030",  1,  1,  2,  2);   // corner TL
      p("#c8a030", 13,  1,  2,  2);   // corner TR
      p("#c8a030",  1, 13,  2,  2);   // corner BL
      p("#c8a030", 13, 13,  2,  2);   // corner BR
      break;
    case "S": // SWAMP
      p("#2e3e1a",  0,  0, 16, 16);   // dark olive base
      p("#18281a",  3,  5,  7,  4);   // murky pool
      p("#202e16",  2,  6,  1,  2);   // pool edge L
      p("#202e16", 10,  5,  1,  3);   // pool edge R
      p("#1e301e",  5,  9,  4,  1);   // pool bottom
      p("#384c1c",  7,  4,  3,  1);   // algae on pool
      p("#384c1c",  9,  8,  4,  2);   // algae patch 2
      p("#4a6030",  1,  0,  2,  9);   // reed 1 (tall)
      p("#3a4e24",  1,  0,  1,  9);   // reed 1 shadow
      p("#4a6030",  5,  1,  2,  6);   // reed 2
      p("#4a6030", 12,  0,  2, 10);   // reed 3
      p("#3a4e24", 12,  0,  1, 10);   // reed 3 shadow
      p("#6a8848",  1,  0,  2,  1);   // reed tip 1
      p("#6a8848",  5,  1,  2,  1);   // reed tip 2
      p("#6a8848", 12,  0,  2,  1);   // reed tip 3
      p("#2a2210",  0, 13, 16,  3);   // mud floor
      p("#201a0c",  1, 14,  3,  2);   // mud dark detail L
      p("#342a18", 12, 13,  3,  2);   // mud detail R
      p("#3c3018",  6, 14,  4,  1);   // mud center
      break;
    case "B": // TOXIC BOG
      p("#1c2c14",  0,  0, 16, 16);   // dark sickly base
      p("#0c1c10",  2,  3, 10,  7);   // toxic pool body
      p("#0a1808",  5,  5,  5,  3);   // pool deepest
      p("#141e0c",  1,  4,  1,  5);   // pool edge L
      p("#141e0c", 12,  3,  1,  6);   // pool edge R
      p("#141e0c",  3,  2,  8,  1);   // pool edge top
      // Toxic gas bubbles (sickly yellow-green)
      p("#4a5e14",  4,  6,  2,  2);   p("#5a6e18",  4,  6,  1,  1);
      p("#4a5e14",  8,  4,  2,  2);   p("#5a6e18",  8,  4,  1,  1);
      p("#4a5e14",  6,  8,  2,  1);
      // Dead skeletal reed stalks
      p("#1e1408",  1,  0,  1, 13);
      p("#1e1408", 14,  0,  1, 11);
      p("#1e1408",  6,  0,  1,  5);
      p("#262008",  1,  0,  2,  1);   // stalk tip
      p("#262008", 14,  0,  2,  1);
      p("#262008",  6,  0,  2,  1);
      // Algae scum + fetid mud floor
      p("#2a3410",  0, 10, 16,  2);
      p("#343c14",  3, 11,  3,  1);   p("#343c14", 10, 10,  3,  1);
      p("#181e0c",  0, 12, 16,  4);
      p("#1c2410", 13, 13,  2,  2);
      break;
    case "D": // DESERT
      p("#c8a858",  0,  0, 16, 16);   // sandy base
      p("#a08840",  0,  4, 16,  1);   // dune ripple 1
      p("#a08840",  0,  9, 16,  1);   // dune ripple 2
      p("#a08840",  0, 14, 16,  1);   // dune ripple 3
      p("#e8c870",  2,  1,  3,  2);   // sun-bleached highlight 1
      p("#e8c870", 11,  6,  3,  2);   // sun-bleached highlight 2
      p("#908050",  7,  7,  3,  2);   // rock outcrop
      p("#a09060",  7,  7,  2,  1);   // rock highlight
      p("#706030", 10,  8,  2,  1);   // rock shadow
      p("#b89848",  4, 12,  5,  1);   // low dune crest
      p("#d0b060",  5, 11,  3,  1);   // dune highlight
      break;
    case "R": // RUINS
      p("#887870",  0,  0, 16, 16);   // worn stone base
      p("#281e18",  0,  0,  7,  7);   // dark interior void (room corner)
      p("#281e18", 10, 10,  6,  6);   // second void
      p("#605848",  0,  0,  8,  2);   // N wall
      p("#605848",  0,  0,  2,  8);   // W wall
      p("#605848",  9,  0,  7,  2);   // NE wall fragment
      p("#605848",  9,  0,  2,  5);   // NE wall stub
      p("#605848",  0, 10,  2,  6);   // SW wall stub
      p("#605848",  0, 14,  9,  2);   // S wall fragment
      p("#706860",  3,  4,  4,  3);   // rubble pile 1
      p("#706860",  11, 6,  4,  2);   // rubble pile 2
      p("#706860",  5, 12,  3,  2);   // rubble pile 3
      p("#a09888",  4,  4,  2,  1);   // rubble highlight 1
      p("#a09888", 11,  6,  2,  1);   // rubble highlight 2
      p("#3a5020",  1,  3,  2,  2);   // moss in crack 1
      p("#3a5020",  7, 13,  2,  2);   // moss in crack 2
      p("#2a3818", 13,  3,  2,  2);   // dark moss
      break;
    case "H": // HILLS
      p("#7a8c38",  0,  0, 16, 16);   // base olive green
      p("#a0b44c",  0,  0, 10,  1);   // crest highlight 1
      p("#98ac48",  0,  1,  8,  1);   // crest highlight 2
      p("#90a444",  0,  2,  6,  2);   // crest highlight 3
      p("#88a040",  0,  4,  4,  2);   // crest highlight 4
      p("#b0c458",  2,  1,  3,  1);   // sunlit peak
      p("#585e1e", 14,  2,  2,  8);   // right shadow
      p("#606e24", 12,  4,  2,  6);   // mid shadow
      p("#5a6824",  3, 10,  2,  1);  p("#5a6824",  3, 11,  1,  2);  // grass tuft 1
      p("#5a6824", 11, 12,  2,  1);  p("#5a6824", 11, 13,  1,  2);  // grass tuft 2
      p("#888058",  7,  7,  3,  2);   // rock outcrop
      p("#a8a070",  7,  7,  2,  1);   // rock highlight
      p("#606038",  9,  8,  2,  1);   // rock shadow
      p("#6a5828",  0, 14,  3,  2);   // soil L
      p("#6a5828", 13, 14,  3,  2);   // soil R
      p("#8a9840",  5,  9,  3,  2);   // mid-hill grass
      break;
    default:
      p("#a0b840", 0, 0, 16, 16);
  }
}

// Dither masks (16 bits, one per pixel along an edge) for irregular transitions
const _DH  = [1,0,1,0,1,1,0,1,0,1,1,0,1,0,1,0]; // dense ~75 %
const _DM  = [1,0,0,1,0,1,0,0,1,0,1,0,0,1,0,1]; // medium ~50 %
const _DL  = [1,0,0,0,1,0,0,1,0,0,1,0,0,0,1,0]; // light  ~25 %

function drawAllTransitions(g, map, N) {
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const type = map[y][x];
      if (type === "C") continue;          // cornucopia keeps sharp borders
      const cx = x * PX, cy = y * PX;

      const dirs = [
        { dx:  0, dy: -1, ex: 0,    ey: 0,       ew: PX, eh: 1, ix: 0, iy: 1 },
        { dx:  0, dy:  1, ex: 0,    ey: PX-1,    ew: PX, eh: 1, ix: 0, iy: PX-2 },
        { dx: -1, dy:  0, ex: 0,    ey: 0,       ew: 1,  eh: PX, ix: 1, iy: 0 },
        { dx:  1, dy:  0, ex: PX-1, ey: 0,       ew: 1,  eh: PX, ix: PX-2, iy: 0 },
      ];

      for (const { dx, dy, ex, ey, ew, eh, ix, iy } of dirs) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= N || ny >= N) continue;
        const ntype = map[ny][nx];
        if (ntype === type) continue;

        // Decode neighbour blend colour
        const hex = (BIOME_BLEND[ntype] || "#808080").slice(1);
        const nb = parseInt(hex, 16);
        const nr = (nb >> 16) & 255, ng2 = (nb >> 8) & 255, nb2 = nb & 255;

        // Density: stronger contrast → denser dither
        const hiContrast = (type === "~" || ntype === "~" || type === "T" || ntype === "T"
                            || type === "S" || ntype === "S");
        const OUTER = hiContrast ? _DH : _DM;
        const INNER = hiContrast ? _DM : _DL;

        const len = (ew === PX) ? PX : PX; // always 16 samples
        for (let i = 0; i < len; i++) {
          if (OUTER[i]) {
            const px = cx + ex + (ew > 1 ? 0 : 0);
            const py = cy + ey + (eh > 1 ? 0 : 0);
            const rx = ew === PX ? cx + ex + i       : cx + ex;
            const ry = eh === PX ? cy + ey + i       : cy + ey;
            // outer strip
            g.fillStyle = `rgba(${nr},${ng2},${nb2},0.70)`;
            g.fillRect(ew === PX ? cx + i : cx + ex,
                       eh === PX ? cy + ey : cy + i,
                       ew === PX ? 1 : ew,
                       eh === PX ? eh : 1);
          }
          if (INNER[i]) {
            // inner strip (1 pixel further in)
            g.fillStyle = `rgba(${nr},${ng2},${nb2},0.35)`;
            g.fillRect(ew === PX ? cx + i : cx + ix,
                       eh === PX ? cy + iy : cy + i,
                       ew === PX ? 1 : 1,
                       eh === PX ? 1 : 1);
          }
        }
      }
    }
  }
}

function drawTributeSprite(g, cx, cy, color, isDead) {
  const p = (c, x, y, w = 1, h = 1) => { g.fillStyle = c; g.fillRect(cx+x, cy+y, w, h); };
  if (isDead) {
    p("#c8c0b8", 0, 0, PX, PX);     // gray background
    p("#908880", 2, 2, 4, 4);        // X top-left block
    p("#908880",10, 2, 4, 4);        // X top-right block
    p("#908880", 6, 6, 4, 4);        // X center
    p("#908880", 2,10, 4, 4);        // X bottom-left
    p("#908880",10,10, 4, 4);        // X bottom-right
    return;
  }
  const M = 2, S = PX - M * 2;       // 2px margin → 12×12 sprite
  p(color,     M,   M,   S,   S);    // fill
  p("#1a1410", M,   M,   S,   1);    // top border
  p("#1a1410", M,   M+S-1, S, 1);   // bottom border
  p("#1a1410", M,   M,   1,   S);    // left border
  p("#1a1410", M+S-1, M, 1,  S);    // right border
  // bevel highlight
  g.fillStyle = "rgba(255,255,255,0.40)";
  g.fillRect(cx+M+1, cy+M+1, S-2, 1);
  g.fillRect(cx+M+1, cy+M+1, 1, S-2);
}

// ─── component ────────────────────────────────────────────────────────────────
export default function ArenaConsole({ roster, onViewCard, focusName, setFocusName }) {
  const [data, setData]         = useState(SAMPLE_DATA);
  const [turn, setTurn]         = useState(0);
  const [selected, setSelected] = useState(null);
  const [playing, setPlaying]   = useState(false);
  const [loadErr, setLoadErr]   = useState("");
  const [seedInput, setSeedInput] = useState(String(SAMPLE_DATA.seed));
  const [simRunning, setSimRunning] = useState(false);
  const [simError, setSimError] = useState("");
  const canvasRef = useRef(null);
  const fileRef   = useRef(null);

  // when arena receives a focusName from App, select that tribute
  useEffect(() => {
    if (focusName) { setSelected(focusName); setFocusName(null); }
  }, [focusName, setFocusName]);

  useEffect(() => {
    fetch("/sim_output.json")
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(parsed => {
        if (!parsed.snapshots || !parsed.region_map) throw new Error();
        setData(parsed);
        setSeedInput(String(parsed.seed ?? ""));
        setTurn(0); setSelected(null); setPlaying(false);
      })
      .catch(() => {});
  }, []);

  const runSim = async () => {
    const seed = parseInt(seedInput, 10);
    if (isNaN(seed) || seed < 0) { setSimError("Enter a valid seed (non-negative integer)."); return; }
    setSimRunning(true);
    setSimError("");
    setPlaying(false);
    try {
      const res = await fetch("/api/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ seed }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `Server error ${res.status}`);
      if (!json.snapshots || !json.region_map) throw new Error("Unexpected response shape.");
      setData(json);
      setTurn(0);
      setSelected(null);
      setLoadErr("");
      setSimError("");
    } catch (e) {
      const msg = e.message || "";
      setSimError(
        msg.toLowerCase().includes("fetch")
          ? "Sim server offline — run: python3 server.py"
          : msg
      );
    } finally {
      setSimRunning(false);
    }
  };

  const snaps = data.snapshots;
  const snap  = snaps[Math.min(turn, snaps.length - 1)];
  const map   = data.region_map;
  const N     = map.length;

  const rosterByName = useMemo(() => {
    const m = {};
    (roster || []).forEach(r => (m[r.name] = r));
    (data.roster || []).forEach(r => { if (!m[r.name]) m[r.name] = r; });
    return m;
  }, [data.roster, roster]);

  const allyColors = useMemo(() => {
    const ids = [];
    snaps.forEach(s => s.players.forEach(p => {
      if (p.ally != null && !ids.includes(p.ally)) ids.push(p.ally);
    }));
    const m = {};
    ids.forEach((id, i) => (m[id] = ALLY_HUES[i % ALLY_HUES.length]));
    return m;
  }, [snaps]);

  const colorFor = useCallback(
    p => (p.ally != null ? (allyColors[p.ally] ?? SOLO) : SOLO),
    [allyColors]
  );

  // autoplay
  useEffect(() => {
    if (!playing) return;
    if (turn >= snaps.length - 1) { setPlaying(false); return; }
    const id = setTimeout(() => setTurn(t => t + 1), 900);
    return () => clearTimeout(id);
  }, [playing, turn, snaps.length]);

  // ── pixel map draw ──────────────────────────────────────────────────────────
  useEffect(() => {
    const display = canvasRef.current;
    if (!display) return;

    // 1. render pixel art to offscreen canvas
    const off = document.createElement("canvas");
    off.width  = N * PX;
    off.height = N * PX;
    const og = off.getContext("2d");
    og.imageSmoothingEnabled = false;

    // biomes
    for (let y = 0; y < N; y++)
      for (let x = 0; x < N; x++)
        drawBiomeTile(og, map[y][x], x * PX, y * PX);

    // biome transition blending
    drawAllTransitions(og, map, N);

    // kill zone (checkerboard red overlay + border)
    const cx = N / 2, cy = N / 2;
    const rad = snap.safe_radius;
    if (rad < N) {
      for (let y = 0; y < N; y++) {
        for (let x = 0; x < N; x++) {
          const d = Math.max(Math.abs(x - cx + 0.5), Math.abs(y - cy + 0.5));
          if (d > rad) {
            og.fillStyle = "rgba(168,32,32,0.48)";
            for (let py = 0; py < PX; py++)
              for (let px = 0; px < PX; px++)
                if ((px + py) % 2 === 0)
                  og.fillRect(x * PX + px, y * PX + py, 1, 1);
          }
        }
      }
      og.strokeStyle = "#a82020";
      og.lineWidth   = 2;
      og.strokeRect(
        (cx - rad) * PX + 1, (cy - rad) * PX + 1,
        rad * 2 * PX - 2, rad * 2 * PX - 2
      );
    }

    // hazard radial overlay
    if (snap.hazard) {
      const h = snap.hazard;
      for (let y = 0; y < N; y++) {
        for (let x = 0; x < N; x++) {
          const d = Math.max(Math.abs(x - h.x), Math.abs(y - h.y));
          if (d <= h.radius) {
            const t = 1 - d / (h.radius + 1);
            og.fillStyle = `rgba(210,110,20,${(t * 0.65).toFixed(2)})`;
            og.fillRect(x * PX, y * PX, PX, PX);
            // checkerboard inner texture
            if (t > 0.4) {
              og.fillStyle = `rgba(255,180,40,${(t * 0.3).toFixed(2)})`;
              for (let py = 0; py < PX; py++)
                for (let px = 0; px < PX; px++)
                  if ((px + py) % 2 === 0)
                    og.fillRect(x * PX + px, y * PX + py, 1, 1);
            }
          }
        }
      }
    }

    // tribute sprites
    snap.players.forEach(p => {
      drawTributeSprite(og, p.x * PX, p.y * PX, colorFor(p), !p.alive);
    });

    // 2. scale up to display canvas
    const dpr     = window.devicePixelRatio || 1;
    const cssSize = display.clientWidth;
    display.width  = cssSize * dpr;
    display.height = cssSize * dpr;
    const dg = display.getContext("2d");
    dg.setTransform(dpr, 0, 0, dpr, 0, 0);
    dg.imageSmoothingEnabled = false;
    dg.drawImage(off, 0, 0, cssSize, cssSize);

    // 3. selection ring at display resolution
    if (selected) {
      const sp = snap.players.find(p => p.name === selected && p.alive);
      if (sp) {
        const cellPx = cssSize / N;
        dg.strokeStyle = C.amber;
        dg.lineWidth   = 3;
        dg.strokeRect(sp.x * cellPx + 1.5, sp.y * cellPx + 1.5, cellPx - 3, cellPx - 3);
      }
    }

    // 4. text labels at display resolution
    const scale  = cssSize / (N * PX);
    const cellPx = PX * scale;
    dg.textAlign    = "center";
    dg.textBaseline = "middle";
    snap.players.forEach(p => {
      if (!p.alive) return;
      const dx = (p.x * PX + PX / 2) * scale;
      const dy = (p.y * PX + PX / 2) * scale;
      const ab = (p.name[0] + (p.name[1] || "")).toUpperCase();
      const fs = Math.max(7, Math.round(cellPx * 0.32));
      dg.font        = `700 ${fs}px ${mono}`;
      dg.strokeStyle = "rgba(245,240,232,0.85)";
      dg.lineWidth   = 2.5;
      dg.strokeText(ab, dx, dy);
      dg.fillStyle = "#0e0c08";
      dg.fillText(ab, dx, dy);
    });
  }, [snap, map, N, selected, colorFor]);

  // canvas click → select tribute
  const onCanvasClick = e => {
    const cv   = canvasRef.current;
    const rect = cv.getBoundingClientRect();
    const cellPx = rect.width / N;
    const mx = (e.clientX - rect.left) / cellPx;
    const my = (e.clientY - rect.top)  / cellPx;
    let best = null, bd = 1.2;
    snap.players.forEach(p => {
      if (!p.alive) return;
      const d = Math.hypot(p.x + 0.5 - mx, p.y + 0.5 - my);
      if (d < bd) { bd = d; best = p.name; }
    });
    setSelected(best);
  };

  const onFile = e => {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result);
        if (!parsed.snapshots || !parsed.region_map) throw new Error();
        setData(parsed); setTurn(0); setSelected(null); setPlaying(false); setLoadErr("");
      } catch { setLoadErr("Not a valid arena export."); }
    };
    reader.readAsText(f);
  };

  const dossier = useMemo(() =>
    [...snap.players].sort((a, b) => {
      if (a.alive !== b.alive) return a.alive ? -1 : 1;
      return b.overall - a.overall;
    }), [snap]);

  const sel      = selected ? snap.players.find(p => p.name === selected) : null;
  const selRoster = sel ? rosterByName[sel.name] : null;
  const start    = snaps[0].alive_count;

  return (
    <div style={S.root}>
      <style>{CSS}</style>

      {/* header */}
      <div style={S.header}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={S.rec} />
            <span style={S.title}>ARENA&nbsp;FEED</span>
          </div>

          {/* seed runner */}
          <div style={S.seedRow}>
            <span style={S.seedLabel}>SEED</span>
            <input
              type="number"
              min="0"
              value={seedInput}
              onChange={e => setSeedInput(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") runSim(); }}
              disabled={simRunning}
              style={S.seedInput}
            />
            <button
              style={{ ...S.runBtn, opacity: simRunning ? 0.6 : 1 }}
              onClick={runSim}
              disabled={simRunning}
            >
              {simRunning ? "RUNNING…" : "▶ RUN"}
            </button>
          </div>
        </div>

        <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
          <StatPill label="HOUR"  value={String(snap.hour).padStart(3, "0")} />
          <StatPill label="ALIVE" value={`${snap.alive_count} / ${start}`} />
          <StatPill label="RING"  value={snap.safe_radius >= N ? "OPEN" : `r${snap.safe_radius}`}
            danger={snap.safe_radius < N} />

          {/* night / weather / border chips */}
          {snap.is_night && (
            <span style={{ ...S.envPill, background: "#2a2040", color: "#c8b8f0" }}>
              ◐ NIGHT
            </span>
          )}
          {snap.weather?.type && snap.weather.type !== "clear" && (
            <span style={{ ...S.envPill, background: "#1a3858", color: "#90c8e8" }}>
              {WEATHER_ICONS[snap.weather.type] || "🌀"} {snap.weather.type.replace(/_/g," ").toUpperCase()}
            </span>
          )}
          {snap.hazard && (
            <span style={S.hazardPill}>⚠ {snap.hazard.kind.toUpperCase()}</span>
          )}
          {snap.border_disaster && snap.safe_radius < N && (
            <span style={{ ...S.hazardPill, background: "#7a2010" }}>
              ▶ {snap.border_disaster.replace(/_/g," ").toUpperCase()}
            </span>
          )}

          <button style={S.loadBtn} onClick={() => fileRef.current?.click()}>LOAD FEED</button>
          <input ref={fileRef} type="file" accept=".json,application/json"
            onChange={onFile} style={{ display: "none" }} />
        </div>
      </div>

      {(loadErr || simError) && (
        <div style={S.err}>
          {simError
            ? <>⚠ {simError}{simError.includes("python3") && <code style={{ marginLeft: 8, background: C.amberLight, padding: "1px 6px", borderRadius: 2 }}>python3 server.py</code>}</>
            : loadErr}
        </div>
      )}

      {/* body */}
      <div style={S.body}>
        {/* map */}
        <div style={S.mapCol}>
          <div style={S.mapFrame}>
            <canvas
              ref={canvasRef}
              onClick={onCanvasClick}
              style={{ width: "100%", height: "100%", display: "block",
                cursor: "crosshair", imageRendering: "pixelated" }}
            />
          </div>
          <MapLegend />
        </div>

        {/* sidebar */}
        <div style={S.side}>
          {sel ? (
            <FocusPanel
              sel={sel} roster={selRoster} color={colorFor(sel)}
              onClose={() => setSelected(null)}
              onViewCard={() => onViewCard(sel.name)}
            />
          ) : (
            <div style={S.sideHint}>
              Click a sprite on the map or a row below to select a tribute.
            </div>
          )}
          <div style={S.list}>
            {dossier.map(p => (
              <TributeRow key={p.name} p={p} color={colorFor(p)}
                selected={selected === p.name}
                onClick={() => setSelected(p.name === selected ? null : p.name)} />
            ))}
          </div>
        </div>
      </div>

      {/* transport */}
      <div style={S.transport}>
        <button style={S.ctrl} onClick={() => { setTurn(0); setPlaying(false); }}>⏮</button>
        <button style={S.ctrl} onClick={() => setTurn(t => Math.max(0, t - 1))}>◀</button>
        <button style={{ ...S.ctrl, ...S.playBtn }}
          onClick={() => setPlaying(p => !p)}>
          {playing ? "⏸" : "▶"}
        </button>
        <button style={S.ctrl} onClick={() => setTurn(t => Math.min(snaps.length - 1, t + 1))}>▶</button>
        <div style={S.track}>
          {snaps.map((s, i) => (
            <button key={i} onClick={() => { setTurn(i); setPlaying(false); }}
              title={`Hour ${s.hour}`}
              style={{
                ...S.tick,
                background: i === turn ? C.amber : s.hazard ? C.danger : C.border,
                height: i === turn ? 20 : s.hazard ? 13 : 8,
                opacity: i === turn ? 1 : 0.7,
              }}
            />
          ))}
        </div>
        <span style={S.turnLabel}>HR {String(snap.hour).padStart(3, "0")}</span>
      </div>
    </div>
  );
}

// ─── sub-components ────────────────────────────────────────────────────────────
function StatPill({ label, value, danger }) {
  return (
    <div style={{ textAlign: "right" }}>
      <div style={{ fontSize: 8, letterSpacing: 2, color: C.inkDim, fontWeight: 700 }}>{label}</div>
      <div style={{ fontSize: 17, fontWeight: 800, color: danger ? C.danger : C.amber, letterSpacing: 1 }}>
        {value}
      </div>
    </div>
  );
}

function TributeRow({ p, color, selected, onClick }) {
  return (
    <div onClick={onClick} className="arow" style={{
      ...S.row,
      opacity: p.alive ? 1 : 0.45,
      background: selected ? C.surfaceHi : "transparent",
      borderLeft: `3px solid ${p.alive ? color : C.border}`,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
        <span style={{
          ...S.rowName,
          textDecoration: p.alive ? "none" : "line-through",
          color: p.alive ? C.ink : C.inkDim,
        }}>{p.name}</span>
        <span style={S.rowDist}>D{p.district}</span>
        <span style={{ flex: 1 }} />
        {p.kills > 0 && <span style={S.kills}>✦{p.kills}</span>}
        <span style={S.threat}>{p.overall}</span>
      </div>
      <div style={S.hpTrack}>
        <div style={{ ...S.hpFill, width: `${Math.max(0, p.health)}%`, background: hpColor(p.health) }} />
      </div>
      {p.dialogue && <div style={S.rowLine}>{p.dialogue}</div>}
    </div>
  );
}

function FocusPanel({ sel, roster, color, onClose, onViewCard }) {
  const s = roster?.stats;
  const [tag, line] = s ? computeArchetype(s, sel.district) : ["—", ""];
  const distColor = DISTRICT_COLORS[sel.district] || C.amber;
  return (
    <div style={{ ...S.focus, borderTop: `3px solid ${distColor}` }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
        <span style={{ width: 12, height: 12, borderRadius: "50%", background: color, flexShrink: 0, marginTop: 3 }} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: 0.5, color: C.ink }}>{sel.name}</div>
          <div style={{ fontSize: 9, letterSpacing: 2, color: distColor, fontWeight: 700 }}>
            DISTRICT {sel.district} · {tag}
          </div>
        </div>
        <button style={S.xBtn} onClick={onClose}>✕</button>
      </div>

      <div style={{ display: "flex", gap: 10, margin: "10px 0", fontSize: 11, letterSpacing: 0.5 }}>
        <span style={{ fontWeight: 700, color: sel.alive ? hpColor(sel.health) : C.danger }}>
          {sel.alive ? `${sel.health} HP` : "ELIMINATED"}
        </span>
        <span style={{ color: C.inkDim }}>· {sel.kills} kill{sel.kills !== 1 ? "s" : ""}</span>
        <span style={{ color: C.inkDim }}>· {sel.ally != null ? "ALLIED" : "SOLO"}</span>
      </div>

      {s && STAT_ORDER.map(([key, lab, max]) => (
        <div key={key} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
          <span style={{ fontSize: 8, letterSpacing: 1.5, color: C.inkDim, width: 54 }}>{lab}</span>
          <div style={{ flex: 1, height: 5, background: C.border, borderRadius: 2, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${(s[key] / max) * 100}%`, background: color, borderRadius: 2 }} />
          </div>
          <span style={{ fontSize: 10, fontWeight: 700, width: 16, textAlign: "right", color: C.inkMid }}>{s[key]}</span>
        </div>
      ))}

      {sel.dialogue && (
        <div style={{ fontSize: 10.5, color: C.inkMid, fontStyle: "italic", marginTop: 10,
          paddingTop: 10, borderTop: `1px solid ${C.border}`, lineHeight: 1.5 }}>
          "{sel.dialogue}"
        </div>
      )}
      {line && (
        <div style={{ fontSize: 10, color: C.inkDim, marginTop: 6, lineHeight: 1.4 }}>{line}</div>
      )}

      <button style={S.viewCardBtn} onClick={onViewCard}>VIEW TRIBUTE CARD →</button>
    </div>
  );
}

function MapLegend() {
  const items = [
    [".", "plains"], ["T", "forest"], ["^", "mountain"], ["~", "water"],
    ["S", "swamp"],  ["H", "hills"],  ["D", "desert"],   ["R", "ruins"],
    ["B", "toxic bog"], ["C", "cornucopia"],
  ].map(([k, label]) => [BIOME_BASE[k], label]);
  return (
    <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 8 }}>
      {items.map(([c, l]) => (
        <span key={l} style={{ display: "flex", alignItems: "center", gap: 4,
          fontSize: 8, letterSpacing: 1, color: C.inkDim, textTransform: "uppercase" }}>
          <span style={{ width: 10, height: 10, background: c, display: "inline-block",
            border: `1px solid ${C.border}`, imageRendering: "pixelated" }} />
          {l}
        </span>
      ))}
      <span style={{ display: "flex", alignItems: "center", gap: 4,
        fontSize: 8, letterSpacing: 1, color: C.inkDim, textTransform: "uppercase" }}>
        <span style={{ width: 10, height: 10, background: "rgba(168,32,32,0.45)",
          display: "inline-block", border: `1px solid ${C.border}` }} />
        kill zone
      </span>
    </div>
  );
}

// ─── styles ───────────────────────────────────────────────────────────────────
const S = {
  root: { background: C.bg, color: C.ink, fontFamily: mono,
    minHeight: "calc(100vh - 48px)", padding: 16, boxSizing: "border-box" },

  header: { display: "flex", justifyContent: "space-between", alignItems: "center",
    paddingBottom: 12, borderBottom: `2px solid ${C.border}`, flexWrap: "wrap", gap: 10 },
  rec: { width: 8, height: 8, borderRadius: "50%", background: C.danger,
    boxShadow: `0 0 6px ${C.danger}`, animation: "pulse 1.6s infinite", flexShrink: 0 },
  title: { fontSize: 20, fontWeight: 900, letterSpacing: 6, color: C.ink },
  sub: { fontSize: 9, letterSpacing: 2, color: C.inkDim },
  envPill: { fontSize: 9, letterSpacing: 1.5, fontWeight: 700,
    padding: "4px 8px", borderRadius: 3 },
  hazardPill: { background: C.danger, color: "#fff", fontSize: 9, letterSpacing: 2,
    padding: "4px 9px", borderRadius: 2, fontWeight: 700 },
  loadBtn: { background: C.surface, color: C.amber, border: `1px solid ${C.border}`,
    fontFamily: mono, fontSize: 9, letterSpacing: 2, padding: "7px 12px",
    cursor: "pointer", borderRadius: 3, fontWeight: 700 },
  err: { color: C.danger, fontSize: 11, padding: "6px 0 2px", letterSpacing: 0.5 },

  seedRow: { display: "flex", alignItems: "center", gap: 6 },
  seedLabel: { fontSize: 8, letterSpacing: 2, color: C.inkDim, fontWeight: 700 },
  seedInput: {
    width: 86, background: C.surface, color: C.ink, border: `1px solid ${C.border}`,
    borderRadius: 3, padding: "5px 8px", fontFamily: mono, fontSize: 11,
    letterSpacing: 1, textAlign: "right",
  },
  runBtn: {
    background: C.amber, color: "#fff", border: "none",
    fontFamily: mono, fontSize: 9, letterSpacing: 2, fontWeight: 800,
    padding: "6px 14px", cursor: "pointer", borderRadius: 3,
    transition: "opacity 0.15s",
  },

  body: { display: "flex", gap: 14, marginTop: 14, alignItems: "flex-start", flexWrap: "wrap" },
  mapCol: { flex: "1 1 380px", minWidth: 280 },
  mapFrame: { position: "relative", aspectRatio: "1 / 1", width: "100%",
    border: `2px solid ${C.borderDark}`, borderRadius: 4, overflow: "hidden",
    background: C.surface, boxShadow: "inset 0 0 12px rgba(0,0,0,0.08), 0 2px 6px rgba(0,0,0,0.1)" },

  side: { flex: "1 1 300px", minWidth: 280, display: "flex", flexDirection: "column", gap: 10 },
  sideHint: { fontSize: 10, letterSpacing: 1.2, color: C.inkDim,
    border: `1px dashed ${C.border}`, padding: 14, borderRadius: 4, textAlign: "center",
    background: C.surface },
  list: { display: "flex", flexDirection: "column", gap: 2, maxHeight: 420,
    overflowY: "auto", paddingRight: 2 },

  row: { padding: "7px 10px", borderRadius: 3, cursor: "pointer",
    transition: "background 0.1s", borderLeft: `3px solid ${C.border}` },
  rowName: { fontSize: 12, fontWeight: 700 },
  rowDist: { fontSize: 8, color: C.inkDim, letterSpacing: 1 },
  kills: { fontSize: 10, color: C.amber, fontWeight: 700 },
  threat: { fontSize: 10, color: C.amberDim, fontWeight: 700, minWidth: 30, textAlign: "right" },
  hpTrack: { height: 3, background: C.border, borderRadius: 2, marginTop: 5, overflow: "hidden" },
  hpFill: { height: "100%", transition: "width 0.3s", borderRadius: 2 },
  rowLine: { fontSize: 10, color: C.inkDim, marginTop: 4, lineHeight: 1.4 },

  focus: { border: `1px solid ${C.border}`, borderRadius: 4, padding: 14, background: C.surface,
    boxShadow: "0 1px 4px rgba(0,0,0,0.07)" },
  xBtn: { background: "none", border: "none", color: C.inkDim, cursor: "pointer",
    fontSize: 14, fontFamily: mono, padding: 2 },
  viewCardBtn: { marginTop: 12, background: "none", border: `1px solid ${C.amber}`,
    color: C.amber, fontFamily: mono, fontSize: 9, letterSpacing: 2, fontWeight: 700,
    padding: "7px 12px", cursor: "pointer", borderRadius: 3, width: "100%" },

  transport: { display: "flex", alignItems: "center", gap: 6, marginTop: 14,
    paddingTop: 12, borderTop: `1px solid ${C.border}` },
  ctrl: { background: C.surface, color: C.inkMid, border: `1px solid ${C.border}`,
    width: 32, height: 28, borderRadius: 3, cursor: "pointer", fontSize: 12, fontFamily: mono },
  playBtn: { color: C.amber, borderColor: C.amberDim, background: C.amberLight },
  track: { flex: 1, display: "flex", alignItems: "center", gap: 2, height: 24, padding: "0 6px" },
  tick: { flex: 1, minWidth: 2, borderRadius: 1, cursor: "pointer",
    transition: "height 0.12s, background 0.12s", border: "none" },
  turnLabel: { fontSize: 10, letterSpacing: 2, color: C.amber, fontWeight: 700, minWidth: 52, textAlign: "right" },
};

const CSS = `
  @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.25} }
  .arow:hover { background: ${C.surfaceHi} !important; }
`;
