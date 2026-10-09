import type { Footprint, ScreenPoint, TilePoint, TileSize } from "./types";

export const TILE_32: TileSize = { width: 32, height: 16 };
export const TILE_64: TileSize = { width: 64, height: 32 };

/**
 * Projects a view-space point to screen pixels at 1× (2:1 dimetric).
 * `+x` goes down-right on screen and `+y` goes down-left.
 */
export function worldToScreen(point: TilePoint, tile: TileSize): ScreenPoint {
  return {
    x: ((point.x - point.y) * tile.width) / 2 + 0,
    y: ((point.x + point.y) * tile.height) / 2 + 0,
  };
}

/** Inverse of `worldToScreen`. The result is fractional; floor it to get the tile. */
export function screenToWorld(point: ScreenPoint, tile: TileSize): TilePoint {
  const u = point.x / tile.width;
  const v = point.y / tile.height;
  return { x: v + u + 0, y: v - u + 0 };
}

/**
 * Screen position of a footprint's front (bottom) vertex. This is where a sprite's
 * bottom-center anchor goes (ART_DIRECTION.md §4.2).
 */
export function footprintAnchor(footprint: Footprint, tile: TileSize): ScreenPoint {
  return worldToScreen({ x: footprint.x + footprint.size, y: footprint.y + footprint.size }, tile);
}
