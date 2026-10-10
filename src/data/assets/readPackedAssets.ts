import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { PackedAssets } from "@/core/assets";
import type { Raster } from "@/core/raster";
import { decodePng } from "./png";

/** The packed assets as read on the server: catalog plus atlas pixels. */
export interface ServerAssets {
  packed: PackedAssets;
  /** Null when there are no sprites yet. */
  atlas: Raster | null;
}

/**
 * Reads the catalog and atlas written by `pnpm pack-assets` from
 * `public/generated/assets`. Resolves to null when they do not exist.
 */
export async function readPackedAssets(): Promise<ServerAssets | null> {
  // Spelled out in each call, so build tracing sees which folder is read.
  let packed: PackedAssets;
  try {
    packed = JSON.parse(
      await readFile(join(process.cwd(), "public/generated/assets/catalog.json"), "utf8"),
    ) as PackedAssets;
  } catch {
    return null;
  }
  if (Object.keys(packed.frames).length === 0) return { packed, atlas: null };
  return {
    packed,
    atlas: decodePng(await readFile(join(process.cwd(), "public/generated/assets", packed.image))),
  };
}
