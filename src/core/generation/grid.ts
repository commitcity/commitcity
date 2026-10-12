import { hash53 } from "@/core/random";
import type { BlockPosition } from "./spiral";

// Street grid with blocks of varied sizes (ARCHITECTURE.md §6.2). Every column of
// blocks has its own width and every row its own depth, picked by a hash of the
// owner and the column or row, so blocks are rectangles of different shapes
// instead of identical squares. Roads are 1 tile wide between them.

/** Block spans in tiles; repeated values make them more likely. */
const SPANS: readonly number[] = [4, 5, 5, 6, 6, 7, 8, 8, 10];

/** The interior of one block: tiles x..x+w-1, y..y+h-1, roads around it. */
export interface BlockRect {
  block: BlockPosition;
  x: number;
  y: number;
  w: number;
  h: number;
}

export class StreetGrid {
  private readonly starts = { x: new Map<number, number>(), y: new Map<number, number>() };

  constructor(private readonly owner: string) {}

  /** Width (axis x) or depth (axis y) of column or row i. */
  span(axis: "x" | "y", i: number): number {
    // The center block is never thinner than 6, so it holds a few buildings.
    const pool = i === 0 ? SPANS.filter((s) => s >= 6) : SPANS;
    return pool[hash53(`${this.owner}:grid:${axis}:${i}`) % pool.length]!;
  }

  /** First interior tile of column or row i. Column 0 is centered on the origin. */
  start(axis: "x" | "y", i: number): number {
    const cache = this.starts[axis];
    const hit = cache.get(i);
    if (hit !== undefined) return hit;
    let value: number;
    if (i === 0) value = -Math.floor(this.span(axis, 0) / 2);
    else if (i > 0) value = this.start(axis, i - 1) + this.span(axis, i - 1) + 1;
    else value = this.start(axis, i + 1) - 1 - this.span(axis, i);
    cache.set(i, value);
    return value;
  }

  rect(block: BlockPosition): BlockRect {
    return {
      block,
      x: this.start("x", block.x),
      y: this.start("y", block.y),
      w: this.span("x", block.x),
      h: this.span("y", block.y),
    };
  }
}
