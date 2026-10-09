import { describe, expect, it } from "vitest";
import { type DepthItem, frontCornerDepth, isBehind, sortByDepth } from "./depth";
import { rotateFootprint } from "./orientation";
import type { Footprint, Orientation } from "./types";

const ORIENTATIONS: Orientation[] = [0, 1, 2, 3];

function item(id: string, x: number, y: number, size: number): DepthItem {
  return { id, footprint: { x, y, size } };
}

function order(items: DepthItem[]): string[] {
  return sortByDepth(items).map((i) => i.id);
}

/** Checks that every item is drawn after all items it may cover. */
function expectValidOrder(items: DepthItem[]) {
  const sorted = sortByDepth(items);
  const position = new Map(sorted.map((it, index) => [it.id, index]));
  for (const a of items) {
    for (const b of items) {
      if (isBehind(a.footprint, b.footprint)) {
        expect(position.get(a.id), `${a.id} before ${b.id}`).toBeLessThan(position.get(b.id)!);
      }
    }
  }
}

function rotateAll(items: DepthItem[], o: Orientation): DepthItem[] {
  return items.map((i) => ({ id: i.id, footprint: rotateFootprint(i.footprint, o) }));
}

describe("frontCornerDepth", () => {
  it("sums the coordinates of the front tile", () => {
    expect(frontCornerDepth({ x: 2, y: 5, size: 1 })).toBe(7);
    expect(frontCornerDepth({ x: 2, y: 5, size: 4 })).toBe(13);
  });
});

describe("isBehind", () => {
  it("orders neighbors along each axis", () => {
    const a: Footprint = { x: 0, y: 0, size: 1 };
    expect(isBehind(a, { x: 1, y: 0, size: 1 })).toBe(true);
    expect(isBehind(a, { x: 0, y: 1, size: 1 })).toBe(true);
    expect(isBehind({ x: 1, y: 0, size: 1 }, a)).toBe(false);
  });

  it("leaves diagonal neighbors unordered", () => {
    // Left and right of each other on screen: they never overlap.
    expect(isBehind({ x: 0, y: 1, size: 1 }, { x: 1, y: 0, size: 1 })).toBe(false);
    expect(isBehind({ x: 1, y: 0, size: 1 }, { x: 0, y: 1, size: 1 })).toBe(false);
  });
});

describe("sortByDepth", () => {
  it("draws a tall building behind a short one first", () => {
    expect(order([item("short", 2, 2, 1), item("tall", 0, 0, 2)])).toEqual(["tall", "short"]);
  });

  it("draws a small building against the right wall of a large one after it", () => {
    // The front-corner rule alone gets this wrong: the small building's front corner
    // sum (5) is lower than the large one's (7), but it stands in front of the large
    // building's right wall.
    const large = item("large", 1, 0, 4);
    const small = item("small", 5, 0, 1);
    expect(frontCornerDepth(small.footprint)).toBeLessThan(frontCornerDepth(large.footprint));
    expect(order([small, large])).toEqual(["large", "small"]);
  });

  it("draws a small building against the left wall of a large one after it", () => {
    expect(order([item("small", 0, 5, 1), item("large", 0, 1, 4)])).toEqual(["large", "small"]);
  });

  it("draws a small building behind a large one first", () => {
    expect(order([item("large", 1, 1, 4), item("small", 0, 1, 1)])).toEqual(["small", "large"]);
  });

  it("is deterministic regardless of input order", () => {
    const items = [item("a", 0, 0, 1), item("b", 3, 0, 1), item("c", 0, 3, 1), item("d", 1, 1, 2)];
    const expected = order(items);
    expect(order([...items].reverse())).toEqual(expected);
    expect(order([items[2]!, items[0]!, items[3]!, items[1]!])).toEqual(expected);
  });

  it.each(ORIENTATIONS)("handles the hard cases at orientation %i", (o) => {
    const scene = [
      item("tall-back", 4, 4, 2),
      item("short-front", 6, 6, 1),
      item("large", 8, 2, 4),
      item("small-right-wall", 12, 2, 1),
      item("small-left-wall", 9, 6, 1),
      item("small-back", 7, 3, 1),
      item("edge-corner", 0, 0, 1),
      item("edge-far", 13, 13, 3),
      item("medium", 1, 9, 3),
    ];
    expectValidOrder(rotateAll(scene, o));
  });

  it("produces a valid order for random non-overlapping layouts", () => {
    let seed = 12345;
    const next = () => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return seed / 2147483648;
    };

    for (let round = 0; round < 50; round++) {
      const occupied = new Set<string>();
      const items: DepthItem[] = [];
      for (let attempt = 0; attempt < 80; attempt++) {
        const size = 1 + Math.floor(next() * 4);
        const x = Math.floor(next() * 20);
        const y = Math.floor(next() * 20);
        const tiles: string[] = [];
        for (let dx = 0; dx < size; dx++)
          for (let dy = 0; dy < size; dy++) tiles.push(`${x + dx},${y + dy}`);
        if (tiles.some((t) => occupied.has(t))) continue;
        tiles.forEach((t) => occupied.add(t));
        items.push(item(`b${attempt}`, x, y, size));
      }
      for (const o of ORIENTATIONS) expectValidOrder(rotateAll(items, o));
    }
  });
});
