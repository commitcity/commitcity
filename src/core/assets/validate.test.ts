import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  type RgbaImage,
  checkFolderFiles,
  checkSprite,
  parseManifest,
  parsePalette,
  spriteFiles,
} from "./validate";
import type { BuildingManifest } from "./manifest";

const palette = parsePalette(readFileSync("assets/palette/commitcity.hex", "utf8"));
const ROOF = [0x9b, 0xab, 0xb2];
const WALL = [0x62, 0x55, 0x65];

const valid = {
  id: "brick-office-small",
  family: "brick",
  footprint: 2,
  levels: [2, 1],
  views: [0],
  symmetric: false,
  variants: ["default", "abandoned"],
  authors: ["Jane Doe"],
  license: "CC-BY-SA-4.0",
  aiAssisted: false,
};

/** A footprint-N box like ART_DIRECTION.md §4.2: roof diamond on top of walls. */
function box(footprint: number, wall: number): RgbaImage {
  const width = footprint * 32;
  const depth = footprint * 16;
  const height = depth + wall;
  const data = new Uint8Array(width * height * 4);
  for (let x = 0; x < width; x++) {
    const top = Math.ceil((x < width / 2 ? width / 2 - 1 - x : x - width / 2) / 2);
    for (let y = top; y < height - top; y++) {
      const color = y < depth - top ? ROOF : WALL;
      data.set([...color, 255], (y * width + x) * 4);
    }
  }
  return { width, height, data };
}

function setPixel(image: RgbaImage, x: number, y: number, rgba: number[]) {
  image.data.set(rgba, (y * image.width + x) * 4);
}

describe("parsePalette", () => {
  it("reads the 64 project colors", () => {
    expect(palette.size).toBe(64);
    expect(palette.has(0x2e222f)).toBe(true);
  });

  it("rejects a malformed line", () => {
    expect(() => parsePalette("2e222f\nnope\n")).toThrow("palette line 2");
  });
});

describe("parseManifest", () => {
  it("accepts a valid manifest and sorts its lists", () => {
    const { manifest, problems } = parseManifest(valid, "brick-office-small");
    expect(problems).toEqual([]);
    expect(manifest?.levels).toEqual([1, 2]);
  });

  it("names every missing and unknown field", () => {
    const withoutFamily = Object.fromEntries(Object.entries(valid).filter(([k]) => k !== "family"));
    const { manifest, problems } = parseManifest({ ...withoutFamily, colour: "red" }, valid.id);
    expect(manifest).toBeNull();
    expect(problems).toContain('missing field "family"');
    expect(problems.some((p) => p.startsWith('unknown field "colour"'))).toBe(true);
  });

  it.each([
    [{ id: "Brick Office" }, '"id" must be lowercase'],
    [{ id: "other-name" }, 'but the folder is "brick-office-small"'],
    [{ family: "castle" }, '"family" must be one of'],
    [{ footprint: 5 }, '"footprint" must be 1, 2, 3 or 4'],
    [{ levels: [] }, '"levels" must be a non-empty list'],
    [{ levels: [1, 1] }, '"levels" must be a non-empty list'],
    [{ views: [1] }, '"views" must include view 0'],
    [{ variants: ["abandoned"] }, '"variants" must include "default"'],
    [{ authors: [""] }, '"authors" must be a non-empty list'],
    [{ license: "MIT" }, '"license" must be "CC-BY-SA-4.0"'],
    [{ aiAssisted: "no" }, '"aiAssisted" must be true or false'],
  ])("rejects %j", (patch, message) => {
    const { problems } = parseManifest({ ...valid, ...patch }, "brick-office-small");
    expect(problems.join("\n")).toContain(message);
  });

  it("reserves the placeholder prefix", () => {
    const { problems } = parseManifest({ ...valid, id: "placeholder-x" }, "placeholder-x");
    expect(problems.join()).toContain("placeholder-");
  });
});

describe("files", () => {
  const manifest = parseManifest(valid, valid.id).manifest as BuildingManifest;

  it("expects one PNG per view and variant", () => {
    expect(spriteFiles(manifest).map((s) => s.file)).toEqual([
      "view-0.png",
      "view-0.abandoned.png",
    ]);
    expect(spriteFiles({ ...manifest, views: [0, 1], symmetric: true })).toHaveLength(2);
  });

  it("reports missing and undeclared files", () => {
    const problems = checkFolderFiles(manifest, ["manifest.json", "view-0.png", "view-1.png"]);
    expect(problems).toEqual([
      "view-0.abandoned.png is missing (the manifest declares it)",
      "view-1.png is not declared by the manifest (expected files: view-0.png, view-0.abandoned.png)",
    ]);
  });
});

describe("checkSprite", () => {
  it("accepts a correct box", () => {
    expect(checkSprite(box(2, 40), 2, palette)).toEqual([]);
    expect(checkSprite(box(1, 4), 1, palette)).toEqual([]);
  });

  it("rejects the wrong canvas size", () => {
    expect(checkSprite(box(2, 40), 3, palette)).toEqual([
      "canvas is 64 × 72 px; a footprint-3 building must be 96 × (48 + a multiple of 4)",
    ]);
    const odd = box(2, 40);
    expect(
      checkSprite({ ...odd, height: 70, data: odd.data.slice(0, 64 * 70 * 4) }, 2, palette),
    ).toHaveLength(1);
  });

  it("rejects semi-transparent pixels", () => {
    const image = box(2, 40);
    setPixel(image, 30, 30, [...WALL, 128]);
    setPixel(image, 31, 30, [...WALL, 1]);
    expect(checkSprite(image, 2, palette)).toEqual([
      "semi-transparent pixel at (30, 30) alpha 128 and 1 more; use fully opaque or fully transparent pixels",
    ]);
  });

  it("rejects colors outside the palette", () => {
    const image = box(2, 40);
    setPixel(image, 32, 50, [0, 0, 0, 255]);
    expect(checkSprite(image, 2, palette)).toEqual([
      "color not in the palette at (32, 50) #000000; use only assets/palette/commitcity.hex",
    ]);
  });

  it("rejects drawing below the footprint, allowing a 2 px overhang", () => {
    const image = box(2, 40);
    // Bottom-left corner of the canvas lies below the diamond's lower-left edge.
    setPixel(image, 0, image.height - 1, [...WALL, 255]);
    expect(checkSprite(image, 2, palette)[0]).toMatch(/^pixel below the footprint at \(0, 71\)/);

    const overhang = box(2, 40);
    // Column 0's lowest pixel is at row height - 1 - 16; two more rows are allowed.
    setPixel(overhang, 0, overhang.height - 1 - 16 + 2, [...WALL, 255]);
    expect(checkSprite(overhang, 2, palette)).toEqual([]);
  });

  it("rejects empty padding above the building", () => {
    expect(checkSprite(box(1, 8), 1, palette)).toEqual([]);
    const tall = box(1, 8);
    const padded = new Uint8Array(tall.data.length + 32 * 8 * 4);
    padded.set(tall.data, 32 * 8 * 4);
    expect(checkSprite({ width: 32, height: tall.height + 8, data: padded }, 1, palette)).toEqual([
      "8 empty rows at the top; crop the canvas so at most 3 remain",
    ]);
  });

  it("rejects an empty sprite", () => {
    const empty = { width: 32, height: 20, data: new Uint8Array(32 * 20 * 4) };
    expect(checkSprite(empty, 1, palette)).toEqual(["the sprite is empty"]);
  });
});
