import { type AssetCatalog, type BuildingManifest, FAMILIES, createCatalog } from "./manifest";

/**
 * One code-drawn placeholder per family and footprint, covering every level and
 * variant, so manifest choice always succeeds before real art exists
 * (ART_DIRECTION.md §13).
 */
export const PLACEHOLDER_MANIFESTS: readonly BuildingManifest[] = FAMILIES.flatMap((family) =>
  ([1, 2, 3, 4] as const).map((footprint): BuildingManifest => ({
    id: `placeholder-${family}-${footprint}`,
    family,
    footprint,
    levels: [1, 2, 3],
    views: [0],
    symmetric: true,
    variants: ["default", "abandoned"],
    authors: ["CommitCity contributors"],
    license: "CC-BY-SA-4.0",
    aiAssisted: false,
  })),
);

export const PLACEHOLDER_CATALOG: AssetCatalog = createCatalog(PLACEHOLDER_MANIFESTS);
