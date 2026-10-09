import { Texture } from "pixi.js";

// Helpers for code-drawn placeholder sprites (ART_DIRECTION.md §13).

export type Rgb = readonly [number, number, number];

/**
 * First row covered by a 2:1 diamond of the given width in column `x`. Rows widen
 * by 4 px per step (2 px each side), so the top and bottom vertices are 2 px wide.
 * The diamond's height is half its width; the last row is `height - top`.
 */
export function diamondTop(x: number, width: number): number {
  const half = width / 2;
  const fromCenter = x < half ? half - 1 - x : x - half;
  return Math.ceil(fromCenter / 2);
}

/** A small RGBA bitmap drawn pixel by pixel and turned into a nearest-neighbor texture. */
export class Pixels {
  private readonly data: ImageData;

  constructor(
    readonly width: number,
    readonly height: number,
  ) {
    this.data = new ImageData(width, height);
  }

  set(x: number, y: number, [r, g, b]: Rgb) {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return;
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

/** A keyed texture cache. Textures live until `clear()`. */
export class TextureCache {
  private readonly textures = new Map<string, Texture>();

  get(key: string, create: () => Texture): Texture {
    let texture = this.textures.get(key);
    if (!texture) {
      texture = create();
      this.textures.set(key, texture);
    }
    return texture;
  }

  clear() {
    for (const texture of this.textures.values()) texture.destroy(true);
    this.textures.clear();
  }
}
