import { Sprite } from "pixi.js";
import type { Orientation, TileSize } from "@/core/view";
import { PixelStage } from "../stage";
import { buildingTexture, clearPlaceholderCache, groundTexture } from "./placeholders";
import { type SpikeScene, buildRenderList } from "./scene";

export { MAX_ZOOM, MIN_ZOOM } from "../stage";

export interface SpikeSettings {
  scene: SpikeScene;
  orientation: Orientation;
  tile: TileSize;
}

/** Renders a milestone 1.1 spike scene. */
export class SpikeRenderer {
  private readonly stage = new PixelStage();
  private settings: SpikeSettings | null = null;

  set onZoomChange(handler: (zoom: number) => void) {
    this.stage.onZoomChange = handler;
  }

  async init(parent: HTMLElement) {
    await this.stage.init(parent);
  }

  get fps(): number {
    return this.stage.fps;
  }

  get spriteCount(): number {
    return this.stage.spriteCount;
  }

  setSettings(settings: SpikeSettings) {
    const previous = this.settings;
    this.settings = settings;
    if (previous && previous.tile.width !== settings.tile.width) clearPlaceholderCache();
    this.rebuild(previous?.scene !== settings.scene || previous?.tile !== settings.tile);
  }

  setZoom(zoom: number) {
    this.stage.setZoom(zoom);
  }

  getZoom() {
    return this.stage.getZoom();
  }

  setAutoPan(enabled: boolean) {
    this.stage.setAutoPan(enabled);
  }

  destroy() {
    this.stage.destroy();
    clearPlaceholderCache();
  }

  private rebuild(recenter: boolean) {
    if (!this.settings || !this.stage.ready) return;
    const { scene, orientation, tile } = this.settings;
    const list = buildRenderList(scene, orientation, tile);
    this.stage.clear();

    for (const g of list.ground) {
      const sprite = new Sprite(groundTexture(g.kind, tile));
      sprite.x = g.screenX - tile.width / 2;
      sprite.y = g.screenY;
      this.stage.groundLayer.addChild(sprite);
    }
    for (const b of list.buildings) {
      const sprite = new Sprite(buildingTexture(b.size, b.heightPx, b.leftSide, b.rightSide, tile));
      // Bottom-center anchor, applied in whole pixels.
      sprite.x = b.anchorX - sprite.texture.width / 2;
      sprite.y = b.anchorY - sprite.texture.height;
      this.stage.objectLayer.addChild(sprite);
    }

    // Keep the scene center on screen when rotating; recenter fully on scene change.
    if (recenter || !this.stage.isAutoPanning()) this.stage.centerOn(list.centerX, list.centerY);
  }
}
