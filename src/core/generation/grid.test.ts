import { describe, expect, it } from "vitest";
import { StreetGrid } from "./grid";

describe("StreetGrid", () => {
  it("leaves exactly one road tile between neighbouring columns and rows", () => {
    const grid = new StreetGrid("owner");
    for (const axis of ["x", "y"] as const)
      for (let i = -6; i < 6; i++)
        expect(grid.start(axis, i + 1)).toBe(grid.start(axis, i) + grid.span(axis, i) + 1);
  });

  it("varies block sizes and depends only on the owner", () => {
    const a = new StreetGrid("owner");
    const spans = new Set(Array.from({ length: 12 }, (_, i) => a.span("x", i)));
    expect(spans.size).toBeGreaterThan(2);
    expect(new StreetGrid("owner").rect({ x: 2, y: -3 })).toEqual(a.rect({ x: 2, y: -3 }));
  });

  it("keeps the center block at least 6 tiles wide and deep", () => {
    for (let i = 0; i < 50; i++) {
      const rect = new StreetGrid(`o${i}`).rect({ x: 0, y: 0 });
      expect(Math.min(rect.w, rect.h)).toBeGreaterThanOrEqual(6);
      expect(rect.x).toBeLessThanOrEqual(0);
      expect(rect.x + rect.w).toBeGreaterThan(0);
    }
  });
});
