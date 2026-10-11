import { DECORATION_VARIANT_COUNT } from "@/core/assets";
import type { Decoration } from "@/core/model";
import { hash53 } from "@/core/random";
import { LOT_SIZE } from "./layout";
import type { Lot } from "./spiral";

// Parks fill the space buildings leave empty (ARCHITECTURE.md §6.6): the unused
// lots of the outermost block.
// Everything here comes from position hashes, not from repository streams, so a
// park never shifts the buildings or decorations of a repository.

/** What a park adds to the city: water tiles and decorations. */
export interface ParkLayout {
  water: { x: number; y: number }[];
  decorations: Decoration[];
}

export type ParkStyle = "pond" | "plaza" | "garden";
const STYLES: readonly ParkStyle[] = ["pond", "plaza", "garden"];

const roll = (key: string, n: number) => hash53(key) % n;

/** Repository id used for decorations of the park on the given lot. */
export const parkId = (lot: Lot) => `park:${lot.index}`;

/** Style of the park on an unused lot. */
export function parkStyle(owner: string, lot: Lot): ParkStyle {
  return STYLES[roll(`${owner}:park:${lot.index}`, STYLES.length)]!;
}

/** A park filling a whole unused lot. */
export function parkLot(owner: string, lot: Lot): ParkLayout {
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
  return { water, decorations };
}
