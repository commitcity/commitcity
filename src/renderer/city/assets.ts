import { Rectangle, Texture } from "pixi.js";
import { frameKey, resolveView } from "@/core/assets";
import { type HitMask, parseBuildingKey } from "@/core/view";
import type { LoadedAssets } from "./loadAssets";

/** Building textures and hit masks cut from the atlas. */
export class AtlasTextures {
  private readonly source: Texture | null;
  private readonly manifests;
  private readonly textures = new Map<string, Texture>();
  private readonly masks = new Map<string, HitMask>();

  constructor(private readonly assets: LoadedAssets) {
    this.manifests = new Map(assets.packed.buildings.map((m) => [m.id, m]));
    if (assets.atlas) {
      const canvas = document.createElement("canvas");
      canvas.width = assets.atlas.width;
      canvas.height = assets.atlas.height;
      canvas.getContext("2d")!.putImageData(assets.atlas, 0, 0);
      this.source = Texture.from(canvas);
      this.source.source.scaleMode = "nearest";
    } else {
      this.source = null;
    }
  }

  /** The atlas texture for a render-list key, or undefined if the atlas lacks it. */
  texture(textureKey: string): Texture | undefined {
    const frame = this.frame(textureKey);
    if (!frame || !this.source) return undefined;
    let texture = this.textures.get(frame.key);
    if (!texture) {
      const { x, y, width, height } = frame;
      texture = new Texture({
        source: this.source.source,
        frame: new Rectangle(x, y, width, height),
      });
      this.textures.set(frame.key, texture);
    }
    return texture;
  }

  mask(textureKey: string): HitMask | undefined {
    const frame = this.frame(textureKey);
    const atlas = this.assets.atlas;
    if (!frame || !atlas) return undefined;
    let mask = this.masks.get(frame.key);
    if (!mask) {
      const { x, y, width, height } = frame;
      const opaque = new Uint8Array(width * height);
      for (let row = 0; row < height; row++)
        for (let col = 0; col < width; col++)
          opaque[row * width + col] =
            atlas.data[((y + row) * atlas.width + x + col) * 4 + 3]! > 0 ? 1 : 0;
      mask = { width, height, opaque };
      this.masks.set(frame.key, mask);
    }
    return mask;
  }

  destroy() {
    for (const texture of this.textures.values()) texture.destroy();
    this.textures.clear();
    this.source?.destroy(true);
  }

  /**
   * Building keys map to a frame by manifest, nearest view and variant (levels
   * share one drawing); ground, road and decoration keys are frame keys already.
   */
  private frame(textureKey: string) {
    const building = parseBuildingKey(textureKey);
    let key = textureKey;
    if (building) {
      const manifest = this.manifests.get(building.manifestId);
      if (!manifest) return undefined;
      key = frameKey(manifest.id, resolveView(manifest, building.view), building.variant as never);
    }
    const frame = this.assets.packed.frames[key];
    return frame && { key, ...frame };
  }
}
