import { DECORATION_VARIANT_COUNT, GROUND_VARIANT_COUNT } from "@/core/assets";
import type { Building, Decoration, Facing, GroundKind, GroundTile, RoadTile } from "@/core/model";
import { hash53 } from "@/core/random";
import type { BlockRect } from "./grid";

/** Margin of countryside around the city, in tiles: room for the woods to close in. */
export const GROUND_MARGIN = 4;

type Tile = { x: number; y: number };
const at = (x: number, y: number) => `${x},${y}`;
const roll = (key: string, n: number) => hash53(key) % n;

/** Road tiles along one side of a block, corners included. */
export function roadAlong(rect: BlockRect, side: Facing): Tile[] {
  const { x, y, w, h } = rect;
  const tiles: Tile[] = [];
  for (let i = -1; i <= (side === 0 || side === 2 ? h : w); i++) {
    if (side === 1) tiles.push({ x: x + i, y: y + h });
    else if (side === 3) tiles.push({ x: x + i, y: y - 1 });
    else if (side === 0) tiles.push({ x: x + w, y: y + i });
    else tiles.push({ x: x - 1, y: y + i });
  }
  return tiles;
}

/**
 * Joins road pieces into one network: while there are separate pieces, the
 * shortest path along `candidates` (the edges of the city's blocks) from the
 * first piece to any other is paved. Deterministic: the search visits
 * neighbours in a fixed order and starts from sorted tiles.
 */
export function connectRoads(pieces: readonly Tile[], candidates: readonly Tile[]): Tile[] {
  const road = new Set(pieces.map((t) => at(t.x, t.y)));
  const open = new Set(candidates.map((t) => at(t.x, t.y)));
  const parse = (k: string) => k.split(",").map(Number) as [number, number];
  const steps = [
    [1, 0],
    [0, 1],
    [-1, 0],
    [0, -1],
  ] as const;
  // Sorted by y, then x; each key is parsed once, not on every comparison.
  const sorted = (keys: Iterable<string>) =>
    [...keys]
      .map((k) => ({ k, t: parse(k) }))
      .sort((a, b) => a.t[1] - b.t[1] || a.t[0] - b.t[0])
      .map((e) => e.k);

  const component = (start: string) => {
    const seen = new Set([start]);
    const queue = [start];
    for (let i = 0; i < queue.length; i++) {
      const [x, y] = parse(queue[i]!);
      for (const [dx, dy] of steps) {
        const k = at(x + dx, y + dy);
        if (road.has(k) && !seen.has(k)) {
          seen.add(k);
          queue.push(k);
        }
      }
    }
    return seen;
  };

  for (;;) {
    let first: string | undefined;
    let best: [number, number] | undefined;
    for (const k of road) {
      const t = parse(k);
      if (!best || t[1] < best[1] || (t[1] === best[1] && t[0] < best[0])) {
        first = k;
        best = t;
      }
    }
    if (first === undefined) break;
    const joined = component(first);
    if (joined.size === road.size) break;
    // Breadth-first search from the joined network over free candidate tiles.
    const from = new Map<string, string | null>();
    const queue = sorted(joined);
    for (const k of queue) from.set(k, null);
    let reached: string | null = null;
    for (let i = 0; i < queue.length && reached === null; i++) {
      const [x, y] = parse(queue[i]!);
      for (const [dx, dy] of steps) {
        const k = at(x + dx, y + dy);
        if (from.has(k)) continue;
        if (road.has(k)) {
          from.set(k, queue[i]!);
          reached = k;
          break;
        }
        if (!open.has(k)) continue;
        from.set(k, queue[i]!);
        queue.push(k);
      }
    }
    // No path along block edges: leave the rest as it is.
    if (reached === null) break;
    for (let k: string | null = from.get(reached)!; k !== null && !joined.has(k); k = from.get(k)!)
      road.add(k);
  }
  return [...road].map((k) => {
    const [x, y] = parse(k);
    return { x, y };
  });
}

/** Unique road tiles, sorted by y, then x (ARCHITECTURE.md §6.6). */
export function uniqueRoads(tiles: readonly Tile[]): RoadTile[] {
  const map = new Map<string, RoadTile>();
  for (const t of tiles) map.set(at(t.x, t.y), { x: t.x, y: t.y });
  return [...map.values()].sort((a, b) => a.y - b.y || a.x - b.x);
}

/**
 * Ground for every tile in the bounds. The variant comes from a position hash, so
 * ground never depends on repository order.
 */
export function fillGround(
  owner: string,
  bounds: { minX: number; minY: number; maxX: number; maxY: number },
  kinds: ReadonlyMap<string, GroundKind>,
): GroundTile[] {
  const ground: GroundTile[] = [];
  for (let y = bounds.minY; y <= bounds.maxY; y++) {
    for (let x = bounds.minX; x <= bounds.maxX; x++) {
      ground.push({
        x,
        y,
        kind: kinds.get(at(x, y)) ?? "grass",
        variant: hash53(`${owner}:ground:${x},${y}`) % GROUND_VARIANT_COUNT,
      });
    }
  }
  return ground;
}

const GROVE_CELL = 6;

/** The grove (or meadow) of one coarse cell, if it has one: its center and radius. */
function groveOf(owner: string, gx: number, gy: number, density: number, what = "grove") {
  const seed = `${owner}:${what}:${gx},${gy}`;
  if (roll(seed, 100) >= density) return null;
  return {
    x: gx * GROVE_CELL + roll(`${seed}:x`, GROVE_CELL),
    y: gy * GROVE_CELL + roll(`${seed}:y`, GROVE_CELL),
    radius: 1 + roll(`${seed}:r`, 2),
  };
}

/**
 * Trees grow in small groves, not on every free tile: a coarse grid of cells, a
 * few of which hold a grove around a hashed center. `density` is the chance that
 * a cell has a grove, out of 100.
 */
export function inGrove(
  owner: string,
  x: number,
  y: number,
  density: number,
  cache = new Map<string, ReturnType<typeof groveOf>>(),
): boolean {
  const cx = Math.floor(x / GROVE_CELL);
  const cy = Math.floor(y / GROVE_CELL);
  for (let gy = cy - 1; gy <= cy + 1; gy++) {
    for (let gx = cx - 1; gx <= cx + 1; gx++) {
      const key = `${gx},${gy},${density}`;
      let grove = cache.get(key);
      if (grove === undefined) {
        grove = groveOf(owner, gx, gy, density);
        cache.set(key, grove);
      }
      if (!grove) continue;
      const dx = x - grove.x;
      const dy = y - grove.y;
      if (dx * dx + dy * dy <= grove.radius * grove.radius + 1) return true;
    }
  }
  return false;
}

/** Lighter meadow patches in open grass, laid out like groves on their own cells. */
export function inMeadow(
  owner: string,
  x: number,
  y: number,
  cache = new Map<string, ReturnType<typeof groveOf>>(),
): boolean {
  const cx = Math.floor(x / GROVE_CELL);
  const cy = Math.floor(y / GROVE_CELL);
  for (let gy = cy - 1; gy <= cy + 1; gy++) {
    for (let gx = cx - 1; gx <= cx + 1; gx++) {
      const key = `${gx},${gy}`;
      let patch = cache.get(key);
      if (patch === undefined) {
        patch = groveOf(owner, gx, gy, 30, "meadow");
        cache.set(key, patch);
      }
      if (!patch) continue;
      const dx = x - patch.x;
      const dy = y - patch.y;
      if (dx * dx + dy * dy <= (patch.radius + 1) ** 2) return true;
    }
  }
  return false;
}

/**
 * How wild a tile is, out of 100: 0 next to anything built, growing with the
 * distance from it, with a ragged edge so the woods do not form a straight line.
 * Above about 50 the tile is forest.
 */
export function wildness(owner: string, x: number, y: number, distance: number): number {
  const jitter = roll(`${owner}:wild:${Math.floor(x / 3)},${Math.floor(y / 3)}`, 41) - 20;
  return Math.max(0, Math.min(92, (distance - 1) * 26 + jitter));
}

/** Distance in steps from each tile in the bounds to the nearest built tile. */
export function distanceFrom(
  built: ReadonlySet<string>,
  bounds: { minX: number; minY: number; maxX: number; maxY: number },
): Map<string, number> {
  const distance = new Map<string, number>();
  const queue: [number, number][] = [];
  for (const k of built) {
    const [x, y] = k.split(",").map(Number) as [number, number];
    distance.set(k, 0);
    queue.push([x, y]);
  }
  for (let i = 0; i < queue.length; i++) {
    const [x, y] = queue[i]!;
    const d = distance.get(at(x, y))!;
    for (const [nx, ny] of [
      [x + 1, y],
      [x, y + 1],
      [x - 1, y],
      [x, y - 1],
    ] as const) {
      if (nx < bounds.minX || nx > bounds.maxX || ny < bounds.minY || ny > bounds.maxY) continue;
      const k = at(nx, ny);
      if (distance.has(k)) continue;
      distance.set(k, d + 1);
      queue.push([nx, ny]);
    }
  }
  return distance;
}

/**
 * Nature on the free tiles: woods that thicken away from the city, groves of
 * trees, a bush or flowers here and there, flowers in the gardens between
 * buildings, weeds on dirt and street trees downtown. Everything comes from position hashes, so it
 * never depends on repository order.
 */
export function decorateFree(
  owner: string,
  free: readonly {
    x: number;
    y: number;
    garden: boolean;
    dirt: boolean;
    density: number;
    wild: number;
    downtown?: boolean;
  }[],
): Decoration[] {
  const decorations: Decoration[] = [];
  const groves = new Map<string, ReturnType<typeof groveOf>>();
  for (const { x, y, garden, dirt, density, wild, downtown } of free) {
    const key = `${owner}:nature:${x},${y}`;
    const variant = roll(`${key}:v`, DECORATION_VARIANT_COUNT);
    const pick = roll(key, 100);
    let kind: string | null = null;
    // Downtown is paved: a street tree now and then, nothing wild.
    if (downtown) kind = pick < (garden ? 35 : 6) ? "tree" : null;
    else if (dirt) kind = pick < 35 ? "weeds" : pick < 42 ? "dead-tree" : null;
    else if (garden) kind = pick < 30 ? "tree" : pick < 60 ? "flowers" : pick < 80 ? "bush" : null;
    else if (pick < wild) kind = pick < wild * 0.88 ? "tree" : "bush";
    else if (inGrove(owner, x, y, density, groves))
      kind = pick < 70 ? "tree" : pick < 85 ? "bush" : null;
    else kind = pick < 2 ? "bush" : pick < 3 ? "flowers" : null;
    if (kind) decorations.push({ x, y, kind, variant, repoId: "nature" });
  }
  return decorations;
}

/**
 * How many rings of blocks around the center are downtown: paved, with street
 * trees instead of backyards. Downtown grows with the city, the way a dense
 * core grows in city builders; a village or a small town has none (-1).
 */
export function downtownRadius(repoCount: number, village: boolean): number {
  if (village || repoCount < 20) return -1;
  if (repoCount < 100) return 0;
  if (repoCount < 250) return 1;
  return 2;
}

/** Ring of a block around the center block: 0 for the center, 1 for the eight around it... */
export function ringOf(block: { x: number; y: number }): number {
  return Math.max(Math.abs(block.x), Math.abs(block.y));
}

/** Free tiles next to an abandoned building turn to dirt. */
export function dirtAround(building: Building): Tile[] {
  if (building.variant !== "abandoned") return [];
  const tiles: Tile[] = [];
  const { x, y } = building.origin;
  const f = building.footprint;
  for (let dy = -1; dy <= f; dy++)
    for (let dx = -1; dx <= f; dx++) tiles.push({ x: x + dx, y: y + dy });
  return tiles;
}
