import type { PackedAssets } from "@/core/assets";

// Kept free of PixiJS so the page can start loading assets before the renderer.

/** The packed artist assets as loaded in the browser: catalog plus atlas pixels. */
export interface LoadedAssets {
  packed: PackedAssets;
  /** Null when there are no sprites yet. */
  atlas: ImageData | null;
}

/**
 * Fetches the catalog written by `pnpm pack-assets` and decodes its atlas. Resolves
 * to null when the catalog does not exist, so the city still renders with
 * placeholders.
 */
export async function loadAssets(catalogUrl: string): Promise<LoadedAssets | null> {
  const response = await fetch(catalogUrl);
  if (!response.ok) return null;
  const packed = (await response.json()) as PackedAssets;
  if (Object.keys(packed.frames).length === 0) return { packed, atlas: null };

  const image = await fetch(new URL(packed.image, new URL(catalogUrl, location.href)));
  if (!image.ok) throw new Error(`atlas ${packed.image}: HTTP ${image.status}`);
  const bitmap = await createImageBitmap(await image.blob(), { premultiplyAlpha: "none" });
  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
  const context = canvas.getContext("2d")!;
  context.drawImage(bitmap, 0, 0);
  bitmap.close();
  return { packed, atlas: context.getImageData(0, 0, canvas.width, canvas.height) };
}
