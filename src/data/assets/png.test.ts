import { PNG } from "pngjs";
import { describe, expect, it } from "vitest";
import { createRaster } from "@/core/raster";
import { decodePng, encodePng } from "./png";

/** A small image with varied pixels and alpha, so every filter has work to do. */
function sample(width = 7, height = 5) {
  const raster = createRaster(width, height);
  for (let i = 0; i < width * height; i++)
    raster.data.set([(i * 37) & 255, (i * 91) & 255, (i * 13 + 200) & 255, i % 3 ? 255 : 0], i * 4);
  return raster;
}

describe("png", () => {
  it("round-trips RGBA", () => {
    const raster = sample();
    expect(decodePng(encodePng(raster))).toEqual(raster);
  });

  it("writes files other decoders read", () => {
    const raster = sample();
    const png = PNG.sync.read(encodePng(raster));
    expect(png.width).toBe(7);
    expect(new Uint8Array(png.data)).toEqual(raster.data);
  });

  it.each([0, 1, 2, 3, 4])("reads RGBA rows with filter %i", (filterType) => {
    const raster = sample();
    const png = new PNG({ width: 7, height: 5 });
    png.data = Buffer.from(raster.data);
    const file = PNG.sync.write(png, { filterType });
    expect(decodePng(file)).toEqual(raster);
  });

  it("reads RGB as opaque RGBA", () => {
    const raster = sample();
    // Opaque input: pngjs composites transparent pixels onto white when dropping alpha.
    for (let i = 3; i < raster.data.length; i += 4) raster.data[i] = 255;
    const png = new PNG({ width: 7, height: 5 });
    png.data = Buffer.from(raster.data);
    const file = PNG.sync.write(png, { colorType: 2, filterType: 4 });
    expect(decodePng(file)).toEqual(raster);
  });

  it("rejects what it does not read", () => {
    expect(() => decodePng(new Uint8Array([1, 2, 3]))).toThrow("not a PNG");
    const png = new PNG({ width: 2, height: 2, colorType: 0, inputColorType: 0 });
    png.data = Buffer.alloc(16);
    expect(() => decodePng(PNG.sync.write(png, { colorType: 0, inputColorType: 6 }))).toThrow(
      "unsupported",
    );
  });
});
