import { describe, expect, it } from "vitest";
import { TILE_32, TILE_64, footprintAnchor, screenToWorld, worldToScreen } from "./projection";

describe("worldToScreen", () => {
  it("maps the origin to the origin", () => {
    expect(worldToScreen({ x: 0, y: 0 }, TILE_32)).toEqual({ x: 0, y: 0 });
  });

  it("moves +x down-right and +y down-left by half a tile", () => {
    expect(worldToScreen({ x: 1, y: 0 }, TILE_32)).toEqual({ x: 16, y: 8 });
    expect(worldToScreen({ x: 0, y: 1 }, TILE_32)).toEqual({ x: -16, y: 8 });
    expect(worldToScreen({ x: 1, y: 0 }, TILE_64)).toEqual({ x: 32, y: 16 });
  });

  it("keeps a 2:1 slope along both axes", () => {
    for (const tile of [TILE_32, TILE_64]) {
      const step = worldToScreen({ x: 3, y: 0 }, tile);
      expect(Math.abs(step.x)).toBe(2 * step.y);
    }
  });

  it("returns integer pixels for integer tiles", () => {
    for (let x = -5; x <= 5; x++) {
      for (let y = -5; y <= 5; y++) {
        const p = worldToScreen({ x, y }, TILE_32);
        expect(Number.isInteger(p.x) && Number.isInteger(p.y)).toBe(true);
      }
    }
  });
});

describe("screenToWorld", () => {
  it("inverts worldToScreen", () => {
    for (const tile of [TILE_32, TILE_64]) {
      for (const point of [
        { x: 0, y: 0 },
        { x: 3, y: -2 },
        { x: -7, y: 11 },
        { x: 2.5, y: 0.25 },
      ]) {
        expect(screenToWorld(worldToScreen(point, tile), tile)).toEqual(point);
      }
    }
  });
});

describe("footprintAnchor", () => {
  it.each([1, 2, 3, 4])("matches the canvas rules for a %i×%i footprint", (size) => {
    // ART_DIRECTION.md §4.2: the anchor is the bottom-center of a canvas that is
    // size × 32 wide, so the footprint's top vertex sits size × 16 px above it.
    const footprint = { x: 2, y: -1, size };
    const anchor = footprintAnchor(footprint, TILE_32);
    const top = worldToScreen(footprint, TILE_32);
    expect(anchor.x).toBe(top.x);
    expect(anchor.y - top.y).toBe(size * 16);
  });
});
