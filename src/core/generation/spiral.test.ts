import { describe, expect, it } from "vitest";
import { BLOCK_PERIOD, LOT_SIZE } from "./layout";
import { blockAt, blockRing, lotAt } from "./spiral";

describe("blockAt", () => {
  it("starts at the center and walks ring 1 clockwise from its back corner", () => {
    expect(Array.from({ length: 9 }, (_, i) => blockAt(i))).toEqual([
      { x: 0, y: 0 },
      { x: -1, y: -1 },
      { x: 0, y: -1 },
      { x: 1, y: -1 },
      { x: 1, y: 0 },
      { x: 1, y: 1 },
      { x: 0, y: 1 },
      { x: -1, y: 1 },
      { x: -1, y: 0 },
    ]);
  });

  it("visits every block of each ring exactly once, in ring order", () => {
    const seen = new Set<string>();
    let index = 0;
    for (let ring = 0; ring <= 6; ring++) {
      const count = ring === 0 ? 1 : 8 * ring;
      for (let i = 0; i < count; i++, index++) {
        const block = blockAt(index);
        expect(blockRing(block)).toBe(ring);
        seen.add(`${block.x},${block.y}`);
      }
    }
    expect(seen.size).toBe(13 * 13);
  });

  it("moves to a neighboring block at every step within a ring", () => {
    for (let i = 2; i < 300; i++) {
      const a = blockAt(i - 1);
      const b = blockAt(i);
      if (blockRing(a) !== blockRing(b)) continue;
      expect(Math.abs(a.x - b.x) + Math.abs(a.y - b.y)).toBe(1);
    }
  });

  it("rejects invalid indexes", () => {
    expect(() => blockAt(-1)).toThrow(RangeError);
    expect(() => blockAt(1.5)).toThrow(RangeError);
  });
});

describe("lotAt", () => {
  it("puts the first four lots around the world origin", () => {
    expect([0, 1, 2, 3].map((i) => lotAt(i).origin)).toEqual([
      { x: -4, y: -4 },
      { x: 0, y: -4 },
      { x: 0, y: 0 },
      { x: -4, y: 0 },
    ]);
  });

  it("never overlaps another lot or a road tile", () => {
    const isRoad = (v: number) => (((v - 4) % BLOCK_PERIOD) + BLOCK_PERIOD) % BLOCK_PERIOD === 0;
    const tiles = new Set<string>();
    for (let i = 0; i < 400; i++) {
      const { origin } = lotAt(i);
      for (let dx = 0; dx < LOT_SIZE; dx++) {
        for (let dy = 0; dy < LOT_SIZE; dy++) {
          const x = origin.x + dx;
          const y = origin.y + dy;
          expect(isRoad(x) || isRoad(y), `lot ${i} on a road at ${x},${y}`).toBe(false);
          const key = `${x},${y}`;
          expect(tiles.has(key), `lot ${i} overlaps at ${key}`).toBe(false);
          tiles.add(key);
        }
      }
    }
  });
});
