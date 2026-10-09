import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { checkTile, parseTileManifest, tileFiles } from "./tiles";
import { parsePalette } from "./validate";

const palette = parsePalette(readFileSync("assets/palette/commitcity.hex", "utf8"));
const GRASS = [0x23, 0x90, 0x63, 255];

/** A full 32 × 16 diamond in one palette color. */
function diamond() {
  const data = new Uint8Array(32 * 16 * 4);
  for (let x = 0; x < 32; x++) {
    const top = Math.ceil((x < 16 ? 15 - x : x - 16) / 2);
    for (let y = top; y < 16 - top; y++) data.set(GRASS, (y * 32 + x) * 4);
  }
  return { width: 32, height: 16, data };
}

const manifest = {
  id: "grass",
  kind: "ground",
  authors: ["A"],
  license: "CC-BY-SA-4.0",
  aiAssisted: true,
};

describe("parseTileManifest", () => {
  it("accepts a valid ground manifest", () => {
    expect(parseTileManifest(manifest, "grass", "ground").problems).toEqual([]);
  });

  it("rejects a wrong kind and an unknown ground name", () => {
    expect(parseTileManifest({ ...manifest, kind: "road" }, "grass", "ground").problems).toEqual([
      '"kind" must be "ground" for a folder under assets/ground/',
    ]);
    expect(parseTileManifest({ ...manifest, id: "lava" }, "lava", "ground").problems).toEqual([
      "ground folders must be named one of: grass, dirt, pavement",
    ]);
  });

  it("accepts any road set name", () => {
    const road = { ...manifest, id: "street", kind: "road" };
    expect(parseTileManifest(road, "street", "road").problems).toEqual([]);
  });
});

describe("tileFiles", () => {
  it("lists one file per variant or road shape, with its texture key", () => {
    const ground = parseTileManifest(manifest, "grass", "ground").manifest!;
    expect(tileFiles(ground)).toHaveLength(4);
    expect(tileFiles(ground)[3]).toEqual({ file: "variant-3.png", textureKey: "ground/grass/3" });
    const road = tileFiles({ ...ground, id: "street", kind: "road" });
    expect(road).toHaveLength(16);
    expect(road[5]).toEqual({ file: "mask-5.png", textureKey: "road/5" });
    expect(tileFiles({ ...ground, id: "tree", kind: "vegetation" })[2]!.textureKey).toBe(
      "decoration/tree/2",
    );
  });
});

describe("checkTile", () => {
  it("accepts a full diamond", () => {
    expect(checkTile(diamond(), "ground", palette)).toEqual([]);
  });

  it("rejects a wrong size", () => {
    expect(
      checkTile({ width: 32, height: 20, data: new Uint8Array(32 * 20 * 4) }, "road", palette),
    ).toEqual(["canvas is 32 × 20 px; tiles must be 32 × 16"]);
  });

  it("rejects gaps, pixels outside the diamond, soft alpha and foreign colors", () => {
    const tile = diamond();
    tile.data.set([0, 0, 0, 0], (8 * 32 + 16) * 4);
    tile.data.set(GRASS, 0);
    tile.data.set([0x23, 0x90, 0x63, 100], (8 * 32 + 10) * 4);
    tile.data.set([1, 2, 3, 255], (8 * 32 + 20) * 4);
    expect(checkTile(tile, "ground", palette)).toEqual([
      "transparent pixel inside the diamond at (16, 8); fill the whole tile",
      "pixel outside the diamond at (0, 0); tiles may not draw outside it",
      "semi-transparent pixel at (10, 8) alpha 100; use fully opaque or fully transparent pixels",
      "color not in the palette at (20, 8) #010203; use only assets/palette/commitcity.hex",
    ]);
  });

  it("checks vegetation like a 1 × 1 building", () => {
    const wide = { width: 40, height: 16, data: new Uint8Array(40 * 16 * 4) };
    expect(checkTile(wide, "vegetation", palette)[0]).toMatch(/^canvas is 40 × 16 px/);
  });
});

describe("vegetation", () => {
  it("may be as low as its tile", () => {
    const low = { width: 32, height: 16, data: new Uint8Array(32 * 16 * 4) };
    low.data.set(GRASS, (12 * 32 + 16) * 4);
    expect(checkTile(low, "vegetation", palette)).toEqual([]);
  });
});
