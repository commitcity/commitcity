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
  type Solid,
  type Vec,
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
const GOLD = ramp("9e4539", "f79617", "f9c22b", "fbff86");
const HEDGE = ramp(...RAMPS.foliage);
const ROOF_GARDEN = ramp("165a4c", "165a4c", "239063", "1ebc73");
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

type Lot = "paved" | "lawn" | "yard" | "plaza" | "meadow";

function drawLot(c: Canvas, kind: Lot, abandoned: boolean, seed: string) {
  // A meadow or a lawn is the city's own grass: nothing is drawn, so the ground
  // tiles show through and the building does not seem to stand on a raised plot.
  if ((kind === "meadow" || kind === "lawn") && !abandoned) return;
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
      else
        color = rim
          ? COLORS.sidewalk
          : noise(seed, "oil", x, y) < 0.04
            ? RAMPS.asphalt[0]
            : RAMPS.asphalt[2];
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

const HOUSE_ROOFS: Record<string, string> = {
  cream: "red",
  blue: "slate",
  pink: "brown",
  yellow: "green",
  mint: "teal",
  white: "slate",
};

/** A gabled house, 1 to 3 storeys, with a chimney. */
function house(ctx: Ctx): Part[] {
  const storeys = ctx.level;
  const h = storeys * 7;
  const walls = PLASTER[ctx.scheme]!;
  const roof = ROOF[HOUSE_ROOFS[ctx.scheme] ?? "red"]!;
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
    {
      solid: gable(1, 2, 15, 14, h, 4, "u"),
      material: ctx.scheme === "rust" ? RUST : ROOF[ctx.scheme]!,
    },
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
    const g = tiles === 2 ? TINTS.sky!.ramp : TINTS.blue!.ramp;
    return [
      { solid: box(3, 3, 0, S - 3, S - 3, 8), material: STONE },
      { solid: cylinder(c, c, r, 8, h), material: g, detail: curtain(ctx, g, 5, 3, 8) },
      { solid: cylinder(c, c, r - 2, h, h + 4), material: STONE },
      { solid: cylinder(c, c, 0.6, h + 4, h + 14), material: METAL },
    ];
  };
}

/** A slim glass slab with a crown. */
function slab(ctx: Ctx): Part[] {
  const h = 20 + ctx.level * 14;
  const g = TINTS.silver!.ramp;
  return [
    { solid: box(3, 4, 0, 13, 12, h), material: g, detail: curtain(ctx, g, 4, 3) },
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

// More variety: colour schemes beyond orange brick and blue glass, houses for
// every family and landmark shapes (TheoTown served as a loose reference).

const WALLS: Record<string, Material> = {
  redbrick: ramp("45293f", "6e2727", "9e4539", "b33831"),
  brownbrick: ramp("45293f", "694f62", "966c6c", "ab947a"),
  ochre: ramp("694f62", "9e4539", "e6904e", "fbb954"),
  plum: ramp("45293f", "753c54", "a24b6f", "cf657f"),
  sage: ramp("313638", "374e4a", "547e64", "92a984"),
  stone: ramp("3e3546", "625565", "7f708a", "9babb2"),
  white: ramp("625565", "7f708a", "9babb2", "c7dcd0"),
  sand: ramp("694f62", "966c6c", "ab947a", "fdcbb0"),
  lilac: ramp("45293f", "6b3e75", "905ea9", "a884f3"),
  peach: ramp("753c54", "cd683d", "fca790", "fdcbb0"),
  mint: ramp("0b5e65", "0b8a8f", "0eaf9b", "8ff8e2"),
  charcoal: ramp("2e222f", "3e3546", "625565", "7f708a"),
  lemon: ramp("676633", "a2a947", "d5e04b", "fbff86"),
};
const ROOFS: Record<string, Material> = {
  ...ROOF,
  purple: ramp("2e222f", "45293f", "6b3e75", "905ea9"),
  dark: ramp("2e222f", "3e3546", "625565", "7f708a"),
  wine: ramp("45293f", "831c5d", "c32454", "f04f78"),
};
/**
 * Glass tints, after real curtain walls: pale and greyish on the lit face, deep on
 * the shaded one, with thin frames and a few diagonal sky reflections. `ramp`
 * shades roofs and outlines; `lit` is the share of panes lit from inside.
 */
interface Tint {
  ramp: Material;
  left: { base: Hex; streak: Hex; frame: Hex };
  right: { base: Hex; streak: Hex; frame: Hex };
  lit: number;
}
const TINTS: Record<string, Tint> = {
  sky: {
    ramp: ramp("323353", "484a77", "7f708a", "9babb2", "c7dcd0"),
    left: { base: "9babb2", streak: "8fd3ff", frame: "c7dcd0" },
    right: { base: "484a77", streak: "4d65b4", frame: "7f708a" },
    lit: 0,
  },
  silver: {
    ramp: ramp("2e222f", "3e3546", "625565", "7f708a", "9babb2"),
    left: { base: "7f708a", streak: "9babb2", frame: "c7dcd0" },
    right: { base: "3e3546", streak: "625565", frame: "625565" },
    lit: 0.02,
  },
  dark: {
    ramp: ramp("2e222f", "2e222f", "3e3546", "625565", "7f708a"),
    left: { base: "3e3546", streak: "484a77", frame: "625565" },
    right: { base: "2e222f", streak: "3e3546", frame: "3e3546" },
    lit: 0.06,
  },
  blue: {
    ramp: GLASS,
    left: { base: "4d65b4", streak: "4d9be6", frame: "8fd3ff" },
    right: { base: "323353", streak: "484a77", frame: "484a77" },
    lit: 0.06,
  },
  sage: {
    ramp: ramp("313638", "374e4a", "547e64", "92a984", "b2ba90"),
    left: { base: "547e64", streak: "92a984", frame: "b2ba90" },
    right: { base: "313638", streak: "374e4a", frame: "374e4a" },
    lit: 0.03,
  },
  bronze: {
    ramp: ramp("45293f", "694f62", "966c6c", "ab947a", "fdcbb0"),
    left: { base: "694f62", streak: "966c6c", frame: "ab947a" },
    right: { base: "45293f", streak: "45293f", frame: "694f62" },
    lit: 0.04,
  },
};
const GLASSES: Record<string, Material> = Object.fromEntries(
  Object.entries(TINTS).map(([name, t]) => [name, t.ramp]),
);
const tintOf = (m: Material): Tint => Object.values(TINTS).find((t) => t.ramp === m) ?? TINTS.sky!;
const WOOD = ramp("4c3e24", "694f62", "966c6c", "ab947a");
const PITCH = ramp("165a4c", "239063", "1ebc73", "91db69");

/** Schemes are "walls/roof" or "walls/glass" pairs; this splits them. */
const pair = (scheme: string): [string, string] => scheme.split("/") as [string, string];
const glassOf = (name: string): [Hex, Hex] => {
  const t = TINTS[name] ?? TINTS.sky!;
  return [t.left.streak, t.right.base];
};

/** Windows on both visible walls of the box u0–u1 × v0–v1, each wall with its own extent. */
function boxWindows(
  w: Omit<Windows, "s0" | "s1"> & { u0: number; u1: number; v0: number; v1: number },
): Detail {
  const left = windows({ ...w, s0: w.u0, s1: w.u1 });
  const right = windows({ ...w, s0: w.v0, s1: w.v1, doors: undefined });
  return (hit) => {
    const spot = wallSpot(hit);
    if (!spot) return null;
    return spot.side === "left" ? left(hit) : right(hit);
  };
}

/**
 * Glass skin for any vertical or sloped face: panes in the tint's base colour,
 * thin frames every `period` along the wall and every `storey` up, diagonal sky
 * reflections, and a few lit panes on dark tints.
 */
const curtain =
  (ctx: Ctx, g: Material, storey: number, period: number, z0 = 0): Detail =>
  (hit) => {
    if (hit.facing === "top" || hit.facing === "back") return null;
    const t = tintOf(g);
    const lit = hit.facing === "left" || (hit.facing !== "right" && hit.n[1] >= hit.n[0]);
    const side = lit ? t.left : t.right;
    const s = Math.floor(lit ? hit.p[0] : hit.p[1]);
    const z = Math.floor(hit.p[2]);
    if (z < z0) return null;
    if ((z - z0) % storey === 0) return side.frame;
    if (s % period === 0) return lit ? side.frame : side.streak;
    const n = noise(
      ctx.seed,
      lit ? "l" : "r",
      Math.floor(s / period),
      Math.floor((z - z0) / storey),
    );
    if (ctx.abandoned) return n < 0.4 ? COLORS.board : "2e222f";
    if (n < t.lit) return COLORS.litWindow;
    const band = (((s - Math.floor(z / 2) + 7 * hashOf(ctx.seed)) % 40) + 40) % 40;
    return lit && band < 6 ? side.streak : side.base;
  };
const hashOf = (seed: string) => Math.floor(noise(seed, "streak") * 40);

/** A pitched cottage with a chimney, a fenced garden and a path. */
function cottage(walls: Material, roof: Material, ctx: Ctx, brick = false): Part[] {
  const storeys = Math.min(ctx.level, 2);
  const h = storeys * 7;
  const parts: Part[] = [
    {
      solid: box(2, 2, 0, 11, 10, h),
      material: walls,
      detail: houseWindows(ctx, 2, 11, storeys, [[4, 6]]),
    },
    { solid: gable(1, 1, 12, 11, h, 7, "v"), material: roof },
    { solid: box(8, 3, h, 10, 5, h + 9), material: brick ? STONE : BRICK },
    // Fence along the garden's front edges.
    { solid: box(1, 14, 0, 15, 15, 2), material: WOOD, flat: true },
    { solid: box(14, 1, 0, 15, 15, 2), material: WOOD, flat: true },
  ];
  if (ctx.level >= 2) parts.push({ solid: box(4, 10, 0, 9, 13, 4), material: walls });
  return parts;
}

function resCottage(ctx: Ctx): Part[] {
  const [w, r] = pair(ctx.scheme);
  return cottage(WALLS[w]!, ROOFS[r]!, ctx);
}

function brickCottage(ctx: Ctx): Part[] {
  const [w, r] = pair(ctx.scheme);
  return cottage(WALLS[w]!, ROOFS[r]!, ctx, true);
}

/** A tall, slim residential slab with vertical window strips and a crown. */
function highrise(tiles: number) {
  return (ctx: Ctx): Part[] => {
    const S = tiles * T;
    const walls = WALLS[ctx.scheme]!;
    const h = 40 + ctx.level * 22 + tiles * 10;
    const u1 = S - 5;
    const v1 = tiles === 2 ? S - 9 : S - 6;
    return [
      { solid: box(3, 3, 0, S - 3, S - 3, 6), material: STONE },
      {
        solid: box(5, 5, 6, u1, v1, h),
        material: walls,
        detail: boxWindows({
          seed: ctx.seed,
          abandoned: ctx.abandoned,
          period: 4,
          width: 2,
          storey: 5,
          sill: 1,
          height: 3,
          from: 8,
          to: h - 3,
          margin: 2,
          u0: 5,
          u1,
          v0: 5,
          v1,
          lit: 0.3,
          glass: glassOf(ctx.level === 3 ? "silver" : "dark"),
        }),
      },
      { solid: box(4, 4, h, u1 + 1, v1 + 1, h + 2), material: walls },
      { solid: box(8, 8, h + 2, u1 - 4, v1 - 4, h + 7), material: STONE },
    ];
  };
}

/** A pastel mid-rise with coloured balconies. */
function midrise(ctx: Ctx): Part[] {
  const S = 2 * T;
  const walls = WALLS[ctx.scheme]!;
  const storeys = 3 + ctx.level;
  const h = storeys * 7;
  const accent = ctx.scheme === "white" ? WALLS.plum! : WALLS.white!;
  const parts: Part[] = [
    {
      solid: box(4, 4, 0, S - 4, S - 4, h),
      material: walls,
      detail: boxWindows({
        seed: ctx.seed,
        abandoned: ctx.abandoned,
        period: 6,
        width: 3,
        storey: 7,
        sill: 2,
        height: 3,
        from: 0,
        to: h,
        margin: 2,
        u0: 4,
        u1: S - 4,
        v0: 4,
        v1: S - 4,
        doors: [[14, 18]],
        glass: glassOf("silver"),
      }),
    },
    { solid: box(3, 3, h, S - 3, S - 3, h + 2), material: accent },
  ];
  for (let f = 1; f < storeys; f++)
    parts.push({ solid: box(6, S - 4, f * 7, 12, S - 2, f * 7 + 2), material: accent });
  return parts;
}

/** Three narrow row houses, each its own colour, with gable fronts. */
function rowhouses(ctx: Ctx): Part[] {
  const palette = ["plum", "sand", "sage", "ochre", "white", "lilac", "redbrick"];
  const start = Math.floor(noise(ctx.seed, "row") * palette.length);
  const h = 8 + ctx.level * 6;
  const parts: Part[] = [];
  for (let i = 0; i < 3; i++) {
    const walls = WALLS[palette[(start + i * 2) % palette.length]!]!;
    const u0 = 2 + i * 9.5;
    const u1 = u0 + 9;
    parts.push({
      solid: box(u0, 6, 0, u1, 24, h),
      material: walls,
      detail: windows({
        seed: ctx.seed + i,
        abandoned: ctx.abandoned,
        period: 4,
        width: 2,
        storey: 6,
        sill: 2,
        height: 3,
        from: 0,
        to: h,
        margin: 2,
        s0: u0,
        s1: u1,
        doors: [[u0 + 2, u0 + 4]],
        lit: 0.3,
      }),
    });
    parts.push({
      solid: gable(u0, 5, u1, 25, h, 5, "u"),
      material: ROOFS[i === 1 ? "dark" : "slate"]!,
    });
    parts.push({ solid: gable(u0 + 2, 20, u1 - 2, 25, h, 4, "v"), material: walls });
  }
  parts.push({ solid: box(2, 26, 0, 30, 28, 2), material: HEDGE });
  return parts;
}

/** A corner store with a striped awning in the scheme's colour. */
function store(ctx: Ctx): Part[] {
  const [w, a] = pair(ctx.scheme);
  const walls = WALLS[w]!;
  const awningColor = ROOFS[a]!.ramp[2]!;
  const h = 7 + ctx.level * 6;
  const awning: Detail = (hit) => {
    if (ctx.abandoned) return null;
    const k = Math.floor(hit.p[0] + hit.p[1]);
    return Math.floor(k / 2) % 2 ? COLORS.curb : awningColor;
  };
  return [
    {
      solid: box(3, 3, 0, 13, 13, h),
      material: walls,
      detail: all(
        (hit) => {
          const spot = wallSpot(hit);
          if (!spot || spot.z >= 5 || spot.z < 1) return null;
          const s = Math.floor(spot.s);
          if (s < 4 || s > 11) return null;
          return ctx.abandoned ? COLORS.board : spot.z >= 4 ? RAMPS.glass[4] : COLORS.litWindow;
        },
        boxWindows({
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
          u0: 3,
          u1: 13,
          v0: 3,
          v1: 13,
          glass: glassOf("silver"),
        }),
      ),
    },
    { solid: gable(3, 13, 13, 16, 6, 1, "u"), material: ROOFS[a]!, detail: awning },
    { solid: gable(13, 3, 16, 13, 6, 1, "v"), material: ROOFS[a]!, detail: awning },
    { solid: box(2, 2, h, 14, 14, h + 1), material: walls },
  ];
}

/** A school: an L of classrooms, a bell gable and a yard. */
function school(tiles: number) {
  return (ctx: Ctx): Part[] => {
    const S = tiles * T;
    const walls = WALLS[ctx.scheme]!;
    const h = 8 + ctx.level * 6;
    const win = (u0: number, u1: number, v0: number, v1: number) =>
      boxWindows({
        seed: ctx.seed + u0,
        abandoned: ctx.abandoned,
        period: 5,
        width: 3,
        storey: 7,
        sill: 2,
        height: 4,
        from: 0,
        to: h,
        margin: 2,
        u0,
        u1,
        v0,
        v1,
        doors: [[u0 + 4, u0 + 7]],
        lit: 0.35,
        glass: glassOf("silver"),
      });
    return [
      { solid: box(3, 3, 0, S - 3, 14, h), material: walls, detail: win(3, S - 3, 3, 14) },
      { solid: gable(2, 2, S - 2, 15, h, 6, "u"), material: ROOFS.slate! },
      { solid: box(3, 14, 0, 16, S - 3, h), material: walls, detail: win(3, 16, 14, S - 3) },
      { solid: gable(2, 14, 17, S - 2, h, 6, "v"), material: ROOFS.slate! },
      { solid: box(S - 12, 5, h, S - 6, 11, h + 12), material: walls },
      { solid: pyramid(S - 13, 4, S - 5, 12, h + 12, 6), material: ROOFS.teal! },
      { solid: box(20, 18, 0, S - 4, S - 4, 1), material: ROOFS.red!, flat: true },
    ];
  };
}

/** A walk-up tenement with a cornice and shopfronts on the ground floor. */
function tenement(tiles: number) {
  return (ctx: Ctx): Part[] => {
    const S = tiles * T;
    const walls = WALLS[ctx.scheme]!;
    const h = 12 + ctx.level * 7 + tiles * 4;
    return [
      {
        solid: box(3, 3, 0, S - 3, S - 3, h),
        material: walls,
        detail: all(
          (hit) => {
            const spot = wallSpot(hit);
            if (!spot || spot.z >= 5 || spot.z < 1) return null;
            if (Math.floor(spot.s) % 8 < 2) return null;
            return ctx.abandoned ? COLORS.board : spot.z >= 4 ? "2e222f" : COLORS.litWindow;
          },
          boxWindows({
            seed: ctx.seed,
            abandoned: ctx.abandoned,
            period: 5,
            width: 2,
            storey: 6,
            sill: 2,
            height: 3,
            from: 7,
            to: h - 2,
            margin: 3,
            u0: 3,
            u1: S - 3,
            v0: 3,
            v1: S - 3,
            glass: glassOf("dark"),
          }),
          bands(6, { left: walls.ramp[3]!, right: walls.ramp[2]! }, 1),
        ),
      },
      { solid: box(2, 2, h, S - 2, S - 2, h + 2), material: STONE },
      { solid: box(S - 10, 6, h + 2, S - 6, 10, h + 7), material: BRICK },
      { solid: box(6, 6, h + 2, 12, 12, h + 8), material: WOOD },
    ];
  };
}

/** A railway station: a vaulted glass hall behind a clocked entrance block. */
function station(ctx: Ctx): Part[] {
  const S = 4 * T;
  const walls = WALLS[ctx.scheme]!;
  const h = 14 + ctx.level * 4;
  return [
    {
      solid: box(6, 4, 0, S - 4, 40, h),
      material: walls,
      detail: archWindows(ctx, 6, S - 4, 4, 8),
    },
    {
      solid: gable(5, 3, S - 3, 41, h, 14, "u"),
      material: GLASSES.silver!,
      detail: curtain(ctx, GLASSES.silver!, 4, 4),
    },
    {
      solid: box(14, 40, 0, 50, 58, h + 8),
      material: walls,
      detail: all(
        archWindows(ctx, 14, 50, 4, 10),
        bands(6, { left: STONE.ramp[2]!, right: STONE.ramp[1]! }, 2),
      ),
    },
    { solid: box(13, 39, h + 8, 51, 59, h + 10), material: STONE },
    { solid: box(28, 46, h + 10, 36, 54, h + 30), material: walls },
    { solid: pyramid(27, 45, 37, 55, h + 30, 10), material: ROOFS.teal! },
  ];
}

/** An art-deco tower in setbacks. */
function decoTower(ctx: Ctx): Part[] {
  const S = 4 * T;
  const walls = WALLS[ctx.scheme]!;
  const tiers = [
    [6, 6, S - 6, S - 6, 30],
    [12, 12, S - 12, S - 12, 60 + ctx.level * 10],
    [18, 18, S - 18, S - 18, 90 + ctx.level * 20],
    [24, 24, S - 24, S - 24, 110 + ctx.level * 24],
  ] as const;
  const parts: Part[] = [];
  let z = 0;
  for (const [u0, v0, u1, v1, top] of tiers) {
    parts.push({
      solid: box(u0, v0, z, u1, v1, top),
      material: walls,
      detail: boxWindows({
        seed: ctx.seed + top,
        abandoned: ctx.abandoned,
        period: 4,
        width: 2,
        storey: 6,
        sill: 1,
        height: 4,
        from: z + 2,
        to: top - 2,
        margin: 2,
        u0,
        u1,
        v0,
        v1,
        glass: glassOf("dark"),
        lit: 0.3,
      }),
    });
    z = top;
  }
  parts.push({ solid: cylinder(S / 2, S / 2, 1, z, z + 18), material: METAL });
  return parts;
}

/** A modern house: a white volume with a cantilevered upper floor and a pool. */
function modernHouse(ctx: Ctx): Part[] {
  const walls = WALLS[ctx.scheme]!;
  const parts: Part[] = [
    {
      solid: box(2, 2, 0, 10, 9, 7),
      material: walls,
      detail: windows({
        seed: ctx.seed,
        abandoned: ctx.abandoned,
        period: 8,
        width: 6,
        storey: 7,
        sill: 1,
        height: 5,
        from: 0,
        to: 7,
        margin: 1,
        s0: 2,
        s1: 10,
        glass: glassOf("silver"),
        lit: 0.5,
      }),
    },
    { solid: box(1, 1, 7, 11, 10, 8), material: STONE },
    { solid: box(4, 11, 0, 13, 15, 1), material: ctx.abandoned ? ROOFS.brown! : WATER, flat: true },
  ];
  if (ctx.level >= 2) {
    parts.push({
      solid: box(5, 3, 8, 14, 9, 14),
      material: WOOD,
      detail: windows({
        seed: ctx.seed + "u",
        abandoned: ctx.abandoned,
        period: 9,
        width: 6,
        storey: 7,
        sill: 1,
        height: 4,
        from: 8,
        to: 14,
        margin: 1,
        s0: 5,
        s1: 14,
        glass: glassOf("dark"),
      }),
    });
    parts.push({ solid: box(4, 2, 14, 15, 10, 15), material: walls });
  }
  return parts;
}

/** A filling station: a canopy over pumps and a small shop. */
function gasStation(ctx: Ctx): Part[] {
  const brand = ROOFS[ctx.scheme]!;
  const parts: Part[] = [
    {
      solid: box(2, 2, 0, 8, 14, 7),
      material: WALLS.white!,
      detail: windows({
        seed: ctx.seed,
        abandoned: ctx.abandoned,
        period: 12,
        width: 10,
        storey: 7,
        sill: 1,
        height: 4,
        from: 0,
        to: 7,
        margin: 1,
        s0: 2,
        s1: 8,
        lit: 0.9,
      }),
    },
    { solid: box(2, 2, 7, 8, 14, 9), material: brand },
    { solid: box(9, 3, 9, 15, 14, 11), material: brand },
    { solid: box(11.5, 6, 0, 12.5, 7, 9), material: METAL },
    { solid: box(11.5, 11, 0, 12.5, 12, 9), material: METAL },
    { solid: box(11, 8, 0, 13, 9, 4), material: brand },
  ];
  if (ctx.level >= 2) parts.push({ solid: box(14, 1, 0, 15, 2, 20), material: brand });
  return parts;
}

/** An office block with ribbon windows; walls and glass come from the scheme. */
function office(tiles: number) {
  return (ctx: Ctx): Part[] => {
    const S = tiles * T;
    const [w, g] = pair(ctx.scheme);
    const walls = WALLS[w]!;
    const glass = GLASSES[g]!;
    const h = 20 + ctx.level * 12 + tiles * 6;
    const ribbons: Detail = (hit) => {
      const spot = wallSpot(hit);
      if (!spot) return null;
      const z = Math.floor(spot.z);
      if (z < 6 || z >= h - 2 || (z - 6) % 6 > 2) return null;
      const s = Math.floor(spot.s);
      if (s < 6 || s >= S - 6) return null;
      const n = noise(ctx.seed, spot.side, Math.floor(s / 4), Math.floor(z / 6));
      if (ctx.abandoned) return n < 0.5 ? COLORS.board : "2e222f";
      if (n < 0.06) return COLORS.litWindow;
      return spot.side === "left" ? glass.ramp[3]! : glass.ramp[1]!;
    };
    return [
      { solid: box(4, 4, 0, S - 4, S - 4, 5), material: glass, detail: curtain(ctx, glass, 5, 4) },
      { solid: box(4, 4, 5, S - 4, S - 4, h), material: walls, detail: ribbons },
      { solid: box(3, 3, h, S - 3, S - 3, h + 1), material: walls },
      { solid: box(8, 8, h + 1, 16, 14, h + 5), material: METAL },
    ];
  };
}

/** A tapered glass tower: the front face slopes back, braced by a diagrid. */
function wedge(tiles: number) {
  return (ctx: Ctx): Part[] => {
    const S = tiles * T;
    const g = GLASSES[ctx.scheme]!;
    const h = 60 + ctx.level * 26 + tiles * 12;
    const v0 = 4;
    const v1 = S - 4;
    const a = (h - 16) / (v1 - v0);
    const skin = curtain(ctx, g, 4, 3);
    const t = tintOf(g);
    const core = box(4, v0, 0, S - 4, v1, h) as Extract<ReturnType<typeof box>, { kind: "convex" }>;
    const diagrid: Detail = (hit) => {
      if (hit.facing === "top" || hit.facing === "back") return null;
      const z = hit.p[2];
      const s = hit.facing === "right" ? hit.p[1] : hit.p[0];
      if (Math.floor(s + z / 2) % 16 === 0 || Math.floor(s - z / 2 + 160) % 16 === 0)
        return hit.facing === "right" ? "625565" : lum(t.left.base) > 120 ? "625565" : "c7dcd0";
      return skin(hit);
    };
    return [
      {
        solid: { kind: "convex", planes: [...core.planes, { n: [0, a, 1], d: h + a * v0 }] },
        material: g,
        detail: diagrid,
      },
      { solid: box(2, 2, 0, S - 2, S - 2, 3), material: STONE },
    ];
  };
}

/** A dark glass skyscraper with a lit crown. */
function blackTower(tiles: number) {
  return (ctx: Ctx): Part[] => {
    const S = tiles * T;
    const g = GLASSES[ctx.scheme]!;
    const h = 70 + ctx.level * 28 + tiles * 14;
    const m = tiles === 4 ? 12 : 4;
    return [
      {
        solid: box(2, 2, 0, S - 2, S - 2, 8),
        material: STONE,
        detail: curtain(ctx, GLASSES.silver!, 8, 4),
      },
      { solid: box(m, m, 8, S - m, S - m, h), material: g, detail: curtain(ctx, g, 5, 3, 8) },
      { solid: box(m + 2, m + 2, h, S - m - 2, S - m - 2, h + 4), material: METAL },
      { solid: box(S / 2 - 1, S / 2 - 1, h + 4, S / 2 + 1, S / 2 + 1, h + 20), material: METAL },
    ];
  };
}

/**
 * A setback skyscraper: three glass tiers, each narrower than the one below,
 * with stone bands between them and a pyramid crown under a spire.
 */
function setbackTower(tiles: number) {
  return (ctx: Ctx): Part[] => {
    const S = tiles * T;
    const g = GLASSES[ctx.scheme]!;
    const h = 70 + ctx.level * 24 + tiles * 10;
    const steps = [3, 3 + tiles * 2, 3 + tiles * 4];
    const tops = [Math.round(h * 0.45), Math.round(h * 0.75), h];
    const parts: Part[] = [];
    let z = 0;
    steps.forEach((m, i) => {
      parts.push({
        solid: box(m, m, z, S - m, S - m, tops[i]!),
        material: g,
        detail: curtain(ctx, g, 5, 3, z),
      });
      parts.push({
        solid: box(m - 1, m - 1, tops[i]!, S - m + 1, S - m + 1, tops[i]! + 2),
        material: STONE,
      });
      z = tops[i]! + 2;
    });
    const m = steps[2]! + 2;
    parts.push({ solid: pyramid(m, m, S - m, S - m, z, 10 + tiles * 2), material: METAL });
    parts.push({ solid: cylinder(S / 2, S / 2, 0.6, z + 8, z + 30), material: METAL });
    return parts;
  };
}

/**
 * Two slim towers of different heights on a shared stone podium, at the left and
 * right corners so both read side by side on screen.
 */
function twinTowers(tiles: number) {
  return (ctx: Ctx): Part[] => {
    const S = tiles * T;
    const g = GLASSES[ctx.scheme]!;
    const h = 60 + ctx.level * 22 + tiles * 10;
    const low = Math.round(h * 0.8);
    const w = tiles * 5;
    const podium = 10;
    return [
      {
        solid: box(2, 2, 0, S - 2, S - 2, podium),
        material: STONE,
        detail: curtain(ctx, GLASSES.silver!, 5, 4),
      },
      // Left on screen: low u, high v. Right on screen: high u, low v.
      {
        solid: box(4, S - 4 - w, podium, 4 + w, S - 4, h),
        material: g,
        detail: curtain(ctx, g, 4, 3, podium),
      },
      { solid: box(5, S - 3 - w, h, 3 + w, S - 5, h + 4), material: METAL },
      { solid: cylinder(4 + w / 2, S - 4 - w / 2, 0.6, h + 4, h + 18), material: METAL },
      {
        solid: box(S - 4 - w, 4, podium, S - 4, 4 + w, low),
        material: g,
        detail: curtain(ctx, g, 4, 3, podium),
      },
      { solid: box(S - 3 - w, 5, low, S - 5, 3 + w, low + 4), material: METAL },
    ];
  };
}

/** A stone office tower with punched windows and a stepped copper crown. */
function crownTower(tiles: number) {
  return (ctx: Ctx): Part[] => {
    const S = tiles * T;
    const [w, roof] = pair(ctx.scheme);
    const walls = WALLS[w]!;
    const crown =
      roof === "gold" ? ramp("45293f", "6e2727", "9e4539", "cd683d") : ramp(...RAMPS.teal);
    const h = 50 + ctx.level * 22 + tiles * 10;
    const m = 4;
    return [
      { solid: box(2, 2, 0, S - 2, S - 2, 6), material: STONE },
      {
        solid: box(m, m, 6, S - m, S - m, h),
        material: walls,
        detail: all(
          bands(12, { left: walls.ramp[3]!, right: walls.ramp[1]! }, 6),
          boxWindows({
            seed: ctx.seed,
            abandoned: ctx.abandoned,
            period: 4,
            width: 2,
            storey: 6,
            sill: 2,
            height: 3,
            from: 8,
            to: h - 2,
            margin: 2,
            u0: m,
            u1: S - m,
            v0: m,
            v1: S - m,
            glass: glassOf("dark"),
            lit: 0.35,
          }),
        ),
      },
      { solid: box(m + 1, m + 1, h, S - m - 1, S - m - 1, h + 2), material: STONE },
      { solid: box(m + 3, m + 3, h + 2, S - m - 3, S - m - 3, h + 5), material: walls },
      {
        solid: pyramid(m + 3, m + 3, S - m - 3, S - m - 3, h + 5, 12 + tiles * 4),
        material: crown,
      },
      { solid: cylinder(S / 2, S / 2, 0.6, h + 12, h + 30 + tiles * 3), material: METAL },
    ];
  };
}

/** A needle-thin glass tower with a long mast and a red beacon. */
function needle(ctx: Ctx): Part[] {
  const S = 2 * T;
  const g = GLASSES[ctx.scheme]!;
  const h = 90 + ctx.level * 26;
  return [
    {
      solid: box(3, 3, 0, S - 3, S - 3, 6),
      material: STONE,
      detail: curtain(ctx, GLASSES.silver!, 6, 4),
    },
    { solid: box(9, 9, 6, S - 9, S - 9, h), material: g, detail: curtain(ctx, g, 4, 2, 6) },
    { solid: box(10, 10, h, S - 10, S - 10, h + 6), material: METAL },
    { solid: cylinder(S / 2, S / 2, 0.6, h + 6, h + 34), material: METAL },
    { solid: box(S / 2 - 1, S / 2 - 1, h + 34, S / 2 + 1, S / 2 + 1, h + 36), material: ROOF.red! },
  ];
}

/** A wide podium with a roof garden and a slim tower set back at the rear corner. */
function podiumTower(tiles: number) {
  return (ctx: Ctx): Part[] => {
    const S = tiles * T;
    const [w, gName] = pair(ctx.scheme);
    const walls = WALLS[w]!;
    const g = GLASSES[gName]!;
    const h = 60 + ctx.level * 24 + tiles * 10;
    const podium = 14;
    const t = Math.round(S * 0.55);
    return [
      {
        solid: box(2, 2, 0, S - 2, S - 2, podium),
        material: walls,
        detail: boxWindows({
          seed: ctx.seed,
          abandoned: ctx.abandoned,
          period: 6,
          width: 4,
          storey: 7,
          sill: 1,
          height: 4,
          from: 1,
          to: podium - 1,
          margin: 3,
          u0: 2,
          u1: S - 2,
          v0: 2,
          v1: S - 2,
          glass: glassOf("sky"),
          lit: 0.2,
        }),
      },
      { solid: box(3, 3, podium, S - 3, S - 3, podium + 1), material: ROOF_GARDEN },
      {
        solid: box(4, 4, podium, 4 + t, 4 + t, h),
        material: g,
        detail: curtain(ctx, g, 5, 3, podium),
      },
      { solid: box(6, 6, h, 2 + t, 2 + t, h + 3), material: walls },
      { solid: box(10, 10, h + 3, t - 2, t - 2, h + 8), material: METAL },
    ];
  };
}

/** The convex solid cut by the half-space n·p ≤ d. */
const cut = (solid: Solid, n: Vec, d: number): Solid =>
  solid.kind === "convex" ? { kind: "convex", planes: [...solid.planes, { n, d }] } : solid;

const BARK = ramp("2e222f", "45293f", "694f62", "966c6c");
const DECK = ramp("165a4c", "165a4c", "239063", "239063");
const PALM = ramp("165a4c", "239063", "1ebc73", "91db69");

/**
 * A rounded arch over the box (u0, v0)–(u1, v1) from z0, rising `rise` in the
 * middle of u: a convex polygon of steep sides and a flatter top.
 */
function arch(u0: number, v0: number, u1: number, v1: number, z0: number, rise: number): Solid {
  let solid = box(u0, v0, z0 - 1, u1, v1, z0 + rise);
  const half = (u1 - u0) / 2;
  const mid = u0 + half;
  // z − z0 ≤ rise · (1 − k|u − mid|/half) for a few slopes, with the top at `rise`.
  for (const [k, lift] of [
    [0.35, 0],
    [1, 0.3],
    [3, 2],
  ] as const) {
    const a = (rise * k) / half;
    const top = z0 + rise * (1 + lift);
    solid = cut(solid, [a, 0, 1], top + a * mid);
    solid = cut(solid, [-a, 0, 1], top - a * mid);
  }
  return solid;
}

/** A palm on a roof or a plaza: a thin trunk under a small round crown. */
const palm = (u: number, v: number, z: number, h: number): Part[] => [
  { solid: cylinder(u, v, 0.7, z, z + h), material: BARK },
  { solid: dome(u, v, z + h, 3), material: PALM },
];

/**
 * A sail tower: a slim glass shaft framed by white fins, crowned by a glass arch
 * with a taller white crest behind it, on a podium with a pool and palms.
 */
function sailTower(tiles: number) {
  return (ctx: Ctx): Part[] => {
    const S = tiles * T;
    const g = GLASSES[ctx.scheme]!;
    const h = 80 + ctx.level * 26 + tiles * 10;
    const m = tiles * 3 + 2;
    const podium = 6;
    const fin = WALLS.white!;
    return [
      {
        solid: box(2, 2, 0, S - 2, S - 2, podium),
        material: STONE,
        detail: curtain(ctx, GLASSES.silver!, 6, 4),
      },
      { solid: box(3, 3, podium, S - 3, S - 3, podium + 1), material: STONE },
      { solid: box(S - m + 2, S - m + 2, podium, S - 4, S - 4, podium + 1), material: WATER },
      ...palm(S - 6, m - 1, podium + 1, 8),
      ...palm(m - 1, S - 6, podium + 1, 10),
      {
        solid: box(m, m, podium, S - m, S - m, h),
        material: g,
        detail: curtain(ctx, g, 4, 3, podium),
      },
      // White fins up the corners of both visible walls.
      { solid: box(m - 1, S - m - 1, podium, m + 1, S - m + 1, h), material: fin },
      { solid: box(S - m - 1, S - m - 1, podium, S - m + 1, S - m + 1, h + 2), material: fin },
      { solid: box(S - m - 1, m - 1, podium, S - m + 1, m + 1, h), material: fin },
      // A white crest behind, then a rounded glass arch in front of it.
      { solid: arch(m, m, S - m, m + 3, h, 20 + tiles * 4), material: fin },
      {
        solid: arch(m + 1, m + 3, S - m - 1, S - m, h, 12 + tiles * 3),
        material: g,
        detail: curtain(ctx, g, 4, 3, h),
      },
      {
        solid: cylinder(S / 2, m + 1, 0.6, h + 16 + tiles * 4, h + 30 + tiles * 4),
        material: METAL,
      },
    ];
  };
}

/**
 * A dark glass shaft held by four stone piers that rise past the roof, with a
 * sky terrace half way up and a roof garden between the piers.
 */
function pierTower(tiles: number) {
  return (ctx: Ctx): Part[] => {
    const S = tiles * T;
    const [w, gName] = pair(ctx.scheme);
    const stone = WALLS[w]!;
    const g = GLASSES[gName]!;
    const h = 70 + ctx.level * 26 + tiles * 10;
    const m = 4;
    const p = tiles * 2 + 3;
    const terrace = Math.round(h * 0.55);
    const piers = [
      [m, m, 4],
      [S - m - p, m, 0],
      [m, S - m - p, 0],
      [S - m - p, S - m - p, 10],
    ] as const;
    const parts: Part[] = [
      { solid: box(2, 2, 0, S - 2, S - 2, 4), material: STONE },
      {
        solid: box(m + 2, m + 2, 4, S - m - 2, S - m - 2, h),
        material: g,
        detail: curtain(ctx, g, 4, 3, 4),
      },
      { solid: box(m + 1, m + 1, terrace, S - m - 1, S - m - 1, terrace + 3), material: stone },
      { solid: box(m + 2, m + 2, h, S - m - 2, S - m - 2, h + 2), material: DECK },
    ];
    for (const [u, v, extra] of piers)
      parts.push({
        solid: box(u, v, 0, u + p, v + p, h + 6 + extra),
        material: stone,
        detail: bands(6, { left: stone.ramp[2]!, right: stone.ramp[1]! }),
      });
    parts.push({
      solid: box(S / 2 - 3, S / 2 - 3, h + 2, S / 2 + 3, S / 2 + 3, h + 8),
      material: METAL,
    });
    return parts;
  };
}

/**
 * A tall apartment slab: a long, narrow block of small windows with darker
 * stair cores, a dark ground floor and a machine room on the roof. On three
 * tiles a second, shorter slab stands in front.
 */
function aptSlab(tiles: number) {
  return (ctx: Ctx): Part[] => {
    const S = tiles * T;
    const walls = WALLS[ctx.scheme]!;
    const storey = 5;
    const slab = (
      u0: number,
      v0: number,
      u1: number,
      v1: number,
      floors: number,
      key: string,
    ): Part[] => {
      const h = 6 + floors * storey;
      const cores = (hit: Hit) => {
        const spot = wallSpot(hit);
        if (!spot || spot.z < 6) return null;
        const len = spot.side === "left" ? u1 - u0 : v1 - v0;
        const s = spot.s - (spot.side === "left" ? u0 : v0);
        // A recessed stair core every 14 units on the long wall.
        return len > 20 && Math.floor(s) % 14 === 7
          ? walls.ramp[spot.side === "left" ? 1 : 0]!
          : null;
      };
      return [
        {
          solid: box(u0, v0, 0, u1, v1, 6),
          material: STONE,
          detail: curtain(ctx, GLASSES.dark!, 6, 4),
        },
        {
          solid: box(u0, v0, 6, u1, v1, h),
          material: walls,
          detail: all(
            cores,
            boxWindows({
              seed: ctx.seed + key,
              abandoned: ctx.abandoned,
              period: 4,
              width: 2,
              storey,
              sill: 2,
              height: 2,
              from: 6,
              to: h - 1,
              margin: 2,
              u0,
              u1,
              v0,
              v1,
              glass: glassOf("sky"),
              lit: 0.12,
            }),
          ),
        },
        { solid: box(u0, v0, h, u1, v1, h + 1), material: walls },
        { solid: box(u0 + 3, v0 + 2, h + 1, u0 + 11, v1 - 2, h + 7), material: walls },
        { solid: box(u1 - 8, v0 + 3, h + 1, u1 - 4, v1 - 3, h + 3), material: METAL },
      ];
    };
    const floors = 10 + ctx.level * 4 + tiles * 2;
    if (tiles === 2) return slab(3, 9, S - 3, S - 6, floors, "a");
    return [
      ...slab(3, 4, S - 3, 16, floors, "a"),
      ...slab(3, S - 18, S - 18, S - 6, Math.round(floors * 0.7), "b"),
    ];
  };
}

/**
 * A low office or school block: two wings in an L around a glass atrium with a
 * glass roof, and a lawn with trees in the open front corner.
 */
function atriumBlock(tiles: number) {
  return (ctx: Ctx): Part[] => {
    const S = tiles * T;
    const [w, gName] = pair(ctx.scheme);
    const walls = WALLS[w]!;
    const g = GLASSES[gName]!;
    const h = 16 + ctx.level * 6;
    const d = 12 + tiles * 2;
    const win = (u0: number, v0: number, u1: number, v1: number, key: string) =>
      all(
        bands(6, { left: walls.ramp[3]!, right: walls.ramp[1]! }),
        boxWindows({
          seed: ctx.seed + key,
          abandoned: ctx.abandoned,
          period: 5,
          width: 3,
          storey: 6,
          sill: 2,
          height: 3,
          from: 1,
          to: h - 1,
          margin: 2,
          u0,
          u1,
          v0,
          v1,
          glass: glassOf(gName),
          lit: 0.15,
        }),
      );
    const a = d + 1;
    const parts: Part[] = [
      // Left on screen: the wing along v; right on screen: the wing along u.
      { solid: box(2, 2, 0, d, S - 2, h), material: walls, detail: win(2, 2, d, S - 2, "a") },
      { solid: box(d, 2, 0, S - 2, d, h - 6), material: walls, detail: win(d, 2, S - 2, d, "b") },
      { solid: box(1, 1, h, d + 1, S - 1, h + 1), material: walls },
      { solid: box(d, 1, h - 6, S - 1, d + 1, h - 5), material: walls },
      { solid: box(d, d, 0, a + 12, a + 12, h - 2), material: g, detail: curtain(ctx, g, 6, 3) },
      { solid: pyramid(d, d, a + 12, a + 12, h - 2, 6), material: g },
      { solid: box(5, 6, h + 1, 9, 12, h + 4), material: METAL },
      { solid: box(S - 12, 5, h - 5, S - 6, 9, h - 2), material: METAL },
      { solid: box(a + 13, a + 13, 0, S - 3, S - 3, 1), material: DECK, flat: true },
      ...palm(S - 8, a + 17, 1, 5),
      ...palm(a + 17, S - 8, 1, 5),
    ];
    return parts;
  };
}

/** Three rounded residential towers of different heights on a garden podium. */
function trioTowers(ctx: Ctx): Part[] {
  const S = 4 * T;
  const g = GLASSES[ctx.scheme]!;
  const h = 80 + ctx.level * 26;
  const podium = 10;
  const r = 9;
  const tower = (u: number, v: number, top: number): Part[] => [
    { solid: cylinder(u, v, r, podium, top), material: g, detail: curtain(ctx, g, 4, 3, podium) },
    {
      solid: box(u - r, v - r, podium, u, v, top),
      material: g,
      detail: curtain(ctx, g, 4, 3, podium),
    },
    { solid: cylinder(u, v, r + 0.5, top, top + 2), material: WALLS.white! },
    { solid: cylinder(u - 2, v - 2, r - 4, top + 2, top + 7), material: WALLS.white! },
  ];
  return [
    {
      solid: box(2, 2, 0, S - 2, S - 2, podium),
      material: STONE,
      detail: curtain(ctx, GLASSES.silver!, 5, 4),
    },
    { solid: box(3, 3, podium, S - 3, S - 3, podium + 1), material: DECK },
    { solid: box(34, 40, podium, 46, 52, podium + 1), material: WATER },
    ...tower(14, 14, h),
    ...tower(14, 40, Math.round(h * 0.78)),
    ...tower(40, 14, Math.round(h * 0.88)),
    ...palm(30, 50, podium + 1, 6),
    ...palm(50, 30, podium + 1, 7),
    ...palm(52, 48, podium + 1, 5),
  ];
}

/** A low shopping mall with a coloured sign band and a car park. */
function mall(ctx: Ctx): Part[] {
  const S = 3 * T;
  const band = ROOFS[ctx.scheme]!;
  const h = 10 + ctx.level * 5;
  const parts: Part[] = [
    {
      solid: box(4, 4, 0, S - 4, 30, h),
      material: WALLS.white!,
      detail: all((hit) => {
        const spot = wallSpot(hit);
        if (!spot) return null;
        const z = Math.floor(spot.z);
        if (z >= h - 4) return spot.side === "left" ? band.ramp[2]! : band.ramp[1]!;
        if (z < 6 && Math.floor(spot.s) % 10 > 2)
          return ctx.abandoned
            ? COLORS.board
            : spot.side === "left"
              ? RAMPS.glass[3]
              : RAMPS.glass[1];
        return null;
      }),
    },
    {
      solid: box(18, 14, h, 30, 26, h + 6),
      material: GLASSES.silver!,
      detail: curtain(ctx, GLASSES.silver!, 3, 3),
    },
  ];
  // Parked cars on the forecourt.
  for (let u = 6; u < S - 6; u += 6) {
    const color = [RAMPS.roofTiles[2], RAMPS.glass[3], COLORS.curb, GOLD.ramp[2]][(u / 6) % 4]!;
    parts.push({
      solid: box(u, 36, 0, u + 3, 41, 2),
      material: ramp("2e222f", "3e3546", color, color),
    });
  }
  return parts;
}

/** A tech campus: two glass towers joined by a sky bridge, on the city's grass. */
function campus(ctx: Ctx): Part[] {
  const g = GLASSES[ctx.scheme]!;
  const h = 50 + ctx.level * 20;
  return [
    { solid: box(6, 6, 0, 28, 28, h), material: g, detail: curtain(ctx, g, 5, 4) },
    { solid: box(36, 30, 0, 58, 54, h - 16), material: g, detail: curtain(ctx, g, 5, 4) },
    { solid: box(26, 14, h - 34, 40, 22, h - 28), material: WALLS.white! },
    {
      solid: cylinder(18, 46, 8, 0, 10),
      material: WALLS.white!,
      detail: curtain(ctx, GLASSES.silver!, 5, 3),
    },
  ];
}

// Industry and civic landmarks

/** A water tower: a tank on four legs. */
function waterTower(ctx: Ctx): Part[] {
  const tank = ROOFS[ctx.scheme]!;
  const legs = 14 + ctx.level * 6;
  const parts: Part[] = [];
  for (const [u, v] of [
    [4, 4],
    [11, 4],
    [4, 11],
    [11, 11],
  ] as const)
    parts.push({ solid: box(u, v, 0, u + 1, v + 1, legs), material: METAL });
  parts.push({ solid: box(4, 7, legs - 8, 12, 8, legs - 7), material: METAL });
  parts.push({
    solid: cylinder(8, 8, 6, legs, legs + 10),
    material: tank,
    detail: (hit) => (Math.floor(hit.p[2]) === legs + 4 ? COLORS.curb : null),
  });
  parts.push({ solid: dome(8, 8, legs + 10, 6, legs + 10), material: tank });
  return parts;
}

/** A thin convex blade from a hub in the u–z plane, `len` long towards `angle`. */
function blade(hu: number, hv: number, hz: number, angle: number, len: number) {
  const du = Math.cos(angle);
  const dz = Math.sin(angle);
  const w = 1;
  return {
    kind: "convex" as const,
    planes: [
      { n: [du, 0, dz] as const, d: du * hu + dz * hz + len },
      { n: [-du, 0, -dz] as const, d: -(du * hu + dz * hz) },
      { n: [-dz, 0, du] as const, d: -dz * hu + du * hz + w },
      { n: [dz, 0, -du] as const, d: dz * hu - du * hz + w },
      { n: [0, 1, 0] as const, d: hv + 0.5 },
      { n: [0, -1, 0] as const, d: -(hv - 0.5) },
    ],
  };
}

function windTurbine(ctx: Ctx): Part[] {
  const h = 40 + ctx.level * 12;
  const len = 14 + ctx.level * 2;
  const white = ramp("625565", "9babb2", "c7dcd0", "c7dcd0");
  const turn = noise(ctx.seed, "turn") * Math.PI;
  return [
    { solid: cylinder(8, 8, 1.5, 0, h), material: white },
    { solid: box(6, 7, h - 1, 11, 9, h + 2), material: white },
    ...[0, 1, 2].map((i) => ({
      solid: blade(11, 9.5, h + 0.5, turn + (i * 2 * Math.PI) / 3, len),
      material: white,
    })),
  ];
}

/** A container yard: stacks of coloured boxes, a gantry crane at the top level. */
function containerYard(ctx: Ctx): Part[] {
  const colors = [ROOF.red!, GLASS, ROOF.teal!, GOLD, ROOFS.purple!, ROOF.green!];
  const parts: Part[] = [];
  for (let u = 3; u < 28; u += 9)
    for (let v = 3; v < 28; v += 5) {
      const stack = 1 + Math.floor(noise(ctx.seed, u, v) * (ctx.level + 1));
      for (let k = 0; k < stack; k++) {
        const m = colors[Math.floor(noise(ctx.seed, u, v, k) * colors.length)]!;
        parts.push({ solid: box(u, v, k * 4, u + 8, v + 4, k * 4 + 4), material: m });
      }
    }
  if (ctx.level >= 3) {
    parts.push({ solid: box(2, 2, 0, 3, 4, 24), material: GOLD });
    parts.push({ solid: box(29, 2, 0, 30, 4, 24), material: GOLD });
    parts.push({ solid: box(2, 2, 24, 30, 4, 26), material: GOLD });
  }
  return parts;
}

/** A fire station: red engine bays and a hose tower. */
function fireStation(ctx: Ctx): Part[] {
  const S = 2 * T;
  const red = ramp("6e2727", "ae2334", "e83b3b", "f68181");
  const h = 12 + ctx.level * 3;
  return [
    {
      solid: box(3, 3, 0, S - 3, S - 3, h),
      material: red,
      detail: all(
        rollDoor(5, 11, 8, WALLS.white!),
        rollDoor(13, 19, 8, WALLS.white!),
        boxWindows({
          seed: ctx.seed,
          abandoned: ctx.abandoned,
          period: 5,
          width: 2,
          storey: 20,
          sill: 9,
          height: 3,
          from: 0,
          to: h,
          margin: 3,
          u0: 3,
          u1: S - 3,
          v0: 3,
          v1: S - 3,
          glass: glassOf("silver"),
        }),
      ),
    },
    { solid: box(2, 2, h, S - 2, S - 2, h + 1), material: WALLS.white! },
    { solid: box(21, 4, 0, 28, 11, h + 16), material: red },
    { solid: box(20, 3, h + 16, 29, 12, h + 18), material: WALLS.white! },
  ];
}

/** A hospital: white blocks, a red cross and a helipad on the roof. */
function hospital(ctx: Ctx): Part[] {
  const S = 3 * T;
  const h = 18 + ctx.level * 8;
  const white = WALLS.white!;
  const roofMarks: Detail = (hit) => {
    if (hit.facing !== "top") return null;
    const du = hit.p[0] - 16;
    const dv = hit.p[1] - 16;
    if ((Math.abs(du) < 1.5 && Math.abs(dv) < 5) || (Math.abs(dv) < 1.5 && Math.abs(du) < 5))
      return ctx.abandoned ? "6e2727" : "e83b3b";
    return null;
  };
  const win = (u0: number, u1: number, v0: number, v1: number, top: number) =>
    boxWindows({
      seed: ctx.seed + u0,
      abandoned: ctx.abandoned,
      period: 4,
      width: 3,
      storey: 6,
      sill: 2,
      height: 3,
      from: 6,
      to: top - 2,
      margin: 2,
      u0,
      u1,
      v0,
      v1,
      glass: glassOf("sky"),
      lit: 0.4,
    });
  return [
    {
      solid: box(4, 4, 0, 28, 28, h),
      material: white,
      detail: all(roofMarks, win(4, 28, 4, 28, h)),
    },
    {
      solid: box(28, 10, 0, S - 4, S - 6, h - 8),
      material: white,
      detail: win(28, S - 4, 10, S - 6, h - 8),
    },
    { solid: box(8, 28, 0, 26, S - 4, 10), material: white, detail: win(8, 26, 28, S - 4, 10) },
    { solid: box(12, 34, 10, 22, 40, 11), material: ramp("6e2727", "ae2334", "e83b3b", "f68181") },
  ];
}

/** A stadium: a ring of stands around a striped pitch, with floodlights. */
function stadium(ctx: Ctx): Part[] {
  const S = 4 * T;
  const c = S / 2;
  const h = 10 + ctx.level * 4;
  const seats = ramp("3e3546", "484a77", "4d65b4", "8fd3ff");
  const top: Detail = (hit) => {
    if (hit.facing !== "top") return null;
    const d = Math.hypot(hit.p[0] - c, hit.p[1] - c);
    if (d < 17) {
      if (ctx.abandoned) return RAMPS.dry[1];
      if (Math.abs(d - 6) < 0.5) return COLORS.curb;
      return Math.floor((hit.p[0] - hit.p[1]) / 4) % 2 ? PITCH.ramp[2]! : PITCH.ramp[3]!;
    }
    if (d < 19) return RAMPS.concrete[3];
    return Math.floor(d) % 2 ? seats.ramp[2]! : seats.ramp[3]!;
  };
  const parts: Part[] = [
    {
      solid: cylinder(c, c, 28, 0, h),
      material: WALLS.white!,
      detail: all(top, bands(4, { left: STONE.ramp[2]!, right: STONE.ramp[1]! }, 1)),
    },
  ];
  for (const [u, v] of [
    [8, 8],
    [S - 8, 8],
    [8, S - 8],
    [S - 8, S - 8],
  ] as const) {
    parts.push({ solid: box(u - 1, v - 1, 0, u + 1, v + 1, h + 24), material: METAL });
    parts.push({
      solid: box(u - 3, v - 2, h + 24, u + 3, v + 2, h + 27),
      material: ramp("2e222f", "fbb954", "fbff86", "fbff86"),
    });
  }
  return parts;
}

/** A monument: an obelisk or a statue on a plinth in a small plaza. */
function monument(ctx: Ctx): Part[] {
  const h = 18 + ctx.level * 10;
  const base: Part[] = [
    { solid: box(3, 3, 0, 13, 13, 2), material: STONE },
    { solid: box(5, 5, 2, 11, 11, 6), material: SAND_STONE },
  ];
  if (ctx.scheme === "obelisk")
    return [
      ...base,
      { solid: box(6.5, 6.5, 6, 9.5, 9.5, h), material: STONE },
      { solid: pyramid(6.5, 6.5, 9.5, 9.5, h, 3), material: GOLD },
    ];
  const bronze = ramp("0b5e65", "0b8a8f", "0eaf9b", "30e1b9");
  return [
    ...base,
    { solid: box(6, 6, 6, 10, 10, 10), material: STONE },
    { solid: cylinder(8, 8, 1.5, 10, 18), material: bronze },
    { solid: dome(8, 8, 19, 1.5), material: bronze },
    { solid: box(8, 7.5, 15, 12, 8.5, 16), material: bronze },
  ];
}

// Village: wooden houses for small towns ------------------------------------------

/** Painted or natural wood: wall colours per face and the darker seam between boards. */
interface Wood {
  material: Material;
  seam: { left: Hex; right: Hex };
}
const wood = (r: Hex[], left: Hex, right: Hex, seamLeft: Hex, seamRight: Hex): Wood => ({
  material: { ramp: r, left, right, top: r[r.length - 1] },
  seam: { left: seamLeft, right: seamRight },
});
const WOODS: Record<string, Wood> = {
  log: wood(["45293f", "6e2727", "9e4539", "cd683d"], "9e4539", "6e2727", "6e2727", "45293f"),
  white: wood(["625565", "7f708a", "9babb2", "c7dcd0"], "c7dcd0", "9babb2", "9babb2", "7f708a"),
  blue: wood(["323353", "484a77", "4d65b4", "4d9be6"], "4d9be6", "4d65b4", "4d65b4", "484a77"),
  red: wood(["6e2727", "ae2334", "e83b3b", "f68181"], "e83b3b", "ae2334", "ae2334", "6e2727"),
  yellow: wood(["9e4539", "f79617", "f9c22b", "fbff86"], "f9c22b", "f79617", "f79617", "9e4539"),
  green: wood(["165a4c", "239063", "1ebc73", "91db69"], "1ebc73", "239063", "239063", "165a4c"),
  sage: wood(["313638", "374e4a", "547e64", "92a984"], "92a984", "547e64", "547e64", "374e4a"),
  teal: wood(["0b5e65", "0b8a8f", "0eaf9b", "30e1b9"], "0eaf9b", "0b8a8f", "0b8a8f", "0b5e65"),
};
const SHINGLE = ramp("2e222f", "45293f", "694f62", "966c6c");
const VILLAGE_ROOFS: Record<string, Material> = { ...ROOF, shingle: SHINGLE };
const TRIM = ramp("625565", "9babb2", "c7dcd0", "c7dcd0");

/** Horizontal boards: a darker seam every `every` units of height. Logs use 3, siding 2. */
const boards =
  (w: Wood, every: number): Detail =>
  (hit) => {
    const spot = wallSpot(hit);
    if (!spot) return null;
    return Math.floor(spot.z) % every === every - 1 ? w.seam[spot.side] : null;
  };

const woodOf = (scheme: string) => {
  const [w, r] = pair(scheme);
  return { w: WOODS[w]!, roof: VILLAGE_ROOFS[r]! };
};

/** A porch along the left wall: a plank floor, posts and a roof. */
function porch(
  u0: number,
  u1: number,
  v: number,
  depth: number,
  z: number,
  roof: Material,
): Part[] {
  const parts: Part[] = [
    { solid: box(u0, v, 0, u1, v + depth, 1), material: WOOD, flat: true },
    { solid: box(u0 - 0.5, v, z, u1 + 0.5, v + depth + 0.5, z + 1), material: roof },
  ];
  for (let u = u0; u <= u1 - 1; u += Math.max(3, Math.floor((u1 - u0 - 1) / 3)))
    parts.push({ solid: box(u, v + depth - 1, 1, u + 1, v + depth, z), material: TRIM });
  parts.push({ solid: box(u1 - 1, v + depth - 1, 1, u1, v + depth, z), material: TRIM });
  return parts;
}

/** A log cabin with a stone chimney and a small porch. */
function cabin(ctx: Ctx): Part[] {
  const { w, roof } = woodOf(ctx.scheme);
  const storeys = ctx.level === 3 ? 2 : 1;
  const h = storeys * 7 + (ctx.level === 2 ? 2 : 0);
  return [
    {
      solid: box(3, 3, 0, 12, 10, h),
      material: w.material,
      detail: all(houseWindows(ctx, 3, 12, storeys, [[5, 7]]), boards(w, 3)),
    },
    { solid: gable(2, 2, 13, 11, h, 6, "u"), material: roof },
    { solid: box(12, 5, 0, 14, 8, h + 8), material: STONE },
    ...porch(3, 12, 10, 3, 5, roof),
    // Firewood stacked by the back corner.
    { solid: box(1, 11, 0, 3, 14, 3), material: ramp("45293f", "6e2727", "9e4539") },
  ];
}

/** A clapboard cottage, gable end to the street. */
function clapboard(ctx: Ctx): Part[] {
  const { w, roof } = woodOf(ctx.scheme);
  const storeys = Math.min(ctx.level, 2);
  const h = storeys * 7;
  const parts: Part[] = [
    {
      solid: box(3, 2, 0, 12, 11, h),
      material: w.material,
      detail: all(houseWindows(ctx, 3, 12, storeys, [[6, 8]]), boards(w, 2)),
    },
    { solid: gable(2, 1, 13, 12, h, 7, "v"), material: roof },
    { solid: box(4, 5, h, 6, 7, h + 8), material: BRICK },
  ];
  // A lean-to on the right for the bigger ones.
  if (ctx.level === 3)
    parts.push(
      { solid: box(12, 4, 0, 15, 10, 5), material: w.material, detail: boards(w, 2) },
      { solid: box(12, 3.5, 5, 15.5, 10.5, 6), material: roof },
    );
  return parts;
}

/** A two-storey farmhouse with a wrap-around porch. */
function farmhouse(ctx: Ctx): Part[] {
  const { w, roof } = woodOf(ctx.scheme);
  const storeys = Math.max(1, Math.min(ctx.level, 2));
  const h = storeys * 7 + 1;
  const parts: Part[] = [
    {
      solid: box(5, 5, 0, 23, 19, h),
      material: w.material,
      detail: all(houseWindows(ctx, 5, 23, storeys, [[11, 13]]), boards(w, 2)),
    },
    { solid: gable(4, 4, 24, 20, h, 8, "u"), material: roof },
    { solid: box(18, 8, h, 20, 10, h + 10), material: BRICK },
    ...porch(5, 23, 19, 4, 6, roof),
  ];
  if (ctx.level === 3)
    parts.push(
      {
        solid: box(23, 7, 0, 29, 17, 9),
        material: w.material,
        detail: all(houseWindows(ctx, 23, 29, 1, []), boards(w, 2)),
      },
      { solid: gable(22.5, 6, 29.5, 18, 9, 5, "u"), material: roof },
    );
  return parts;
}

/** A red barn: big front door with a white cross brace, a hay loft and a silo. */
function barn(ctx: Ctx): Part[] {
  const { w, roof } = woodOf(ctx.scheme);
  const h = 10 + ctx.level * 2;
  const door: Detail = (hit) => {
    const spot = wallSpot(hit);
    if (!spot || spot.side !== "left") return null;
    const s = spot.s - 10;
    const z = spot.z;
    if (s < 0 || s >= 10 || z >= 9) return null;
    if (s < 1 || s >= 9 || z >= 8) return TRIM.ramp[2]!;
    const d = (s - 1) / 8;
    if (Math.abs(d - z / 8) < 0.09 || Math.abs(1 - d - z / 8) < 0.09) return TRIM.ramp[2]!;
    return ctx.abandoned ? COLORS.board : w.seam.left;
  };
  const loft: Detail = (hit) => {
    const spot = wallSpot(hit);
    if (!spot || spot.side !== "left") return null;
    return spot.s >= 13 && spot.s < 17 && spot.z >= h + 1 && spot.z < h + 5 ? "2e222f" : null;
  };
  const parts: Part[] = [
    {
      solid: box(4, 4, 0, 26, 22, h),
      material: w.material,
      detail: all(door, boards(w, 2)),
    },
    {
      solid: gable(3, 3, 27, 23, h, 11, "v"),
      material: roof,
    },
    // The gable end is wood too, with the loft door.
    { solid: gable(4, 21.5, 26, 22, h, 10, "v"), material: w.material, detail: loft },
  ];
  if (ctx.level >= 2)
    parts.push(
      { solid: cylinder(28, 8, 3, 0, h + 10), material: STONE },
      { solid: dome(28, 8, h + 10, 3), material: ROOF.slate! },
    );
  return parts;
}

/** A white wooden chapel with a steeple over the door. */
function woodChapel(ctx: Ctx): Part[] {
  const { w, roof } = woodOf(ctx.scheme);
  const h = 11 + ctx.level * 2;
  const steeple = h + 8 + ctx.level * 3;
  return [
    {
      solid: box(8, 5, 0, 24, 24, h),
      material: w.material,
      detail: all(archWindows(ctx, 5, 24, 4, 6), boards(w, 2)),
    },
    { solid: gable(7, 4, 25, 25, h, 9, "v"), material: roof },
    {
      solid: box(13, 22, 0, 19, 28, steeple),
      material: w.material,
      detail: all(archWindows(ctx, 13, 19, steeple - 7, 4), boards(w, 2)),
    },
    { solid: pyramid(12.5, 21.5, 19.5, 28.5, steeple, 12), material: roof },
    { solid: box(15.5, 24.5, steeple + 12, 16.5, 25.5, steeple + 16), material: GOLD },
  ];
}

/** A general store with a tall false front, an awning and crates by the door. */
function generalStore(ctx: Ctx): Part[] {
  const { w, roof } = woodOf(ctx.scheme);
  const h = 8 + ctx.level * 3;
  const sign: Detail = (hit) => {
    const spot = wallSpot(hit);
    if (!spot || spot.side !== "left") return null;
    return spot.z >= h + 1 && spot.z < h + 4 && spot.s >= 8 && spot.s < 24 ? "fbb954" : null;
  };
  return [
    {
      solid: box(5, 4, 0, 27, 22, h),
      material: w.material,
      detail: boards(w, 2),
    },
    { solid: gable(4.5, 3, 27.5, 22, h, 6, "v"), material: roof },
    {
      solid: box(5, 22, 0, 27, 24, h + 6),
      material: w.material,
      detail: all(
        sign,
        windows({
          seed: ctx.seed,
          abandoned: ctx.abandoned,
          period: 7,
          width: 5,
          storey: h,
          sill: 1,
          height: 4,
          from: 0,
          to: 6,
          margin: 2,
          s0: 5,
          s1: 27,
          doors: [[15, 18]],
          lit: 0.6,
        }),
        boards(w, 2),
      ),
    },
    { solid: box(5, 24, 6, 27, 28, 7), material: ROOF.red! },
    { solid: box(5, 24, 0, 27, 28, 1), material: WOOD, flat: true },
    { solid: box(6, 27, 1, 7, 28, 6), material: TRIM },
    { solid: box(25, 27, 1, 26, 28, 6), material: TRIM },
    { solid: box(7, 28.5, 0, 10, 31, 3), material: ramp("45293f", "6e2727", "9e4539", "cd683d") },
  ];
}

/** A tower narrowing upward, cut flat at height `h`: a pyramid of the given rise, clipped. */
function taper(lo: number, hi: number, h: number, rise: number) {
  const solid = pyramid(lo, lo, hi, hi, 0, rise) as Extract<
    ReturnType<typeof pyramid>,
    { kind: "convex" }
  >;
  return { kind: "convex" as const, planes: [...solid.planes, { n: [0, 0, 1] as const, d: h }] };
}

/** A windmill: a tapered wooden tower, a cap and four sails facing the street. */
function windmill(ctx: Ctx): Part[] {
  const { w, roof } = woodOf(ctx.scheme);
  const h = 20 + ctx.level * 6;
  const len = 11 + ctx.level * 2;
  const turn = 0.3 + noise(ctx.seed, "turn") * 0.6;
  const sail = ramp("625565", "9babb2", "c7dcd0", "c7dcd0");
  return [
    { solid: taper(7, 25, h, h * 1.8), material: w.material },
    { solid: box(6, 6, 0, 26, 26, h * 0.35), material: w.material, detail: boards(w, 2) },
    { solid: dome(16, 16, h, 6), material: roof },
    { solid: box(15, 20, h - 1, 17, 24, h + 1), material: WOOD },
    ...[0, 1, 2, 3].map((i) => ({
      solid: blade(16, 24, h, turn + (i * Math.PI) / 2, len),
      material: sail,
    })),
  ];
}

/** A farm: farmhouse, barn and rows of crops. */
function farm(ctx: Ctx): Part[] {
  const [h0, b0] = pair(ctx.scheme);
  const house = WOODS[h0]!;
  const red = WOODS[b0]!;
  const h = 7 * Math.min(ctx.level, 2) + 1;
  const parts: Part[] = [
    {
      solid: box(4, 4, 0, 18, 14, h),
      material: house.material,
      detail: all(houseWindows(ctx, 4, 18, Math.min(ctx.level, 2), [[8, 10]]), boards(house, 2)),
    },
    { solid: gable(3, 3, 19, 15, h, 7, "u"), material: ROOF.red! },
    ...porch(4, 18, 14, 3, 5, ROOF.red!),
    { solid: box(26, 4, 0, 44, 20, 14), material: red.material, detail: boards(red, 2) },
    { solid: gable(25, 3, 45, 21, 14, 9, "v"), material: ROOF.slate! },
  ];
  if (ctx.level >= 2)
    parts.push(
      { solid: cylinder(40, 26, 3, 0, 26), material: STONE },
      { solid: dome(40, 26, 26, 3), material: ROOF.slate! },
    );
  // Crop rows, alternating green and ripe.
  for (let i = 0; i < 6; i++)
    parts.push({
      solid: box(4 + i * 4, 24, 0, 6 + i * 4, 44, 2),
      material: ctx.level === 3 && i % 2 ? ramp(...RAMPS.dry) : HEDGE,
      flat: true,
    });
  return parts;
}

/** A big log lodge with a cross wing, two chimneys and a long porch. */
function lodge(ctx: Ctx): Part[] {
  const { w, roof } = woodOf(ctx.scheme);
  const storeys = Math.min(ctx.level + 1, 3);
  const h = storeys * 7;
  return [
    {
      solid: box(8, 8, 0, 56, 30, h),
      material: w.material,
      detail: all(houseWindows(ctx, 8, 56, storeys, [[20, 23]]), boards(w, 3)),
    },
    { solid: gable(7, 7, 57, 31, h, 10, "u"), material: roof },
    {
      solid: box(36, 20, 0, 52, 50, h),
      material: w.material,
      detail: all(houseWindows(ctx, 36, 52, storeys, [[42, 45]]), boards(w, 3)),
    },
    { solid: gable(35, 19, 53, 51, h, 9, "v"), material: roof },
    { solid: box(10, 12, 0, 13, 16, h + 12), material: STONE },
    { solid: box(48, 12, 0, 51, 16, h + 12), material: STONE },
    ...porch(8, 35, 30, 5, 6, roof),
  ];
}

const HOUSE_SCHEMES = ["cream", "blue", "pink", "yellow", "mint", "white"];

const MODELS: Model[] = [
  {
    name: "cabin",
    family: "village",
    footprint: 1,
    levels: [1, 2, 3],
    lot: "meadow",
    schemes: ["log/green", "log/shingle", "log/slate"],
    parts: cabin,
  },
  {
    name: "cottage",
    family: "village",
    footprint: 1,
    levels: [1, 2, 3],
    lot: "meadow",
    schemes: [
      "white/red",
      "blue/slate",
      "yellow/shingle",
      "green/red",
      "red/slate",
      "sage/shingle",
      "teal/brown",
    ],
    parts: clapboard,
  },
  {
    name: "farmhouse",
    family: "village",
    footprint: 2,
    levels: [1, 2, 3],
    lot: "meadow",
    schemes: ["white/red", "blue/slate", "yellow/green", "sage/shingle"],
    parts: farmhouse,
  },
  {
    name: "barn",
    family: "village",
    footprint: 2,
    levels: [1, 2, 3],
    lot: "meadow",
    schemes: ["red/slate", "log/shingle"],
    parts: barn,
  },
  {
    name: "chapel",
    family: "village",
    footprint: 2,
    levels: [1, 2, 3],
    lot: "meadow",
    schemes: ["white/slate", "white/red"],
    parts: woodChapel,
  },
  {
    name: "store",
    family: "village",
    footprint: 2,
    levels: [1, 2, 3],
    lot: "meadow",
    schemes: ["white/red", "yellow/shingle", "teal/brown"],
    parts: generalStore,
  },
  {
    name: "windmill",
    family: "village",
    footprint: 2,
    levels: [1, 2, 3],
    lot: "meadow",
    schemes: ["white/shingle", "log/red"],
    parts: windmill,
  },
  {
    name: "farm",
    family: "village",
    footprint: 3,
    levels: [1, 2, 3],
    lot: "meadow",
    schemes: ["white/red", "yellow/log", "blue/red"],
    parts: farm,
  },
  {
    name: "lodge",
    family: "village",
    footprint: 4,
    levels: [1, 2, 3],
    lot: "meadow",
    schemes: ["log/green", "log/slate"],
    parts: lodge,
  },
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
    name: "slab",
    family: "residential",
    footprint: 2,
    levels: [2, 3],
    lot: "paved",
    schemes: ["white", "sand", "peach"],
    parts: aptSlab(2),
  },
  {
    name: "slab-large",
    family: "residential",
    footprint: 3,
    levels: [1, 2, 3],
    lot: "paved",
    schemes: ["white", "sand", "sage"],
    parts: aptSlab(3),
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
  {
    name: "shed",
    family: "industrial",
    footprint: 1,
    levels: [1, 2, 3],
    lot: "yard",
    schemes: ["rust", "teal", "green"],
    parts: shed,
  },
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
  // More variety -------------------------------------------------------------------
  {
    name: "cottage",
    family: "residential",
    footprint: 1,
    levels: [1, 2],
    lot: "lawn",
    schemes: ["sage/red", "white/green", "lilac/slate", "peach/brown", "lemon/purple"],
    parts: resCottage,
  },
  {
    name: "midrise",
    family: "residential",
    footprint: 2,
    levels: [1, 2],
    lot: "lawn",
    schemes: ["peach", "mint", "lilac", "white"],
    parts: midrise,
  },
  {
    name: "highrise",
    family: "residential",
    footprint: 2,
    levels: [2, 3],
    lot: "lawn",
    schemes: ["redbrick", "sand", "brownbrick"],
    parts: highrise(2),
  },
  {
    name: "highrise-large",
    family: "residential",
    footprint: 3,
    levels: [2, 3],
    lot: "lawn",
    schemes: ["plum", "white", "brownbrick"],
    parts: highrise(3),
  },
  {
    name: "brick-cottage",
    family: "brick",
    footprint: 1,
    levels: [1, 2],
    lot: "lawn",
    schemes: ["redbrick/slate", "brownbrick/red", "stone/teal", "sand/wine", "white/dark"],
    parts: brickCottage,
  },
  {
    name: "brick-store",
    family: "brick",
    footprint: 1,
    levels: [1, 2, 3],
    lot: "paved",
    schemes: ["redbrick/green", "brownbrick/teal", "stone/red", "plum/brown", "sage/wine"],
    parts: store,
  },
  {
    name: "brick-rowhouses",
    family: "brick",
    footprint: 2,
    levels: [1, 2, 3],
    lot: "paved",
    schemes: ["a", "b", "c"],
    parts: rowhouses,
  },
  {
    name: "brick-tenement",
    family: "brick",
    footprint: 2,
    levels: [1, 2, 3],
    lot: "paved",
    schemes: ["plum", "sage", "sand", "brownbrick"],
    parts: tenement(2),
  },
  {
    name: "brick-tenement-large",
    family: "brick",
    footprint: 3,
    levels: [1, 2, 3],
    lot: "paved",
    schemes: ["redbrick", "stone", "lilac"],
    parts: tenement(3),
  },
  {
    name: "brick-school",
    family: "brick",
    footprint: 3,
    levels: [1, 2, 3],
    lot: "paved",
    schemes: ["redbrick", "ochre"],
    parts: school(3),
  },
  {
    name: "brick-station",
    family: "brick",
    footprint: 4,
    levels: [1, 2, 3],
    lot: "plaza",
    schemes: ["redbrick", "sand"],
    parts: station,
  },
  {
    name: "brick-deco-tower",
    family: "brick",
    footprint: 4,
    levels: [1, 2, 3],
    lot: "plaza",
    schemes: ["sand", "brownbrick"],
    parts: decoTower,
  },
  {
    name: "modern-house",
    family: "modern",
    footprint: 1,
    levels: [1, 2, 3],
    lot: "lawn",
    schemes: ["white", "charcoal", "sand", "sage"],
    parts: modernHouse,
  },
  {
    name: "modern-gas-station",
    family: "modern",
    footprint: 1,
    levels: [1, 2],
    lot: "paved",
    schemes: ["wine", "green", "teal"],
    parts: gasStation,
  },
  {
    name: "modern-office",
    family: "modern",
    footprint: 2,
    levels: [1, 2, 3],
    lot: "paved",
    schemes: ["white/sky", "sand/bronze", "charcoal/blue", "sage/sage"],
    parts: office(2),
  },
  {
    name: "modern-office-large",
    family: "modern",
    footprint: 3,
    levels: [1, 2, 3],
    lot: "paved",
    schemes: ["white/sky", "charcoal/bronze", "stone/silver"],
    parts: office(3),
  },
  {
    name: "modern-wedge",
    family: "modern",
    footprint: 2,
    levels: [2, 3],
    lot: "plaza",
    schemes: ["sky", "blue"],
    parts: wedge(2),
  },
  {
    name: "modern-wedge-large",
    family: "modern",
    footprint: 3,
    levels: [2, 3],
    lot: "plaza",
    schemes: ["sky", "dark"],
    parts: wedge(3),
  },
  {
    name: "modern-black-tower",
    family: "modern",
    footprint: 2,
    levels: [3],
    lot: "plaza",
    schemes: ["dark", "bronze"],
    parts: blackTower(2),
  },
  {
    name: "modern-black-tower-large",
    family: "modern",
    footprint: 4,
    levels: [1, 2, 3],
    lot: "plaza",
    schemes: ["dark", "blue", "sage"],
    parts: blackTower(4),
  },
  {
    name: "modern-setback",
    family: "modern",
    footprint: 3,
    levels: [2, 3],
    lot: "plaza",
    schemes: ["sky", "bronze", "sage"],
    parts: setbackTower(3),
  },
  {
    name: "modern-setback-large",
    family: "modern",
    footprint: 4,
    levels: [1, 2, 3],
    lot: "plaza",
    schemes: ["silver", "blue"],
    parts: setbackTower(4),
  },
  {
    name: "modern-twin",
    family: "modern",
    footprint: 3,
    levels: [1, 2, 3],
    lot: "plaza",
    schemes: ["blue", "bronze"],
    parts: twinTowers(3),
  },
  {
    name: "modern-twin-large",
    family: "modern",
    footprint: 4,
    levels: [1, 2, 3],
    lot: "plaza",
    schemes: ["sky", "dark"],
    parts: twinTowers(4),
  },
  {
    name: "modern-crown",
    family: "modern",
    footprint: 2,
    levels: [2, 3],
    lot: "paved",
    schemes: ["stone/teal", "sand/gold"],
    parts: crownTower(2),
  },
  {
    name: "modern-crown-large",
    family: "modern",
    footprint: 3,
    levels: [1, 2, 3],
    lot: "paved",
    schemes: ["white/teal", "brownbrick/gold", "charcoal/gold"],
    parts: crownTower(3),
  },
  {
    name: "modern-needle",
    family: "modern",
    footprint: 2,
    levels: [2, 3],
    lot: "plaza",
    schemes: ["silver", "sage"],
    parts: needle,
  },
  {
    name: "modern-podium",
    family: "modern",
    footprint: 3,
    levels: [1, 2, 3],
    lot: "paved",
    schemes: ["sand/blue", "white/dark"],
    parts: podiumTower(3),
  },
  {
    name: "modern-podium-large",
    family: "modern",
    footprint: 4,
    levels: [1, 2, 3],
    lot: "paved",
    schemes: ["stone/sky", "peach/bronze"],
    parts: podiumTower(4),
  },
  {
    name: "modern-sail",
    family: "modern",
    footprint: 2,
    levels: [2, 3],
    lot: "plaza",
    schemes: ["blue", "sky"],
    parts: sailTower(2),
  },
  {
    name: "modern-sail-large",
    family: "modern",
    footprint: 3,
    levels: [1, 2, 3],
    lot: "plaza",
    schemes: ["blue", "silver"],
    parts: sailTower(3),
  },
  {
    name: "modern-piers",
    family: "modern",
    footprint: 2,
    levels: [2, 3],
    lot: "paved",
    schemes: ["sand/dark", "white/blue"],
    parts: pierTower(2),
  },
  {
    name: "modern-piers-large",
    family: "modern",
    footprint: 3,
    levels: [1, 2, 3],
    lot: "paved",
    schemes: ["sand/dark", "stone/sage", "white/bronze"],
    parts: pierTower(3),
  },
  {
    name: "modern-atrium",
    family: "modern",
    footprint: 3,
    levels: [1, 2],
    lot: "paved",
    schemes: ["white/sky", "sand/blue", "redbrick/silver"],
    parts: atriumBlock(3),
  },
  {
    name: "modern-atrium-large",
    family: "modern",
    footprint: 4,
    levels: [1, 2, 3],
    lot: "paved",
    schemes: ["white/blue", "stone/sage"],
    parts: atriumBlock(4),
  },
  {
    name: "modern-trio",
    family: "modern",
    footprint: 4,
    levels: [1, 2, 3],
    lot: "plaza",
    schemes: ["sky", "blue"],
    parts: trioTowers,
  },
  {
    name: "modern-mall",
    family: "modern",
    footprint: 3,
    levels: [1, 2],
    lot: "yard",
    schemes: ["red", "teal", "purple"],
    parts: mall,
  },
  {
    name: "modern-campus",
    family: "modern",
    footprint: 4,
    levels: [1, 2, 3],
    lot: "lawn",
    schemes: ["sky", "sage", "silver"],
    parts: campus,
  },
  {
    name: "water-tower",
    family: "industrial",
    footprint: 1,
    levels: [1, 2, 3],
    lot: "yard",
    schemes: ["teal", "red"],
    parts: waterTower,
  },
  {
    name: "wind-turbine",
    family: "industrial",
    footprint: 1,
    levels: [1, 2, 3],
    lot: "lawn",
    parts: windTurbine,
  },
  {
    name: "container-yard",
    family: "industrial",
    footprint: 2,
    levels: [1, 2, 3],
    lot: "yard",
    parts: containerYard,
  },
  {
    name: "fire-station",
    family: "civic",
    footprint: 2,
    levels: [1, 2, 3],
    lot: "paved",
    parts: fireStation,
  },
  {
    name: "hospital",
    family: "civic",
    footprint: 3,
    levels: [1, 2, 3],
    lot: "plaza",
    parts: hospital,
  },
  {
    name: "stadium",
    family: "civic",
    footprint: 4,
    levels: [1, 2, 3],
    lot: "lawn",
    parts: stadium,
  },
  {
    name: "monument",
    family: "civic",
    footprint: 1,
    levels: [1, 2, 3],
    lot: "plaza",
    schemes: ["obelisk", "statue"],
    parts: monument,
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
      const suffix = model.schemes ? `-${scheme.replace("/", "-")}` : "";
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
