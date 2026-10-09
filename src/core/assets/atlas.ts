import type { BuildingManifest, Variant, View } from "./manifest";

// The packed form of the artist assets that the app loads: one atlas image plus
// this JSON (ARCHITECTURE.md §9). Written by `pnpm pack-assets`.

export interface AtlasFrame {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PackedAssets {
  /** Image path relative to the catalog file. */
  image: string;
  buildings: BuildingManifest[];
  /** Keyed by `frameKey`. */
  frames: Record<string, AtlasFrame>;
}

export function frameKey(manifestId: string, view: View, variant: Variant): string {
  return `${manifestId}/view-${view}/${variant}`;
}

/**
 * The view to draw when `view` is wanted. Symmetric buildings always use view 0;
 * otherwise the nearest available view, preferring the next one clockwise on a tie,
 * so a building never disappears (ART_DIRECTION.md §8).
 */
export function resolveView(manifest: Pick<BuildingManifest, "views" | "symmetric">, view: View) {
  if (manifest.symmetric) return 0;
  for (const step of [0, 1, 3, 2]) {
    const candidate = ((view + step) % 4) as View;
    if (manifest.views.includes(candidate)) return candidate;
  }
  return 0;
}

/**
 * Places rectangles in rows ("shelves"), tallest first, with a 1 px gap so
 * neighbors never bleed into each other. Deterministic: ties keep input order.
 */
export function packShelves(
  sizes: readonly { width: number; height: number }[],
  maxWidth = 2048,
): { positions: { x: number; y: number }[]; width: number; height: number } {
  const GAP = 1;
  const order = sizes.map((_, i) => i).sort((a, b) => sizes[b]!.height - sizes[a]!.height || a - b);
  const positions: { x: number; y: number }[] = new Array(sizes.length);
  let x = 0;
  let y = 0;
  let shelf = 0;
  let width = 0;
  for (const i of order) {
    const size = sizes[i]!;
    if (size.width > maxWidth) throw new Error(`sprite wider than the atlas (${size.width} px)`);
    if (x > 0 && x + size.width > maxWidth) {
      y += shelf + GAP;
      x = 0;
      shelf = 0;
    }
    positions[i] = { x, y };
    x += size.width + GAP;
    shelf = Math.max(shelf, size.height);
    width = Math.max(width, x - GAP);
  }
  return { positions, width, height: sizes.length ? y + shelf : 0 };
}
