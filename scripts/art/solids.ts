// A tiny ray caster for building sprites: shapes are solids in world space and
// every pixel takes the color of the frontmost surface (ART_DIRECTION.md §2–§5).
//
// World axes, in pixels along the tile grid: u runs to the lower right on screen,
// v to the lower left and z up. One tile side is 16 units, so a footprint of N
// tiles spans u, v ∈ [0, 16N]. A point lands on screen at
//   x = W/2 + u − v,   y = top + (u + v)/2 − z
// which is the 2:1 projection: the footprint diamond comes out exactly as
// `diamondTop` draws it, and walls, windows and roof edges follow the grid.
import { Canvas, type Hex } from "./kit";

export type Vec = readonly [number, number, number];

/** Which way a surface faces, for shading: top, left wall (+v), right wall (+u), or a slope. */
export type Facing = "top" | "left" | "right" | "back" | "slope";

/** A colour ramp, darkest first, with optional fixed colours per facing. */
export interface Material {
  ramp: readonly Hex[];
  top?: Hex;
  left?: Hex;
  right?: Hex;
  /** Outline colour; the darkest ramp step by default. */
  outline?: Hex;
}

export interface Hit {
  /** Point on the surface. */
  p: Vec;
  /** Unit normal. */
  n: Vec;
  facing: Facing;
}

/** Overrides the shaded colour of a surface point (windows, doors, stripes), or null. */
export type Detail = (hit: Hit) => Hex | null;

interface Plane {
  n: Vec;
  d: number;
}

export type Solid =
  | { kind: "convex"; planes: Plane[] }
  | { kind: "cylinder"; cu: number; cv: number; r: number; z0: number; z1: number }
  | { kind: "sphere"; cu: number; cv: number; cz: number; r: number; zMin: number };

export interface Part {
  solid: Solid;
  material: Material;
  detail?: Detail;
  /** Parts drawn without an outline against the lot, like a low wall or a lawn. */
  flat?: boolean;
}

// The view ray through a pixel, p(t) = P0 + t·D, with D = (½, ½, ½): the eye looks
// along −D, so a larger t is nearer the viewer.
const D: Vec = [0.5, 0.5, 0.5];
const dot = (a: Vec, b: Vec) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const norm = (a: Vec): Vec => {
  const l = Math.hypot(a[0], a[1], a[2]);
  return [a[0] / l, a[1] / l, a[2] / l];
};

/** Nearest surface along the ray through screen offset (x, y) from the footprint's top vertex. */
function intersect(solid: Solid, x: number, y: number): { t: number; n: Vec } | null {
  const p0: Vec = [x / 2, -x / 2, -y];
  if (solid.kind === "convex") {
    let lo = -Infinity;
    let hi = Infinity;
    let hiN: Vec | null = null;
    for (const { n, d } of solid.planes) {
      const nd = dot(n, D);
      const rest = d - dot(n, p0);
      if (Math.abs(nd) < 1e-9) {
        if (rest < 0) return null;
      } else if (nd > 0) {
        const t = rest / nd;
        if (t < hi) {
          hi = t;
          hiN = n;
        }
      } else lo = Math.max(lo, rest / nd);
    }
    if (hiN === null || hi < lo) return null;
    return { t: hi, n: norm(hiN) };
  }
  if (solid.kind === "cylinder") {
    // u − cu = a + t/2, v − cv = b + t/2.
    const a = p0[0] - solid.cu;
    const b = p0[1] - solid.cv;
    const A = 0.5;
    const B = a + b;
    const C = a * a + b * b - solid.r * solid.r;
    const disc = B * B - 4 * A * C;
    if (disc < 0) return null;
    const t1 = (-B - Math.sqrt(disc)) / (2 * A);
    const t2 = (-B + Math.sqrt(disc)) / (2 * A);
    // z = −y + t/2 within [z0, z1].
    const zLo = 2 * (solid.z0 + y);
    const zHi = 2 * (solid.z1 + y);
    const lo = Math.max(t1, zLo);
    if (Math.min(t2, zHi) < lo) return null;
    if (zHi < t2) return { t: zHi, n: [0, 0, 1] };
    const u = a + t2 / 2;
    const v = b + t2 / 2;
    return { t: t2, n: norm([u, v, 0]) };
  }
  const a = p0[0] - solid.cu;
  const b = p0[1] - solid.cv;
  const c = p0[2] - solid.cz;
  // |(a, b, c) + t·D|² = r²
  const A = 0.75;
  const B = a + b + c;
  const C = a * a + b * b + c * c - solid.r * solid.r;
  const disc = B * B - 4 * A * C;
  if (disc < 0) return null;
  const t = (-B + Math.sqrt(disc)) / (2 * A);
  const z = c + t / 2;
  if (z + solid.cz < solid.zMin) return null;
  return { t, n: norm([a + t / 2, b + t / 2, z]) };
}

function facingOf(n: Vec): Facing {
  if (n[2] > 0.95) return "top";
  if (n[0] > 0.95) return "right";
  if (n[1] > 0.95) return "left";
  if (n[0] < -0.5 || n[1] < -0.5) return "back";
  return "slope";
}

/** Light from the upper left of the screen: top 1, left walls ~0.6, right walls ~0.35. */
const LIGHT: Vec = [0.35, 0.6, 1];

function shade(material: Material, n: Vec, facing: Facing): Hex {
  if (facing === "top" && material.top) return material.top;
  if (facing === "left" && material.left) return material.left;
  if (facing === "right" && material.right) return material.right;
  const ramp = material.ramp;
  const b = Math.max(0, Math.min(1, dot(n, LIGHT)));
  // Keep the darkest step for outlines.
  const steps = ramp.length - 1;
  return ramp[Math.max(1, Math.min(steps, Math.round(b * steps)))]!;
}

/**
 * Draws `parts` onto `c`, whose footprint of `tiles` tiles fills the bottom of the
 * canvas. Silhouettes get a one-pixel outline in each part's darkest colour.
 * Returns, per pixel, whether a part covers it.
 */
export function render(c: Canvas, tiles: number, parts: readonly Part[]): Uint8Array {
  const w = c.width;
  const top = c.height - (tiles * 32) / 2;
  const owner = new Int32Array(w * c.height).fill(-1);
  for (let py = 0; py < c.height; py++) {
    for (let px = 0; px < w; px++) {
      const x = px + 0.5 - w / 2;
      const y = py + 0.5 - top;
      let best: { t: number; n: Vec; part: number } | null = null;
      parts.forEach((part, i) => {
        const hit = intersect(part.solid, x, y);
        if (hit && (!best || hit.t > best.t + 1e-6)) best = { ...hit, part: i };
      });
      if (!best) continue;
      const { t, n, part: i } = best as { t: number; n: Vec; part: number };
      const part = parts[i]!;
      const p: Vec = [x / 2 + t / 2, -x / 2 + t / 2, -y + t / 2];
      const facing = facingOf(n);
      const color = part.detail?.({ p, n, facing }) ?? shade(part.material, n, facing);
      c.set(px, py, color);
      owner[py * w + px] = part.flat ? -2 : i;
    }
  }
  // Outline: drawn pixels of a solid next to a pixel no solid covers.
  for (let py = 0; py < c.height; py++)
    for (let px = 0; px < w; px++) {
      const i = owner[py * w + px]!;
      if (i < 0) continue;
      const open = [
        [px - 1, py],
        [px + 1, py],
        [px, py - 1],
        [px, py + 1],
      ].some(([qx, qy]) => !c.inside(qx!, qy!) || owner[qy! * w + qx!]! === -1);
      if (open) {
        const m = parts[i]!.material;
        c.set(px, py, m.outline ?? m.ramp[0]!);
      }
    }
  return Uint8Array.from(owner, (i) => (i === -1 ? 0 : 1));
}

// Shapes. All take world units (16 per tile).

/** An axis-aligned box from (u0, v0, z0) to (u1, v1, z1). */
export function box(u0: number, v0: number, z0: number, u1: number, v1: number, z1: number): Solid {
  return {
    kind: "convex",
    planes: [
      { n: [1, 0, 0], d: u1 },
      { n: [-1, 0, 0], d: -u0 },
      { n: [0, 1, 0], d: v1 },
      { n: [0, -1, 0], d: -v0 },
      { n: [0, 0, 1], d: z1 },
      { n: [0, 0, -1], d: -z0 },
    ],
  };
}

/**
 * A gable roof over the box (u0, v0)–(u1, v1) from height z0, rising `rise` to a
 * ridge along `axis` ("u": the ridge runs to the lower right).
 */
export function gable(
  u0: number,
  v0: number,
  u1: number,
  v1: number,
  z0: number,
  rise: number,
  axis: "u" | "v",
): Solid {
  const base = box(u0, v0, z0 - 1, u1, v1, z0 + rise) as Extract<Solid, { kind: "convex" }>;
  const planes = [...base.planes];
  if (axis === "u") {
    const half = (v1 - v0) / 2;
    const mid = v0 + half;
    // z − z0 ≤ rise · (1 − |v − mid| / half)
    planes.push({ n: [0, rise / half, 1], d: z0 + rise + (rise / half) * mid });
    planes.push({ n: [0, -rise / half, 1], d: z0 + rise - (rise / half) * mid });
  } else {
    const half = (u1 - u0) / 2;
    const mid = u0 + half;
    planes.push({ n: [rise / half, 0, 1], d: z0 + rise + (rise / half) * mid });
    planes.push({ n: [-rise / half, 0, 1], d: z0 + rise - (rise / half) * mid });
  }
  return { kind: "convex", planes };
}

/** A pyramid (hip) roof over the box from z0, rising `rise` to a point or a short ridge. */
export function pyramid(
  u0: number,
  v0: number,
  u1: number,
  v1: number,
  z0: number,
  rise: number,
): Solid {
  const base = box(u0, v0, z0 - 1, u1, v1, z0 + rise) as Extract<Solid, { kind: "convex" }>;
  const hu = (u1 - u0) / 2;
  const hv = (v1 - v0) / 2;
  const mu = u0 + hu;
  const mv = v0 + hv;
  return {
    kind: "convex",
    planes: [
      ...base.planes,
      { n: [rise / hu, 0, 1], d: z0 + rise + (rise / hu) * mu },
      { n: [-rise / hu, 0, 1], d: z0 + rise - (rise / hu) * mu },
      { n: [0, rise / hv, 1], d: z0 + rise + (rise / hv) * mv },
      { n: [0, -rise / hv, 1], d: z0 + rise - (rise / hv) * mv },
    ],
  };
}

/** A vertical cylinder centred on (cu, cv). */
export function cylinder(cu: number, cv: number, r: number, z0: number, z1: number): Solid {
  return { kind: "cylinder", cu, cv, r, z0, z1 };
}

/** A dome: the part of a sphere above `zMin`. */
export function dome(cu: number, cv: number, cz: number, r: number, zMin = cz): Solid {
  return { kind: "sphere", cu, cv, cz, r, zMin };
}

/**
 * Where a hit lies on a vertical wall: `s` runs along the wall from its back end,
 * `z` up, and `side` says which wall. Null on roofs and curved surfaces.
 */
export function wallSpot(hit: Hit): { s: number; z: number; side: "left" | "right" } | null {
  if (hit.facing === "left") return { s: hit.p[0], z: hit.p[2], side: "left" };
  if (hit.facing === "right") return { s: hit.p[1], z: hit.p[2], side: "right" };
  return null;
}
