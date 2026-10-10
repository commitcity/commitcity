// Interface art cut from paid packs the maintainers bought (assets/licensed/README.md).
// The packs may be used and modified but not redistributed, so neither they nor
// these results are committed: this writes to assets/licensed/ui, which
// `pnpm pack-assets` copies over the code-drawn images of the same name.
// Without the packs it does nothing, and the code-drawn images stay.
// Run: pnpm art:licensed
import { existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { PNG } from "pngjs";
import { Canvas, type Hex } from "./kit";

const SOURCE = join("assets", "licensed", "humble-gift");
const PAPER_UI = join(SOURCE, "Humble Gift - Paper UI System v1.1", "Sprites");
const V13 = join(SOURCE, "Humble Gift - v1.3", "PNG", "SpriteSheet.png");
const OUT = join("assets", "licensed", "ui");

/** Pack colors → Resurrect 64, so the result passes the palette rule (ART_DIRECTION.md §2). */
const RECOLOR: Record<Hex, Hex> = {
  // Paper UI System
  ecddc0: "fdcbb0",
  ceb990: "fca790",
  d0c2a8: "fca790",
  b4a794: "ab947a",
  958979: "966c6c",
  "0d9068": "239063",
  b02a36: "ae2334",
  "911c26": "6e2727",
  "8895a7": "9babb2",
  "798495": "9babb2",
  "747d87": "7f708a",
  "5a6067": "625565",
  "00303b": "2e222f",
  // v1.3
  eebd8a: "fdcbb0",
  daa475: "fca790",
  "752438": "7a3045",
  "411d31": "45293f",
  "1b2236": "2e222f",
};

function read(path: string): Canvas {
  const png = PNG.sync.read(readFileSync(path));
  const c = new Canvas(png.width, png.height);
  // Hard alpha (§6): anything not fully transparent becomes opaque.
  for (let i = 0; i < png.data.length; i += 4)
    if (png.data[i + 3]! > 0)
      c.data.set([png.data[i]!, png.data[i + 1]!, png.data[i + 2]!, 255], i);
  return c;
}

function crop(src: Canvas, x: number, y: number, w: number, h: number): Canvas {
  const out = new Canvas(w, h);
  for (let j = 0; j < h; j++)
    for (let i = 0; i < w; i++) {
      const c = src.get(x + i, y + j);
      if (c) out.set(i, j, c);
    }
  return out;
}

/** Draws the opaque pixels of `src` onto `dest` at (x, y). */
function stamp(dest: Canvas, src: Canvas, x: number, y: number) {
  for (let j = 0; j < src.height; j++)
    for (let i = 0; i < src.width; i++) {
      const c = src.get(i, j);
      if (c) dest.set(x + i, y + j, c);
    }
}

function recolored(c: Canvas): Canvas {
  const out = c.copy();
  out.recolor(RECOLOR);
  for (let y = 0; y < out.height; y++)
    for (let x = 0; x < out.width; x++) {
      const color = out.get(x, y);
      if (color && !Object.values(RECOLOR).includes(color))
        throw new Error(`licensed art: no palette color for #${color}`);
    }
  return out;
}

/**
 * A sheet of paper with ornamented corners on a second sheet: the Paper UI pieces
 * laid out as a nine-slice, 32 + 32 + 32 with the back sheet 3 pixels lower right.
 * Slice: 32 35 35 32.
 */
function paperSheet(): Canvas {
  const piece = (n: number) =>
    read(join(PAPER_UI, "Paper UI Pack", "Plain", "1 Paper", `${n}.png`));
  const c = new Canvas(99, 99);
  for (let k = 0; k < 9; k++) stamp(c, piece(18 + k), 3 + (k % 3) * 32, 3 + Math.floor(k / 3) * 32);
  for (let k = 0; k < 9; k++) stamp(c, piece(1 + k), (k % 3) * 32, Math.floor(k / 3) * 32);
  // Ornaments: 11 TL, 12 top, 13 TR, 10 left, 14 right, 17 BL, 16 bottom, 15 BR.
  const slots: [number, number, number][] = [
    [11, 0, 0],
    [12, 1, 0],
    [13, 2, 0],
    [10, 0, 1],
    [14, 2, 1],
    [17, 0, 2],
    [16, 1, 2],
    [15, 2, 2],
  ];
  for (const [n, sx, sy] of slots) stamp(c, piece(n), sx * 32, sy * 32);
  return recolored(c);
}

/** The pinned paper tag with green chevrons, cropped to its 21 rows. Slice: 0 20 0 16. */
function tagButton(variant: number): Canvas {
  return recolored(
    crop(read(join(PAPER_UI, "Content", "4 Buttons", `${variant}.png`)), 0, 5, 80, 21),
  );
}

/** The v1.3 speech box with a tail at the lower left. Slice: 4 12 14 14. */
function tooltip(): Canvas {
  return recolored(crop(read(V13), 38, 983, 109, 34));
}

if (!existsSync(SOURCE)) {
  console.log(`- No licensed packs in ${SOURCE}; the code-drawn interface stays.`);
} else {
  const files: Record<string, Canvas> = {
    "paper-sheet.png": paperSheet(),
    "tip.png": tooltip(),
    "button-tag.png": tagButton(0),
    "button-tag-hover.png": tagButton(1),
    "button-tag-pressed.png": tagButton(1),
  };
  rmSync(OUT, { recursive: true, force: true });
  mkdirSync(OUT, { recursive: true });
  for (const [name, canvas] of Object.entries(files)) canvas.writePng(join(OUT, name));
  console.log(`✓ Cut ${Object.keys(files).length} licensed interface images into ${OUT}`);
}
