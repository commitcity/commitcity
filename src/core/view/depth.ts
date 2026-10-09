import type { Footprint } from "./types";

export interface DepthItem {
  /** Stable id used as the last tie-break, for example a repo id. */
  id: string;
  /** Footprint in view space. */
  footprint: Footprint;
}

/** Sum of the front corner tile's coordinates (ARCHITECTURE.md §7.2). */
export function frontCornerDepth(footprint: Footprint): number {
  return footprint.x + footprint.y + 2 * (footprint.size - 1);
}

/**
 * Whether `a` must be drawn before `b`. Footprints must not overlap.
 *
 * `a` is behind `b` when it lies entirely on the -x or -y side of `b` and the two
 * can overlap on screen. Pairs that sit diagonally (behind on one axis, in front
 * on the other) never overlap on screen, so they have no order.
 */
export function isBehind(a: Footprint, b: Footprint): boolean {
  if (!overlapsHorizontally(a, b)) return false;
  const aBeforeB = a.x + a.size <= b.x || a.y + a.size <= b.y;
  const bBeforeA = b.x + b.size <= a.x || b.y + b.size <= a.y;
  return aBeforeB && !bBeforeA;
}

/**
 * Sorts objects back to front so that each one is drawn after everything it may
 * cover. Uses a topological sort over `isBehind`, with the front-corner depth,
 * then x, then id as the tie-break, so the result is deterministic.
 *
 * O(n²) pairs; this runs only when the city or the orientation changes.
 */
export function sortByDepth<T extends DepthItem>(items: readonly T[]): T[] {
  const n = items.length;
  const blockers = new Array<number>(n).fill(0);
  const followers: number[][] = items.map(() => []);

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const a = items[i]!.footprint;
      const b = items[j]!.footprint;
      if (isBehind(a, b)) {
        followers[i]!.push(j);
        blockers[j]!++;
      } else if (isBehind(b, a)) {
        followers[j]!.push(i);
        blockers[i]!++;
      }
    }
  }

  const compare = (i: number, j: number) => compareItems(items[i]!, items[j]!);
  const ready: number[] = [];
  for (let i = 0; i < n; i++) if (blockers[i] === 0) ready.push(i);
  ready.sort(compare);

  const done = new Array<boolean>(n).fill(false);
  const result: T[] = [];
  while (result.length < n) {
    // A cycle should be impossible for non-overlapping footprints; if one appears
    // anyway, fall back to the smallest remaining item so the sort still finishes.
    const next = ready.length > 0 ? ready.shift()! : smallestRemaining(done, compare);
    if (done[next]) continue;
    done[next] = true;
    result.push(items[next]!);
    for (const f of followers[next]!) {
      blockers[f]!--;
      if (blockers[f] === 0 && !done[f]) insertSorted(ready, f, compare);
    }
  }
  return result;
}

function overlapsHorizontally(a: Footprint, b: Footprint): boolean {
  // Horizontal screen extent in half-tile units: from the left vertex (x - (y + size))
  // to the right vertex ((x + size) - y). Sprites are as wide as their footprint.
  const aLeft = a.x - a.y - a.size;
  const aRight = a.x - a.y + a.size;
  const bLeft = b.x - b.y - b.size;
  const bRight = b.x - b.y + b.size;
  return aLeft < bRight && bLeft < aRight;
}

function compareItems(a: DepthItem, b: DepthItem): number {
  return (
    frontCornerDepth(a.footprint) - frontCornerDepth(b.footprint) ||
    a.footprint.x - b.footprint.x ||
    (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
  );
}

function insertSorted(list: number[], value: number, compare: (a: number, b: number) => number) {
  let lo = 0;
  let hi = list.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (compare(list[mid]!, value) <= 0) lo = mid + 1;
    else hi = mid;
  }
  list.splice(lo, 0, value);
}

function smallestRemaining(done: boolean[], compare: (a: number, b: number) => number): number {
  let best = -1;
  for (let i = 0; i < done.length; i++) {
    if (!done[i] && (best === -1 || compare(i, best) < 0)) best = i;
  }
  return best;
}
