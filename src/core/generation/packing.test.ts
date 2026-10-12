import { describe, expect, it } from "vitest";
import type { Footprint } from "@/core/model";
import { StreetGrid } from "./grid";
import { MAIN_STREET_BLOCK, packBuildings } from "./packing";

const grid = new StreetGrid("owner");
const items = (footprints: number[]) =>
  footprints.map((f) => ({ footprint: f as Footprint, gap: false }));

describe("packBuildings", () => {
  it("starts with houses on both sides of the main street", () => {
    const { placements } = packBuildings(grid, items([1, 1, 1, 1]), () => false);
    expect(placements.map((p) => [p.blockIndex, p.facing])).toEqual([
      [0, 1],
      [MAIN_STREET_BLOCK, 3],
      [0, 1],
      [MAIN_STREET_BLOCK, 3],
    ]);
    // Neighbours on the same side stand side by side.
    expect(placements[2]!.origin.x).toBe(placements[0]!.origin.x + 1);
  });

  it("never overlaps two buildings and keeps each against its block's edge", () => {
    const sizes = Array.from({ length: 300 }, (_, i) => [1, 1, 1, 2, 2, 3, 1, 4][i % 8]!);
    const { placements, blocks } = packBuildings(grid, items(sizes), (k) => k % 9 === 5);
    const taken = new Set<string>();
    placements.forEach((p, i) => {
      const f = sizes[i]!;
      expect(p.blockIndex % 9).not.toBe(5);
      for (let dx = 0; dx < f; dx++)
        for (let dy = 0; dy < f; dy++) {
          const key = `${p.origin.x + dx},${p.origin.y + dy}`;
          expect(taken.has(key)).toBe(false);
          taken.add(key);
        }
      const r = blocks[p.blockIndex]!.rect;
      const edge = [r.x + r.w - f, r.y + r.h - f, r.x, r.y][p.facing];
      expect([p.origin.x, p.origin.y][p.facing % 2]).toBe(edge);
    });
  });

  it("never moves earlier buildings when more are added", () => {
    const sizes = [2, 1, 3, 1, 1, 4, 2, 1, 1];
    const before = packBuildings(grid, items(sizes), () => false).placements;
    const after = packBuildings(grid, items([...sizes, 2, 1]), () => false).placements;
    expect(after.slice(0, sizes.length)).toEqual(before);
  });
});
