import { describe, expect, it } from "vitest";
import {
  type Raster,
  type Rgb,
  blit,
  createRaster,
  fitFrame,
  ninePatch,
  scaleNearest,
} from "./raster";

/** A raster from rows of one-letter pixels: "." is transparent, a letter is a color. */
function fromRows(rows: string[]): Raster {
  const raster = createRaster(rows[0]!.length, rows.length);
  rows.forEach((row, y) =>
    [...row].forEach((c, x) => {
      if (c !== ".") raster.data.set([c.charCodeAt(0), 0, 0, 255], (y * raster.width + x) * 4);
    }),
  );
  return raster;
}

function toRows(raster: Raster): string[] {
  const rows: string[] = [];
  for (let y = 0; y < raster.height; y++) {
    let row = "";
    for (let x = 0; x < raster.width; x++) {
      const i = (y * raster.width + x) * 4;
      row += raster.data[i + 3] === 0 ? "." : String.fromCharCode(raster.data[i]!);
    }
    rows.push(row);
  }
  return rows;
}

/** The background color that reads as "z". */
const Z: Rgb = [122, 0, 0];

describe("createRaster", () => {
  it("is transparent without a fill and opaque with one", () => {
    expect([...createRaster(1, 1).data]).toEqual([0, 0, 0, 0]);
    expect([...createRaster(1, 1, [1, 2, 3]).data]).toEqual([1, 2, 3, 255]);
  });
});

describe("blit", () => {
  it("copies opaque pixels only, with no blending", () => {
    const dest = fromRows(["aaa", "aaa"]);
    blit(dest, fromRows([".b", "b."]), { x: 0, y: 0, width: 2, height: 2 }, 1, 0);
    expect(toRows(dest)).toEqual(["aab", "aba"]);
  });

  it("reads a region of the source and clips to the destination", () => {
    const dest = createRaster(2, 2);
    blit(dest, fromRows(["xxxx", "xabx", "xcdx"]), { x: 1, y: 1, width: 2, height: 2 }, -1, 1);
    expect(toRows(dest)).toEqual(["..", "b."]);
  });
});

describe("scaleNearest", () => {
  it("turns every pixel into a block", () => {
    expect(toRows(scaleNearest(fromRows(["ab"]), 2))).toEqual(["aabb", "aabb"]);
  });
});

describe("fitFrame", () => {
  it("scales by the largest whole factor that fits, then centers", () => {
    expect(toRows(fitFrame(fromRows(["ab"]), 5, 3, Z))).toEqual(["aabbz", "aabbz", "zzzzz"]);
  });

  it("stops at maxFactor", () => {
    expect(toRows(fitFrame(fromRows(["a"]), 4, 4, Z, { maxFactor: 2 }))).toEqual([
      "zzzz",
      "zaaz",
      "zaaz",
      "zzzz",
    ]);
  });

  it("crops a source too big at minFactor around its center", () => {
    expect(toRows(fitFrame(fromRows(["abcd"]), 2, 1, Z))).toEqual(["bc"]);
    expect(toRows(fitFrame(fromRows(["ab"]), 2, 1, Z, { minFactor: 2 }))).toEqual(["ab"]);
  });

  it("centers in the top fitHeight rows when the source fits there", () => {
    expect(toRows(fitFrame(fromRows(["a"]), 3, 5, Z, { maxFactor: 1, fitHeight: 3 }))).toEqual([
      "zzz",
      "zaz",
      "zzz",
      "zzz",
      "zzz",
    ]);
    expect(toRows(fitFrame(fromRows(["a", "b", "c", "d"]), 1, 5, Z, { fitHeight: 3 }))).toEqual([
      "a",
      "b",
      "c",
      "d",
      "z",
    ]);
  });
});

describe("ninePatch", () => {
  it("keeps corners, stretches nothing and repeats edges and center", () => {
    const src = fromRows(["abcd", "efgh", "ijkl"]);
    expect(toRows(ninePatch(src, 1, 6, 4))).toEqual(["abcbcd", "efgfgh", "efgfgh", "ijkjkl"]);
  });
});
