import type { Facing, Footprint } from "@/core/model";
import type { BlockRect, StreetGrid } from "./grid";
import { blockAt } from "./spiral";

/** Spiral index of the block across the main street from the center block. */
export const MAIN_STREET_BLOCK = (() => {
  for (let k = 1; ; k++) {
    const b = blockAt(k);
    if (b.x === 0 && b.y === 1) return k;
  }
})();

// Buildings stand side by side along the streets, like a city builder
// (ARCHITECTURE.md §6.3). Each block is walked around its edge, and a building
// takes the first free spot along a road where its footprint fits. Blocks are
// opened in spiral order, so the oldest repositories form the center.

/** Where one building stands. */
export interface Placement {
  origin: { x: number; y: number };
  facing: Facing;
  /** Spiral index of its block. */
  blockIndex: number;
}

/** Sides in filling order: front-left (+y), front-right (+x), back-right (-y), back-left (-x). */
const SIDES: readonly Facing[] = [1, 0, 3, 2];

/** Spots along one side of a block for a footprint, in walking order. */
function* spots(rect: BlockRect, side: Facing, f: number): Generator<{ x: number; y: number }> {
  if (f > rect.w || f > rect.h) return;
  const { x, y, w, h } = rect;
  switch (side) {
    case 1:
      for (let i = 0; i <= w - f; i++) yield { x: x + i, y: y + h - f };
      return;
    case 0:
      for (let i = h - f; i >= 0; i--) yield { x: x + w - f, y: y + i };
      return;
    case 3:
      for (let i = 0; i <= w - f; i++) yield { x: x + i, y };
      return;
    default:
      for (let i = 0; i <= h - f; i++) yield { x, y: y + i };
  }
}

export class BlockSpace {
  readonly taken = new Set<string>();
  /** Sides that have at least one building, with the range they cover along the side. */
  readonly usedSides = new Map<Facing, { lo: number; hi: number }>();
  buildings = 0;
  /** Tiles kept free next to buildings, for gardens. */
  readonly gardens: { x: number; y: number }[] = [];
  /** Smallest footprint that found no spot; tiles are only ever taken, so it never fits again. */
  private noRoomFor = Infinity;

  constructor(
    readonly rect: BlockRect,
    readonly index: number,
  ) {}

  free(x: number, y: number, f: number): boolean {
    for (let dx = 0; dx < f; dx++)
      for (let dy = 0; dy < f; dy++) if (this.taken.has(`${x + dx},${y + dy}`)) return false;
    return true;
  }

  inside(x: number, y: number): boolean {
    const r = this.rect;
    return x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h;
  }

  claim(x: number, y: number, w: number, h: number, garden = false) {
    for (let dx = 0; dx < w; dx++) {
      for (let dy = 0; dy < h; dy++) {
        const key = `${x + dx},${y + dy}`;
        if (garden && this.inside(x + dx, y + dy) && !this.taken.has(key))
          this.gardens.push({ x: x + dx, y: y + dy });
        this.taken.add(key);
      }
    }
  }

  /** Places a footprint at the first free spot, or returns null when the block is full. */
  place(f: Footprint, gap: boolean): Placement | null {
    if (f >= this.noRoomFor) return null;
    for (const side of SIDES) {
      const placed = this.placeOnSide(f, gap, side);
      if (placed) return placed;
    }
    this.noRoomFor = f;
    return null;
  }

  /** Places a footprint at the first free spot along one side. */
  placeOnSide(f: Footprint, gap: boolean, side: Facing): Placement | null {
    for (const spot of spots(this.rect, side, f)) {
      if (!this.free(spot.x, spot.y, f)) continue;
      this.claim(spot.x, spot.y, f, f);
      if (gap) this.leaveGap(spot, side, f);
      const along = side === 1 || side === 3 ? spot.x : spot.y;
      const range = this.usedSides.get(side);
      this.usedSides.set(side, {
        lo: Math.min(range?.lo ?? along, along),
        hi: Math.max(range?.hi ?? along + f - 1, along + f - 1),
      });
      this.buildings++;
      return { origin: spot, facing: side, blockIndex: this.index };
    }
    return null;
  }

  /** Whether a 1 × 1 building still fits anywhere along the roads. */
  hasRoom(): boolean {
    return SIDES.some((side) => [...spots(this.rect, side, 1)].some((p) => this.free(p.x, p.y, 1)));
  }

  /** Keeps the strip after a building free of buildings: a small garden or yard. */
  private leaveGap(spot: { x: number; y: number }, side: Facing, f: number) {
    const { x, y } = spot;
    if (side === 1) this.claim(x + f, y, 1, f, true);
    else if (side === 0) this.claim(x, y - 1, f, 1, true);
    else if (side === 3) this.claim(x - 1, y, 1, f, true);
    else this.claim(x, y + f, f, 1, true);
  }
}

/**
 * Places footprints in order. The first buildings line both sides of the main
 * street, the road between the center block and the block in front of it,
 * taking turns from one side to the other like houses in a village. After that,
 * each building goes to the first block, in spiral order, with room for it;
 * `skip` marks blocks kept free (parks).
 */
export function packBuildings(
  grid: StreetGrid,
  items: readonly { footprint: Footprint; gap: boolean }[],
  skip: (blockIndex: number) => boolean,
): { placements: Placement[]; blocks: BlockSpace[] } {
  const blocks: BlockSpace[] = [];
  const open = (index: number) => {
    while (blocks.length <= index) {
      const k = blocks.length;
      blocks.push(new BlockSpace(grid.rect(blockAt(k)), k));
    }
    return blocks[index]!;
  };

  let first = 0;
  let street = 0;
  const placements = items.map(({ footprint, gap }) => {
    const sides = [
      () => open(0).placeOnSide(footprint, gap, 1),
      () => open(MAIN_STREET_BLOCK).placeOnSide(footprint, gap, 3),
    ];
    const turn = street % 2;
    const onStreet = sides[turn]!() ?? sides[1 - turn]!();
    if (onStreet) {
      street++;
      return onStreet;
    }
    for (let k = first; ; k++) {
      if (skip(k)) continue;
      const placed = open(k).place(footprint, gap);
      if (placed) return placed;
      // Blocks that cannot take even a 1 × 1 building are never tried again.
      if (k === first && !blocks[k]!.hasRoom()) first++;
    }
  });
  return { placements, blocks };
}
