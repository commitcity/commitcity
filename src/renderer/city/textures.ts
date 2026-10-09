import type { Texture } from "pixi.js";
import type { AssetCatalog } from "@/core/assets";
import type { HitMask, TileSize } from "@/core/view";
import { type Rgb, outlineOf } from "../pixels";
import { AtlasTextures } from "./assets";
import type { LoadedAssets } from "./loadAssets";
import { CityPlaceholders } from "./placeholders";

/**
 * Every texture the city needs: artist sprites from the atlas when one exists for
 * a key, code-drawn placeholders otherwise, so nothing ever disappears.
 */
export class CityTextures {
  private readonly placeholders: CityPlaceholders;
  private readonly atlas: AtlasTextures | null;
  private readonly outlines = new Map<string, Texture>();

  constructor(catalog: AssetCatalog, tile: TileSize, assets: LoadedAssets | null) {
    this.placeholders = new CityPlaceholders(catalog, tile);
    this.atlas = assets ? new AtlasTextures(assets) : null;
  }

  texture(textureKey: string): Texture {
    return this.atlas?.texture(textureKey) ?? this.placeholders.texture(textureKey);
  }

  /** Opaque pixels of the texture, for hit testing. */
  mask(textureKey: string): HitMask {
    return this.atlas?.mask(textureKey) ?? this.placeholders.mask(textureKey);
  }

  /** A 1 px outline of the texture's shape, drawn one pixel up and left of it. */
  outline(textureKey: string, color: Rgb): Texture {
    const key = `${textureKey}|${color.join(",")}`;
    let texture = this.outlines.get(key);
    if (!texture) {
      texture = outlineOf(this.mask(textureKey), color).toTexture();
      this.outlines.set(key, texture);
    }
    return texture;
  }

  destroy() {
    for (const texture of this.outlines.values()) texture.destroy(true);
    this.outlines.clear();
    this.placeholders.destroy();
    this.atlas?.destroy();
  }
}
