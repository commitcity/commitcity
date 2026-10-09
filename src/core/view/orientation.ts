import type { Footprint, Orientation, Side, TilePoint } from "./types";

// Each orientation step turns the map 90° clockwise on screen around the world
// origin (the city center). The model never changes; only view coordinates do
// (ARCHITECTURE.md §6.9).

/** Rotates a point (a tile corner, not a tile) into view space. */
export function rotatePoint(point: TilePoint, orientation: Orientation): TilePoint {
  const { x, y } = point;
  switch (orientation) {
    case 0:
      return { x, y };
    case 1:
      return { x: -y + 0, y: x };
    case 2:
      return { x: -x + 0, y: -y + 0 };
    case 3:
      return { x: y, y: -x + 0 };
  }
}

/** Rotates a footprint and returns it with its new back corner as the origin. */
export function rotateFootprint(footprint: Footprint, orientation: Orientation): Footprint {
  const { x, y, size } = footprint;
  const a = rotatePoint({ x, y }, orientation);
  const b = rotatePoint({ x: x + size, y: y + size }, orientation);
  return { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), size };
}

/** Rotates a single tile into view space. */
export function rotateTile(tile: TilePoint, orientation: Orientation): TilePoint {
  const { x, y } = rotateFootprint({ ...tile, size: 1 }, orientation);
  return { x, y };
}

/** The view-space side that a world-space side becomes. */
export function rotateSide(side: Side, orientation: Orientation): Side {
  return ((side + orientation) % 4) as Side;
}

/** The orientation that undoes `orientation`. */
export function inverseOrientation(orientation: Orientation): Orientation {
  return ((4 - orientation) % 4) as Orientation;
}
