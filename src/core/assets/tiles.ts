import { type RgbaImage, checkCommonFields, checkFlatTile, checkSprite } from "./validate";

// Ground, road and vegetation assets (ART_DIRECTION.md §10, §12). Each is a folder
// with a manifest and a fixed set of PNGs; the file names match the variants and
// shapes the generator and view layer produce, so every texture key has art.

export type TileKind = "ground" | "road" | "water" | "vegetation";

export const TILE_KINDS: readonly TileKind[] = ["ground", "road", "water", "vegetation"];

/** Folder under `assets/` for each kind. */
export const TILE_FOLDERS: Record<TileKind, string> = {
  ground: "ground",
  road: "roads",
  water: "water",
  vegetation: "vegetation",
};

/** Ground variants per kind; the generator picks one by position hash. */
export const GROUND_VARIANT_COUNT = 4;
/** Variants per decoration kind; the generator picks one per decoration. */
export const DECORATION_VARIANT_COUNT = 3;
export const ROAD_SHAPE_COUNT = 16;
/** Water tiles are auto-tiled like roads: one shape per neighbor mask. */
export const WATER_SHAPE_COUNT = 16;

/** Folder ids each kind accepts: the names the generator uses. */
const TILE_IDS: Record<TileKind, readonly string[] | null> = {
  ground: ["grass", "dirt", "pavement"],
  road: null,
  water: ["water"],
  // Props live with the vegetation: they stand on one tile the same way.
  vegetation: [
    "tree",
    "bush",
    "flowers",
    "weeds",
    "dead-tree",
    "fountain",
    "bench",
    "lamp",
    "car",
    "house-red",
    "house-blue",
    "house-green",
    "house-yellow",
  ],
};

export interface TileManifest {
  id: string;
  kind: TileKind;
  authors: string[];
  license: string;
  aiAssisted: boolean;
}

const TILE_KEYS = ["id", "kind", "authors", "license", "aiAssisted"] as const;

export function parseTileManifest(
  value: unknown,
  folder: string,
  kind: TileKind,
): { manifest: TileManifest | null; problems: string[] } {
  const fields = checkCommonFields(value, TILE_KEYS, folder);
  if (!fields.record) return { manifest: null, problems: fields.problems };
  const { record: m, problems } = fields;
  if ("kind" in m && m.kind !== kind)
    problems.push(`"kind" must be "${kind}" for a folder under assets/${TILE_FOLDERS[kind]}/`);
  const ids = TILE_IDS[kind];
  if (ids && typeof m.id === "string" && !ids.includes(m.id))
    problems.push(`${kind} folders must be named one of: ${ids.join(", ")}`);
  if (problems.length > 0) return { manifest: null, problems };
  return { manifest: m as unknown as TileManifest, problems };
}

/** The PNGs a tile folder must contain, with the render-list texture key each one serves. */
export function tileFiles(manifest: TileManifest): { file: string; textureKey: string }[] {
  const range = (n: number) => Array.from({ length: n }, (_, i) => i);
  switch (manifest.kind) {
    case "ground":
      return range(GROUND_VARIANT_COUNT).map((i) => ({
        file: `variant-${i}.png`,
        textureKey: `ground/${manifest.id}/${i}`,
      }));
    case "road":
      return range(ROAD_SHAPE_COUNT).map((mask) => ({
        file: `mask-${mask}.png`,
        textureKey: `road/${mask}`,
      }));
    case "water":
      return range(WATER_SHAPE_COUNT).map((mask) => ({
        file: `mask-${mask}.png`,
        textureKey: `water/${mask}`,
      }));
    case "vegetation":
      return range(DECORATION_VARIANT_COUNT).map((i) => ({
        file: `variant-${i}.png`,
        textureKey: `decoration/${manifest.id}/${i}`,
      }));
  }
}

/**
 * Checks one tile image. Ground, road and water tiles are one full 32 × 16 diamond;
 * vegetation follows the rules of a 1 × 1 building (bottom-anchored, grows upward).
 */
export function checkTile(
  image: RgbaImage,
  kind: TileKind,
  palette: ReadonlySet<number>,
): string[] {
  return kind === "vegetation"
    ? checkSprite(image, 1, palette, { flat: true })
    : checkFlatTile(image, palette);
}
