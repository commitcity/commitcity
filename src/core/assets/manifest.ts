import { hash53 } from "@/core/random";

export type Family = "residential" | "brick" | "modern" | "industrial" | "civic";
export type Variant = "default" | "abandoned";
export type View = 0 | 1 | 2 | 3;

export const FAMILIES: readonly Family[] = [
  "residential",
  "brick",
  "modern",
  "industrial",
  "civic",
];

/** One building, as described by its `manifest.json` (ART_DIRECTION.md §12). */
export interface BuildingManifest {
  id: string;
  family: Family;
  footprint: 1 | 2 | 3 | 4;
  /** Levels this drawing can represent, for example [1, 2]. */
  levels: number[];
  /** Available views; at least [0]. */
  views: View[];
  symmetric: boolean;
  variants: Variant[];
  authors: string[];
  license: string;
  aiAssisted: boolean;
}

export interface AssetCatalog {
  /** Hash of all manifests; changes whenever any manifest changes. */
  version: string;
  buildings: BuildingManifest[];
}

/** Builds a catalog with a version derived from its content, independent of manifest order. */
export function createCatalog(buildings: readonly BuildingManifest[]): AssetCatalog {
  const sorted = [...buildings].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const ids = new Set<string>();
  for (const manifest of sorted) {
    if (ids.has(manifest.id)) throw new Error(`Duplicate manifest id "${manifest.id}"`);
    ids.add(manifest.id);
  }
  const version = hash53(JSON.stringify(sorted)).toString(16).padStart(14, "0");
  return { version, buildings: sorted };
}
