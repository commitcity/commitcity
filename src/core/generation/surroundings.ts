import { DECORATION_VARIANT_COUNT, GROUND_VARIANT_COUNT } from "@/core/assets";
import type { Building, Decoration, GroundKind, GroundTile, RoadTile } from "@/core/model";
import { type Random, hash53 } from "@/core/random";
import { BLOCK_INTERIOR, LOT_SIZE, blockOrigin } from "./layout";
import type { BlockPosition, Lot } from "./spiral";

/** Margin of ground around the outermost roads, in tiles. */
export const GROUND_MARGIN = 2;

/** Road tiles around every occupied block, sorted by y, then x (ARCHITECTURE.md §6.6). */
export function roadsAround(blocks: readonly BlockPosition[]): RoadTile[] {
  const tiles = new Map<string, RoadTile>();
  for (const block of blocks) {
    const origin = blockOrigin(block);
    for (let i = -1; i <= BLOCK_INTERIOR; i++) {
      for (const [x, y] of [
        [origin.x + i, origin.y - 1],
        [origin.x + i, origin.y + BLOCK_INTERIOR],
        [origin.x - 1, origin.y + i],
        [origin.x + BLOCK_INTERIOR, origin.y + i],
      ] as const) {
        tiles.set(`${x},${y}`, { x, y });
      }
    }
  }
  return [...tiles.values()].sort((a, b) => a.y - b.y || a.x - b.x);
}

/**
 * Ground for every tile in the bounds. The variant comes from a position hash, so
 * ground never depends on repository order. Lots of archived repositories turn to
 * dirt, and the tiles in `water` (keys "x,y") become water.
 */
export function fillGround(
  owner: string,
  bounds: { minX: number; minY: number; maxX: number; maxY: number },
  dirtLots: readonly Lot[],
  water: ReadonlySet<string> = new Set(),
): GroundTile[] {
  const dirt = new Set<string>();
  for (const lot of dirtLots) {
    for (let dx = 0; dx < LOT_SIZE; dx++) {
      for (let dy = 0; dy < LOT_SIZE; dy++) dirt.add(`${lot.origin.x + dx},${lot.origin.y + dy}`);
    }
  }
  const ground: GroundTile[] = [];
  for (let y = bounds.minY; y <= bounds.maxY; y++) {
    for (let x = bounds.minX; x <= bounds.maxX; x++) {
      const key = `${x},${y}`;
      const kind: GroundKind = water.has(key) ? "water" : dirt.has(key) ? "dirt" : "grass";
      ground.push({
        x,
        y,
        kind,
        variant: hash53(`${owner}:ground:${x},${y}`) % GROUND_VARIANT_COUNT,
      });
    }
  }
  return ground;
}

const DECORATION_CHANCE = 0.35;
const LIVELY = ["tree", "tree", "bush", "flowers"] as const;
const ABANDONED = ["weeds", "weeds", "dead-tree"] as const;

/** Decoration on the free tiles of one lot, from the repository's decoration stream. */
export function decorateLot(lot: Lot, building: Building, random: Random): Decoration[] {
  const kinds = building.variant === "abandoned" ? ABANDONED : LIVELY;
  const decorations: Decoration[] = [];
  for (let dy = 0; dy < LOT_SIZE; dy++) {
    for (let dx = 0; dx < LOT_SIZE; dx++) {
      const x = lot.origin.x + dx;
      const y = lot.origin.y + dy;
      // Draw for every tile, occupied or not, so the building's size never shifts
      // the decoration of the remaining tiles.
      const place = random.chance(DECORATION_CHANCE);
      const kind = random.pick(kinds);
      const variant = random.int(0, DECORATION_VARIANT_COUNT - 1);
      const insideBuilding =
        x >= building.origin.x &&
        x < building.origin.x + building.footprint &&
        y >= building.origin.y &&
        y < building.origin.y + building.footprint;
      if (place && !insideBuilding)
        decorations.push({ x, y, kind, variant, repoId: building.repoId });
    }
  }
  return decorations;
}
