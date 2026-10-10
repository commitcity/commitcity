import { describe, expect, it } from "vitest";
import type { PackedAssets } from "@/core/assets";
import { parseCityInput } from "@/core/model";
import tiny from "../../../fixtures/tiny.json";
import { PREVIEW_BACKGROUND, PREVIEW_PLAQUE, PREVIEW_SIZE, cityPreview } from "./preview";
import { createRaster } from "./raster";

// An atlas with grass only, and a 24 × 24 one-color panel: enough to see the layout.
const packed: PackedAssets = {
  image: "atlas.png",
  buildings: [],
  tiles: [],
  frames: { "ground/grass/0": { x: 0, y: 0, width: 32, height: 16 } },
};
const atlas = createRaster(32, 16, [0, 200, 0]);
const panel = createRaster(24, 24, [150, 80, 40]);

const pixel = (image: { width: number; data: Uint8Array }, x: number, y: number) => [
  ...image.data.subarray((y * image.width + x) * 4, (y * image.width + x) * 4 + 3),
];

describe("cityPreview", () => {
  const input = parseCityInput(tiny);
  const { image, buildings } = cityPreview(input, packed, atlas, panel);

  it("is a full-size image with the plaque along the bottom", () => {
    expect(image.width).toBe(PREVIEW_SIZE.width);
    expect(image.height).toBe(PREVIEW_SIZE.height);
    expect(pixel(image, PREVIEW_PLAQUE.x, PREVIEW_PLAQUE.y)).toEqual([150, 80, 40]);
    expect(pixel(image, 0, PREVIEW_SIZE.height - 1)).toEqual([...PREVIEW_BACKGROUND]);
  });

  it("counts the buildings of the generated city", () => {
    expect(buildings).toBe(input.repos.length);
  });

  it("is deterministic", () => {
    const again = cityPreview(input, packed, atlas, panel).image.data;
    // Buffer.equals: toEqual over three million bytes is slow.
    expect(Buffer.from(again).equals(Buffer.from(image.data))).toBe(true);
  });
});
