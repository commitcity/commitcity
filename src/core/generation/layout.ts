// City grid constants (ARCHITECTURE.md §6.2). A block holds 2 × 2 lots of 4 × 4
// tiles and is followed by a 1-tile road, so blocks repeat every 9 tiles. Block
// (0, 0) is centered on the world origin.

export const LOT_SIZE = 4;
export const LOTS_PER_BLOCK_SIDE = 2;
export const LOTS_PER_BLOCK = LOTS_PER_BLOCK_SIDE * LOTS_PER_BLOCK_SIDE;
export const BLOCK_INTERIOR = LOT_SIZE * LOTS_PER_BLOCK_SIDE;
export const ROAD_WIDTH = 1;
export const BLOCK_PERIOD = BLOCK_INTERIOR + ROAD_WIDTH;

/** World tile of the back (top) corner of a block's interior. */
export function blockOrigin(block: { x: number; y: number }): { x: number; y: number } {
  return {
    x: block.x * BLOCK_PERIOD - BLOCK_INTERIOR / 2,
    y: block.y * BLOCK_PERIOD - BLOCK_INTERIOR / 2,
  };
}
