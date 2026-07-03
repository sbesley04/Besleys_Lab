"""
Arena Simulation Engine
=======================
A turn-based Hunger Games simulation. Each turn = 4 in-game hours.
Player STATS drive their own actions. THREAT RATING (overall) drives how
others treat them. Output is a list of JSON-serializable snapshots, one per
turn, each with player positions/health and per-player dialogue.

Run:  python3 arena_sim.py            (uses default seed, prints narrative)
      python3 arena_sim.py 12345      (custom seed)
"""

import json
import math
import random
import sys
import textwrap

# ---------------------------------------------------------------------------
# CONFIG
# ---------------------------------------------------------------------------

GRID        = 128
TURN_HOURS  = 4
CORNUCOPIA  = (GRID // 2, GRID // 2)

WEIGHTS = {
    "fight": 0.22, "kill": 0.20, "survival": 0.18,
    "sponsor": 0.16, "advantages": 0.13, "judge": 0.11,
}

ALLY_THRESHOLD       = 55
DISTRICT_BOND        = 40
CAREER_BOND          = 20
KINDRED_AGGRESSOR    = 30
PROXIMITY            = 3
REFUGE_PER_TURN      = 3

BETRAYAL_BASE          = 0.04
BETRAYAL_AGGRESSOR_BASE = 0.30
BETRAYAL_THINNING      = 0.55

HAZARD_BASE_CHANCE = 0.05
HAZARD_MAX_CHANCE  = 0.85

RING_START_TURN  = 5
RING_MIN_RADIUS  = 3
RING_DAMAGE      = 18
RING_SHRINK_RATE = 2   # cells per turn; keeps endgame timing sane at 128×128

CAREER_DISTRICTS = {1, 2, 4}

# ---------------------------------------------------------------------------
# GAME-PARAMETER TABLES  (seed-derived per-run configuration)
# ---------------------------------------------------------------------------

# (key, damage_per_turn_outside, short_description)
BORDER_DISASTERS = [
    ("lava",         27, "A wall of magma advances from the arena's edge"),
    ("insect_swarm", 16, "A mutt insect swarm churns inward across the boundary"),
    ("toxic_gas",    21, "Capitol toxic gas rolls in from the perimeter"),
    ("fire_curtain", 24, "A Gamemaker fire wall pushes the boundary"),
    ("acid_storm",   18, "Acid rain sheets down on the outer arena"),
    ("glacier",      14, "Sheets of glacial ice lock the perimeter shut"),
    ("floodwall",    23, "Engineered floodwaters surge from the arena's edge"),
    ("sonic_wave",   13, "A subsonic pressure wave herds tributes inward"),
]

WEATHER_PROFILES = {
    "arid":      [("clear",0.45),("heat_wave",0.20),("sandstorm",0.20),("dry_lightning",0.15)],
    "temperate": [("clear",0.45),("fog",0.22),("rain",0.23),("storm",0.10)],
    "tropical":  [("clear",0.25),("rain",0.35),("storm",0.25),("fog",0.15)],
    "arctic":    [("clear",0.40),("blizzard",0.30),("fog",0.18),("freezing_mist",0.12)],
}

# (night_start_hour, day_start_hour)  — both within a 24h day
NIGHT_SPANS = {
    "short":    (22, 4),
    "normal":   (20, 6),
    "long":     (18, 8),
    "blackout": (17, 10),
}


class GameParams:
    """Seed-derived arena configuration: border disaster, night, weather."""
    def __init__(self, rng):
        bd = rng.choice(BORDER_DISASTERS)
        self.border_disaster    = bd[0]
        self.border_damage      = bd[1]
        self.border_description = bd[2]
        self.border_shape = rng.choice(
            ["square", "square", "square", "circle", "circle", "north_south"])
        self.ring_start  = rng.randint(4, 10)
        self.ring_rate   = rng.choice([1, 1, 2, 2, 2, 3])
        self.night_type  = rng.choice(
            ["none", "none", "short", "normal", "normal", "long", "blackout"])
        self.weather_region = rng.choice(
            ["arid", "temperate", "temperate", "tropical", "arctic"])


# ---------------------------------------------------------------------------
# REGIONS
# ---------------------------------------------------------------------------

REGIONS = {
    "plains":     {"move": 1.5, "hide": 0.6, "cache": 0.8,  "encounter": 1.4},
    "forest":     {"move": 0.7, "hide": 1.5, "cache": 1.0,  "encounter": 0.8},
    "mountain":   {"move": 0.5, "hide": 1.2, "cache": 1.5,  "encounter": 0.7},
    "water":      {"move": 0.6, "hide": 0.9, "cache": 1.1,  "encounter": 0.9},
    "cornucopia": {"move": 1.0, "hide": 0.3, "cache": 3.0,  "encounter": 2.5},
    "swamp":      {"move": 0.45,"hide": 1.4, "cache": 0.9,  "encounter": 0.7},
    "hills":      {"move": 0.8, "hide": 0.9, "cache": 1.2,  "encounter": 1.1},
    "desert":     {"move": 1.3, "hide": 0.4, "cache": 0.6,  "encounter": 1.5},
    "ruins":      {"move": 0.7, "hide": 1.4, "cache": 2.0,  "encounter": 0.6},
    "toxic_bog":  {"move": 0.35,"hide": 1.5, "cache": 0.7,  "encounter": 0.5},
}

REGION_FLAVOUR = {
    "plains":     ["the open plains", "the sun-bleached grassland", "the wide meadows",
                   "the scrubland", "the exposed flats"],
    "forest":     ["the forest", "the dense treeline", "the dark undergrowth",
                   "the thicket", "the canopy shadows", "the woodland"],
    "mountain":   ["the mountain", "the rocky slopes", "the high ridgeline",
                   "the boulder field", "the switchback paths", "the cliffs"],
    "water":      ["the lake shore", "the river bend", "the stream bank",
                   "the flooded channel", "the still water"],
    "cornucopia": ["the Cornucopia", "the golden horn", "the centre of the arena",
                   "the bloodstained mouth of the horn"],
    "swamp":      ["the swamp", "the bog", "the murky wetlands", "the marsh",
                   "the stagnant water", "the mire", "the reed-choked bog"],
    "hills":      ["the hills", "the rolling hills", "the hillside",
                   "the high ground", "the grassy ridgeline", "the open slopes"],
    "desert":     ["the sand flats", "the dry wastes", "the baked earth",
                   "the scorched plain", "the dune field", "the arid expanse"],
    "ruins":      ["the ruins", "the old Capitol outpost", "the crumbled station",
                   "the rubble field", "the broken structure", "the wreckage"],
    "toxic_bog":  ["the toxic bog", "the poisoned mire", "the sulfur flats",
                   "the caustic wetlands", "the foul marsh", "the death bog",
                   "the reeking lowland", "the toxic sump"],
}

# ---------------------------------------------------------------------------
# CACHE ITEMS  (weighted pool)
# ---------------------------------------------------------------------------

CACHE_ITEMS = [
    # Tier-1 weapons (rare)
    {"type": "weapon", "fight": 3, "label": "a trident",                    "w": 1},
    {"type": "weapon", "fight": 3, "label": "a longsword",                  "w": 1},
    {"type": "weapon", "fight": 3, "label": "a compound bow with arrows",   "w": 2},
    # Tier-2 weapons
    {"type": "weapon", "fight": 2, "label": "a hunting knife",              "w": 4},
    {"type": "weapon", "fight": 2, "label": "a hand axe",                   "w": 4},
    {"type": "weapon", "fight": 2, "label": "a hidden blade",               "w": 3},
    {"type": "weapon", "fight": 2, "label": "a short sword",                "w": 2},
    {"type": "weapon", "fight": 2, "label": "a spiked mace",                "w": 2},
    # Tier-3 weapons
    {"type": "weapon", "fight": 1, "label": "a makeshift spear",            "w": 5},
    {"type": "weapon", "fight": 1, "label": "a set of throwing knives",     "w": 4},
    {"type": "weapon", "fight": 1, "label": "a crude wooden club",          "w": 4},
    {"type": "weapon", "fight": 1, "label": "a length of sharpened rebar",  "w": 3},
    {"type": "weapon", "fight": 1, "label": "a wire garrote",               "w": 2},
    # Medical
    {"type": "med",  "heal": 50, "label": "a Capitol trauma kit",           "w": 1},
    {"type": "med",  "heal": 35, "label": "a medical kit",                  "w": 3},
    {"type": "med",  "heal": 25, "label": "a field dressing and antiseptic","w": 4},
    {"type": "med",  "heal": 20, "label": "a vial of morphling",            "w": 3},
    {"type": "med",  "heal": 15, "label": "a tourniquet",                   "w": 5},
    {"type": "med",  "heal": 10, "label": "a packet of painkillers",        "w": 5},
    # Food / supplies
    {"type": "food", "heal": 20, "label": "a full backpack of supplies",    "w": 2},
    {"type": "food", "heal": 15, "label": "a supply pack",                  "w": 4},
    {"type": "food", "heal": 12, "label": "a water filtration kit",         "w": 3},
    {"type": "food", "heal":  8, "label": "dried rations and a canteen",    "w": 5},
    {"type": "food", "heal":  5, "label": "a handful of edible roots",      "w": 6},
]

_ITEM_WEIGHTS = [it["w"] for it in CACHE_ITEMS]
_ITEM_TOTAL   = sum(_ITEM_WEIGHTS)

def _draw_item(rng):
    r = rng.random() * _ITEM_TOTAL
    for item in CACHE_ITEMS:
        r -= item["w"]
        if r <= 0:
            return dict(item)
    return dict(CACHE_ITEMS[-1])

# ---------------------------------------------------------------------------
# INJURIES
# ---------------------------------------------------------------------------

INJURIES = [
    "a deep gash across the forearm",
    "cracked ribs making every breath costly",
    "a sprained ankle slowing each step",
    "burns scoring one side of the face and shoulder",
    "a shoulder wound limiting weapon reach",
    "a concussion blurring the edges of things",
    "an arrow graze along the thigh",
    "an infected cut from the first day festering now",
    "a broken finger on the dominant hand",
    "bruised kidneys from the fall",
    "a puncture wound that keeps reopening",
    "a torn muscle in the calf",
    "a deep bruise across the ribs from a thrown stone",
    "a laceration across the scalp still seeping blood",
]

# ---------------------------------------------------------------------------
# HAZARDS
# ---------------------------------------------------------------------------

HAZARD_KINDS = [
    "wall of fire",
    "flash flood",
    "toxic fog",
    "tracker-jacker swarm",
    "ground tremor",
    "Gamemaker bombardment",
    "acid rain",
    "muttation wolf pack",
    "wildfire",
    "blizzard",
    "locust swarm",
    "sinkhole collapse",
    "lightning storm",
    "Gamemaker landmine sweep",
    "venomous snake release",
    "avalanche",
    "superheated steam vents",
    "Capitol gas strike",
    "spontaneous drought crack",
    "darkness and screaming",
]

HAZARD_ESCAPE = {
    "wall of fire":           ["Outrun the flames with scorched boots.",
                               "Finds a gap in the fire wall and dives through.",
                               "Rolls through the outer edge — barely."],
    "flash flood":            ["Grabs a tree branch and holds until the surge passes.",
                               "Scrambles to high ground as the channel fills below.",
                               "Swims against the current, lungs burning, and makes it."],
    "toxic fog":              ["Ties cloth over the mouth and moves fast.",
                               "Drops to the ground — the fog runs thin near the earth.",
                               "Veers upwind and clears the grey cloud by seconds."],
    "tracker-jacker swarm":   ["Hits the water and stays under until the buzzing fades.",
                               "Runs and doesn't stop until the sound is gone.",
                               "Tears through the swarm, trailing stings."],
    "ground tremor":          ["Braces against a boulder and rides it out.",
                               "Drops flat. The earth shakes, settles, shakes again.",
                               "Runs off the fault line as cracks open underfoot."],
    "Gamemaker bombardment":  ["Reads the trajectory and sprints between impacts.",
                               "Uses a fallen tribute as cover. Survives.",
                               "Zigzags through the blasts. Ears ringing, still moving."],
    "acid rain":              ["Finds shelter under a rock shelf just in time.",
                               "Pulls a jacket over their head — it dissolves, skin doesn't.",
                               "Sprints to the treeline, the rain hissing on bare stone behind them."],
    "muttation wolf pack":    ["Climbs a tree. Waits. The mutts circle and move on.",
                               "Fights one off with bare hands, then runs.",
                               "Stumbles into a clearing — the mutts hesitate at the open ground."],
    "wildfire":               ["Cuts a firebreak in the undergrowth and waits behind it.",
                               "Follows the smoke upwind and slips through before the line closes.",
                               "The fire jumps overhead. They survive on luck and low ground."],
    "blizzard":               ["Digs a snow cave and waits out the white.",
                               "Packs into a rock crevice, body heat doing the rest.",
                               "Keeps moving, which is the only way to survive the cold."],
    "locust swarm":           ["Wraps every opening in cloth and holds still.",
                               "The swarm strips the vegetation bare but leaves skin intact.",
                               "Holds breath. The cloud passes in under a minute."],
    "sinkhole collapse":      ["Leaps clear as the ground opens beneath.",
                               "Grabs a root on the lip and hauls up before the collapse widens.",
                               "Rolls away — the hole swallows the cache they were reaching for."],
    "lightning storm":        ["Sheds all metal gear and lies flat in the open.",
                               "Finds a rubber-soled boot from a dead tribute. Insulation enough.",
                               "Counts seconds between flash and thunder. Stays ahead of the cell."],
    "Gamemaker landmine sweep":"Freezes, maps every footfall, exits the grid one slow step at a time.",
    "venomous snake release":  ["Climbs above the release zone before the snakes spread.",
                                "Moves through without agitation — fast but deliberate.",
                                "Takes a bite but the antivenin from a sponsor cache holds it."],
    "avalanche":              ["Outrides the leading edge to stable ground.",
                               "Burrows into the snow's surface — rides it down, digs out.",
                               "The snowfield carries them a hundred feet but no farther."],
    "superheated steam vents":["Reads the kill pattern and threads through.",
                               "Ties wet cloth across the face and sprints between eruptions.",
                               "Scalded but moving. Moving is what counts."],
    "Capitol gas strike":     ["Holds breath and runs upwind with burning eyes.",
                               "The gas disperses fast in the open. Fast enough.",
                               "Finds a crack in the rock face and seals it from inside."],
    "spontaneous drought crack":["The fissure opens wide but they jump the gap.",
                                  "Debris falls into the crack. They don't.",
                                  "Clings to the far lip and drags up."],
    "darkness and screaming": ["Stops moving completely. Waits. Counts. Survives.",
                               "The screaming isn't them. That's all that matters.",
                               "Closes their eyes in the dark. Stays perfectly still."],
}

def _hazard_escape_line(rng, kind):
    opts = HAZARD_ESCAPE.get(kind)
    if opts:
        return rng.choice(opts) if isinstance(opts, list) else opts
    return "Scrambles clear."

# ---------------------------------------------------------------------------
# PLAYER DATA
# ---------------------------------------------------------------------------

ROSTER = [
    # name,        district, judge, sponsor, adv, kill, fight, survival
    ("Daniela",    1,  6,  6,  7,  9,  4,  3),
    ("Kushal",     1,  7, 10,  4,  2,  6,  4),
    ("Kailash",    2, 11,  9,  6,  9,  9,  9),
    ("Bella",      3,  5,  4,  3,  5,  4,  3),
    ("Sahana",     3,  4,  4,  7, 10,  3,  2),
    ("Connor",     4,  6, 10,  8,  6,  7, 10),
    ("Hanna",      5,  5,  4,  6,  7,  7,  6),
    ("Virat",      6,  8,  2,  9,  7,  6,  4),
    ("Ananya",     7,  6,  3,  7,  7,  5,  6),
    ("Sasha",      8,  7,  7,  4,  4,  6,  6),
    ("Meadow",     9,  8,  3,  2,  3,  6,  7),
    ("Aanya",      9,  7,  9,  6,  2,  7,  7),
    ("Sam",        10,10,  6,  6,  8,  9, 10),
    ("Michelina",  11, 8,  8,  7,  1,  8, 10),
    ("Zoe",        12, 6,  1,  9, 10,  6,  5),
]


class Player:
    def __init__(self, name, district, judge, sponsor, adv, kill, fight, surv):
        self.name     = name
        self.district = district
        self.stats    = {
            "judge": judge, "sponsor": sponsor, "advantages": adv,
            "kill": kill, "fight": fight, "survival": surv,
        }
        self.overall   = self._overall()
        self.x = self.y = 0
        self.health    = 100
        self.alive     = True
        self.kills     = 0
        self.ally      = None
        self.inventory = []
        self.injuries  = []          # list of injury description strings
        self.events    = []          # (tag, data) pairs for this turn
        self.death_turn = None

    def _overall(self):
        s = self.stats
        norm = {k: s[k] / (12 if k == "judge" else 10) for k in WEIGHTS}
        return round(sum(norm[k] * WEIGHTS[k] for k in WEIGHTS) * 100, 1)

    @property
    def fight_power(self):
        bonus = sum(i.get("fight", 0) for i in self.inventory)
        return (self.stats["fight"] + bonus) * (self.health / 100)

    def _personality(self):
        k = self.stats["kill"]
        f = self.stats["fight"]
        sv = self.stats["survival"]
        if k >= 7 and f >= 7:
            return "predator"
        if self.district in CAREER_DISTRICTS and f >= 5 and k >= 5:
            return "career"
        if k <= 2 and sv >= 7:
            return "ghost"
        if sv >= 7:
            return "survivor"
        if k >= 7:
            return "hunter"
        return "default"


# ---------------------------------------------------------------------------
# ARENA
# ---------------------------------------------------------------------------

def build_arena(rng):
    """
    Three-layer noise → ten biomes, then lake/stream post-processing.

    Elevation is histogram-equalised (rank-mapped) so geographic zones —
    low basins, mid plains, high ridges — are always structurally present.
    Moisture and structure density are only min-max rescaled, so their
    distribution varies per seed: some runs are dense jungle, others open
    desert; some are ruin-heavy, others almost none. This gives each seed
    a distinct character while keeping terrain geographically coherent.
    """
    W = GRID

    def make_noise(octaves):
        buf   = [[0.0] * W for _ in range(W)]
        total = sum(w for _, w in octaves)
        for res, weight in octaves:
            pts = [[rng.random() for _ in range(res + 2)]
                   for _ in range(res + 2)]
            for gy in range(W):
                for gx in range(W):
                    fx = gx / (W - 1) * res
                    fy = gy / (W - 1) * res
                    ix, iy = int(fx), int(fy)
                    tx, ty = fx - ix, fy - iy
                    ix, iy = min(ix, res - 1), min(iy, res - 1)
                    v = (pts[iy    ][ix    ] * (1-tx) * (1-ty)
                       + pts[iy    ][ix + 1] *  tx    * (1-ty)
                       + pts[iy + 1][ix    ] * (1-tx) *  ty
                       + pts[iy + 1][ix + 1] *  tx    *  ty)
                    buf[gy][gx] += v * weight / total
        return buf

    def equalize(buf):
        """Rank-map to uniform [0,1] so e < 0.10 is always exactly 10%."""
        W2   = len(buf)
        flat = sorted((buf[y][x], y, x) for y in range(W2) for x in range(W2))
        N    = len(flat)
        out  = [[0.0] * W2 for _ in range(W2)]
        for rank, (_, y, x) in enumerate(flat):
            out[y][x] = rank / (N - 1)
        return out

    def rescale(buf):
        flat = [v for row in buf for v in row]
        lo, hi = min(flat), max(flat)
        span = hi - lo or 1.0
        return [[(v - lo) / span for v in row] for row in buf]

    # Elevation: equalised → zones always present, just shaped differently
    elev  = equalize(make_noise([(4, 0.50), (8, 0.30), (16, 0.15), (32, 0.05)]))
    # Moisture / structure: min-max only → per-seed character variation
    moist  = rescale(make_noise([(5, 0.50), (10, 0.35), (20, 0.15)]))
    struct = rescale(make_noise([(6, 0.60), (12, 0.40)]))

    # Biome lookup.
    # e thresholds are exact percentiles (equalized → uniform).
    # m/s thresholds calibrated for bell-curve rescaled noise (mean≈0.44,
    # std≈0.14). Seeds with high-moisture noise → dense forest/swamp/bog;
    # low-moisture seeds → desert-heavy. This is the intended seed variance.
    def biome_at(e, m, s):
        # ── Water basins (bottom 10 %) ─────────────────────────────────────
        if e < 0.10:
            if m > 0.54:    return "toxic_bog"   # stagnant poisoned pools
            return          "water"
        # ── Lake margins (10–22 %) ────────────────────────────────────────
        if e < 0.22:
            if m > 0.60:    return "toxic_bog"
            if m > 0.44:    return "swamp"
            return          "water"
        # ── Low wetland zone (22–34 %) ────────────────────────────────────
        if e < 0.34:
            if m > 0.64:    return "toxic_bog"
            if m > 0.52:    return "swamp"
            if m < 0.34:    return "desert"
            return          "plains"
        # ── Desert: dry belt at any mid elevation ──────────────────────────
        if m < 0.30:        return "desert"
        # ── Low-mid transition (34–46 %) ──────────────────────────────────
        if e < 0.46:
            if m > 0.60:    return "forest"
            if m > 0.48:    return "swamp"
            return          "plains"
        # ── Ruins: mid-elevation, high structure density ───────────────────
        if e < 0.68 and s > 0.72:  return "ruins"
        # ── Mid zone (46–62 %) ────────────────────────────────────────────
        if e < 0.62:    return "forest" if m > 0.50 else "plains"
        # ── Upper-mid (62–76 %) ───────────────────────────────────────────
        if e < 0.76:    return "forest" if m > 0.58 else "hills"
        # ── High ground (76–90 %) ─────────────────────────────────────────
        if e < 0.90:    return "hills"  if m > 0.44 else "mountain"
        # ── Peaks (top 10 %) ──────────────────────────────────────────────
        return "mountain"

    grid = [[biome_at(elev[y][x], moist[y][x], struct[y][x]) for x in range(W)]
            for y in range(W)]

    # ── Post-processing: lakes and streams ────────────────────────────────────
    _clean_water(grid, W)           # dissolve isolated 1-3 cell puddles
    _carve_streams(rng, grid, elev, W)  # connect lakes with 1-cell streams

    # ── Cornucopia at centre ──────────────────────────────────────────────────
    ccx, ccy = CORNUCOPIA
    for dy in (0, -1):
        for dx in (0, -1):
            grid[ccy + dy][ccx + dx] = "cornucopia"

    return grid


def _water_components(grid, W):
    """Return list of connected water-cell groups (4-connected)."""
    from collections import deque
    visited = [[False] * W for _ in range(W)]
    components = []
    for sy in range(W):
        for sx in range(W):
            if grid[sy][sx] != "water" or visited[sy][sx]:
                continue
            region = []
            q = deque([(sy, sx)])
            visited[sy][sx] = True
            while q:
                y, x = q.popleft()
                region.append((y, x))
                for dy, dx in ((-1, 0), (1, 0), (0, -1), (0, 1)):
                    ny, nx = y + dy, x + dx
                    if 0 <= ny < W and 0 <= nx < W \
                            and grid[ny][nx] == "water" and not visited[ny][nx]:
                        visited[ny][nx] = True
                        q.append((ny, nx))
            components.append(region)
    return components


def _clean_water(grid, W):
    """Convert isolated micro-puddles (≤ 3 cells) to swamp."""
    for region in _water_components(grid, W):
        if len(region) <= 3:
            for y, x in region:
                grid[y][x] = "swamp"


def _carve_streams(rng, grid, elev, W):
    """
    Find lake pairs within carving distance and cut a narrow stream between
    them, threading toward the lowest-elevation step at each move.
    """
    lakes = [r for r in _water_components(grid, W) if len(r) >= 5]
    if len(lakes) < 2:
        return

    # Centre-of-mass for each lake
    centers = [
        (sum(y for y, x in r) // len(r), sum(x for y, x in r) // len(r))
        for r in lakes
    ]

    # Build candidate pairs sorted by Chebyshev distance
    pairs = []
    for i in range(len(lakes)):
        for j in range(i + 1, len(lakes)):
            cy1, cx1 = centers[i]
            cy2, cx2 = centers[j]
            d = max(abs(cy1 - cy2), abs(cx1 - cx2))
            if 5 < d < 70:
                pairs.append((d, i, j))
    pairs.sort()

    streams_cut = 0
    used = set()
    for _, i, j in pairs:
        if streams_cut >= 14:
            break
        if i in used and j in used:
            continue
        _cut_one_stream(grid, elev, centers[i], centers[j], W)
        used.add(i); used.add(j)
        streams_cut += 1


def _cut_one_stream(grid, elev, c1, c2, W):
    """Walk from c1 toward c2, always stepping to the lowest-elevation
    reachable neighbour that also brings us closer to the target."""
    y, x = c1
    ty, tx = c2
    visited = {(y, x)}
    max_steps = max(abs(ty - y), abs(tx - x)) + 10

    for _ in range(max_steps):
        if grid[y][x] == "water":
            break                    # reached an existing water body
        if grid[y][x] not in ("cornucopia",):
            grid[y][x] = "water"

        # Candidate steps: 4-connected neighbours that move toward target
        cands = []
        for dy, dx in ((-1, 0), (1, 0), (0, -1), (0, 1)):
            ny, nx = y + dy, x + dx
            if not (0 <= ny < W and 0 <= nx < W):
                continue
            if (ny, nx) in visited:
                continue
            # Prefer steps that shorten distance to target
            old_d = abs(y - ty) + abs(x - tx)
            new_d = abs(ny - ty) + abs(nx - tx)
            if new_d <= old_d + 1:   # allow slight detours toward lower ground
                cands.append((elev[ny][nx], ny, nx))

        if not cands:
            break
        cands.sort()                 # pick lowest-elevation step
        _, y, x = cands[0]
        visited.add((y, x))


def region_at(arena, x, y):
    return arena[max(0, min(GRID - 1, y))][max(0, min(GRID - 1, x))]


def _region_name(rng, biome):
    return rng.choice(REGION_FLAVOUR.get(biome, [biome]))


# ---------------------------------------------------------------------------
# AFFINITY
# ---------------------------------------------------------------------------

def affinity(a, b, turn):
    score = 0.0

    # Bloodbath urgency: the first cannons make everyone want a partner.
    # Fades fast — by turn 3 it's gone.
    if turn == 1:   score += 18
    elif turn == 2: score += 10
    elif turn == 3: score +=  5

    if a.district == b.district:
        score += DISTRICT_BOND
    if a.district in CAREER_DISTRICTS and b.district in CAREER_DISTRICTS \
            and a.district != b.district:
        score += CAREER_BOND
    score += (10 - b.stats["kill"]) / 9 * 25
    aggressor_pact = a.stats["kill"] >= 7 and b.stats["kill"] >= 7
    if aggressor_pact:
        score += KINDRED_AGGRESSOR
    if b.overall > a.overall:
        score += min(30, (b.overall - a.overall) * 0.8)
    comp = 0
    if a.stats["fight"] <= 4 and b.stats["fight"] >= 7:
        comp += 12
    if a.stats["survival"] <= 4 and b.stats["survival"] >= 7:
        comp += 12
    score += comp
    if a.ally is None and a.overall < 60:
        score += min(20, REFUGE_PER_TURN * turn)
    return min(100, score), aggressor_pact


# ---------------------------------------------------------------------------
# SIMULATION
# ---------------------------------------------------------------------------

class Sim:
    def __init__(self, seed=42):
        self.rng       = random.Random(seed)
        self.seed      = seed
        self.params    = GameParams(self.rng)
        self.arena     = build_arena(self.rng)
        self.players   = [Player(*r) for r in ROSTER]
        self.alliances = {}
        self._ally_counter = 0
        self.turn      = 0
        self.weather   = {"type": "clear", "intensity": 0.0}
        self.snapshots = []
        self._spawn()

    # ── environment ────────────────────────────────────────────────────────────

    def _is_night(self):
        if self.params.night_type == "none":
            return False
        hour = (self.turn * TURN_HOURS) % 24
        ns, ds = NIGHT_SPANS[self.params.night_type]
        if ns > ds:   # spans midnight
            return hour >= ns or hour < ds
        return ns <= hour < ds

    def _roll_weather(self):
        profile = WEATHER_PROFILES[self.params.weather_region]
        r = self.rng.random()
        cum = 0.0
        for wtype, prob in profile:
            cum += prob
            if r < cum:
                return {"type": wtype, "intensity": round(self.rng.uniform(0.4, 1.0), 2)}
        return {"type": "clear", "intensity": 0.0}

    def _advance_weather(self):
        """30 % chance to shift weather each turn; otherwise it persists."""
        if self.turn <= 1 or self.rng.random() < 0.30:
            self.weather = self._roll_weather()

    def _env_modifiers(self):
        """Return encounter / move / cache / ally multipliers for this turn."""
        e = m = c = a = 1.0

        if self._is_night():
            nt = self.params.night_type
            if nt == "short":
                e *= 0.70; m *= 0.88; c *= 0.80
            elif nt == "normal":
                e *= 0.58; m *= 0.80; c *= 0.70
            elif nt == "long":
                e *= 0.48; m *= 0.74; c *= 0.60
            elif nt == "blackout":
                if self.rng.random() < 0.40:   # sudden total darkness
                    e *= 0.20; m *= 0.50; c *= 0.30; a *= 0.72
                else:
                    e *= 0.42; m *= 0.68; c *= 0.50; a *= 0.85

        wt = self.weather.get("type", "clear")
        wi = self.weather.get("intensity", 0.0)
        if wt == "fog":
            e *= max(0.28, 1 - 0.55 * wi);  c *= 0.85
        elif wt == "rain":
            e *= 0.84; m *= max(0.70, 1 - 0.20 * wi); c *= 0.80; a *= 0.88
        elif wt == "storm":
            e *= 0.66; m *= max(0.56, 1 - 0.32 * wi); c *= 0.64; a *= 0.80
        elif wt == "sandstorm":
            e *= 0.55; m *= max(0.45, 1 - 0.42 * wi); c *= 0.55
        elif wt == "blizzard":
            e *= 0.48; m *= max(0.44, 1 - 0.46 * wi); c *= 0.50; a *= 0.78
        elif wt == "heat_wave":
            e *= 1.15; m *= 1.05; c *= 0.85
        elif wt == "dry_lightning":
            e *= 0.78; c *= 0.80
        elif wt == "freezing_mist":
            e *= 0.62; m *= 0.72; c *= 0.65; a *= 0.82

        return {"encounter": e, "move": m, "cache": c, "ally": a}

    def _env_context_line(self, rng):
        """One-sentence atmospheric note appended to dialogue occasionally."""
        lines = []
        if self._is_night():
            night_lines = {
                "short":   ["The brief darkness is no respite.",
                             "Working fast in the short night."],
                "normal":  ["Night makes everything harder to read.",
                             "The dark slows every decision."],
                "long":    ["The long night weighs on everything.",
                             "Still hours until any light."],
                "blackout":["The blackout is total — no stars, no horizon.",
                             "Complete darkness. Every sound a threat."],
            }.get(self.params.night_type, [])
            lines += night_lines
        weather_lines = {
            "fog":           ["The fog closes in tight.",
                               "Visibility down to nothing."],
            "rain":          ["Rain pounds the ground without mercy.",
                               "Everything is soaked and slick."],
            "storm":         ["Lightning fractures the sky overhead.",
                               "Moving in the storm is dangerous."],
            "sandstorm":     ["Sand scours every exposed surface.",
                               "The sandstorm makes it nearly impossible to see."],
            "blizzard":      ["Snow drives horizontally.",
                               "The blizzard is killing cold."],
            "heat_wave":     ["The heat is extraordinary, relentless.",
                               "The ground shimmers. Movement costs everything."],
            "dry_lightning": ["Lightning ignites the distance without rain.",
                               "The sky crackles — unpredictable."],
            "freezing_mist": ["The freeze settles fast over everything.",
                               "Ice forms underfoot with each step."],
        }.get(self.weather.get("type", "clear"), [])
        lines += weather_lines
        return rng.choice(lines) if lines else ""

    # ── border helpers ─────────────────────────────────────────────────────────

    def _outside_border(self, p, rad):
        cx, cy = CORNUCOPIA
        shape  = self.params.border_shape
        if shape == "circle":
            return (p.x - cx) ** 2 + (p.y - cy) ** 2 > rad * rad
        if shape == "north_south":
            return abs(p.y - cy) > rad
        if shape == "east_west":
            return abs(p.x - cx) > rad
        return max(abs(p.x - cx), abs(p.y - cy)) > rad  # square

    def _spawn(self):
        cx, cy = CORNUCOPIA
        n = len(self.players)
        radius = 5
        for i, p in enumerate(self.players):
            ang = 2 * math.pi * i / n
            p.x = int(round(cx + radius * math.cos(ang)))
            p.y = int(round(cy + radius * math.sin(ang)))
            p.x = max(0, min(GRID - 1, p.x))
            p.y = max(0, min(GRID - 1, p.y))

    @property
    def alive(self):
        return [p for p in self.players if p.alive]

    def _dist(self, a, b):
        return max(abs(a.x - b.x), abs(a.y - b.y))

    def _new_alliance(self, members, aggressor):
        self._ally_counter += 1
        aid = self._ally_counter
        self.alliances[aid] = {"members": list(members), "aggressor": aggressor}
        for m in members:
            m.ally = aid
        return aid

    def _leave_alliance(self, p):
        aid = p.ally
        if aid is None:
            return
        if aid in self.alliances:
            try:
                self.alliances[aid]["members"].remove(p)
            except ValueError:
                pass
            if len(self.alliances[aid]["members"]) <= 1:
                for m in list(self.alliances[aid]["members"]):
                    m.ally = None
                del self.alliances[aid]
        p.ally = None

    # ── phases ─────────────────────────────────────────────────────────────

    def _phase_movement(self):
        cx, cy = CORNUCOPIA
        for p in self.alive:
            reg   = REGIONS[region_at(self.arena, p.x, p.y)]
            env   = self._env_modifiers()
            base  = 2 + self.rng.random() * 2
            speed = max(1, int(round(base * reg["move"] * env["move"])))
            confidence = (p.stats["fight"] + p.stats["kill"]) / 2
            caution    = p.stats["survival"]
            to_center  = self.turn <= 1 and confidence >= 6
            threats    = [o for o in self.alive if o is not p
                          and o.overall > p.overall + 8 and o.health > 60
                          and self._dist(p, o) <= PROXIMITY + 2]

            # Ally cohesion — find the centroid of living partners
            ally_pos = None
            if p.ally is not None:
                info = self.alliances.get(p.ally)
                if info:
                    partners = [m for m in info["members"] if m is not p and m.alive]
                    if partners:
                        ally_pos = (
                            sum(m.x for m in partners) // len(partners),
                            sum(m.y for m in partners) // len(partners),
                        )

            if to_center:
                tx, ty = cx, cy
            elif threats and caution >= confidence:
                # Flee from nearest threat — even allies scatter when chased
                t  = min(threats, key=lambda o: self._dist(p, o))
                tx = p.x + (p.x - t.x)
                ty = p.y + (p.y - t.y)
            elif ally_pos is not None:
                apx, apy = ally_pos
                dist_to_ally = max(abs(p.x - apx), abs(p.y - apy))
                if dist_to_ally <= 2 and self.rng.random() < 0.28:
                    # Already side-by-side — small foraging drift around partner
                    tx = apx + self.rng.randint(-2, 2)
                    ty = apy + self.rng.randint(-2, 2)
                else:
                    # Converge on partner's position
                    tx, ty = apx, apy
            elif confidence >= 6 and self.rng.random() < 0.5:
                tx, ty = cx, cy
            else:
                tx = p.x + self.rng.randint(-speed, speed)
                ty = p.y + self.rng.randint(-speed, speed)

            dx = max(-speed, min(speed, tx - p.x))
            dy = max(-speed, min(speed, ty - p.y))
            p.x = max(0, min(GRID - 1, p.x + dx))
            p.y = max(0, min(GRID - 1, p.y + dy))

    def _phase_caches(self):
        for p in self.alive:
            reg   = REGIONS[region_at(self.arena, p.x, p.y)]
            chance = 0.10 * reg["cache"] * (0.6 + p.stats["survival"] / 10) * self._env_modifiers()["cache"]
            if self.rng.random() < chance:
                item = _draw_item(self.rng)
                p.inventory.append(item)
                if "heal" in item:
                    p.health = min(100, p.health + item["heal"])
                p.events.append(("cache", item["label"]))

    def _phase_sponsor(self):
        for p in self.alive:
            chance = 0.02 * p.stats["sponsor"]
            if self.rng.random() < chance and p.health < 90:
                heal      = 20 + p.stats["sponsor"] * 2
                p.health  = min(100, p.health + heal)
                # sponsor clears one injury if any
                cleared = None
                if p.injuries:
                    cleared = p.injuries.pop(0)
                p.events.append(("sponsor", (heal, cleared)))

    def _phase_alliances(self):
        # Tiered early-game window: wider search radius + lower bar for the
        # first few turns so alliances seed before the field thins out.
        t = self.turn
        if t <= 2:
            search_r  = PROXIMITY + 5    # broad sweep right after bloodbath
            threshold = ALLY_THRESHOLD - 20
        elif t <= 4:
            search_r  = PROXIMITY + 3    # narrowing window
            threshold = ALLY_THRESHOLD - 10
        else:
            search_r  = PROXIMITY        # normal from turn 5 onward
            threshold = ALLY_THRESHOLD

        seen = set()
        for a in self.alive:
            if a.ally is not None:
                continue
            for b in self.alive:
                if b is a or b.ally is not None:
                    continue
                if self._dist(a, b) > search_r:
                    continue
                if region_at(self.arena, a.x, a.y) == "cornucopia":
                    continue
                key = tuple(sorted((a.name, b.name)))
                if key in seen:
                    continue
                seen.add(key)
                ab, agg1 = affinity(a, b, self.turn)
                ba, agg2 = affinity(b, a, self.turn)
                env_thresh = threshold * self._env_modifiers()["ally"]
                if ab >= env_thresh and ba >= env_thresh:
                    self._new_alliance([a, b], agg1 or agg2)
                    a.events.append(("ally", b.name))
                    b.events.append(("ally", a.name))

    def _phase_betrayal(self):
        n0 = len(self.players)
        thinning = 1 - len(self.alive) / n0
        for aid in list(self.alliances.keys()):
            info = self.alliances.get(aid)
            if not info:
                continue
            members = [m for m in info["members"] if m.alive]
            if len(members) < 2:
                continue
            base   = BETRAYAL_AGGRESSOR_BASE if info["aggressor"] else BETRAYAL_BASE
            chance = base + thinning * BETRAYAL_THINNING
            if any(m.health < 50 for m in members):
                chance += 0.15
            if self.rng.random() < chance:
                betrayer = max(members, key=lambda m: m.stats["kill"])
                victim   = min([m for m in members if m is not betrayer],
                               key=lambda m: m.fight_power)
                self._resolve_combat(betrayer, victim, betrayal=True)
                for m in list(members):
                    self._leave_alliance(m)

    def _phase_combat(self):
        checked = set()
        for a in list(self.alive):
            if not a.alive:
                continue
            for b in list(self.alive):
                if b is a or not b.alive:
                    continue
                if a.ally is not None and a.ally == b.ally:
                    continue
                key = tuple(sorted((a.name, b.name)))
                if key in checked:
                    continue
                checked.add(key)
                fight_range = 2 if len(self.alive) <= 5 else 1
                if self._dist(a, b) > fight_range:
                    continue
                reg = REGIONS[region_at(self.arena, a.x, a.y)]
                if self.rng.random() > 0.5 * reg["encounter"] * self._env_modifiers()["encounter"]:
                    continue
                if self._wants_fight(a, b):
                    self._resolve_combat(a, b)
                elif self._wants_fight(b, a):
                    self._resolve_combat(b, a)

    def _wants_fight(self, a, b):
        n_alive = len(self.alive)
        # Pacifists won't strike first — unless they're truly the last ones standing
        if a.stats["kill"] <= 2 and b.health > 40 and n_alive > 3:
            return False
        threat_gap = b.overall - a.overall
        if threat_gap > 6 and b.health > 55:
            return self.rng.random() < 0.10
        appetite = a.stats["kill"] / 10
        if b.health < 50:
            appetite += 0.3
        appetite += (1 - n_alive / len(self.players)) * 0.5
        # Extreme endgame: desperation overrides caution
        if n_alive <= 4:
            appetite += 0.35
        return self.rng.random() < appetite

    def _resolve_combat(self, attacker, defender, betrayal=False):
        pa = attacker.fight_power + attacker.stats["advantages"] * 0.15 \
             + self.rng.random() * 3
        pd = defender.fight_power + defender.stats["advantages"] * 0.15 \
             + self.rng.random() * 3
        if betrayal:
            pa += 2
        if pa >= pd:
            dmg = 30 + int((pa - pd) * 6) + self.rng.randint(0, 20)
            defender.health -= dmg
            # chance of injury on significant hits
            if dmg > 30 and self.rng.random() < 0.45 and len(defender.injuries) < 3:
                defender.injuries.append(self.rng.choice(INJURIES))
            tag = "betrayed_win" if betrayal else "attacked_win"
            attacker.events.append((tag, defender.name))
            if defender.health <= 0:
                self._kill(defender, attacker)
            else:
                defender.events.append(("survived_hit", attacker.name))
        else:
            dmg = 25 + int((pd - pa) * 6) + self.rng.randint(0, 15)
            attacker.health -= dmg
            if dmg > 28 and self.rng.random() < 0.40 and len(attacker.injuries) < 3:
                attacker.injuries.append(self.rng.choice(INJURIES))
            defender.events.append(("defended", attacker.name))
            if attacker.health <= 0:
                self._kill(attacker, defender)

    def _kill(self, victim, killer):
        victim.alive     = False
        victim.health    = 0
        victim.death_turn = self.turn
        killer.kills    += 1
        victim.events.append(("died", killer.name))
        if victim.ally is not None:
            self._leave_alliance(victim)

    def _current_radius(self):
        if self.turn <= self.params.ring_start:
            return GRID
        shrink = self.turn - self.params.ring_start
        return max(RING_MIN_RADIUS, GRID // 2 - shrink * self.params.ring_rate)

    def _phase_ring(self):
        rad = self._current_radius()
        if rad >= GRID:
            return
        cx, cy = CORNUCOPIA
        dis = self.params.border_disaster
        # Starvation effect: once the border is clamped at minimum, damage
        # ramps up each turn so any survivors are eventually forced to fight.
        turns_past_min = max(0, self.turn - (
            self.params.ring_start
            + (GRID // 2 - RING_MIN_RADIUS) // max(1, self.params.ring_rate)
        ))
        dmg = self.params.border_damage + turns_past_min * 3

        for p in self.alive:
            if not self._outside_border(p, rad):
                continue

            p.health -= dmg
            p.events.append(("ring", dis))

            # Push back toward safe zone — direction depends on border shape
            shape = self.params.border_shape
            if shape == "circle":
                ddx = cx - p.x; ddy = cy - p.y
                dist = max(1.0, (ddx * ddx + ddy * ddy) ** 0.5)
                step = min(5, int(dist - rad) + 2)
                p.x = max(0, min(GRID - 1, p.x + round(ddx / dist * step)))
                p.y = max(0, min(GRID - 1, p.y + round(ddy / dist * step)))
            elif shape == "north_south":
                step = 2 + max(0, abs(p.y - cy) - rad)
                p.y = max(0, min(GRID - 1, p.y + (-step if p.y > cy else step)))
            elif shape == "east_west":
                step = 2 + max(0, abs(p.x - cx) - rad)
                p.x = max(0, min(GRID - 1, p.x + (-step if p.x > cx else step)))
            else:  # square
                step = 2 + max(0, max(abs(p.x - cx), abs(p.y - cy)) - rad)
                if p.x != cx: p.x += -step if p.x > cx else step
                if p.y != cy: p.y += -step if p.y > cy else step
                p.x = max(0, min(GRID - 1, p.x))
                p.y = max(0, min(GRID - 1, p.y))

            if p.health <= 0:
                p.alive      = False
                p.health     = 0
                p.death_turn = self.turn
                p.events.append(("died_ring", dis))
                if p.ally is not None:
                    self._leave_alliance(p)

    def _phase_hazard(self):
        n0       = len(self.players)
        progress = 1 - len(self.alive) / n0
        chance   = HAZARD_BASE_CHANCE + progress * (HAZARD_MAX_CHANCE - HAZARD_BASE_CHANCE)
        if self.rng.random() > chance:
            return None
        kind = self.rng.choice(HAZARD_KINDS)
        hx   = self.rng.randint(0, GRID - 1)
        hy   = self.rng.randint(0, GRID - 1)
        rad  = 3 + int(progress * 4)
        hit  = []
        for p in self.alive:
            if max(abs(p.x - hx), abs(p.y - hy)) <= rad:
                dmg = self.rng.randint(20, 50)
                dmg = int(dmg * (1.2 - p.stats["survival"] / 20))
                p.health -= dmg
                if dmg > 25 and self.rng.random() < 0.35 and len(p.injuries) < 3:
                    p.injuries.append(self.rng.choice(INJURIES))
                p.events.append(("hazard", kind))
                if p.health <= 0:
                    p.alive      = False
                    p.health     = 0
                    p.death_turn = self.turn
                    p.events.append(("died_hazard", kind))
                    if p.ally is not None:
                        self._leave_alliance(p)
                else:
                    p.x = max(0, min(GRID - 1, p.x + (1 if p.x >= hx else -1) * 2))
                    p.y = max(0, min(GRID - 1, p.y + (1 if p.y >= hy else -1) * 2))
                hit.append(p.name)
        return {"kind": kind, "x": hx, "y": hy, "radius": rad, "hit": hit}

    # ── dialogue ────────────────────────────────────────────────────────────

    def _dialogue(self, p, ctx=None):
        rng = self.rng
        if ctx is None:
            ctx = {}

        if not p.alive and p.death_turn == self.turn:
            for tag, data in p.events:
                if tag == "died":        return self._death_line(rng, p, data)
                if tag == "died_hazard": return self._death_hazard_line(rng, p, data)
                if tag == "died_ring":   return self._death_ring_line(rng, p)
            return "The cannon sounds."
        if not p.alive:
            return None

        lines = []
        for tag, data in p.events:
            if tag == "cache":
                lines.append(self._cache_line(rng, p, data))
            elif tag == "sponsor":
                heal, cleared = data
                lines.append(self._sponsor_line(rng, p, heal, cleared))
            elif tag == "ally":
                lines.append(self._ally_line(rng, p, data))
            elif tag == "betrayed_win":
                lines.append(self._betrayal_win_line(rng, p, data))
            elif tag == "attacked_win":
                lines.append(self._attack_win_line(rng, p, data, ctx))
            elif tag == "survived_hit":
                lines.append(self._survived_hit_line(rng, p, data))
            elif tag == "defended":
                lines.append(self._defended_line(rng, p, data))
            elif tag == "hazard":
                lines.append(self._hazard_survive_line(rng, p, data))
            elif tag == "ring":
                lines.append(self._ring_line(rng, p))

        if not lines:
            lines.append(self._idle_line(rng, p, ctx))

        if p.alive and rng.random() < 0.28:
            env = self._env_context_line(rng)
            if env:
                lines.append(env)

        return " ".join(lines)

    # ── dialogue sub-methods ────────────────────────────────────────────────

    def _death_line(self, rng, p, killer):
        n_kills = p.kills
        kill_note = f" {p.name} had {n_kills} kill{'s' if n_kills != 1 else ''} on the record." if n_kills else ""
        options = {
            "predator": [
                f"Meets {killer} in open ground and doesn't back down. The fight is short and conclusive — "
                f"{killer} is the better predator today.{kill_note} The cannon sounds.",
                f"{killer} was the one opponent worth genuinely worrying about. "
                f"The encounter is brief and there's no second chance. The cannon announces the result.",
                f"For the first time in these Games, the fight isn't won before it starts. "
                f"{killer} finds a gap in the pattern. That's all it takes. The cannon sounds.",
            ],
            "career": [
                f"District {p.district} training covers almost every scenario. "
                f"{killer} turns out to be the exception. The fight is technically clean, and lost. "
                f"The cannon sounds.",
                f"There's no dishonour in falling to {killer}. The arena doesn't grade on District pedigree. "
                f"The cannon sounds before the dust settles.{kill_note}",
                f"{killer} found the flaw the training never addressed. "
                f"In the end the arena finds it in everyone.{kill_note} The cannon follows.",
            ],
            "ghost": [
                f"Hidden this long, {p.name} finally runs out of places to disappear. "
                f"{killer} closes the distance before there's time to react. "
                f"The cannon sounds from deep inside the terrain.",
                f"The strategy was to wait everyone out. {killer} was more patient. "
                f"Found in a position with no exit.{kill_note} The cannon sounds.",
                f"{killer} had been tracking this. The final distance closes faster than expected "
                f"— no room to run when it matters. The cannon sounds.",
            ],
            "survivor": [
                f"{p.name} has outlasted every challenge the arena designed. "
                f"{killer} is the one that couldn't be read in time. "
                f"The cannon sounds with {n_kills or 'no'} kill{'s' if n_kills != 1 else ''} on the record.",
                f"Survival instincts failed at the worst moment. "
                f"{killer} caught the one angle that wasn't covered. "
                f"The cannon sounds — another tribute who read the terrain but not the person.",
                f"Every step until now was calculated. "
                f"{killer} didn't give time for a calculation. The cannon sounds.",
            ],
            "hunter": [
                f"The field has been thinning fast, and so has the patience. "
                f"{killer} was waiting for exactly that — overextension. The cannon sounds.{kill_note}",
                f"Pushed the pace one encounter too many. "
                f"{killer} held ground and made it count. The cannon sounds, flat and final.",
                f"After all of it — the kills, the movement, the aggression — {killer} ends it. "
                f"The cannon announces what the arena always delivers.{kill_note}",
            ],
            "default": [
                f"{p.name} and {killer} meet somewhere in the arena's middle distance. "
                f"The outcome is decided fast. The cannon sounds before anyone far away hears the fight.",
                f"{killer} doesn't give {p.name} much time to react. "
                f"The fight is shorter than it should have been, and the cannon sounds into silence.",
                f"There's a moment where the outcome isn't clear. Then it is. "
                f"{killer} walks away. The cannon sounds.",
                f"Not a last stand — {killer} didn't leave room for that. "
                f"Just an encounter, and then the cannon, and then nothing.",
                f"The arena had {p.name} running for {self.turn} turns before {killer} ended it. "
                f"The cannon sounds, and the Capitol feed moves to the next tribute.",
            ],
        }
        pool = options.get(p._personality(), options["default"])
        return rng.choice(pool)

    def _death_hazard_line(self, rng, p, kind):
        region = region_at(self.arena, p.x, p.y)
        loc    = _region_name(rng, region)
        options = [
            f"The {kind} reaches {loc} before {p.name} can clear it. "
            f"No margin left. The cannon sounds.",
            f"Caught in the radius of the {kind} with nowhere to redirect. "
            f"The Gamemakers designed this specifically. The cannon sounds.",
            f"The {kind} rolls through {loc} indiscriminately — "
            f"{p.name} was simply in its path. The cannon sounds.",
            f"Survived everything else the arena designed. The {kind} is the answer. "
            f"The cannon sounds from inside it, still moving.",
            f"There's no strategy that covers a {kind} arriving without warning. "
            f"The cannon sounds before the event is even over.",
            f"The {kind} catches {p.name} in {loc} at the worst possible moment. "
            f"The margin was too thin. The cannon sounds.",
        ]
        return rng.choice(options)

    def _death_ring_line(self, rng, p):
        dis = self.params.border_disaster
        disaster_lines = {
            "lava":         f"The lava overtakes {p.name} at the boundary's edge. No outrunning it at this stage. The cannon sounds.",
            "insect_swarm": f"The mutt swarm is faster than it looked from a distance. Caught at the perimeter. The cannon sounds from inside the cloud.",
            "toxic_gas":    f"One breath of the gas at the boundary is enough. Couldn't cover the ground in time. The cannon sounds.",
            "fire_curtain": f"The Gamemaker fire wall closes the last gap. {p.name} runs out of arena. The cannon sounds.",
            "acid_storm":   f"The acid storm claims the outer ring and {p.name} along with it. Couldn't clear the perimeter in time. The cannon sounds.",
            "glacier":      f"The ice front is faster than it looks from inside. Caught at the freeze line. The cannon sounds into the cold.",
            "floodwall":    f"The engineered flood reaches {p.name} before the clear ground does. The cannon sounds from somewhere below the water.",
            "sonic_wave":   f"The subsonic pulse does its damage at the perimeter. Couldn't cross the necessary ground. The cannon sounds.",
        }
        if dis in disaster_lines and rng.random() < 0.65:
            return disaster_lines[dis]
        return rng.choice([
            f"The arena contracts to a point {p.name} can't reach in time. The boundary settles it. The cannon sounds.",
            f"There's no more ground left on the safe side. The closing perimeter ends it cleanly. The cannon sounds.",
            f"Driven past the safe margin by the shrinking arena. The cannon sounds from the kill zone.",
            f"The arena ran out of room for {p.name} before the fighting did. The cannon sounds.",
        ])

    def _cache_line(self, rng, p, label):
        region  = region_at(self.arena, p.x, p.y)
        loc     = _region_name(rng, region)
        weapons = [i["label"] for i in p.inventory if i.get("type") == "weapon"]
        change  = "Already armed, but options change the math." if weapons else "Changes the next encounter entirely."
        options = [
            f"Finds {label} tucked into {loc} — someone stashed this in the opening hours and never came back. "
            f"{change}",
            f"The search through {loc} pays off: {label}. "
            f"Takes it without stopping to evaluate. Better inventory, same pace.",
            f"{label.capitalize()}, half-buried in {loc}. "
            f"Checks it over, finds it usable, and keeps moving. Small advantage, but an advantage.",
            f"Digs {label} from a concealed spot in {loc}. "
            f"The Gamemakers left this somewhere accessible — doesn't question it, just takes it.",
            f"An hour of working through {loc} finally pays off: {label}. "
            f"The inventory is better than it was, and that matters more as the field shrinks.",
            f"Finds {label} in {loc}. It's been here since the opening — "
            f"nobody else came this way, or nobody who did survived to use it.",
        ]
        return rng.choice(options)

    def _sponsor_line(self, rng, p, heal, cleared):
        n_alive = len(self.alive)
        field   = f"Down to {n_alive} tributes — the Capitol is paying close attention." if n_alive <= 6 else \
                  "Someone back home made a calculation about who still matters."
        options = [
            f"A silver parachute spirals down. {field} "
            f"{heal} points of damage addressed — enough to change the next hour.",
            f"The gift lands with a quiet thud: medical supplies, from the weight of it. "
            f"{field} The body responds faster than expected.",
            f"Sponsor support arrives at the right moment. "
            f"{field} {heal} damage rolled back. Still in the fight.",
            f"The parachute catches light before hitting the ground. "
            f"Capitol money spent on keeping {p.name} alive — {heal} points recovered.",
            f"Something in the last few hours played well with the audience. "
            f"The parachute arrives with exactly what's needed. {heal} damage undone.",
        ]
        line = rng.choice(options)
        if cleared:
            line += f" The treatment also addresses {cleared}."
        return line

    def _ally_line(self, rng, p, partner):
        pers   = p._personality()
        region = region_at(self.arena, p.x, p.y)
        loc    = _region_name(rng, region)
        options = {
            "predator": [
                f"Crosses paths with {partner} in {loc} and neither one immediately attacks. "
                f"That's the entire negotiation. The alliance forms without a word about trust — "
                f"both of them know what it is.",
                f"The arithmetic works: two predators alive is better than one until it isn't. "
                f"{partner} is in range and the field is still crowded. The pact forms from pure calculation.",
            ],
            "career": [
                f"Links up with {partner} in {loc} — Career logic, not sentiment. "
                f"The field is cleaner to work through with a partner at this stage. "
                f"Both tributes know exactly how long it lasts.",
                f"{partner} makes sense as a partner right now: same assessment, different angles. "
                f"The pact forms on the move, without ceremony.",
            ],
            "ghost": [
                f"Stays close to {partner} in {loc} — not because it feels safe, "
                f"but because alone was riskier. The alliance is a calculation, not a comfort.",
                f"{partner} found them before anyone else did. That's either luck or {partner}'s skill. "
                f"Either way, staying together is better than separating. The pact holds.",
            ],
            "survivor": [
                f"Finds {partner} in {loc} and makes the calculation quickly: "
                f"two sets of eyes, shared resources, divided threat profile. "
                f"The alliance forms because the numbers say it should.",
                f"{partner} is the closest viable ally given the current field. "
                f"The approach is careful, the outcome is an alliance, "
                f"and neither one pretends it's more than mutual interest.",
            ],
            "default": [
                f"Meets {partner} in {loc} under circumstances where fighting would cost both of them. "
                f"The alternative — an alliance — is the obvious move. "
                f"Neither one says it out loud. They just start moving in the same direction.",
                f"The decision to ally with {partner} takes about four seconds. "
                f"The field is too crowded to be picky, and {partner} is right there. "
                f"The pact is fragile and real.",
                f"{partner} and {p.name} end up moving through {loc} side by side "
                f"after a moment where neither one attacked. "
                f"The alliance isn't discussed — it's just what happens next.",
            ],
        }
        pool = options.get(pers, options["default"])
        return rng.choice(pool)

    def _betrayal_win_line(self, rng, p, victim):
        options = [
            f"The alliance with {victim} ends the only way it was ever going to. "
            f"The moment the angle opened, the decision was already made. "
            f"{victim} is down before there's time to react.",
            f"Turns on {victim} without a tell — everything before this, the shared ground "
            f"and divided labour, was groundwork for exactly this moment. The cannon sounds.",
            f"Waited until {victim}'s attention was on something else. "
            f"That's all a betrayal needs: one unguarded moment. "
            f"The alliance ends on {p.name}'s terms.",
            f"The calculation changed somewhere in the last few hours. "
            f"{victim} became the liability, and the arena doesn't reward keeping liabilities. "
            f"The execution is cold. The cannon follows.",
            f"Some alliances are just a longer route to the same ending. "
            f"{victim} knew what kind of tribute {p.name} is — or should have. "
            f"The ambush is clean. The cannon sounds.",
            f"The field has thinned enough that {victim} is now a competitor, not an asset. "
            f"Acts on that before {victim} does. "
            f"The cannon sounds and the alliance is over.",
        ]
        return rng.choice(options)

    def _attack_win_line(self, rng, p, target, ctx=None):
        pers    = p._personality()
        weapons = [i["label"] for i in p.inventory if i.get("type") == "weapon"]
        weapon  = rng.choice(weapons) if weapons else None
        w_note  = f" The {weapon} is decisive." if weapon else ""
        n_alive = (ctx or {}).get("n_alive", len(self.alive))
        f_note  = f" The field is down to {n_alive}." if n_alive <= 5 else ""
        options = {
            "predator": [
                f"Closes on {target} across the ground before they can reset.{w_note} "
                f"The fight is one-sided from the first exchange — {target} is down, "
                f"and the field is better for it.{f_note}",
                f"The hunt for {target} took most of the last hour. The encounter itself "
                f"takes less than a minute.{w_note} Efficient. Already moving before the cannon sounds.",
                f"Tracked {target} into position and pressed the advantage without hesitation.{w_note} "
                f"The fight was over before {target} could make it complicated.{f_note}",
            ],
            "career": [
                f"The engagement with {target} runs like a training scenario.{w_note} "
                f"District {p.district} preparation covers exactly this. {target} didn't have an answer for it.",
                f"Engages {target} the way every Career is taught to: fast, decisive, no theatrics.{w_note} "
                f"The fight doesn't last long enough to be a fight. The cannon follows.{f_note}",
                f"The read on {target} was right — wrong terrain, wrong angle. "
                f"Career instincts close the gap before {target} can correct.{w_note}",
            ],
            "hunter": [
                f"Found {target} before {target} found them. "
                f"That's been the whole pattern.{w_note} The engagement is clean and fast.{f_note}",
                f"The kill count goes up. {target} didn't see the approach until too late.{w_note} "
                f"Keep moving. Keep hunting. Keep the number going up.{f_note}",
            ],
            "default": [
                f"The exchange with {target} goes the right way.{w_note} "
                f"Not graceful, but it didn't need to be — {target} is down "
                f"and the cannon sounds across the arena.",
                f"Catches {target} in a position they couldn't defend.{w_note} "
                f"The fight is short and the outcome is unambiguous. Keeps moving after.{f_note}",
                f"The encounter with {target} ends in {p.name}'s favour.{w_note} "
                f"{target} fought back, they just lost. "
                f"The cannon sounds and the field gets one smaller.{f_note}",
                f"{target} came in first. Wrong choice.{w_note} "
                f"The counter-attack is harder and better-placed. "
                f"{target} goes down. {p.name} doesn't.{f_note}",
            ],
        }
        pool = options.get(pers, options["default"])
        return rng.choice(pool)

    def _survived_hit_line(self, rng, p, attacker):
        inj  = p.injuries[-1] if p.injuries else None
        hp   = p.health
        inj_note = f" Now carrying {inj}." if inj else ""
        hp_note  = " Critically low on health — the margin is gone." if hp < 25 else \
                   " The damage is real but survivable." if hp < 50 else ""
        options = [
            f"The fight with {attacker} doesn't go cleanly — takes real damage before breaking off. "
            f"{attacker} is still out there.{inj_note}{hp_note}",
            f"Absorbs hits from {attacker} and stays upright, but it costs something. "
            f"The exchange wasn't a win, just a survival.{inj_note}{hp_note}",
            f"{attacker} connects more than once before the fight breaks. "
            f"Walks away from it, which is what matters — "
            f"but the body is tracking every point of that damage.{inj_note}{hp_note}",
            f"The encounter with {attacker} ends without a death, "
            f"which means {attacker} is still a problem somewhere in the arena.{inj_note}{hp_note}",
            f"Trades damage with {attacker} and comes out ahead by the bare minimum: still alive. "
            f"The situation is worse than it was an hour ago.{inj_note}{hp_note}",
            f"Gets hit by {attacker} and doesn't go down. "
            f"That's the win — surviving the encounter. The cost is clear though.{inj_note}{hp_note}",
        ]
        return rng.choice(options)

    def _defended_line(self, rng, p, attacker):
        weapons = [i["label"] for i in p.inventory if i.get("type") == "weapon"]
        w_note  = f" The {rng.choice(weapons)} is the difference." if weapons else ""
        options = [
            f"{attacker} commits to the attack and gets the worst of the exchange.{w_note} "
            f"Holds position and drives {attacker} back. The aggressor retreats.",
            f"Reads {attacker}'s approach and responds before the full attack lands.{w_note} "
            f"{attacker} came in confident. Leaves in worse shape.",
            f"The defence against {attacker} is clean — not elegant, but effective.{w_note} "
            f"{attacker} found a tribute who was ready for it.",
            f"Beats back {attacker}'s charge and keeps every step of ground.{w_note} "
            f"The message is clear: not the easy target {attacker} was looking for.",
            f"{attacker} opened the fight and finished it differently than planned.{w_note} "
            f"The counter-attack was faster and better-placed. {attacker} withdraws.",
        ]
        return rng.choice(options)

    def _hazard_survive_line(self, rng, p, kind):
        return _hazard_escape_line(rng, kind)

    def _ring_line(self, rng, p):
        inj = f", slowed by {p.injuries[0]}" if p.injuries else ""
        dis = self.params.border_disaster
        disaster_lines = {
            "lava":         [f"Running ahead of the lava front{inj}.",
                              "The heat hits before the magma does. Moving.",
                              "The ground cracks and glows behind them."],
            "insect_swarm": [f"Running ahead of the insect swarm{inj}.",
                              "The mutt buzzing is almost a wall now.",
                              "The swarm is inches behind. Keep running."],
            "toxic_gas":    [f"The gas rolls in from the boundary{inj}. Running.",
                              "Eyes stinging already — the cloud is close.",
                              "One breath of that and it's over. Moving."],
            "fire_curtain": [f"The fire curtain advances behind{inj}.",
                              "Running from the Gamemaker fire wall.",
                              "Heat and light. The fire is close."],
            "acid_storm":   [f"Acid rain hisses on stone behind them{inj}.",
                              "The acid boundary is visible. Moving fast.",
                              "What that rain does to skin — not stopping."],
            "glacier":      [f"The ice front moves faster than expected{inj}.",
                              "The freezing line cracks and advances.",
                              "Ice at the back. Keep moving inward."],
            "floodwall":    [f"The engineered floodwaters surge from the edge{inj}.",
                              "Running ahead of the rising water.",
                              "The flood takes the outer third fast."],
            "sonic_wave":   [f"The pressure wave hits before the sound does{inj}.",
                              "Subsonic pulse. Everything vibrates. Moving in.",
                              "The pressure from the wave forces every step inward."],
        }
        options = disaster_lines.get(dis, []) + [
            f"Driven inward as the arena contracts{inj}.",
            f"The boundary closes. No choice but to move.",
            f"The shrinking arena makes the decision: centre, now.",
            f"Retreats ahead of the closing line. The arena is tightening.",
            f"Another contraction. The field is shrinking{inj}.",
            f"Pushed toward the Cornucopia whether they want to be or not.",
        ]
        return rng.choice(options)

    def _idle_line(self, rng, p, ctx=None):  # noqa: C901
        if ctx is None:
            ctx = {}
        pers    = p._personality()
        region  = region_at(self.arena, p.x, p.y)
        loc     = _region_name(rng, region)
        inj     = p.injuries[0] if p.injuries else None
        hp      = p.health
        n_alive = ctx.get("n_alive", len(self.alive))
        n_dead  = ctx.get("n_dead", len(self.players) - n_alive)
        threats = ctx.get("threats", [])   # nearby dangerous players
        weak    = ctx.get("weak", [])      # nearby wounded/weak players

        # ── Partner reference for allied tributes ───────────────────────────
        partner_name = None
        if p.ally is not None:
            info = self.alliances.get(p.ally)
            if info:
                partners = [m for m in info["members"] if m is not p and m.alive]
                if partners:
                    partner_name = partners[0].name

        # ── Critical injury branch (overrides everything) ───────────────────
        if inj and hp < 45:
            options = [
                f"The {inj} has been slowing things down since the last fight, "
                f"and it's getting harder to manage. "
                f"Moving through {loc} at half-pace, every step costing something. "
                f"Still moving — stopping is worse.",
                f"Operating at a serious deficit because of {inj}. "
                f"The body is making every decision before the mind does. "
                f"Keeps pushing through {loc} regardless — there's no version of this "
                f"where resting is safe.",
                f"The damage from {inj} is affecting everything: movement, reaction, judgement. "
                f"Working through {loc} as carefully as possible. "
                f"Anyone who finds this position right now will find an easy target.",
                f"Still in {loc}, still moving, but {inj} is the whole story right now. "
                f"The pain has settled into a background constant. "
                f"The question is whether it holds for another few hours.",
            ]
            return rng.choice(options)

        # ── Threat-aware branch (named dangerous players nearby) ────────────
        if threats:
            t = threats[0]
            options = {
                "predator": [
                    f"Has an eye on {t.name} — visible from here, moving in the wrong direction. "
                    f"Not the right moment yet. The patience that's kept the count this high "
                    f"is the same patience that wins this.",
                    f"Tracking {t.name} through {loc} without closing the distance. "
                    f"The right angle doesn't exist yet. It will.",
                ],
                "ghost": [
                    f"{t.name} has been working the area and hasn't found this position yet. "
                    f"The best option is stillness — staying in {loc} and letting {t.name} pass. "
                    f"So far, that's working.",
                    f"Knows {t.name} is close and hasn't moved in twenty minutes. "
                    f"Every sound from the direction of {loc} is catalogued. "
                    f"Waiting them out.",
                ],
                "survivor": [
                    f"{t.name} is close enough to be a problem — {t.name}'s been moving "
                    f"through {loc} in a pattern that could come this way. "
                    f"Takes a longer route, adding time to add distance.",
                    f"Aware of {t.name} nearby and adjusting the route accordingly. "
                    f"This isn't about avoiding confrontation; it's about choosing the ground.",
                ],
                "default": [
                    f"{t.name} is within range in {loc}, and that changes the calculation. "
                    f"Moving more carefully, keeping the terrain between them. "
                    f"Not ready for that fight on {t.name}'s terms.",
                    f"Spotted {t.name} in {loc} a few minutes ago and hasn't stopped moving since. "
                    f"The arena is shrinking enough without adding that variable right now.",
                ],
            }
            pool = options.get(pers, options["default"])
            return rng.choice(pool)

        # ── Opportunity-aware branch (weak/wounded players nearby) ──────────
        if weak and pers in ("predator", "hunter"):
            w = weak[0]
            options = [
                f"{w.name} is somewhere in {loc}, and from what's visible, "
                f"not in great shape. The calculation is straightforward: "
                f"close the distance, pick the moment, and the number goes up.",
                f"Has a read on {w.name}'s position in {loc}. "
                f"{w.name} is wounded and moving slowly. "
                f"This is exactly the kind of opportunity the arena creates.",
                f"Watching {w.name}'s movements through {loc} — "
                f"there's a vulnerability there that won't last. "
                f"Timing the approach.",
            ]
            return rng.choice(options)

        # ── Allied branch ────────────────────────────────────────────────────
        if partner_name:
            options = {
                "predator": [
                    f"Stays with {partner_name} through {loc}, "
                    f"though both of them know the math gets uglier as the field thins. "
                    f"For now, two is better. The betrayal calculus can wait.",
                    f"Moving through {loc} alongside {partner_name}. "
                    f"The alliance is still the right call — "
                    f"there are bigger problems in the field right now.",
                ],
                "career": [
                    f"Coordinates movement through {loc} with {partner_name} "
                    f"without needing to discuss it — they're working the same angles from different sides. "
                    f"The efficiency is real.",
                    f"Keeps {partner_name} in sight through {loc}. "
                    f"A Career tribute knows that a good partner is a force multiplier "
                    f"until the field is small enough that it isn't.",
                ],
                "ghost": [
                    f"Stays close to {partner_name} in {loc}, both of them quiet. "
                    f"The alliance has held longer than expected. "
                    f"The cannon count keeps rising elsewhere, "
                    f"which is exactly where they want it.",
                    f"Moving through {loc} with {partner_name} — "
                    f"two sets of eyes, less exposure. The arrangement is working.",
                ],
                "survivor": [
                    f"Works through {loc} with {partner_name}, "
                    f"dividing the search and watching each other's angles. "
                    f"The partnership is solid right now. Neither one is thinking about what comes after.",
                    f"Keeps {partner_name} close through {loc}. "
                    f"Two people covering the same ground doubles the chance of finding "
                    f"what's needed and halves the chance of being caught off-guard.",
                ],
                "default": [
                    f"{p.name} and {partner_name} move through {loc} together, "
                    f"the alliance holding on practical terms if nothing else. "
                    f"Neither one has given the other a reason to break it yet.",
                    f"Still with {partner_name} in {loc}. "
                    f"The field is small enough that this partnership matters. "
                    f"The question of what happens when it's just the two of them "
                    f"is one nobody's answering yet.",
                ],
            }
            pool = options.get(pers, options["default"])
            return rng.choice(pool)

        # ── General idle by personality and biome ────────────────────────────
        field_note = (
            f" {n_alive} tributes left — every move matters more now."
            if n_alive <= 5 else
            f" {n_dead} cannon{'s' if n_dead != 1 else ''} since the start."
            if n_dead > 0 and rng.random() < 0.4 else
            ""
        )
        pools = {
            "predator": [
                f"Moves through {loc} with the deliberate pace of someone who isn't hurrying "
                f"because they don't need to. Every sound is catalogued, every gap assessed. "
                f"The next kill is a question of when, not if.{field_note}",
                f"Working {loc} at a hunter's pace — no wasted movement, no exposed positions. "
                f"The field is thinning and the remaining tributes are the ones worth worrying about. "
                f"That's fine. That's what this is for.{field_note}",
                f"Spends the hour positioning through {loc}, clearing sight lines and noting approaches. "
                f"Three tributes still out there worth tracking. "
                f"The process is the same as it's always been.{field_note}",
                f"In {loc}, moving methodically. The kill count is what it is — "
                f"the point is to keep improving it. {n_alive} tributes left to work through.{field_note}",
            ],
            "career": [
                f"Moves through {loc} with the efficiency of someone who spent years training for exactly this. "
                f"Every step is placed. Every angle is considered. "
                f"District {p.district} didn't build tributes who waste motion.{field_note}",
                f"Working {loc} the way the training always emphasized: information first, "
                f"engagement second. Has a reasonable picture of who's where. "
                f"Uses it.{field_note}",
                f"The arena is familiar territory in the ways that matter. "
                f"Moves through {loc} with something close to routine — "
                f"controlled positioning, measured pace, no panic.{field_note}",
                f"Scouts {loc} before crossing any exposed section of it. "
                f"Career instincts don't switch off under pressure — "
                f"if anything, they sharpen.{field_note}",
            ],
            "ghost": [
                f"Hasn't been found in {loc} yet, and the strategy is to keep it that way. "
                f"Stays below the horizon of what the cameras can track easily, "
                f"breathes slow, and lets the cannon count do the work.{field_note}",
                f"Been in {loc} long enough to know every sound it makes. "
                f"Nobody else has come close, which is the whole point. "
                f"Invisible isn't immortal, but it's bought time.{field_note}",
                f"Still here, still undetected in {loc}. "
                f"The cannon count has been rising without {p.name}'s involvement, "
                f"which is exactly how this was supposed to go.{field_note}",
                f"Holds position in {loc} and watches the arena work. "
                f"Patience is the plan and the plan is working. "
                f"The field is smaller than it was yesterday.{field_note}",
            ],
            "survivor": [
                f"Works through {loc} with the methodical attention of someone who takes "
                f"survival seriously as a discipline. Water sources, cover, exit angles — "
                f"all assessed before each move.{field_note}",
                f"Reads {loc} the way a map is read — not looking at the surface "
                f"but at what the surface means. Where water drains to. Where sight lines break. "
                f"Where to not be if trouble comes.{field_note}",
                f"Moving through {loc} with minimum noise and maximum awareness of who else might be in it. "
                f"Survival isn't luck at this stage — it's arithmetic.{field_note}",
                f"Takes stock in {loc}: current injuries, remaining supplies, "
                f"likely positions of the other tributes, ring timeline. "
                f"The picture is clear enough to plan around.{field_note}",
            ],
            "hunter": [
                f"Moving through {loc} with purpose. "
                f"The field is small enough that every tribute left is a target, "
                f"and the best approach is to find them before they find this position.{field_note}",
                f"{loc} is just the ground between here and the next engagement. "
                f"Crosses it fast. The fight is the point — everything else is approach.{field_note}",
                f"Looking for the next encounter in {loc}. "
                f"The kill count goes up or it doesn't, and right now it needs to go up.{field_note}",
            ],
            "default": [
                f"Moving through {loc}, keeping the pace as steady as the terrain allows. "
                f"The plan is simple and unchanged: stay alive, stay in motion. "
                f"It's held this far.{field_note}",
                f"Spends the hour working through {loc} with the focus that this stage demands. "
                f"There's no room for distraction when the field is this thin.{field_note}",
                f"In {loc}. Alive. Both of those things still true, which is the entire goal "
                f"every single hour of this.{field_note}",
                f"Checks behind, checks ahead, and keeps moving through {loc}. "
                f"The arena is quieter than it was — which either means everyone else is hiding "
                f"or everyone else is dead.{field_note}",
                f"Hours into {loc} and no contact. "
                f"That could mean safety or it could mean something worse is about to happen. "
                f"Keeps moving either way.{field_note}",
            ],
        }
        pool = pools.get(pers, pools["default"])
        return rng.choice(pool)

    # ── snapshot ─────────────────────────────────────────────────────────────

    def _snapshot(self, hazard):
        snap = {
            "turn":            self.turn,
            "hour":            self.turn * TURN_HOURS,
            "alive_count":     len(self.alive),
            "safe_radius":     self._current_radius(),
            "hazard":          hazard,
            "is_night":        self._is_night(),
            "weather":         dict(self.weather),
            "border_disaster": self.params.border_disaster,
            "border_shape":    self.params.border_shape,
            "players":         [],
        }
        n_alive = len(self.alive)
        for p in self.players:
            nearby   = [o for o in self.alive if o is not p and self._dist(p, o) <= 8]
            threats  = [o for o in nearby if o.overall > p.overall + 6 and o.health > 45]
            weak_tgts= [o for o in nearby if o.health < 40 or (o.overall < p.overall - 8 and o.health < 65)]
            ctx = {
                "nearby":  nearby,
                "threats": threats,
                "weak":    weak_tgts,
                "n_alive": n_alive,
                "n_dead":  len(self.players) - n_alive,
            }
            snap["players"].append({
                "name":     p.name,
                "district": p.district,
                "x":        p.x,
                "y":        p.y,
                "health":   max(0, p.health),
                "alive":    p.alive,
                "kills":    p.kills,
                "overall":  p.overall,
                "ally":     p.ally,
                "injuries": list(p.injuries),
                "dialogue": self._dialogue(p, ctx),
            })
        self.snapshots.append(snap)

    # ── main loop ────────────────────────────────────────────────────────────

    def run(self, max_turns=None):
        # Default: high enough that the ring always forces a conclusion
        if max_turns is None:
            max_turns = self.params.ring_start + (GRID // 2) // max(1, self.params.ring_rate) + 90
        self._advance_weather()
        self._snapshot(None)
        while len(self.alive) > 1 and self.turn < max_turns:
            self.turn += 1
            for p in self.players:
                p.events = []
            self._advance_weather()
            self._phase_movement()
            self._phase_caches()
            self._phase_sponsor()
            self._phase_alliances()
            self._phase_combat()
            self._phase_betrayal()
            self._phase_ring()
            hazard = self._phase_hazard()
            self._snapshot(hazard)
        return self.snapshots

    def winner(self):
        alive = self.alive
        return alive[0] if len(alive) == 1 else None


# ---------------------------------------------------------------------------
# CLI — narrative output
# ---------------------------------------------------------------------------

W = 68  # output width

def _bar(label, value, width=30):
    filled = int(round(value / 100 * width))
    return f"[{'█' * filled}{'░' * (width - filled)}] {value:>3}hp"

def _hp_display(hp):
    if hp <= 0:   return "  DEAD"
    if hp < 30:   return f"  {hp:>3}hp  !!CRITICAL!!"
    if hp < 60:   return f"  {hp:>3}hp  (wounded)"
    return f"  {hp:>3}hp"

def _divider(char="─", width=W):
    return char * width

def _box(lines, char="═"):
    inner = max(len(l) for l in lines)
    top   = char * (inner + 4)
    print(top)
    for l in lines:
        print(f"  {l}")
    print(top)

def _wrap(text, indent=4):
    return textwrap.fill(text, width=W, initial_indent=" " * indent,
                         subsequent_indent=" " * indent)


def main():
    seed = int(sys.argv[1]) if len(sys.argv) > 1 else 42
    sim  = Sim(seed=seed)
    p    = sim.params
    snaps = sim.run()

    print()
    _box([
        f"THE  HUNGER  GAMES  —  ARENA  SIMULATION",
        f"Seed: {seed}   ·   {GRID}×{GRID} grid   ·   {len(ROSTER)} tributes",
        f"Turn interval: {TURN_HOURS} hours   ·   {len(snaps) - 1} turns to conclusion",
        f"Border: {p.border_description}  [{p.border_shape.upper()}]",
        f"Ring: starts turn {p.ring_start}, shrinks {p.ring_rate} cell/turn, {p.border_damage} dmg/turn",
        f"Night: {p.night_type.upper()}   ·   Weather region: {p.weather_region.upper()}",
    ])
    print()

    # opening roster
    print("  TRIBUTE ROSTER\n" + _divider())
    sorted_roster = sorted(sim.players, key=lambda p: -p.overall)
    for p in sorted_roster:
        career = "  [CAREER]" if p.district in CAREER_DISTRICTS else ""
        print(f"  {p.name:<12} D{p.district:<3}  threat {p.overall:>5}{career}")
    print(_divider())
    print()

    for snap in snaps:
        hour    = snap["hour"]
        alive   = snap["alive_count"]
        start   = snaps[0]["alive_count"]
        rad     = snap["safe_radius"]
        hazard  = snap["hazard"]

        # ── turn header ───────────────────────────────────────────────────
        is_night = snap.get("is_night", False)
        weather  = snap.get("weather", {})
        wtype    = weather.get("type", "clear")
        env_tag  = ("🌑 NIGHT" if is_night else "☀ DAY")
        wx_tag   = f"  ·  {wtype.upper().replace('_',' ')}" if wtype != "clear" else ""

        if snap["turn"] == 0:
            print(_divider("═"))
            print(f"  HOUR 000  ·  THE TRIBUTES RISE ON THEIR PLATES  ·  {env_tag}{wx_tag}")
            print(_divider("═"))
        else:
            phase = ("THE BLOODBATH" if hour <= 4
                     else "EARLY GAME"   if hour <= 20
                     else "MID GAME"     if hour <= 40
                     else "LATE GAME"    if alive > 4
                     else "ENDGAME")
            ring_str = f"  ·  RING r{rad}" if rad < GRID else ""
            print()
            print(_divider("═"))
            print(f"  HOUR {hour:03d}  ·  {phase}  ·  {alive}/{start} ALIVE{ring_str}  ·  {env_tag}{wx_tag}")
            print(_divider("═"))

        # ── hazard banner ──────────────────────────────────────────────────
        if hazard:
            hkind = hazard["kind"].upper()
            hit   = hazard["hit"]
            print()
            print(f"  ⚠  GAMEMAKER EVENT: {hkind}")
            if hit:
                print(f"     Struck: {', '.join(hit)}")
            else:
                print(f"     No tributes caught in the radius.")

        # ── ring warning ───────────────────────────────────────────────────
        if rad < GRID:
            print()
            print(f"  ▶  ARENA CONTRACTION — safe radius now {rad} cells")

        print()

        # sort: deaths first, then wounded, then events, then idle
        players = snap["players"]

        deaths    = [p for p in players if not p["alive"] and p["dialogue"]]
        key_events = [p for p in players if p["alive"] and p["dialogue"]
                      and any(kw in p["dialogue"] for kw in
                              ["Turns on", "betrayal", "betrayed", "Overpowers",
                               "cannon", "Falls in", "alliance", "pact",
                               "Meets", "knife", "blade", "sword", "Hunt"])]
        normal    = [p for p in players if p["alive"] and p not in key_events]

        # deaths
        if deaths:
            print("  ── CANNONS " + "─" * (W - 12))
            for p in deaths:
                d = p["dialogue"] or ""
                print(f"\n  ✦ {p['name'].upper()} (D{p['district']})")
                print(_wrap(d))
            print()

        # key events
        if key_events:
            print("  ── KEY EVENTS " + "─" * (W - 15))
            for p in key_events:
                hp_str = _hp_display(p["health"])
                inj    = p.get("injuries", [])
                inj_str = f"  [{inj[0]}]" if inj else ""
                d = p["dialogue"] or ""
                print(f"\n  {p['name']:<12} D{p['district']:<3}{hp_str}{inj_str}")
                print(_wrap(d))
            print()

        # normal / idle
        if normal:
            print("  ── IN THE FIELD " + "─" * (W - 17))
            for p in normal:
                hp_str = _hp_display(p["health"])
                inj    = p.get("injuries", [])
                inj_str = f"  [{inj[0]}]" if inj else ""
                d = p["dialogue"] or ""
                print(f"\n  {p['name']:<12} D{p['district']:<3}{hp_str}{inj_str}")
                print(_wrap(d))

        print()

    # ── final result ─────────────────────────────────────────────────────
    print(_divider("═"))
    w = sim.winner()
    if w:
        print()
        _box([
            f"VICTOR:  {w.name.upper()}  (District {w.district})",
            f"Threat rating: {w.overall}   ·   Kills: {w.kills}",
            f"Injuries sustained: {len(w.injuries)}",
            *(f"  — {inj}" for inj in w.injuries),
        ])
    elif len(sim.alive) == 0:
        print("\n  MUTUAL DESTRUCTION — the last tributes fell together. No victor.")
    else:
        print(f"\n  STALEMATE — {len(sim.alive)} still standing at turn limit.")
    print()

    # ── save JSON ─────────────────────────────────────────────────────────
    with open("sim_output.json", "w") as f:
        json.dump({
            "seed":        seed,
            "region_map":  [[{"plains": ".", "forest": "T", "mountain": "^",
                               "water": "~", "cornucopia": "C",
                               "swamp": "S", "hills": "H",
                               "desert": "D", "ruins": "R",
                               "toxic_bog": "B"}[c]
                             for c in row] for row in sim.arena],
            "roster": [
                {"name": p.name, "district": p.district,
                 "overall": p.overall, "stats": p.stats}
                for p in sim.players
            ],
            "snapshots": snaps,
        }, f, indent=2)
    print(f"  Saved → sim_output.json")
    print()


if __name__ == "__main__":
    main()
