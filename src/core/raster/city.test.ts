import { describe, expect, it } from "vitest";
import type { BuildingManifest, PackedAssets } from "@/core/assets";
import type { RenderItem, RenderList } from "@/core/view";
import { atlasFrame, drawCity } from "./city";
import { createRaster } from "./raster";

const manifest: BuildingManifest = {
  id: "house",
  family: "residential",
  footprint: 1,
  levels: [1, 2],
  views: [0],
  symmetric: true,
  variants: ["default"],
  authors: ["test"],
  license: "CC0-1.0",
  aiAssisted: false,
};

// Atlas: a 4 × 2 ground tile at (0, 0) in color 1, a 2 × 3 building at (4, 0) in color 2.
const atlas = createRaster(6, 3);
const paint = (x: number, y: number, w: number, h: number, c: number) => {
  for (let row = y; row < y + h; row++)
    for (let col = x; col < x + w; col++) atlas.data.set([c, 0, 0, 255], (row * 6 + col) * 4);
};
paint(0, 0, 4, 2, 1);
paint(4, 0, 2, 3, 2);

const packed: PackedAssets = {
  image: "atlas.png",
  buildings: [manifest],
  tiles: [],
  frames: {
    "ground/grass/0": { x: 0, y: 0, width: 4, height: 2 },
    "building/house/view-0/default": { x: 4, y: 0, width: 2, height: 3 },
  },
};

const item = (
  layer: RenderItem["layer"],
  textureKey: string,
  screenX: number,
  screenY: number,
) => ({
  layer,
  textureKey,
  screenX,
  screenY,
  depth: 0,
});

describe("atlasFrame", () => {
  it("passes ground keys through and maps building keys to their drawing", () => {
    expect(atlasFrame(packed, "ground/grass/0")).toMatchObject({ x: 0, width: 4 });
    // Every level and view of a symmetric drawing shares one frame.
    expect(atlasFrame(packed, "building/house/view-2/default/level-2")).toEqual({
      key: "building/house/view-0/default",
      x: 4,
      y: 0,
      width: 2,
      height: 3,
    });
  });

  it("is undefined for keys the atlas lacks", () => {
    expect(atlasFrame(packed, "ground/dirt/0")).toBeUndefined();
    expect(atlasFrame(packed, "building/missing/view-0/default/level-1")).toBeUndefined();
  });
});

describe("drawCity", () => {
  it("places tiles by their top vertex and objects by their bottom center, cropped", () => {
    const list: RenderList = {
      ground: [item("ground", "ground/grass/0", 2, 0)],
      roads: [],
      objects: [item("object", "building/house/view-0/default/level-1", 2, 2)],
    };
    const out = drawCity(list, atlas, packed, { width: 4, height: 2 });
    // Tile at x 0..3, y 0..1; building at x 1..2, y -1..1.
    expect(out.width).toBe(4);
    expect(out.height).toBe(3);
    const at = (x: number, y: number) =>
      out.data[(y * 4 + x) * 4 + 3] ? out.data[(y * 4 + x) * 4] : 0;
    expect([0, 1, 2].map((y) => [0, 1, 2, 3].map((x) => at(x, y)).join(""))).toEqual([
      "0220",
      "1221",
      "1221",
    ]);
  });

  it("skips keys the atlas lacks", () => {
    const list: RenderList = {
      ground: [item("ground", "ground/dirt/0", 0, 0)],
      roads: [],
      objects: [],
    };
    expect(drawCity(list, atlas, packed, { width: 4, height: 2 })).toMatchObject({
      width: 1,
      height: 1,
    });
  });
});
