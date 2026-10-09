import type { Texture } from "pixi.js";
import type { Side, TileSize } from "@/core/view";
import { Pixels, type Rgb, TextureCache, diamondTop } from "../pixels";

// Code-generated placeholder sprites (ART_DIRECTION.md §13): 2:1 edges, three-tone
// shading with light from the upper left, canvas N × tileWidth by N × tileHeight + H,
// anchored at the bottom-center. Each world side gets its own hue so that a wrong
// rotation is obvious: the colors must turn with the map.

/** Wall hues per world side: +x red, +y green, -x blue, -y yellow. [medium, dark] */
const SIDE_COLORS: Record<Side, readonly [Rgb, Rgb]> = {
  0: [
    [190, 74, 47],
    [140, 46, 33],
  ],
  1: [
    [99, 171, 63],
    [62, 120, 44],
  ],
  2: [
    [79, 103, 189],
    [52, 66, 138],
  ],
  3: [
    [228, 180, 66],
    [168, 124, 38],
  ],
};
const ROOF: Rgb = [214, 214, 206];
const ROOF_EDGE: Rgb = [160, 160, 152];
const GRASS: Rgb = [86, 140, 72];
const GRASS_EDGE: Rgb = [70, 117, 60];
const ROAD: Rgb = [92, 92, 104];
const ROAD_EDGE: Rgb = [74, 74, 86];

const cache = new TextureCache();

export function buildingTexture(
  size: number,
  heightPx: number,
  leftSide: Side,
  rightSide: Side,
  tile: TileSize,
): Texture {
  const key = `b:${size}:${heightPx}:${leftSide}:${rightSide}:${tile.width}`;
  return cache.get(key, () => {
    const width = size * tile.width;
    const depth = size * tile.height;
    const canvas = new Pixels(width, depth + heightPx);
    const [leftColor] = SIDE_COLORS[leftSide];
    const [, rightColor] = SIDE_COLORS[rightSide];
    for (let x = 0; x < width; x++) {
      const top = diamondTop(x, width);
      const bottom = depth - top;
      for (let y = top; y < bottom; y++) {
        canvas.set(x, y, y === top || y === bottom - 1 ? ROOF_EDGE : ROOF);
      }
      const wall = x < width / 2 ? leftColor : rightColor;
      for (let y = bottom; y < bottom + heightPx; y++) canvas.set(x, y, wall);
    }
    return canvas.toTexture();
  });
}

export function groundTexture(kind: "grass" | "road", tile: TileSize): Texture {
  return cache.get(`g:${kind}:${tile.width}`, () => {
    const fill = kind === "grass" ? GRASS : ROAD;
    const edge = kind === "grass" ? GRASS_EDGE : ROAD_EDGE;
    const canvas = new Pixels(tile.width, tile.height);
    for (let x = 0; x < tile.width; x++) {
      const top = diamondTop(x, tile.width);
      const bottom = tile.height - top;
      for (let y = top; y < bottom; y++) canvas.set(x, y, y === bottom - 1 ? edge : fill);
    }
    return canvas.toTexture();
  });
}

export function clearPlaceholderCache() {
  cache.clear();
}
