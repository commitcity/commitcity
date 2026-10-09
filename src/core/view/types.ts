/** Number of 90° view rotations. Only 0 is used outside of debug tools for now. */
export type Orientation = 0 | 1 | 2 | 3;

/**
 * A side of a footprint, numbered so that rotating the view by one step adds one:
 * 0 = +x, 1 = +y, 2 = -x, 3 = -y. In view space, side 0 is the right wall and
 * side 1 is the left wall; sides 2 and 3 face away from the camera.
 */
export type Side = 0 | 1 | 2 | 3;

/** A point in tile units. Tile `(x, y)` covers the square from `(x, y)` to `(x + 1, y + 1)`. */
export interface TilePoint {
  x: number;
  y: number;
}

/** A square footprint. `(x, y)` is the back (top) corner, the tile with the lowest x and y. */
export interface Footprint {
  x: number;
  y: number;
  size: number;
}

/** Size of one ground diamond in pixels at 1×. Width is always twice the height. */
export interface TileSize {
  width: number;
  height: number;
}

export interface ScreenPoint {
  x: number;
  y: number;
}
