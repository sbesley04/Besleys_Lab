import styles from "./room.module.css";

// The game room, drawn. One SVG in a 1600×1000 box, one-point perspective
// with the vanishing point at (800, 400) — every receding edge (walls,
// floorboards, the prize wall's shelves) is aimed at it, so things sit in the
// room rather than on it. Pure presentation: GameRoom lays the clickable hit
// areas over the top in matching percentages (see STATIONS in GameRoom.tsx).
//
// Colors are classes in room.module.css backed by --room-* tokens, so the
// Grid (Konami) skin can turn the whole room into a wireframe from CSS.

export type Station = "arcade" | "cards" | "logic" | "sims" | "casino" | "prizes";

export const VIEW_W = 1600;
export const VIEW_H = 1000;
const VP = { x: 800, y: 400 };

/** A slightly bowed line, so the room reads as drawn, not ruled. */
function sketch(x1: number, y1: number, x2: number, y2: number, bow = 4) {
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;
  const len = Math.hypot(x2 - x1, y2 - y1) || 1;
  const nx = -(y2 - y1) / len;
  const ny = (x2 - x1) / len;
  return `M${x1} ${y1} Q${(mx + nx * bow).toFixed(1)} ${(my + ny * bow).toFixed(1)} ${x2} ${y2}`;
}

/** Push a point on the back-wall plane's depth out toward the viewer. */
const toward = (x: number, y: number, k: number) => [VP.x + (x - VP.x) * k, VP.y + (y - VP.y) * k] as const;

export default function RoomScene({ hot, owned }: { hot: Station | null; owned: ReadonlySet<string> }) {
  const g = (station: Station) => `${styles.station} ${hot === station ? styles.stationHot : ""}`;

  return (
    <svg
      className={styles.scene}
      viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
      role="img"
      aria-label="A game room: two arcade cabinets and a desk with a computer against the back wall, a corkboard of puzzles, a prize wall on the left, a poker table in front, and a slot machine on the right."
    >
      <defs>
        <clipPath id="room-floor">
          <polygon points="440,640 1160,640 1600,933 1600,1000 0,1000 0,933" />
        </clipPath>
        <radialGradient id="room-lamp" cx="50%" cy="0%" r="80%">
          <stop offset="0%" stopColor="var(--room-brass)" stopOpacity="0.16" />
          <stop offset="100%" stopColor="var(--room-brass)" stopOpacity="0" />
        </radialGradient>
      </defs>

      <Shell />
      {owned.has("disco-ball") && <DiscoBall />}
      {owned.has("neon-sign") && <NeonSign />}

      {/* --- back wall --------------------------------------------------- */}
      <g className={g("logic")}>
        <Corkboard />
      </g>
      <g className={g("arcade")}>
        <ArcadeCabinet x={466} y={338} body="cabA" marquee="TETRIS" screen="blocks" />
        <ArcadeCabinet x={612} y={338} body="cabB" marquee="ARCADE" screen="snake" />
      </g>
      {owned.has("aquarium") && <Aquarium />}
      <g className={g("sims")}>
        <Desk lamp={owned.has("lava-lamp")} />
      </g>

      {/* --- left wall ---------------------------------------------------- */}
      <g className={g("prizes")}>
        <PrizeWall />
      </g>

      {/* --- right wall / front of room ----------------------------------- */}
      {owned.has("jukebox") && <Jukebox />}
      {owned.has("rug") && <ellipse className={styles.rug} cx="330" cy="890" rx="320" ry="88" />}
      <g className={g("cards")}>
        <PokerTable />
      </g>
      <g className={g("casino")}>
        <SlotMachine />
      </g>
    </svg>
  );
}

// --- the room itself ---------------------------------------------------------

function Shell() {
  // Floorboards: evenly spaced where they meet the back wall, fanned out
  // toward the viewer through the vanishing point.
  const boards: string[] = [];
  for (let x = 400; x <= 1200; x += 55) {
    const [fx, fy] = toward(x, 640, 2.5);
    boards.push(sketch(x, 640, fx, fy, 0));
  }
  // Cross-seams get further apart as they come forward (1/z spacing).
  const seams: string[] = [];
  for (const k of [1.18, 1.45, 1.85, 2.45]) {
    const [lx, ly] = toward(440, 640, k);
    const [rx] = toward(1160, 640, k);
    seams.push(`M${lx} ${ly} L${rx} ${ly}`);
  }

  return (
    <g>
      <polygon className={styles.ceiling} points="174,0 1426,0 1160,170 440,170" />
      <polygon className={styles.sideWall} points="0,0 174,0 440,170 440,640 0,933" />
      <polygon className={styles.sideWall} points="1600,0 1426,0 1160,170 1160,640 1600,933" />
      <rect className={styles.backWall} x="440" y="170" width="720" height="470" />
      <rect className={styles.lampWash} x="440" y="170" width="720" height="470" />
      <polygon className={styles.floor} points="440,640 1160,640 1600,933 1600,1000 0,1000 0,933" />
      <g clipPath="url(#room-floor)" className={styles.boards}>
        {boards.map((d, i) => <path key={i} d={d} />)}
        {seams.map((d, i) => <path key={`s${i}`} d={d} />)}
      </g>
      {/* baseboard */}
      <path className={styles.trim} d="M440 628 L1160 628" />
      {/* the room's edges, drawn in ink like the sketch */}
      <g className={styles.edges}>
        <path d={sketch(440, 170, 1160, 170, 3)} />
        <path d={sketch(440, 170, 440, 640, -2)} />
        <path d={sketch(1160, 170, 1160, 640, 2)} />
        <path d={sketch(440, 640, 1160, 640, 2)} />
        <path d={sketch(174, 0, 440, 170, 5)} />
        <path d={sketch(1426, 0, 1160, 170, -5)} />
        <path d={sketch(0, 933, 440, 640, -6)} />
        <path d={sketch(1600, 933, 1160, 640, 6)} />
      </g>
    </g>
  );
}

// --- arcade cabinets ------------------------------------------------------------

function ArcadeCabinet({
  x, y, body, marquee, screen,
}: {
  x: number; y: number; body: "cabA" | "cabB"; marquee: string; screen: "blocks" | "snake";
}) {
  const b = styles[body];
  return (
    <g transform={`translate(${x} ${y})`}>
      {/* right side panel (left of the vanishing point, so we see this side) */}
      <polygon className={styles.shade} points="124,4 140,-2 140,296 124,302" />
      {/* marquee */}
      <rect className={b} x="0" y="0" width="124" height="44" rx="3" />
      <rect className={styles.marquee} x="8" y="8" width="108" height="28" rx="2" />
      <text className={styles.marqueeText} x="62" y="29" textAnchor="middle">{marquee}</text>
      {/* screen */}
      <rect className={b} x="0" y="44" width="124" height="108" />
      <rect className={styles.bezel} x="10" y="52" width="104" height="90" rx="4" />
      <rect className={styles.screen} x="18" y="60" width="88" height="74" rx="6" />
      {screen === "blocks" ? (
        <g className={styles.screenArt}>
          <g className={styles.fallingPiece}>
            <rect x="52" y="64" width="9" height="9" /><rect x="61" y="64" width="9" height="9" />
            <rect x="61" y="73" width="9" height="9" /><rect x="70" y="73" width="9" height="9" />
          </g>
          <rect x="25" y="116" width="9" height="9" /><rect x="34" y="116" width="9" height="9" />
          <rect x="43" y="116" width="9" height="9" /><rect x="70" y="116" width="9" height="9" />
          <rect x="79" y="116" width="9" height="9" /><rect x="88" y="116" width="9" height="9" />
          <rect x="34" y="107" width="9" height="9" /><rect x="88" y="107" width="9" height="9" />
        </g>
      ) : (
        <g className={styles.screenArt}>
          <path className={styles.snakeTrail} d="M28 120 H60 V92 H84 V76" />
          <circle className={styles.snakeFood} cx="90" cy="112" r="3.5" />
        </g>
      )}
      {/* control panel */}
      <polygon className={b} points="-6,152 130,152 136,182 -12,182" />
      <path className={styles.stick} d="M34 166 V150" />
      <circle className={styles.knobRed} cx="34" cy="148" r="6" />
      <circle className={styles.btnA} cx="74" cy="166" r="5" />
      <circle className={styles.btnB} cx="90" cy="162" r="5" />
      <circle className={styles.btnA} cx="104" cy="168" r="5" />
      {/* lower body + coin door */}
      <rect className={b} x="0" y="182" width="124" height="120" />
      <rect className={styles.coinDoor} x="44" y="212" width="36" height="46" rx="2" />
      <rect className={styles.coinSlot} x="52" y="222" width="6" height="12" />
      <rect className={styles.coinSlot} x="66" y="222" width="6" height="12" />
    </g>
  );
}

// --- desk, computer, chair ---------------------------------------------------------

function Desk({ lamp }: { lamp: boolean }) {
  return (
    <g>
      {/* legs + tower behind the top */}
      <rect className={styles.steel} x="838" y="524" width="10" height="116" />
      <rect className={styles.steel} x="1024" y="524" width="10" height="116" />
      <rect className={styles.tower} x="980" y="560" width="38" height="80" rx="3" />
      <circle className={styles.ledGlow} cx="999" cy="574" r="2.5" />
      {/* desktop, receding toward the wall */}
      <polygon className={styles.woodDark} points="826,526 1046,526 1036,504 836,504" />
      <rect className={styles.woodDark} x="826" y="526" width="220" height="8" />
      {/* monitor */}
      <rect className={styles.steel} x="928" y="486" width="14" height="20" />
      <rect className={styles.steel} x="912" y="502" width="46" height="5" rx="2" />
      <rect className={styles.bezel} x="878" y="414" width="114" height="74" rx="4" />
      <rect className={styles.screen} x="884" y="420" width="102" height="62" rx="2" />
      <g className={styles.codeLines}>
        <path d="M892 432 H930" /><path d="M898 442 H952" /><path d="M898 452 H940" />
        <path d="M892 462 H920" /><path d="M898 472 H966" />
      </g>
      {/* keyboard */}
      <polygon className={styles.metal} points="900,520 978,520 974,512 904,512" />
      {/* a plant, because the lab has plants */}
      <path className={styles.leaf} d="M1022 494 C1010 470 1016 458 1024 452 C1030 462 1030 478 1022 494Z" />
      <path className={styles.leaf} d="M1022 494 C1036 476 1046 474 1054 478 C1048 490 1036 496 1022 494Z" />
      <path className={styles.leaf} d="M1020 494 C1002 484 996 476 996 468 C1008 468 1018 478 1020 494Z" />
      <polygon className={styles.pot} points="1010,494 1034,494 1030,510 1014,510" />
      {lamp && <LavaLamp />}
      {/* office chair, back to us */}
      <path className={styles.steel} d="M932 598 V628" />
      <path className={styles.steel} d="M900 648 L932 630 L964 648 M932 630 L932 652 M910 638 L954 638" />
      <circle className={styles.caster} cx="900" cy="650" r="5" />
      <circle className={styles.caster} cx="964" cy="650" r="5" />
      <circle className={styles.caster} cx="932" cy="654" r="5" />
      <ellipse className={styles.chairSeat} cx="932" cy="592" rx="46" ry="12" />
      <path className={styles.chairBack} d="M900 586 C894 548 898 506 932 498 C966 506 970 548 964 586 Z" />
      <path className={styles.chairMesh} d="M910 560 C920 552 944 552 954 560 M906 540 C918 530 946 530 958 540 M912 520 C922 512 942 512 952 520" />
    </g>
  );
}

function LavaLamp() {
  return (
    <g>
      <polygon className={styles.steel} points="852,504 872,504 868,490 856,490" />
      <path className={styles.lavaGlass} d="M856 490 L850 462 C850 452 874 452 874 462 L868 490 Z" />
      <ellipse className={`${styles.lavaBlob} ${styles.lavaA}`} cx="861" cy="478" rx="5" ry="6" />
      <ellipse className={`${styles.lavaBlob} ${styles.lavaB}`} cx="864" cy="464" rx="3.5" ry="4" />
      <polygon className={styles.steel} points="852,456 872,456 868,448 856,448" />
    </g>
  );
}

// --- corkboard of logic puzzles -------------------------------------------------------

function Corkboard() {
  return (
    <g>
      <rect className={styles.wood} x="846" y="244" width="190" height="144" rx="4" />
      <rect className={styles.cork} x="856" y="254" width="170" height="124" />
      {/* a sudoku */}
      <g transform="rotate(-4 890 300)">
        <rect className={styles.paper} x="866" y="266" width="50" height="50" />
        <path className={styles.gridLine} d="M882.7 268 V314 M899.3 268 V314 M868 282.7 H914 M868 299.3 H914" />
        <text className={styles.tinyInk} x="872" y="279">5</text>
        <text className={styles.tinyInk} x="905" y="312">3</text>
        <circle className={styles.pin} cx="891" cy="268" r="3.5" />
      </g>
      {/* a minesweeper corner */}
      <g transform="rotate(3 950 300)">
        <rect className={styles.paper} x="928" y="272" width="44" height="40" />
        <rect className={styles.paperDeep} x="932" y="276" width="12" height="12" />
        <rect className={styles.paperDeep} x="946" y="276" width="12" height="12" />
        <path className={styles.flag} d="M951 300 V290 L960 294 L951 298" />
        <text className={styles.tinyInk} x="934" y="310">2</text>
        <circle className={styles.pin} cx="950" cy="274" r="3.5" />
      </g>
      {/* a posterior, hand-drawn */}
      <g transform="rotate(-2 1000 330)">
        <rect className={styles.paper} x="982" y="300" width="36" height="58" />
        <path className={styles.curve} d="M985 348 C993 348 995 310 1000 310 C1005 310 1007 348 1015 348" />
        <circle className={styles.pin} cx="1000" cy="302" r="3.5" />
      </g>
      {/* a golf flag on a contour map */}
      <g transform="rotate(5 900 350)">
        <rect className={styles.paper} x="872" y="326" width="58" height="40" />
        <ellipse className={styles.contour} cx="901" cy="346" rx="22" ry="13" />
        <ellipse className={styles.contour} cx="901" cy="346" rx="12" ry="6" />
        <path className={styles.flag} d="M901 346 V332 L910 336 L901 340" />
        <circle className={styles.pin} cx="901" cy="328" r="3.5" />
      </g>
      <text className={styles.hand} x="944" y="364" transform="rotate(-3 944 364)">think!</text>
    </g>
  );
}

// --- prize wall (on the left wall, in perspective) ----------------------------------------

function PrizeWall() {
  // Far edge on the wall at x=404, near edge at x=164. Both edges are the same
  // real height, so the near one is scaled by its distance from the VP.
  const k = (VP.x - 164) / (VP.x - 404);
  const far = { x: 404, top: 300, bottom: 566 };
  const near = { x: 164, top: VP.y + (far.top - VP.y) * k, bottom: VP.y + (far.bottom - VP.y) * k };
  const at = (u: number, v: number) => {
    // u: 0 = near edge … 1 = far edge (linear in 1/z is overkill at this size)
    const x = near.x + (far.x - near.x) * u;
    const top = near.top + (far.top - near.top) * u;
    const bottom = near.bottom + (far.bottom - near.bottom) * u;
    return [x, top + (bottom - top) * v] as const;
  };
  const quad = (u0: number, v0: number, u1: number, v1: number) =>
    [at(u0, v0), at(u1, v0), at(u1, v1), at(u0, v1)].map((p) => p.join(",")).join(" ");
  const shelves = [0.34, 0.64, 0.94];
  // The sign's lettering follows the wall's slope at the sign's height.
  const [sx0, sy0] = at(0, 0.1);
  const [sx1, sy1] = at(1, 0.1);
  const signAngle = Math.atan2(sy1 - sy0, sx1 - sx0) * (180 / Math.PI);

  // Prizes sit upright on each shelf; size falls off with depth.
  const items: { u: number; shelf: number; kind: "duck" | "capsule" | "bear" | "rock" | "star" }[] = [
    { u: 0.15, shelf: 0, kind: "bear" }, { u: 0.5, shelf: 0, kind: "duck" }, { u: 0.8, shelf: 0, kind: "capsule" },
    { u: 0.2, shelf: 1, kind: "capsule" }, { u: 0.45, shelf: 1, kind: "rock" }, { u: 0.75, shelf: 1, kind: "star" },
    { u: 0.12, shelf: 2, kind: "duck" }, { u: 0.42, shelf: 2, kind: "capsule" }, { u: 0.7, shelf: 2, kind: "bear" },
  ];

  return (
    <g>
      <polygon className={styles.pegboard} points={quad(0, 0, 1, 1)} />
      {/* sign */}
      <polygon className={styles.prizeSign} points={quad(0.08, 0.02, 0.92, 0.17)} />
      <text
        className={styles.prizeSignText}
        x={at(0.5, 0.13)[0]}
        y={at(0.5, 0.13)[1]}
        textAnchor="middle"
        transform={`rotate(${signAngle.toFixed(1)} ${at(0.5, 0.13).join(" ")})`}
      >
        PRIZES
      </text>
      {shelves.map((v, i) => (
        <polygon key={i} className={styles.woodDark} points={quad(0, v, 1, v + 0.025)} />
      ))}
      {items.map((it, i) => {
        const [x, y] = at(it.u, shelves[it.shelf]);
        const s = 1.25 - it.u * 0.45;
        return <PrizeItem key={i} x={x} y={y} s={s} kind={it.kind} />;
      })}
      {/* the counter's edge */}
      <polygon className={styles.wood} points={quad(-0.02, 0.97, 1.02, 1.03)} />
    </g>
  );
}

function PrizeItem({ x, y, s, kind }: { x: number; y: number; s: number; kind: "duck" | "capsule" | "bear" | "rock" | "star" }) {
  const t = `translate(${x.toFixed(1)} ${y.toFixed(1)}) scale(${s.toFixed(3)})`;
  switch (kind) {
    case "duck":
      return (
        <g transform={t}>
          <ellipse className={styles.duck} cx="0" cy="-9" rx="12" ry="8" />
          <circle className={styles.duck} cx="7" cy="-20" r="6" />
          <path className={styles.beak} d="M12 -20 L18 -18 L12 -16 Z" />
        </g>
      );
    case "capsule":
      return (
        <g transform={t}>
          <path className={styles.capTop} d="M-10 -12 A10 10 0 0 1 10 -12 Z" />
          <path className={styles.capBottom} d="M-10 -12 A10 10 0 0 0 10 -12 Z" />
        </g>
      );
    case "bear":
      return (
        <g transform={t}>
          <circle className={styles.plush} cx="-7" cy="-30" r="4" />
          <circle className={styles.plush} cx="7" cy="-30" r="4" />
          <circle className={styles.plush} cx="0" cy="-24" r="8" />
          <ellipse className={styles.plush} cx="0" cy="-8" rx="10" ry="9" />
        </g>
      );
    case "rock":
      return (
        <g transform={t}>
          <path className={styles.rock} d="M-10 0 C-12 -8 -4 -14 2 -13 C9 -12 12 -6 10 0 Z" />
          <circle className={styles.tinyDot} cx="-2" cy="-7" r="1.2" />
          <circle className={styles.tinyDot} cx="4" cy="-7" r="1.2" />
        </g>
      );
    case "star":
      return (
        <g transform={t}>
          <path className={styles.brass} d="M0 -26 L4 -16 L14 -15 L6 -8 L9 2 L0 -4 L-9 2 L-6 -8 L-14 -15 L-4 -16 Z" />
        </g>
      );
  }
}

// --- poker table + chair ---------------------------------------------------------------

function PokerTable() {
  const chips: [number, number, string, number][] = [
    [190, 790, "chipRed", 3], [255, 804, "chipBlue", 2], [430, 800, "chipRed", 4],
    [490, 784, "chipBrass", 2], [330, 768, "chipBlue", 3],
  ];
  return (
    <g>
      {/* swivel chair, tucked beside the table */}
      <ellipse className={styles.shadow} cx="610" cy="912" rx="58" ry="12" />
      <ellipse className={styles.chairBase} cx="610" cy="906" rx="44" ry="11" />
      <path className={styles.steel} d="M610 904 V842" />
      <path className={styles.chairShell} d="M548 802 C540 752 566 724 610 722 C654 724 680 752 672 802 C650 816 570 816 548 802 Z" />
      <ellipse className={styles.chairCushion} cx="610" cy="826" rx="64" ry="18" />

      {/* pedestal: slatted, like the one in the sketch */}
      <ellipse className={styles.shadow} cx="330" cy="962" rx="150" ry="22" />
      <ellipse className={styles.woodDark} cx="330" cy="952" rx="116" ry="20" />
      <path className={styles.woodDark} d="M258 826 L258 944 Q330 962 402 944 L402 826 Z" />
      <g className={styles.slats}>
        {Array.from({ length: 12 }, (_, i) => 266 + i * 11.5).map((x, i) => (
          <path key={i} d={`M${x} 834 V${942 + Math.sin((i / 11) * Math.PI) * 8}`} />
        ))}
      </g>
      {/* top */}
      <ellipse className={styles.woodDark} cx="330" cy="800" rx="282" ry="64" />
      <ellipse className={styles.rail} cx="330" cy="792" rx="282" ry="62" />
      <ellipse className={styles.felt} cx="330" cy="790" rx="236" ry="46" />
      <ellipse className={styles.feltLine} cx="330" cy="790" rx="160" ry="28" />
      {/* cards + chips */}
      <g transform="rotate(-8 300 786)">
        <rect className={styles.card} x="286" y="776" width="20" height="14" rx="2" />
      </g>
      <g transform="rotate(10 330 790)">
        <rect className={styles.card} x="316" y="782" width="20" height="14" rx="2" />
        <path className={styles.cardPip} d="M326 786 l3 3 -3 3 -3 -3 Z" />
      </g>
      {chips.map(([x, y, cls, n], i) => (
        <g key={i}>
          {Array.from({ length: n }, (_, j) => (
            <ellipse key={j} className={styles[cls]} cx={x} cy={y - j * 4} rx="10" ry="4" />
          ))}
        </g>
      ))}
    </g>
  );
}

// --- slot machine ------------------------------------------------------------------------

function SlotMachine() {
  const coins: [number, number][] = [
    [1236, 948], [1256, 958], [1276, 950], [1224, 962], [1300, 962], [1262, 972], [1318, 946],
  ];
  return (
    <g>
      <ellipse className={styles.shadow} cx="1380" cy="944" rx="150" ry="20" />
      <g transform="translate(1276 470)">
        {/* left side panel (right of the VP, so we see this side) */}
        <polygon className={styles.shade} points="-22,76 0,68 0,466 -22,456" />
        {/* dome + beacon */}
        <circle className={`${styles.beacon}`} cx="100" cy="-10" r="12" />
        <path className={styles.slotBody} d="M0 76 Q0 0 100 0 Q200 0 200 76 Z" />
        <path className={styles.slotSign} d="M18 70 Q20 16 100 16 Q180 16 182 70 Z" />
        <text className={styles.slotSignText} x="100" y="46" textAnchor="middle">LUCK O&apos; THE</text>
        <text className={styles.slotSignBig} x="100" y="66" textAnchor="middle">LAB</text>
        {/* cabinet */}
        <rect className={styles.slotBody} x="0" y="70" width="200" height="396" rx="6" />
        <rect className={styles.chrome} x="16" y="92" width="168" height="112" rx="6" />
        {[0, 1, 2].map((i) => (
          <g key={i}>
            <rect className={styles.reel} x={26 + i * 52} y="102" width="44" height="92" rx="3" />
            <text className={styles.reelSym} x={48 + i * 52} y="132" textAnchor="middle">{["7", "Zn", "7"][i]}</text>
            <text className={styles.reelSymBig} x={48 + i * 52} y="160" textAnchor="middle">{["Zn", "Zn", "Zn"][i]}</text>
            <text className={styles.reelSym} x={48 + i * 52} y="186" textAnchor="middle">{["🍒", "🔔", "🍀"][i]}</text>
          </g>
        ))}
        <path className={styles.payline} d="M20 150 H180" />
        <rect className={styles.paytable} x="16" y="214" width="168" height="46" rx="3" />
        <text className={styles.payText} x="100" y="234" textAnchor="middle">Zn Zn Zn · 250×</text>
        <text className={styles.payText} x="100" y="252" textAnchor="middle">7 7 7 · 100×</text>
        <rect className={styles.chrome} x="16" y="270" width="168" height="26" rx="3" />
        <circle className={styles.knobRed} cx="46" cy="283" r="7" />
        <circle className={styles.btnB} cx="74" cy="283" r="7" />
        <rect className={styles.coinSlot} x="140" y="276" width="8" height="16" />
        {/* belly glass */}
        <rect className={styles.slotBelly} x="16" y="306" width="168" height="104" rx="4" />
        <text className={styles.bellyZn} x="100" y="376" textAnchor="middle">Zn</text>
        <text className={styles.bellyNum} x="152" y="330" textAnchor="middle">30</text>
        <path className={styles.clover} d="M52 372 c-10 -12 4 -22 10 -10 c6 -12 20 -2 10 10 c12 6 2 20 -10 10 c-6 12 -20 2 -10 -10 Z M62 372 q4 14 -2 22" />
        {/* coin tray */}
        <rect className={styles.tray} x="40" y="420" width="120" height="30" rx="4" />
        <ellipse className={styles.brass} cx="80" cy="440" rx="9" ry="3.5" />
        <ellipse className={styles.brass} cx="96" cy="443" rx="9" ry="3.5" />
        {/* lever */}
        <rect className={styles.chrome} x="200" y="196" width="18" height="52" rx="4" />
        <path className={styles.leverArm} d="M210 222 L232 110" />
        <circle className={styles.knobRed} cx="233" cy="102" r="13" />
      </g>
      {/* coins spilled on the floor */}
      {coins.map(([x, y], i) => (
        <ellipse key={i} className={styles.brass} cx={x} cy={y} rx="12" ry="5" />
      ))}
      {[0, 1, 2, 3, 4].map((j) => (
        <ellipse key={`st${j}`} className={styles.brass} cx="1204" cy={944 - j * 5} rx="13" ry="5" />
      ))}
    </g>
  );
}

// --- decor you can buy -------------------------------------------------------------------

function NeonSign() {
  return (
    <g className={styles.neon}>
      <text className={styles.neonText} x="606" y="250" textAnchor="middle">Besley&apos;s</text>
      <path className={styles.neonTube} d="M520 268 H692" />
    </g>
  );
}

function DiscoBall() {
  return (
    <g>
      <path className={styles.string} d="M800 0 V48" />
      <g className={styles.disco}>
        <circle className={styles.discoBall} cx="800" cy="84" r="36" />
        <path className={styles.discoGrid} d="M764 84 H836 M770 64 H830 M770 104 H830 M800 48 V120 M782 52 Q772 84 782 116 M818 52 Q828 84 818 116" />
      </g>
      <g className={styles.sparkles}>
        <path d="M700 150 l4 -12 4 12 -12 -4 12 -4 Z" />
        <path d="M912 124 l3 -9 3 9 -9 -3 9 -3 Z" />
        <path d="M640 300 l3 -9 3 9 -9 -3 9 -3 Z" />
        <path d="M1010 230 l4 -12 4 12 -12 -4 12 -4 Z" />
      </g>
    </g>
  );
}

function Aquarium() {
  return (
    <g>
      <rect className={styles.woodDark} x="1062" y="566" width="80" height="74" />
      <rect className={styles.glassTank} x="1054" y="490" width="96" height="76" rx="3" />
      <path className={styles.water} d="M1056 504 Q1080 500 1102 504 T1148 504" />
      <path className={styles.weed} d="M1064 564 C1060 548 1070 540 1066 526 M1072 564 C1076 550 1070 540 1076 530" />
      {/* a bladderfish and a peeper, as promised */}
      <g className={styles.fishA}>
        <ellipse className={styles.bladderfish} cx="1098" cy="530" rx="12" ry="9" />
        <path className={styles.bladderfish} d="M1086 530 L1078 524 L1078 536 Z" />
        <circle className={styles.tinyDot} cx="1104" cy="528" r="1.6" />
      </g>
      <g className={styles.fishB}>
        <ellipse className={styles.peeper} cx="1124" cy="550" rx="9" ry="5" />
        <path className={styles.peeper} d="M1133 550 L1140 545 L1140 555 Z" />
        <circle className={styles.peeperEye} cx="1119" cy="549" r="2.4" />
      </g>
    </g>
  );
}

function Jukebox() {
  return (
    <g>
      <ellipse className={styles.shadow} cx="1212" cy="694" rx="52" ry="10" />
      <path className={styles.jukebox} d="M1170 690 V560 Q1170 486 1212 486 Q1254 486 1254 560 V690 Z" />
      <path className={styles.jukeArch} d="M1182 600 V562 Q1182 504 1212 504 Q1242 504 1242 562 V600 Z" />
      <path className={styles.jukeLights} d="M1176 690 V562 Q1176 494 1212 494 Q1248 494 1248 562 V690" />
      <rect className={styles.chrome} x="1184" y="612" width="56" height="18" rx="3" />
      <path className={styles.grille} d="M1186 642 H1238 M1186 652 H1238 M1186 662 H1238 M1186 672 H1238" />
      <g className={styles.notes}>
        <text x="1262" y="520">♪</text>
        <text x="1150" y="500">♫</text>
      </g>
    </g>
  );
}
