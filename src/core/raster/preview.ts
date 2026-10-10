import { type PackedAssets, createCatalog, withPlaceholders } from "@/core/assets";
import { generateCity } from "@/core/generation";
import type { CityInput } from "@/core/model";
import { TILE_32, buildRenderList } from "@/core/view";
import { drawCity } from "./city";
import { type Raster, type Rgb, blit, fitFrame, ninePatch, scaleNearest } from "./raster";

/** Size of a social preview image, as the Open Graph spec recommends. */
export const PREVIEW_SIZE = { width: 1200, height: 630 } as const;
/** The background behind the city in the renderer (`src/renderer/stage.ts`). */
export const PREVIEW_BACKGROUND: Rgb = [0x1b, 0x26, 0x32];
/**
 * Screen pixels per art pixel. 2×, like the interface (ART_DIRECTION.md §16):
 * previews are shown small, and 1× buildings blur into specks there.
 */
export const PREVIEW_ZOOM = 2;
/** Largest zoom, for small cities. */
export const PREVIEW_MAX_ZOOM = 3;

/** The wooden plaque along the bottom edge, in preview pixels. */
export const PREVIEW_PLAQUE = (() => {
  const unit = PREVIEW_ZOOM;
  const margin = 12 * unit;
  const height = 40 * unit;
  return {
    x: margin,
    y: PREVIEW_SIZE.height - margin - height,
    width: PREVIEW_SIZE.width - 2 * margin,
    height,
    /** Panel border, where text must not go. */
    border: 8 * unit,
  };
})();

export interface CityPreview {
  image: Raster;
  buildings: number;
}

/**
 * The picture of a social preview without its text: the city the page shows for
 * `input` (same generation, default orientation), drawn from the atlas at
 * `PREVIEW_ZOOM` to `PREVIEW_MAX_ZOOM` around its center, and an empty wooden plaque from `panel`
 * (`panel-wood.png`, a nine-slice with an 8-pixel border).
 */
export function cityPreview(
  input: CityInput,
  packed: PackedAssets,
  atlas: Raster,
  panel: Raster,
): CityPreview {
  const model = generateCity(input, createCatalog(withPlaceholders(packed.buildings)));
  const city = drawCity(buildRenderList(model, 0, TILE_32), atlas, packed, TILE_32);
  const { width, height } = PREVIEW_SIZE;
  // A city that fits sits above the plaque; a bigger one fills the frame behind it.
  const image = fitFrame(city, width, height, PREVIEW_BACKGROUND, {
    minFactor: PREVIEW_ZOOM,
    maxFactor: PREVIEW_MAX_ZOOM,
    fitHeight: PREVIEW_PLAQUE.y,
  });
  const plaque = scaleNearest(
    ninePatch(panel, 8, PREVIEW_PLAQUE.width / PREVIEW_ZOOM, PREVIEW_PLAQUE.height / PREVIEW_ZOOM),
    PREVIEW_ZOOM,
  );
  blit(image, plaque, { x: 0, y: 0, ...whole(plaque) }, PREVIEW_PLAQUE.x, PREVIEW_PLAQUE.y);
  return { image, buildings: model.buildings.length };
}

const whole = (r: Raster) => ({ width: r.width, height: r.height });
