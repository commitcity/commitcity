import { type PackedAssets, frameKey, resolveView } from "@/core/assets";
import {
  type RenderItem,
  type RenderList,
  type TileSize,
  parseBuildingKey,
  spriteOrigin,
} from "@/core/view";
import { type Raster, type Region, blit, createRaster } from "./raster";

/**
 * The atlas frame for a render-list key, or undefined when the atlas lacks it.
 * Building keys map to a frame by manifest, nearest view and variant (levels share
 * one drawing); ground, road and decoration keys are frame keys already.
 */
export function atlasFrame(
  packed: PackedAssets,
  textureKey: string,
): (Region & { key: string }) | undefined {
  const building = parseBuildingKey(textureKey);
  let key = textureKey;
  if (building) {
    const manifest = packed.buildings.find((m) => m.id === building.manifestId);
    if (!manifest) return undefined;
    key = frameKey(manifest.id, resolveView(manifest, building.view), building.variant as never);
  }
  const frame = packed.frames[key];
  return frame && { key, x: frame.x, y: frame.y, width: frame.width, height: frame.height };
}

interface Placed {
  region: Region;
  x: number;
  y: number;
}

/**
 * The whole city drawn at 1× from the atlas, in the render list's order, cropped
 * to the drawn pixels. This is the server's version of the renderer (ARCHITECTURE.md
 * §3): same list, same anchors. Keys the atlas lacks are skipped.
 */
export function drawCity(
  list: RenderList,
  atlas: Raster,
  packed: PackedAssets,
  tile: TileSize,
): Raster {
  const placed: Placed[] = [];
  const place = (item: RenderItem, tileItem: boolean) => {
    const region = atlasFrame(packed, item.textureKey);
    if (!region) return;
    const origin = tileItem
      ? { x: item.screenX - tile.width / 2, y: item.screenY }
      : spriteOrigin(item, region.width, region.height);
    placed.push({ region, x: origin.x, y: origin.y });
  };
  list.ground.forEach((item) => place(item, true));
  list.roads.forEach((item) => place(item, true));
  list.objects.forEach((item) => place(item, false));
  if (placed.length === 0) return createRaster(1, 1);

  const minX = Math.min(...placed.map((p) => p.x));
  const minY = Math.min(...placed.map((p) => p.y));
  const maxX = Math.max(...placed.map((p) => p.x + p.region.width));
  const maxY = Math.max(...placed.map((p) => p.y + p.region.height));
  const out = createRaster(maxX - minX, maxY - minY);
  for (const p of placed) blit(out, atlas, p.region, p.x - minX, p.y - minY);
  return out;
}
