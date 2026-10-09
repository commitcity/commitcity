import { Sprite } from "pixi.js";
import type { AssetCatalog } from "@/core/assets";
import type { CityModel } from "@/core/model";
import {
  type Orientation,
  type TileSize,
  buildRenderList,
  rotatePoint,
  worldToScreen,
} from "@/core/view";
import { PixelStage } from "../stage";
import { CityPlaceholders } from "./placeholders";

export interface CityScene {
  model: CityModel;
  catalog: AssetCatalog;
  orientation: Orientation;
  tile: TileSize;
}

/** Draws a generated city from its render list (ARCHITECTURE.md §7.1). */
export class CityRenderer {
  private readonly stage = new PixelStage();
  private placeholders: CityPlaceholders | null = null;
  private scene: CityScene | null = null;

  set onZoomChange(handler: (zoom: number) => void) {
    this.stage.onZoomChange = handler;
  }

  async init(parent: HTMLElement): Promise<boolean> {
    return this.stage.init(parent);
  }

  get fps(): number {
    return this.stage.fps;
  }

  get spriteCount(): number {
    return this.stage.spriteCount;
  }

  getZoom() {
    return this.stage.getZoom();
  }

  setZoom(zoom: number) {
    this.stage.setZoom(zoom);
  }

  setScene(scene: CityScene) {
    if (!this.stage.ready) return;
    const previous = this.scene;
    this.scene = scene;
    if (!this.placeholders || previous?.catalog !== scene.catalog || previous.tile !== scene.tile) {
      this.placeholders?.destroy();
      this.placeholders = new CityPlaceholders(scene.catalog, scene.tile);
    }
    const textures = this.placeholders;
    const { tile } = scene;
    const list = buildRenderList(scene.model, scene.orientation, tile);

    this.stage.clear();
    for (const item of list.ground) {
      const sprite = new Sprite(textures.texture(item.textureKey));
      sprite.position.set(item.screenX - tile.width / 2, item.screenY);
      this.stage.groundLayer.addChild(sprite);
    }
    for (const item of list.roads) {
      const sprite = new Sprite(textures.texture(item.textureKey));
      sprite.position.set(item.screenX - tile.width / 2, item.screenY);
      this.stage.roadLayer.addChild(sprite);
    }
    for (const item of list.objects) {
      const sprite = new Sprite(textures.texture(item.textureKey));
      // Bottom-center anchor at the footprint's front vertex, in whole pixels.
      sprite.position.set(
        item.screenX - sprite.texture.width / 2,
        item.screenY - sprite.texture.height,
      );
      this.stage.objectLayer.addChild(sprite);
    }

    const { minX, minY, maxX, maxY } = scene.model.bounds;
    const center = worldToScreen(
      rotatePoint({ x: (minX + maxX + 1) / 2, y: (minY + maxY + 1) / 2 }, scene.orientation),
      tile,
    );
    // Rotating keeps the city centered; a different city recenters too.
    this.stage.centerOn(Math.round(center.x), Math.round(center.y));
  }

  destroy() {
    this.stage.destroy();
    this.placeholders?.destroy();
  }
}
