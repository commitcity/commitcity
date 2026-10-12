import { DECORATION_VARIANT_COUNT, GROUND_VARIANT_COUNT } from "@/core/assets";
import type { Building, Decoration, Facing, GroundKind, GroundTile, RoadTile } from "@/core/model";
import { hash53 } from "@/core/random";
import type { BlockRect } from "./grid";

/** Margin of ground around the city, in tiles. */
export const GROUND_MARGIN = 2;

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

/** The grove of one coarse cell, if it has one: its center and radius. */
function groveOf(owner: string, gx: number, gy: number, density: number) {
  const seed = `${owner}:grove:${gx},${gy}`;
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

/**
 * Nature on the free tiles: groves of trees, a bush or flowers here and there,
 * flowers in the gardens between buildings, and weeds on dirt. Everything comes
 * from position hashes, so it never depends on repository order.
 */
export function decorateFree(
  owner: string,
  free: readonly { x: number; y: number; garden: boolean; dirt: boolean; density: number }[],
): Decoration[] {
  const decorations: Decoration[] = [];
  const groves = new Map<string, ReturnType<typeof groveOf>>();
  for (const { x, y, garden, dirt, density } of free) {
    const key = `${owner}:nature:${x},${y}`;
    const variant = roll(`${key}:v`, DECORATION_VARIANT_COUNT);
    const pick = roll(key, 100);
    let kind: string | null = null;
    if (dirt) kind = pick < 35 ? "weeds" : pick < 42 ? "dead-tree" : null;
    else if (garden) kind = pick < 30 ? "tree" : pick < 60 ? "flowers" : pick < 80 ? "bush" : null;
    else if (inGrove(owner, x, y, density, groves))
      kind = pick < 70 ? "tree" : pick < 85 ? "bush" : null;
    else kind = pick < 2 ? "bush" : pick < 3 ? "flowers" : null;
    if (kind) decorations.push({ x, y, kind, variant, repoId: "nature" });
  }
  return decorations;
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
