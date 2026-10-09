// Drawing kit for code-drawn pixel art (ART_DIRECTION.md, skill "isometric-pixel-sprites").
// Everything is deterministic: variation comes from `noise`, never from Math.random.
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { PNG } from "pngjs";
import { diamondTop } from "../../src/core/assets";
import { hash53 } from "../../src/core/random";

/** A palette color as `rrggbb`. The validator rejects anything outside the palette. */
export type Hex = string;

/** Material ramps from Resurrect 64, darkest first (skill §2). */
export const RAMPS = {
  brick: ["6e2727", "9e4539", "cd683d", "e6904e"],
  roofTiles: ["6e2727", "ae2334", "e83b3b", "f68181"],
  glass: ["323353", "484a77", "4d65b4", "4d9be6", "8fd3ff"],
  concrete: ["2e222f", "3e3546", "625565", "7f708a", "9babb2", "c7dcd0"],
  stone: ["313638", "374e4a", "547e64", "92a984", "b2ba90"],
  sand: ["694f62", "966c6c", "ab947a", "fdcbb0"],
  teal: ["0b5e65", "0b8a8f", "0eaf9b", "30e1b9"],
  foliage: ["165a4c", "239063", "1ebc73", "91db69", "cddf6c"],
  dirt: ["4c3e24", "694f62", "966c6c", "ab947a"],
  dry: ["4c3e24", "676633", "a2a947", "d5e04b"],
  asphalt: ["2e222f", "3e3546", "625565"],
} as const satisfies Record<string, readonly Hex[]>;

export const COLORS = {
  lane: "f9c22b",
  curb: "c7dcd0",
  sidewalk: "9babb2",
  sidewalkJoint: "7f708a",
  litWindow: "fbb954",
  coolWindow: "8fd3ff",
  darkWindow: "323353",
  board: "966c6c",
  bark: "4c3e24",
  barkLight: "694f62",
  birch: "c7dcd0",
  deadWood: "694f62",
  deadWoodDark: "45293f",
  flowerPink: "f04f78",
  flowerYellow: "f9c22b",
  flowerViolet: "a884f3",
  flowerWhite: "eaaded",
} as const;

/** A number in [0, 1) that depends only on its inputs. */
export function noise(...parts: (string | number)[]): number {
  return hash53(parts.join(":")) / 2 ** 53;
}

function rgb(hex: Hex): [number, number, number] {
  return [
    parseInt(hex.slice(0, 2), 16),
    parseInt(hex.slice(2, 4), 16),
    parseInt(hex.slice(4, 6), 16),
  ];
}

export class Canvas {
  readonly data: Uint8Array;

  constructor(
    readonly width: number,
    readonly height: number,
  ) {
    this.data = new Uint8Array(width * height * 4);
  }

  inside(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < this.width && y < this.height;
  }

  set(x: number, y: number, hex: Hex) {
    x = Math.round(x);
    y = Math.round(y);
    if (!this.inside(x, y)) return;
    const [r, g, b] = rgb(hex);
    this.data.set([r, g, b, 255], (y * this.width + x) * 4);
  }

  /** Sets a pixel only where something is already drawn. */
  paint(x: number, y: number, hex: Hex) {
    if (this.opaque(x, y)) this.set(x, y, hex);
  }

  clear(x: number, y: number) {
    if (this.inside(x, y))
      this.data.fill(0, (y * this.width + x) * 4, (y * this.width + x) * 4 + 4);
  }

  opaque(x: number, y: number): boolean {
    return this.inside(x, y) && this.data[(y * this.width + x) * 4 + 3] === 255;
  }

  get(x: number, y: number): Hex | null {
    if (!this.opaque(x, y)) return null;
    const i = (y * this.width + x) * 4;
    return [this.data[i]!, this.data[i + 1]!, this.data[i + 2]!]
      .map((v) => v.toString(16).padStart(2, "0"))
      .join("");
  }

  rect(x: number, y: number, w: number, h: number, hex: Hex) {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, hex);
  }

  /** Recolors every drawn pixel through `map` (colors not in it stay). */
  recolor(map: Record<Hex, Hex>) {
    for (let y = 0; y < this.height; y++)
      for (let x = 0; x < this.width; x++) {
        const c = this.get(x, y);
        if (c && map[c]) this.set(x, y, map[c]);
      }
  }

  copy(): Canvas {
    const c = new Canvas(this.width, this.height);
    c.data.set(this.data);
    return c;
  }

  /**
   * Removes empty rows on top, keeping the height above `baseHeight` (the footprint
   * diamond) a multiple of 4, as ART_DIRECTION.md §4.2 requires.
   */
  cropTop(baseHeight: number): Canvas {
    let first = 0;
    while (first < this.height && !this.rowHasPixels(first)) first++;
    let height = Math.max(baseHeight, this.height - first);
    while ((height - baseHeight) % 4 !== 0) height++;
    const start = this.height - height;
    const out = new Canvas(this.width, height);
    out.data.set(this.data.subarray(start * this.width * 4));
    return out;
  }

  private rowHasPixels(y: number): boolean {
    for (let x = 0; x < this.width; x++) if (this.opaque(x, y)) return true;
    return false;
  }

  writePng(path: string) {
    const png = new PNG({ width: this.width, height: this.height });
    png.data.set(this.data);
    writeFileSync(path, PNG.sync.write(png));
  }
}

/** Calls `fn` for every pixel of a 2:1 diamond `w` wide whose top-left box corner is (ox, oy). */
export function eachDiamondPixel(
  w: number,
  fn: (x: number, y: number, local: { x: number; y: number; top: number; bottom: number }) => void,
  ox = 0,
  oy = 0,
) {
  const h = w / 2;
  for (let x = 0; x < w; x++) {
    const top = diamondTop(x, w);
    for (let y = top; y < h - top; y++) fn(ox + x, oy + y, { x, y, top, bottom: h - 1 - top });
  }
}

export interface Folder {
  dir: string;
  manifest: Record<string, unknown>;
  files: Record<string, Canvas>;
}

/** Replaces an asset folder with the given manifest and PNGs. */
export function writeFolder({ dir, manifest, files }: Folder) {
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
  for (const [name, canvas] of Object.entries(files)) canvas.writePng(join(dir, name));
}

/** Shared manifest fields for art drawn by these generators. */
export const CREDITS = {
  authors: ["CommitCity contributors"],
  license: "CC-BY-SA-4.0",
  aiAssisted: true,
};
