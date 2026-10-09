import { describe, expect, it } from "vitest";
import { packShelves, resolveView } from "./atlas";

describe("resolveView", () => {
  it("uses view 0 for symmetric buildings", () => {
    expect(resolveView({ views: [0, 1], symmetric: true }, 1)).toBe(0);
  });

  it("picks the wanted view, else the nearest, clockwise first", () => {
    const m = { views: [0, 2] as (0 | 1 | 2 | 3)[], symmetric: false };
    expect(resolveView(m, 2)).toBe(2);
    expect(resolveView(m, 1)).toBe(2);
    expect(resolveView(m, 3)).toBe(0);
    expect(resolveView({ views: [0], symmetric: false }, 2)).toBe(0);
  });
});

describe("packShelves", () => {
  it("places sprites without overlap, tallest first", () => {
    const sizes = [
      { width: 32, height: 20 },
      { width: 64, height: 72 },
      { width: 96, height: 100 },
      { width: 32, height: 20 },
    ];
    const { positions, width, height } = packShelves(sizes, 128);
    expect(positions).toEqual([
      { x: 65, y: 101 },
      { x: 0, y: 101 },
      { x: 0, y: 0 },
      { x: 0, y: 174 },
    ]);
    expect(width).toBe(97);
    expect(height).toBe(194);
  });

  it("is empty for no sprites", () => {
    expect(packShelves([])).toEqual({ positions: [], width: 0, height: 0 });
  });
});
