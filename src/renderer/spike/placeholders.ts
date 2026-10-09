import { Texture } from "pixi.js";
import type { Side, TileSize } from "@/core/view";

// Code-generated placeholder sprites (ART_DIRECTION.md §13): 2:1 edges, three-tone
// shading with light from the upper left, canvas N × tileWidth by N × tileHeight + H,
// anchored at the bottom-center. Each world side gets its own hue so that a wrong
// rotation is obvious: the colors must turn with the map.

type Rgb = readonly [number, number, number];

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

const cache = new Map<string, Texture>();

export function buildingTexture(
  size: number,
  heightPx: number,
  leftSide: Side,
  rightSide: Side,
  tile: TileSize,
): Texture {
  const key = `b:${size}:${heightPx}:${leftSide}:${rightSide}:${tile.width}`;
  return cached(key, () => {
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
  return cached(`g:${kind}:${tile.width}`, () => {
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
  for (const texture of cache.values()) texture.destroy(true);
  cache.clear();
}

/**
 * First row covered by a diamond of the given width in column `x`. Rows widen by
 * 4 px per step (2 px each side), so the top and bottom vertices are 2 px wide.
 */
function diamondTop(x: number, width: number): number {
  const half = width / 2;
  const fromCenter = x < half ? half - 1 - x : x - half;
  return Math.ceil(fromCenter / 2);
}

function cached(key: string, create: () => Texture): Texture {
  let texture = cache.get(key);
  if (!texture) {
    texture = create();
    cache.set(key, texture);
  }
  return texture;
}

class Pixels {
  private readonly data: ImageData;

  constructor(
    readonly width: number,
    readonly height: number,
  ) {
    this.data = new ImageData(width, height);
  }

  set(x: number, y: number, [r, g, b]: Rgb) {
    const i = (y * this.width + x) * 4;
    this.data.data[i] = r;
    this.data.data[i + 1] = g;
    this.data.data[i + 2] = b;
    this.data.data[i + 3] = 255;
  }

  toTexture(): Texture {
    const canvas = document.createElement("canvas");
    canvas.width = this.width;
    canvas.height = this.height;
    canvas.getContext("2d")!.putImageData(this.data, 0, 0);
    const texture = Texture.from(canvas);
    texture.source.scaleMode = "nearest";
    return texture;
  }
}
