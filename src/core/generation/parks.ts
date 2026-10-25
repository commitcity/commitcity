import { DECORATION_VARIANT_COUNT } from "@/core/assets";
import type { Decoration } from "@/core/model";
import { hash53 } from "@/core/random";
import type { BlockRect } from "./grid";
import { MAIN_STREET_BLOCK } from "./packing";

// Parks (ARCHITECTURE.md §6.6): now and then a whole block holds no repository
// and becomes a park, so the city reads as a city and not as a grid of lots.
// Everything here comes from position hashes, not from repository streams, so a
// park never shifts the buildings or decorations of a repository.

/** What a park adds to the city: water tiles, paved tiles and decorations. */
export interface ParkLayout {
  water: { x: number; y: number }[];
  pavement: { x: number; y: number }[];
  decorations: Decoration[];
}

export type ParkStyle = "pond" | "plaza" | "garden";
const STYLES: readonly ParkStyle[] = ["pond", "plaza", "garden", "pond"];

const roll = (key: string, n: number) => hash53(key) % n;

/**
 * Roughly one block in ten is a park, never one of the first four or the main
 * street, and never two within five blocks of each other in the spiral.
 */
export function isParkBlock(owner: string, blockIndex: number): boolean {
  const candidate = (k: number) =>
    k >= 4 && k !== MAIN_STREET_BLOCK && roll(`${owner}:park:${k}`, 10) === 0;
  if (!candidate(blockIndex)) return false;
  for (let k = blockIndex - 1; k > blockIndex - 6 && k >= 4; k--)
    if (isParkBlock(owner, k)) return false;
  return true;
}

/** Repository id used for decorations of the park in the given block. */
export const parkId = (blockIndex: number) => `park:${blockIndex}`;

/** Small blocks can be plazas; ponds need room for a shore. */
export function parkStyle(owner: string, rect: BlockRect, blockIndex: number): ParkStyle {
  const styles = STYLES.filter(
    (s) =>
      (s !== "plaza" || rect.w * rect.h <= 42) && (s !== "pond" || (rect.w >= 5 && rect.h >= 5)),
  );
  return styles[roll(`${owner}:park-style:${blockIndex}`, styles.length)]!;
}

/** A park filling a whole block. */
export function parkBlock(owner: string, rect: BlockRect, blockIndex: number): ParkLayout {
  const style = parkStyle(owner, rect, blockIndex);
  const id = parkId(blockIndex);
  const water: { x: number; y: number }[] = [];
  const pavement: { x: number; y: number }[] = [];
  const decorations: Decoration[] = [];
  const key = (x: number, y: number) => `${owner}:park:${blockIndex}:${x},${y}`;
  const put = (x: number, y: number, kind: string, variant?: number) =>
    decorations.push({
      x,
      y,
      kind,
      variant: variant ?? roll(key(x, y), DECORATION_VARIANT_COUNT),
      repoId: id,
    });
  const r = (x: number, y: number, n: number) => roll(`${key(x, y)}:pick`, n);
  // Flowering trees in a park all bloom in one colour.
  const bloom = roll(`${owner}:park:${blockIndex}:bloom`, DECORATION_VARIANT_COUNT);

  const { x: x0, y: y0, w, h } = rect;
  const cx = x0 + Math.floor((w - 1) / 2);
  const cy = y0 + Math.floor((h - 1) / 2);
  for (let y = y0; y < y0 + h; y++) {
    for (let x = x0; x < x0 + w; x++) {
      const edgeX = x === x0 || x === x0 + w - 1;
      const edgeY = y === y0 || y === y0 + h - 1;
      const edge = edgeX || edgeY;
      const corner = edgeX && edgeY;
      // Benches on the edges look along the edge, toward the park.
      const bench = edgeX ? 1 : 0;
      if (style === "pond") {
        // Water inside a one-tile shore, with its corners rounded off.
        const ix = x - x0 - 1;
        const iy = y - y0 - 1;
        const pondCorner = (ix === 0 || ix === w - 3) && (iy === 0 || iy === h - 3);
        if (!edge && !(pondCorner && w > 4 && h > 4)) water.push({ x, y });
        else if (corner) put(x, y, "tree");
        else {
          const pick = r(x, y, 9);
          if (pick === 0) put(x, y, "bench", bench);
          else if (pick <= 2) put(x, y, "tree");
          else if (pick === 3) put(x, y, "bush");
          else if (pick === 4) put(x, y, "flowers");
        }
      } else if (style === "plaza") {
        pavement.push({ x, y });
        if (x === cx && y === cy) put(x, y, "fountain", 2);
        else if (corner) put(x, y, "lamp", 0);
        else if (edge && r(x, y, 4) === 0) put(x, y, "bench", bench);
        else if (edge && r(x, y, 5) === 0) put(x, y, "blossom", bloom);
      } else {
        const pick = r(x, y, 10);
        if (x === cx && y === cy) put(x, y, "fountain", 0);
        else if (corner) put(x, y, "lamp", 2);
        else if (pick === 1) put(x, y, "blossom", bloom);
        else if (pick === 2) put(x, y, "tree");
        else if (pick <= 4) put(x, y, "flowers");
        else if (pick === 5) put(x, y, "bush");
        else if (pick === 6 && edge) put(x, y, "bench", bench);
      }
    }
  }
  return { water, pavement, decorations };
}
