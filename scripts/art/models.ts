// Building models drawn with the ray caster in solids.ts: houses, industry, civic
// buildings and new brick and modern shapes (ART_DIRECTION.md §4, §5, §9). Each
// model is a function of level and colour scheme that returns solids; this file
// lays the lot, renders the solids, derives the abandoned variant and writes one
// asset folder per model, level and scheme. Run: pnpm art
import { join } from "node:path";
import type { Family } from "../../src/core/assets";
import {
  COLORS,
  CREDITS,
  Canvas,
  type Hex,
  RAMPS,
  eachDiamondPixel,
  noise,
  writeFolder,
} from "./kit";
import {
  type Detail,
  type Hit,
  type Material,
  type Part,
  box,
  cylinder,
  dome,
  gable,
  pyramid,
  render,
  wallSpot,
} from "./solids";

/** World units per tile side (solids.ts). */
const T = 16;

// Materials -------------------------------------------------------------------

const ramp = (...ramp: Hex[]): Material => ({ ramp });

const PLASTER: Record<string, Material> = {
  cream: ramp("694f62", "966c6c", "ab947a", "fdcbb0"),
  blue: ramp("323353", "484a77", "4d65b4", "8fd3ff"),
  pink: ramp("7a3045", "a24b6f", "cf657f", "ed8099"),
  yellow: ramp("9e4539", "f79617", "f9c22b", "fbff86"),
  white: ramp("3e3546", "7f708a", "9babb2", "c7dcd0"),
  mint: ramp("0b5e65", "0b8a8f", "0eaf9b", "8ff8e2"),
};
const ROOF: Record<string, Material> = {
  red: ramp(...RAMPS.roofTiles),
  slate: ramp("2e222f", "3e3546", "484a77", "625565", "7f708a"),
  brown: ramp("45293f", "694f62", "966c6c", "ab947a"),
  teal: ramp(...RAMPS.teal),
  green: ramp("165a4c", "239063", "1ebc73", "91db69"),
};
const BRICK = ramp(...RAMPS.brick);
const DARK_BRICK = ramp("45293f", "6e2727", "9e4539", "cd683d");
const STONE = ramp("625565", "7f708a", "9babb2", "c7dcd0");
const SAND_STONE = ramp("694f62", "966c6c", "ab947a", "fca790", "fdcbb0");
const METAL = ramp(...RAMPS.concrete);
const RUST = ramp("4c3e24", "6e2727", "9e4539", "cd683d", "e6904e");
const GLASS = ramp(...RAMPS.glass);
const TEAL_GLASS = ramp("0b5e65", "0b8a8f", "0eaf9b", "30e1b9", "8ff8e2");
const GOLD = ramp("9e4539", "f79617", "f9c22b", "fbff86");
const HEDGE = ramp(...RAMPS.foliage);
const WATER = ramp("323353", "4d65b4", "4d9be6", "8fd3ff");

// Facade details ----------------------------------------------------------------

interface Windows {
  seed: string;
  abandoned: boolean;
  /** Column period along the wall, window width, storey height and sill. */
  period: number;
  width: number;
  storey: number;
  sill: number;
  height: number;
  /** Lowest and highest z with windows. */
  from: number;
  to: number;
  /** Leave this far from each wall end solid. */
  margin: number;
  /** Wall length along s, for the margins. */
  s0: number;
  s1: number;
  lit?: number;
  glass?: readonly [Hex, Hex];
  /** Doors: s ranges on the left wall at the ground floor. */
  doors?: readonly [number, number][];
  doorColor?: Hex;
}

function windows(w: Windows): Detail {
  const [lightGlass, darkGlass] = w.glass ?? [RAMPS.glass[3], COLORS.darkWindow];
  return (hit) => {
    const spot = wallSpot(hit);
    if (!spot) return null;
    const s = Math.floor(spot.s);
    const z = Math.floor(spot.z);
    if (spot.side === "left" && w.doors)
      for (const [a, b] of w.doors)
        if (s >= a && s < b && z >= 0 && z < 5)
          return w.abandoned ? COLORS.board : (w.doorColor ?? "45293f");
    if (s < w.s0 + w.margin || s >= w.s1 - w.margin) return null;
    if (z < w.from || z >= w.to) return null;
    const col = Math.floor((s - w.s0 - w.margin) / w.period);
    const inCol = (s - w.s0 - w.margin) % w.period;
    const floor = Math.floor((z - w.from) / w.storey);
    const inFloor = (z - w.from) % w.storey;
    if (inCol >= w.width || inFloor < w.sill || inFloor >= w.sill + w.height) return null;
    const n = noise(w.seed, spot.side, col, floor);
    if (w.abandoned) return n < 0.5 ? (inFloor === w.sill + 1 ? "45293f" : COLORS.board) : "2e222f";
    if (n < (w.lit ?? 0.25)) return COLORS.litWindow;
    return spot.side === "left"
      ? inFloor === w.sill + w.height - 1
        ? RAMPS.glass[4]
        : lightGlass
      : darkGlass;
  };
}

/** Horizontal stripes every `every` units of height on walls, for floors and cornices. */
function bands(every: number, color: { left: Hex; right: Hex }, offset = 0): Detail {
  return (hit) => {
    const spot = wallSpot(hit);
    if (!spot || Math.floor(spot.z) <= 0) return null;
    return (Math.floor(spot.z) - offset) % every === 0 ? color[spot.side] : null;
  };
}

/** The first detail that answers wins. */
const all =
  (...details: (Detail | undefined)[]): Detail =>
  (hit: Hit) => {
    for (const d of details) {
      const c = d?.(hit);
      if (c) return c;
    }
    return null;
  };

// Lots ----------------------------------------------------------------------------

type Lot = "paved" | "lawn" | "yard" | "plaza";

function drawLot(c: Canvas, kind: Lot, abandoned: boolean, seed: string) {
  const top = c.height - c.width / 2;
  eachDiamondPixel(
    c.width,
    (x, y, { x: lx, y: ly, top: t, bottom }) => {
      const joint = (lx + 2 * ly) % 16 === 0 || (((lx - 2 * ly) % 16) + 16) % 16 === 0;
      const rim = ly - t < 2 || bottom - ly < 2;
      let color: Hex;
      if (abandoned) color = noise(seed, "dirt", x, y) < 0.1 ? RAMPS.dirt[1] : RAMPS.dirt[2];
      else if (kind === "paved") color = joint ? COLORS.sidewalkJoint : COLORS.sidewalk;
      else if (kind === "plaza")
        color = joint
          ? COLORS.sidewalk
          : (Math.floor(lx / 8) + ly) % 4 === 0
            ? COLORS.sidewalk
            : COLORS.curb;
      else if (kind === "yard")
        color = rim
          ? COLORS.sidewalk
          : noise(seed, "oil", x, y) < 0.04
            ? RAMPS.asphalt[0]
            : RAMPS.asphalt[2];
      else
        color = rim
          ? COLORS.sidewalk
          : noise(seed, "grass", x, y) < 0.12
            ? RAMPS.foliage[2]
            : RAMPS.foliage[1];
      c.set(x, y, color);
    },
    0,
    top,
  );
  if (!abandoned) return;
  eachDiamondPixel(
    c.width,
    (x, y) => {
      const n = noise(seed, "weed", x, y);
      if (n < 0.06) {
        c.set(x, y, RAMPS.dry[2]);
        c.set(x, y - 1, RAMPS.dry[1]);
      } else if (n < 0.09) c.set(x, y, RAMPS.foliage[1]);
    },
    0,
    top,
  );
}

// Abandoned: same silhouette, colours faded toward dull greys and browns (§9.2).
const DULL: Hex[] = [
  "2e222f",
  "3e3546",
  "45293f",
  "625565",
  "694f62",
  "966c6c",
  "7f708a",
  "ab947a",
];
const lum = (h: Hex) =>
  0.3 * parseInt(h.slice(0, 2), 16) +
  0.59 * parseInt(h.slice(2, 4), 16) +
  0.11 * parseInt(h.slice(4, 6), 16);
const fadeCache = new Map<Hex, Hex>();
function fade(h: Hex): Hex {
  let out = fadeCache.get(h);
  if (!out) {
    const target = lum(h) * 0.72;
    out = DULL.reduce((a, b) => (Math.abs(lum(b) - target) < Math.abs(lum(a) - target) ? b : a));
    fadeCache.set(h, out);
  }
  return out;
}

// Models ------------------------------------------------------------------------------

interface Ctx {
  level: number;
  scheme: string;
  abandoned: boolean;
  seed: string;
}

interface Model {
  name: string;
  family: Family;
  footprint: 1 | 2 | 3 | 4;
  levels: number[];
  lot: Lot;
  schemes?: string[];
  parts: (ctx: Ctx) => Part[];
}

const houseWindows = (
  ctx: Ctx,
  s0: number,
  s1: number,
  storeys: number,
  doors: [number, number][],
) =>
  windows({
    seed: ctx.seed,
    abandoned: ctx.abandoned,
    period: 5,
    width: 2,
    storey: 7,
    sill: 2,
    height: 3,
    from: 0,
    to: storeys * 7,
    margin: 2,
    s0,
    s1,
    doors,
    lit: 0.35,
  });

/** A gabled house, 1 to 3 storeys, with a chimney. */
function house(ctx: Ctx): Part[] {
  const storeys = ctx.level;
  const h = storeys * 7;
  const walls = PLASTER[ctx.scheme]!;
  const roof = ctx.scheme === "blue" || ctx.scheme === "white" ? ROOF.slate! : ROOF.red!;
  const parts: Part[] = [
    {
      solid: box(3, 4, 0, 13, 13, h),
      material: walls,
      detail: houseWindows(ctx, 3, 13, storeys, [[6, 8]]),
    },
  ];
  if (storeys === 3) parts.push({ solid: pyramid(2, 3, 14, 14, h, 8), material: roof });
  else parts.push({ solid: gable(2, 3, 14, 14, h, 6, "u"), material: roof });
  parts.push({ solid: box(10, 5, h, 12, 7, h + 9), material: BRICK });
  // A porch roof over the door.
  if (storeys > 1) parts.push({ solid: box(4, 13, 5, 10, 15, 6), material: roof });
  return parts;
}

/** Two small houses side by side behind a hedge. */
function duplex(ctx: Ctx): Part[] {
  const walls = PLASTER[ctx.scheme]!;
  const other = PLASTER[ctx.scheme === "cream" ? "white" : "cream"]!;
  const parts: Part[] = [];
  for (const [i, m] of [
    [0, walls],
    [1, other],
  ] as const) {
    const u0 = 3 + i * 14;
    parts.push({
      solid: box(u0, 6, 0, u0 + 11, 18, 12),
      material: m,
      detail: houseWindows(ctx, u0, u0 + 11, 2, [[u0 + 4, u0 + 6]]),
    });
    parts.push({ solid: gable(u0 - 1, 5, u0 + 12, 19, 12, 7, "v"), material: ROOF.red! });
  }
  parts.push({ solid: box(2, 26, 0, 30, 28, 3), material: HEDGE });
  parts.push({ solid: box(26, 4, 12, 28, 6, 22), material: BRICK });
  return parts;
}

/** A row of townhouses under one long roof with dormers. */
function terrace(ctx: Ctx): Part[] {
  const walls = PLASTER[ctx.scheme]!;
  const parts: Part[] = [
    {
      solid: box(3, 8, 0, 29, 24, 20),
      material: walls,
      detail: all(
        houseWindows(ctx, 3, 29, 3, [
          [6, 8],
          [15, 17],
          [24, 26],
        ]),
        bands(7, { left: walls.ramp[1]!, right: walls.ramp[0]! }, 0),
      ),
    },
    { solid: gable(2, 7, 30, 25, 20, 8, "u"), material: ROOF.slate! },
  ];
  for (const u of [6, 15, 24])
    parts.push({ solid: gable(u, 18, u + 5, 24, 24, 3, "v"), material: walls });
  for (const u of [10, 19]) parts.push({ solid: box(u, 12, 24, u + 2, 14, 32), material: BRICK });
  return parts;
}

/** A flat-roofed apartment block with balconies; taller per level and footprint. */
function apartments(tiles: number) {
  return (ctx: Ctx): Part[] => {
    const S = tiles * T;
    const storeys = tiles * 2 + ctx.level * 2;
    const h = storeys * 7 + 2;
    const walls = PLASTER[ctx.scheme]!;
    const parts: Part[] = [
      {
        solid: box(4, 4, 0, S - 4, S - 4, h),
        material: walls,
        detail: all(
          windows({
            seed: ctx.seed,
            abandoned: ctx.abandoned,
            period: 6,
            width: 3,
            storey: 7,
            sill: 2,
            height: 3,
            from: 7,
            to: h - 2,
            margin: 3,
            s0: 4,
            s1: S - 4,
          }),
          bands(7, { left: walls.ramp[2]!, right: walls.ramp[1]! }, 0),
        ),
      },
      { solid: box(3, 3, h, S - 3, S - 3, h + 2), material: STONE },
      { solid: box(S / 2 - 6, S / 2 - 6, h + 2, S / 2 + 2, S / 2 + 2, h + 8), material: STONE },
    ];
    // Balconies on the left wall, every other storey.
    for (let f = 1; f < storeys; f += 2)
      for (let u = 8; u + 6 < S - 4; u += 12)
        parts.push({ solid: box(u, S - 4, f * 7, u + 6, S - 2, f * 7 + 2), material: STONE });
    // Entrance canopy.
    parts.push({ solid: box(S / 2 - 4, S - 4, 5, S / 2 + 4, S - 1, 6), material: ROOF.teal! });
    if (tiles >= 3) parts.push({ solid: box(6, 6, h + 2, 14, 14, h + 4), material: HEDGE });
    return parts;
  };
}

/** Twin residential towers on a podium. */
function towers(ctx: Ctx): Part[] {
  const S = 4 * T;
  const walls = PLASTER[ctx.scheme]!;
  const podium = 14;
  const h = podium + 40 + ctx.level * 22;
  const tower = (u0: number, v0: number, hh: number): Part[] => [
    {
      solid: box(u0, v0, podium, u0 + 22, v0 + 22, hh),
      material: walls,
      detail: windows({
        seed: ctx.seed + u0,
        abandoned: ctx.abandoned,
        period: 4,
        width: 2,
        storey: 6,
        sill: 2,
        height: 3,
        from: podium,
        to: hh - 2,
        margin: 2,
        s0: u0,
        s1: u0 + 22,
      }),
    },
    { solid: box(u0 + 6, v0 + 6, hh, u0 + 16, v0 + 16, hh + 6), material: STONE },
  ];
  return [
    {
      solid: box(4, 4, 0, S - 4, S - 4, podium),
      material: STONE,
      detail: windows({
        seed: ctx.seed,
        abandoned: ctx.abandoned,
        period: 6,
        width: 4,
        storey: 7,
        sill: 1,
        height: 4,
        from: 1,
        to: podium,
        margin: 4,
        s0: 4,
        s1: S - 4,
        lit: 0.6,
      }),
    },
    { solid: box(32, 32, podium, 58, 58, podium + 2), material: HEDGE },
    ...tower(8, 8, h),
    ...tower(34, 10, h - 18),
  ];
}

/** A modernist bungalow with a flat roof and a pool. */
function bungalow(ctx: Ctx): Part[] {
  const walls = PLASTER.white!;
  return [
    {
      solid: box(2, 2, 0, 12, 9, 8),
      material: walls,
      detail: windows({
        seed: ctx.seed,
        abandoned: ctx.abandoned,
        period: 4,
        width: 3,
        storey: 8,
        sill: 2,
        height: 4,
        from: 0,
        to: 8,
        margin: 1,
        s0: 2,
        s1: 12,
        lit: 0.4,
      }),
    },
    { solid: box(1, 1, 8, 14, 10, 9), material: ROOF.slate! },
    {
      solid: box(4, 11, 0, 13, 15, 1),
      material: ctx.abandoned ? ROOF.brown! : WATER,
      flat: true,
    },
  ];
}

// Industry

const corrugated =
  (period: number, m: Material): Detail =>
  (hit) => {
    const spot = wallSpot(hit);
    if (!spot) return null;
    return Math.floor(spot.s) % period === 0 ? m.ramp[spot.side === "left" ? 1 : 0]! : null;
  };

const rollDoor =
  (a: number, b: number, height: number, m: Material): Detail =>
  (hit) => {
    const spot = wallSpot(hit);
    if (!spot || spot.side !== "left") return null;
    const s = Math.floor(spot.s);
    const z = Math.floor(spot.z);
    if (s < a || s >= b || z >= height) return null;
    return z % 2 === 0 ? m.ramp[1]! : m.ramp[2]!;
  };

function shed(ctx: Ctx): Part[] {
  const h = 6 + ctx.level * 4;
  return [
    {
      solid: box(2, 3, 0, 14, 13, h),
      material: METAL,
      detail: all(rollDoor(4, 10, 7, RUST), corrugated(2, METAL)),
    },
    { solid: gable(1, 2, 15, 14, h, 4, "u"), material: RUST },
  ];
}

function silos(ctx: Ctx): Part[] {
  const h = 26 + ctx.level * 4;
  const bands2 = (hit: Hit) => (Math.floor(hit.p[2]) % 8 === 0 ? RAMPS.concrete[2]! : null);
  return [
    { solid: cylinder(5, 5, 4, 0, h - 4), material: STONE, detail: bands2 },
    { solid: dome(5, 5, h - 4, 4), material: METAL },
    { solid: cylinder(11, 10, 4.5, 0, h), material: STONE, detail: bands2 },
    { solid: dome(11, 10, h, 4.5), material: METAL },
    { solid: box(3, 11, 0, 7, 15, 6), material: RUST },
  ];
}

/** A warehouse with a row of gabled roofs (a sawtooth from afar) and loading doors. */
function warehouse(ctx: Ctx): Part[] {
  const h = 10 + ctx.level * 4;
  const parts: Part[] = [
    {
      solid: box(3, 4, 0, 29, 28, h),
      material: BRICK,
      detail: all(
        rollDoor(6, 12, 8, METAL),
        rollDoor(16, 22, 8, METAL),
        windows({
          seed: ctx.seed,
          abandoned: ctx.abandoned,
          period: 4,
          width: 2,
          storey: 20,
          sill: h - 5,
          height: 2,
          from: 0,
          to: h,
          margin: 2,
          s0: 3,
          s1: 29,
          lit: 0.1,
        }),
      ),
    },
  ];
  for (let i = 0; i < 4; i++) {
    const u0 = 3 + i * 6.5;
    parts.push({ solid: gable(u0, 4, u0 + 6.5, 28, h, 4, "v"), material: METAL });
  }
  parts.push({
    solid: box(25, 22, 0, 31, 30, 4),
    material: ramp("4c3e24", "694f62", "966c6c", "ab947a"),
  });
  return parts;
}

function tanks(tiles: number) {
  return (ctx: Ctx): Part[] => {
    const S = tiles * T;
    const r = tiles === 2 ? 6 : 8;
    const h = 10 + ctx.level * 4;
    const spots =
      tiles === 2
        ? [
            [9, 9],
            [23, 10],
            [10, 23],
          ]
        : [
            [12, 12],
            [33, 12],
            [12, 34],
            [33, 34],
          ];
    const parts: Part[] = [];
    spots.forEach(([u, v], i) => {
      const m = i % 2 ? STONE : ramp("625565", "9babb2", "c7dcd0", "c7dcd0");
      parts.push({
        solid: cylinder(u!, v!, r, 0, h),
        material: m,
        detail: (hit) => (Math.floor(hit.p[2]) === h - 3 ? COLORS.flowerPink : null),
      });
      parts.push({ solid: dome(u!, v!, h - r * 0.6, r, h), material: m });
    });
    parts.push({ solid: box(0, S / 2 - 1, 3, S, S / 2 + 1, 5), material: RUST });
    parts.push({ solid: box(S / 2 - 1, 0, 6, S / 2 + 1, S, 8), material: RUST });
    return parts;
  };
}

/** A factory hall with offices and chimneys; chimneys grow with the level. */
function factory(tiles: number) {
  return (ctx: Ctx): Part[] => {
    const S = tiles * T;
    const h = 14 + tiles * 2;
    const chimney = 30 + ctx.level * 12 + tiles * 4;
    const stripes = (hit: Hit) =>
      hit.p[2] > chimney - 8 && Math.floor(hit.p[2] / 3) % 2 === 0 ? RAMPS.roofTiles[2]! : null;
    const parts: Part[] = [
      {
        solid: box(4, 10, 0, S - 4, S - 4, h),
        material: DARK_BRICK,
        detail: all(
          rollDoor(10, 18, 9, METAL),
          windows({
            seed: ctx.seed,
            abandoned: ctx.abandoned,
            period: 5,
            width: 3,
            storey: 30,
            sill: h - 7,
            height: 4,
            from: 0,
            to: h,
            margin: 3,
            s0: 4,
            s1: S - 4,
            lit: 0.3,
          }),
        ),
      },
      { solid: gable(3, 9, S - 3, S - 3, h, 8, "u"), material: METAL },
      {
        solid: box(4, 3, 0, S / 2, 10, h + 6),
        material: BRICK,
        detail: windows({
          seed: ctx.seed + "o",
          abandoned: ctx.abandoned,
          period: 4,
          width: 2,
          storey: 7,
          sill: 2,
          height: 3,
          from: 2,
          to: h + 4,
          margin: 2,
          s0: 4,
          s1: S / 2,
        }),
      },
      { solid: cylinder(S - 10, 6, 3, 0, chimney), material: STONE, detail: stripes },
    ];
    if (tiles >= 3)
      parts.push({
        solid: cylinder(S - 18, 5, 2.5, 0, chimney - 14),
        material: STONE,
        detail: stripes,
      });
    return parts;
  };
}

/** A power plant: cooling tower, turbine hall and a tall chimney. */
function plant(ctx: Ctx): Part[] {
  const towerH = 34 + ctx.level * 8;
  const parts: Part[] = [];
  // The cooling tower narrows towards the middle: stacked cylinders.
  for (let i = 0; i < 8; i++) {
    const z0 = (i * towerH) / 8;
    const k = Math.abs(i - 5) / 5;
    parts.push({
      solid: cylinder(18, 18, 11 + 3 * k, z0, z0 + towerH / 8 + 0.5),
      material: STONE,
      detail: i === 7 ? (hit) => (hit.facing === "top" ? "3e3546" : null) : undefined,
    });
  }
  parts.push({
    solid: box(30, 34, 0, 60, 58, 18),
    material: METAL,
    detail: all(
      corrugated(3, METAL),
      windows({
        seed: ctx.seed,
        abandoned: ctx.abandoned,
        period: 6,
        width: 3,
        storey: 30,
        sill: 11,
        height: 3,
        from: 0,
        to: 18,
        margin: 3,
        s0: 30,
        s1: 60,
      }),
    ),
  });
  parts.push({ solid: gable(29, 33, 61, 59, 18, 6, "u"), material: RUST });
  const chimney = 60 + ctx.level * 14;
  parts.push({
    solid: cylinder(48, 14, 3, 0, chimney),
    material: STONE,
    detail: (hit) =>
      Math.floor(hit.p[2] / 4) % 2 === 0 && hit.p[2] > chimney - 16 ? RAMPS.roofTiles[2]! : null,
  });
  return parts;
}

// Civic

/** A clock tower with a pyramid roof; taller per level. */
function clockTower(ctx: Ctx): Part[] {
  const h = 22 + ctx.level * 10;
  const face = (hit: Hit): Hex | null => {
    const spot = wallSpot(hit);
    // One face, on the lit wall: two side by side read as a pair of eyes.
    if (!spot || spot.side !== "left") return null;
    const ds = spot.s - 8;
    const dz = spot.z - (h - 6);
    const d = Math.hypot(ds, dz);
    if (d < 0.8) return "2e222f";
    if (d < 2) return COLORS.curb;
    if (d < 2.8) return GOLD.ramp[1]!;
    return null;
  };
  return [
    { solid: box(3, 3, 0, 13, 13, 4), material: STONE },
    {
      solid: box(4, 4, 4, 12, 12, h),
      material: SAND_STONE,
      detail: all(face, bands(8, { left: SAND_STONE.ramp[2]!, right: SAND_STONE.ramp[1]! }, 4)),
    },
    { solid: box(3, 3, h, 13, 13, h + 2), material: STONE },
    { solid: pyramid(3, 3, 13, 13, h + 2, 12), material: ROOF.teal! },
  ];
}

const archWindows =
  (ctx: Ctx, s0: number, s1: number, z0: number, height: number): Detail =>
  (hit) => {
    const spot = wallSpot(hit);
    if (!spot) return null;
    const s = Math.floor(spot.s);
    const z = Math.floor(spot.z);
    if (s < s0 + 3 || s >= s1 - 3) return null;
    const inCol = (s - s0 - 3) % 6;
    if (inCol > 1 || z < z0 || z >= z0 + height) return null;
    if (ctx.abandoned) return COLORS.board;
    return z === z0 + height - 1
      ? RAMPS.glass[4]
      : z % 3 === 0
        ? COLORS.flowerYellow
        : RAMPS.glass[2];
  };

/** A chapel: a gabled nave and a steeple. */
function chapel(ctx: Ctx): Part[] {
  const navH = 14 + ctx.level * 2;
  const steeple = 34 + ctx.level * 6;
  return [
    {
      solid: box(4, 9, 0, 28, 23, navH),
      material: PLASTER.white!,
      detail: archWindows(ctx, 4, 28, 4, 7),
    },
    { solid: gable(3, 8, 29, 24, navH, 8, "u"), material: ROOF.slate! },
    {
      solid: box(20, 20, 0, 28, 28, steeple),
      material: PLASTER.white!,
      detail: archWindows(ctx, 20, 28, steeple - 9, 5),
    },
    { solid: pyramid(19, 19, 29, 29, steeple, 16), material: ROOF.slate! },
    {
      solid: box(23, 23, steeple + 16, 25, 25, steeple + 21),
      material: GOLD,
    },
  ];
}

/** A colonnade in front of a stone hall, under a pediment. */
function library(tiles: number) {
  return (ctx: Ctx): Part[] => {
    const S = tiles * T;
    const h = 14 + ctx.level * 3 + tiles * 2;
    const parts: Part[] = [
      { solid: box(2, 2, 0, S - 2, S - 2, 2), material: STONE },
      { solid: box(3, 3, 2, S - 3, S - 3, 3), material: STONE },
      {
        solid: box(5, 5, 3, S - 5, S - 9, h),
        material: SAND_STONE,
        detail: archWindows(ctx, 5, S - 5, 8, h - 12),
      },
      { solid: box(4, 4, h, S - 4, S - 4, h + 2), material: STONE },
      {
        solid: gable(4, 4, S - 4, S - 4, h + 2, 6 + tiles, "v"),
        material: ROOF.slate!,
        // The front gable end is a stone pediment.
        detail: (hit) => (hit.facing === "left" ? STONE.ramp[2]! : null),
      },
    ];
    for (let u = 7; u < S - 5; u += 5)
      parts.push({
        solid: cylinder(u, S - 6, 1.2, 3, h),
        material: ramp("625565", "9babb2", "c7dcd0", "c7dcd0"),
      });
    return parts;
  };
}

/** A capitol: wings, a portico and a dome on a drum. */
function capitol(tiles: number) {
  return (ctx: Ctx): Part[] => {
    const S = tiles * T;
    const c = S / 2;
    const h = 16 + tiles * 2;
    const drum = h + 6 + ctx.level * 4;
    const r = tiles * 3 + 2;
    const parts: Part[] = [
      { solid: box(2, 2, 0, S - 2, S - 2, 3), material: STONE },
      {
        solid: box(4, 4, 3, S - 4, S - 4, h),
        material: SAND_STONE,
        detail: archWindows(ctx, 4, S - 4, 7, h - 11),
      },
      { solid: box(3, 3, h, S - 3, S - 3, h + 2), material: STONE },
      {
        solid: cylinder(c, c, r, h + 2, drum),
        material: STONE,
        detail: archWindows(ctx, -99, 99, h + 4, drum - h - 6),
      },
      { solid: dome(c, c, drum, r), material: ctx.abandoned ? STONE : ROOF.teal! },
      { solid: cylinder(c, c, 1.5, drum + r - 1, drum + r + 5), material: GOLD },
    ];
    for (let u = c - 10; u <= c + 10; u += 4)
      parts.push({
        solid: cylinder(u, S - 5, 1.2, 3, h),
        material: ramp("625565", "9babb2", "c7dcd0", "c7dcd0"),
      });
    return parts;
  };
}

// Brick and modern

/** A brick hall with a copper mansard roof and dormers. */
function brickHall(ctx: Ctx): Part[] {
  const S = 2 * T;
  const h = 10 + ctx.level * 7;
  return [
    {
      solid: box(3, 3, 0, S - 3, S - 3, h),
      material: BRICK,
      detail: all(
        archWindows(ctx, 3, S - 3, 3, 5),
        windows({
          seed: ctx.seed,
          abandoned: ctx.abandoned,
          period: 6,
          width: 2,
          storey: 7,
          sill: 2,
          height: 4,
          from: 10,
          to: h,
          margin: 3,
          s0: 3,
          s1: S - 3,
        }),
        bands(7, { left: RAMPS.brick[3], right: RAMPS.brick[2] }, 3),
      ),
    },
    { solid: pyramid(2, 2, S - 2, S - 2, h, 10), material: ROOF.teal! },
    { solid: box(8, 22, h + 1, 12, 26, h + 6), material: ROOF.teal! },
    { solid: box(18, 22, h + 1, 22, 26, h + 6), material: ROOF.teal! },
  ];
}

/** A round glass tower on a stone podium. */
function roundTower(tiles: number) {
  return (ctx: Ctx): Part[] => {
    const S = tiles * T;
    const c = S / 2;
    const r = tiles * 5;
    const h = 30 + ctx.level * 20 + tiles * 8;
    const glass = (hit: Hit): Hex | null => {
      const z = Math.floor(hit.p[2]);
      if (hit.facing === "top") return null;
      if (z % 5 === 0) return RAMPS.concrete[4];
      const angle = Math.atan2(hit.p[1] - c, hit.p[0] - c);
      const col = Math.floor((angle + Math.PI) * r * 0.5);
      const n = noise(ctx.seed, col, Math.floor(z / 5));
      if (ctx.abandoned) return n < 0.5 ? COLORS.board : "2e222f";
      return n < 0.15 ? COLORS.litWindow : null;
    };
    return [
      { solid: box(3, 3, 0, S - 3, S - 3, 8), material: STONE },
      { solid: cylinder(c, c, r, 8, h), material: GLASS, detail: glass },
      { solid: cylinder(c, c, r - 2, h, h + 4), material: STONE },
      { solid: cylinder(c, c, 0.6, h + 4, h + 14), material: METAL },
    ];
  };
}

/** A slim teal glass slab with a crown. */
function slab(ctx: Ctx): Part[] {
  const h = 20 + ctx.level * 14;
  return [
    {
      solid: box(3, 4, 0, 13, 12, h),
      material: TEAL_GLASS,
      detail: windows({
        seed: ctx.seed,
        abandoned: ctx.abandoned,
        period: 3,
        width: 2,
        storey: 5,
        sill: 1,
        height: 4,
        from: 5,
        to: h - 1,
        margin: 1,
        s0: 3,
        s1: 13,
        glass: [TEAL_GLASS.ramp[3]!, TEAL_GLASS.ramp[1]!],
        lit: 0.15,
      }),
    },
    { solid: box(5, 6, h, 11, 10, h + 5), material: STONE },
    { solid: box(7, 7, h + 5, 9, 9, h + 12), material: METAL },
  ];
}

/** A corner shop with an awning and a rooftop sign. */
function shop(ctx: Ctx): Part[] {
  const h = 7 + ctx.level * 6;
  const scheme = PLASTER[ctx.scheme]!;
  const awning: Detail = (hit) => {
    if (
      hit.facing !== "slope" &&
      hit.facing !== "left" &&
      hit.facing !== "right" &&
      hit.facing !== "top"
    )
      return null;
    const k = Math.floor(hit.p[0] + hit.p[1]);
    return ctx.abandoned ? null : Math.floor(k / 2) % 2 ? COLORS.curb : RAMPS.roofTiles[1];
  };
  return [
    {
      solid: box(3, 3, 0, 13, 13, h),
      material: scheme,
      detail: all(
        (hit) => {
          const spot = wallSpot(hit);
          if (!spot || spot.z >= 5 || spot.z < 1) return null;
          const s = Math.floor(spot.s);
          if (s < 4 || s > 11) return null;
          return ctx.abandoned ? COLORS.board : spot.z >= 4 ? RAMPS.glass[4] : RAMPS.glass[2];
        },
        windows({
          seed: ctx.seed,
          abandoned: ctx.abandoned,
          period: 4,
          width: 2,
          storey: 6,
          sill: 2,
          height: 3,
          from: 7,
          to: h,
          margin: 2,
          s0: 3,
          s1: 13,
        }),
      ),
    },
    { solid: gable(3, 13, 13, 16, 6, 1, "u"), material: ROOF.red!, detail: awning },
    { solid: box(2, 2, h, 14, 14, h + 1), material: STONE },
    { solid: box(5, 7, h + 1, 11, 8, h + 6), material: GOLD },
  ];
}

const HOUSE_SCHEMES = ["cream", "blue", "pink", "yellow"];

const MODELS: Model[] = [
  {
    name: "house",
    family: "residential",
    footprint: 1,
    levels: [1, 2, 3],
    lot: "lawn",
    schemes: HOUSE_SCHEMES,
    parts: house,
  },
  {
    name: "bungalow",
    family: "residential",
    footprint: 1,
    levels: [1],
    lot: "lawn",
    parts: bungalow,
  },
  {
    name: "duplex",
    family: "residential",
    footprint: 2,
    levels: [1],
    lot: "lawn",
    schemes: ["cream", "white"],
    parts: duplex,
  },
  {
    name: "terrace",
    family: "residential",
    footprint: 2,
    levels: [2],
    lot: "lawn",
    schemes: ["yellow", "pink", "mint"],
    parts: terrace,
  },
  {
    name: "apartments",
    family: "residential",
    footprint: 2,
    levels: [3],
    lot: "paved",
    schemes: ["cream", "blue"],
    parts: apartments(2),
  },
  {
    name: "apartments-large",
    family: "residential",
    footprint: 3,
    levels: [1, 2, 3],
    lot: "paved",
    schemes: ["cream", "white", "pink"],
    parts: apartments(3),
  },
  {
    name: "towers",
    family: "residential",
    footprint: 4,
    levels: [1, 2, 3],
    lot: "paved",
    schemes: ["white", "cream"],
    parts: towers,
  },
  { name: "shed", family: "industrial", footprint: 1, levels: [1, 2], lot: "yard", parts: shed },
  { name: "silos", family: "industrial", footprint: 1, levels: [3], lot: "yard", parts: silos },
  {
    name: "warehouse",
    family: "industrial",
    footprint: 2,
    levels: [1, 2],
    lot: "yard",
    parts: warehouse,
  },
  { name: "tanks", family: "industrial", footprint: 2, levels: [3], lot: "yard", parts: tanks(2) },
  {
    name: "tank-farm",
    family: "industrial",
    footprint: 3,
    levels: [1],
    lot: "yard",
    parts: tanks(3),
  },
  {
    name: "factory",
    family: "industrial",
    footprint: 3,
    levels: [2, 3],
    lot: "yard",
    parts: factory(3),
  },
  {
    name: "power-plant",
    family: "industrial",
    footprint: 4,
    levels: [1, 2, 3],
    lot: "yard",
    parts: plant,
  },
  {
    name: "clock-tower",
    family: "civic",
    footprint: 1,
    levels: [1, 2, 3],
    lot: "plaza",
    parts: clockTower,
  },
  { name: "chapel", family: "civic", footprint: 2, levels: [1, 2], lot: "plaza", parts: chapel },
  { name: "library", family: "civic", footprint: 2, levels: [3], lot: "plaza", parts: library(2) },
  { name: "hall", family: "civic", footprint: 3, levels: [1, 2], lot: "plaza", parts: library(3) },
  { name: "capitol", family: "civic", footprint: 3, levels: [3], lot: "plaza", parts: capitol(3) },
  {
    name: "capitol-grand",
    family: "civic",
    footprint: 4,
    levels: [1, 2, 3],
    lot: "plaza",
    parts: capitol(4),
  },
  {
    name: "brick-hall",
    family: "brick",
    footprint: 2,
    levels: [1, 2, 3],
    lot: "paved",
    parts: brickHall,
  },
  {
    name: "brick-shop",
    family: "brick",
    footprint: 1,
    levels: [1, 2],
    lot: "paved",
    schemes: ["cream", "mint"],
    parts: shop,
  },
  {
    name: "modern-round",
    family: "modern",
    footprint: 2,
    levels: [2, 3],
    lot: "paved",
    parts: roundTower(2),
  },
  {
    name: "modern-round-large",
    family: "modern",
    footprint: 3,
    levels: [2, 3],
    lot: "paved",
    parts: roundTower(3),
  },
  {
    name: "modern-slab",
    family: "modern",
    footprint: 1,
    levels: [1, 2, 3],
    lot: "paved",
    parts: slab,
  },
];

function draw(model: Model, level: number, scheme: string, abandoned: boolean): Canvas {
  const tiles = model.footprint;
  const c = new Canvas(tiles * 32, tiles * 16 + 240);
  const seed = `${model.name}:${level}:${scheme}`;
  drawLot(c, model.lot, abandoned, seed);
  const covered = render(c, tiles, model.parts({ level, scheme, abandoned, seed }));
  if (abandoned)
    for (let y = 0; y < c.height; y++)
      for (let x = 0; x < c.width; x++) {
        const now = c.get(x, y);
        if (now && covered[y * c.width + x]) c.set(x, y, fade(now));
      }
  return c.cropTop(tiles * 16);
}

const root = join("assets", "buildings");
let count = 0;
const shapes = new Set<string>();
for (const model of MODELS) {
  for (const level of model.levels) {
    for (const scheme of model.schemes ?? ["default"]) {
      const suffix = model.schemes ? `-${scheme}` : "";
      const prefix = model.name.startsWith(model.family)
        ? ""
        : `${model.family === "residential" ? "res" : model.family === "industrial" ? "ind" : model.family === "civic" ? "civic" : model.family}-`;
      const id = `${prefix}${model.name}${suffix}-l${level}`;
      writeFolder({
        dir: join(root, id),
        manifest: {
          id,
          family: model.family,
          footprint: model.footprint,
          levels: [level],
          views: [0],
          symmetric: false,
          variants: ["default", "abandoned"],
          ...CREDITS,
        },
        files: {
          "view-0.png": draw(model, level, scheme, false),
          "view-0.abandoned.png": draw(model, level, scheme, true),
        },
      });
      shapes.add(model.name);
      count++;
    }
  }
}
console.log(`✓ Drew ${count} buildings from ${shapes.size} models`);
