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

/**
 * Real manifests plus the placeholders still needed: a footprint keeps its
 * placeholders until real art covers it in both variants. Then manifest choice
 * relaxes family and picks real art, so no box shows (ART_DIRECTION.md §13).
 */
export function withPlaceholders(real: readonly BuildingManifest[]): BuildingManifest[] {
  const covered = (footprint: number) =>
    (["default", "abandoned"] as const).every((variant) =>
      real.some((m) => m.footprint === footprint && m.variants.includes(variant)),
    );
  return [...real, ...PLACEHOLDER_MANIFESTS.filter((p) => !covered(p.footprint))];
}
