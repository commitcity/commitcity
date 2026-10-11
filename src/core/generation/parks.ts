import { DECORATION_VARIANT_COUNT } from "@/core/assets";
import type { Decoration } from "@/core/model";
import { hash53 } from "@/core/random";
import { LOTS_PER_BLOCK_SIDE, LOT_SIZE, blockOrigin } from "./layout";
import type { BlockPosition } from "./spiral";

// Parks and suburbs fill the space buildings leave empty (ARCHITECTURE.md §6.6):
// the unused lots of the outermost block, and for small accounts a ring of
// neighbourhood blocks with houses, so even a few repositories make a village.
// Everything here comes from position hashes, not from repository streams, so a
// park never shifts the buildings or decorations of a repository.

/** A lot that holds no repository: its key names it in hashes and decoration ids. */
export interface FillerLot {
  index: number | string;
  origin: { x: number; y: number };
}

/** What a park adds to the city: water and paved tiles, and decorations. */
export interface ParkLayout {
  water: { x: number; y: number }[];
  pavement: { x: number; y: number }[];
  decorations: Decoration[];
}

export type ParkStyle = "pond" | "plaza" | "garden";
const STYLES: readonly ParkStyle[] = ["pond", "plaza", "garden"];

const roll = (key: string, n: number) => hash53(key) % n;

/** Repository id used for decorations of the park on the given lot. */
export const parkId = (lot: FillerLot) => `park:${lot.index}`;

/** Style of the park on an unused lot. */
export function parkStyle(owner: string, lot: FillerLot): ParkStyle {
  return STYLES[roll(`${owner}:park:${lot.index}`, STYLES.length)]!;
}

/** A park filling a whole unused lot. */
export function parkLot(owner: string, lot: FillerLot): ParkLayout {
  const style = parkStyle(owner, lot);
  const id = parkId(lot);
  const water: { x: number; y: number }[] = [];
  const decorations: Decoration[] = [];
  const at = (dx: number, dy: number) => ({ x: lot.origin.x + dx, y: lot.origin.y + dy });
  const put = (dx: number, dy: number, kind: string, variant?: number) =>
    decorations.push({
      ...at(dx, dy),
      kind,
      variant: variant ?? roll(`${owner}:park:${lot.index}:${dx},${dy}`, DECORATION_VARIANT_COUNT),
      repoId: id,
    });
  const r = (dx: number, dy: number, n: number) =>
    roll(`${owner}:park:${lot.index}:${dx},${dy}:pick`, n);

  for (let dy = 0; dy < LOT_SIZE; dy++) {
    for (let dx = 0; dx < LOT_SIZE; dx++) {
      const inner = dx >= 1 && dx <= 2 && dy >= 1 && dy <= 2;
      const corner = (dx === 0 || dx === 3) && (dy === 0 || dy === 3);
      if (style === "pond") {
        if (inner) water.push(at(dx, dy));
        else if (corner) put(dx, dy, "tree");
        else {
          const pick = r(dx, dy, 6);
          if (pick === 0) put(dx, dy, "bench", dx === 0 || dx === 3 ? 1 : 0);
          else if (pick <= 2) put(dx, dy, "flowers");
          else if (pick === 3) put(dx, dy, "bush");
        }
      } else if (style === "plaza") {
        if (dx === 1 && dy === 1) put(dx, dy, "fountain", 2);
        else if (inner) continue;
        else if (corner) put(dx, dy, "lamp", 0);
        else if (r(dx, dy, 3) === 0) put(dx, dy, "bench", dx === 0 || dx === 3 ? 1 : 0);
        else put(dx, dy, "flowers");
      } else {
        const pick = r(dx, dy, 8);
        if (dx === 2 && dy === 2) put(dx, dy, "fountain", 0);
        else if (dx === 1 && dy === 2) put(dx, dy, "bench", 0);
        else if (pick <= 2) put(dx, dy, "tree");
        else if (pick <= 5) put(dx, dy, "flowers");
        else if (pick === 6) put(dx, dy, "bush");
        else if (corner) put(dx, dy, "lamp", 2);
      }
    }
  }
  return { water, pavement: [], decorations };
}

/** Suburbs are added while the city has at most this many blocks. */
export const SUBURB_MAX_BLOCKS = 16;
/** Share of suburb lots that are parks instead of houses. */
const SUBURB_PARK_SHARE = 0.12;
const HOUSES = ["house-red", "house-blue", "house-green", "house-yellow"] as const;

/**
 * Blocks next to the city (all eight directions) that hold no repository, while the
 * city is small; sorted by y, then x. Empty for larger cities.
 */
export function suburbBlocks(occupied: readonly BlockPosition[]): BlockPosition[] {
  if (occupied.length === 0 || occupied.length > SUBURB_MAX_BLOCKS) return [];
  const taken = new Set(occupied.map((b) => `${b.x},${b.y}`));
  const ring = new Map<string, BlockPosition>();
  for (const b of occupied)
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++) {
        const key = `${b.x + dx},${b.y + dy}`;
        if (!taken.has(key)) ring.set(key, { x: b.x + dx, y: b.y + dy });
      }
  return [...ring.values()].sort((a, b) => a.y - b.y || a.x - b.x);
}

/** The lots of a suburb block. */
export function suburbLots(block: BlockPosition): FillerLot[] {
  const base = blockOrigin(block);
  const lots: FillerLot[] = [];
  for (let cy = 0; cy < LOTS_PER_BLOCK_SIDE; cy++)
    for (let cx = 0; cx < LOTS_PER_BLOCK_SIDE; cx++)
      lots.push({
        index: `suburb:${block.x},${block.y}:${cx},${cy}`,
        origin: { x: base.x + cx * LOT_SIZE, y: base.y + cy * LOT_SIZE },
      });
  return lots;
}

/** A suburb lot: houses on a loose grid with trees and parked cars, or now and then a park. */
export function suburbLot(owner: string, lot: FillerLot): ParkLayout {
  const key = `${owner}:${lot.index}`;
  if (hash53(`${key}:park`) / 2 ** 53 < SUBURB_PARK_SHARE) return parkLot(owner, lot);
  const px = roll(`${key}:px`, 2);
  const py = roll(`${key}:py`, 2);
  const decorations: Decoration[] = [];
  const pavement: { x: number; y: number }[] = [];
  for (let dy = 0; dy < LOT_SIZE; dy++) {
    for (let dx = 0; dx < LOT_SIZE; dx++) {
      const x = lot.origin.x + dx;
      const y = lot.origin.y + dy;
      const r = (what: string, n: number) => roll(`${key}:${dx},${dy}:${what}`, n);
      const put = (kind: string) =>
        decorations.push({
          x,
          y,
          kind,
          variant: r("variant", DECORATION_VARIANT_COUNT),
          repoId: `${lot.index}`,
        });
      const pick = r("pick", 20);
      if (dx % 2 === px && dy % 2 === py) {
        if (pick < 17) put(HOUSES[r("roof", HOUSES.length)]!);
        else put("tree");
      } else if (pick < 1) {
        put("car");
        pavement.push({ x, y });
      } else if (pick < 10) put("tree");
      else if (pick < 13) put(pick < 12 ? "bush" : "flowers");
    }
  }
  return { water: [], pavement, decorations };
}
