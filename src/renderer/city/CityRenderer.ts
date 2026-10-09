import { Sprite } from "pixi.js";
import type { AssetCatalog } from "@/core/assets";
import type { CityModel } from "@/core/model";
import {
  type Orientation,
  type RenderItem,
  type TileSize,
  buildRenderList,
  pickAt,
  rotatePoint,
  screenToWorld,
  spriteOrigin,
  worldToScreen,
} from "@/core/view";
import type { Rgb } from "../pixels";
import { PixelStage } from "../stage";
import type { LoadedAssets } from "./loadAssets";
import { CityTextures } from "./textures";

export interface CityScene {
  model: CityModel;
  catalog: AssetCatalog;
  orientation: Orientation;
  tile: TileSize;
  /** Artist sprites; null draws placeholders only. */
  assets: LoadedAssets | null;
}

const HOVER_COLOR: Rgb = [255, 255, 255];
const SELECTED_COLOR: Rgb = [255, 214, 64];

/**
 * Draws a generated city from its render list (ARCHITECTURE.md §7.1) and reports
 * hover and taps on buildings, hit-tested against their pixels (§7.4).
 */
export class CityRenderer {
  private readonly stage = new PixelStage();
  private textures: CityTextures | null = null;
  private scene: CityScene | null = null;
  private objects: RenderItem[] = [];
  private hovered: string | null = null;
  private selected: string | null = null;

  /** The repository under the mouse changed (null when none). */
  onHoverChange: (repoId: string | null) => void = () => {};
  /** A building was tapped or clicked (null when empty space was). */
  onTap: (repoId: string | null) => void = () => {};

  set onZoomChange(handler: (zoom: number) => void) {
    this.stage.onZoomChange = handler;
  }

  async init(parent: HTMLElement): Promise<boolean> {
    this.stage.onTap = (x, y) => this.onTap(this.pick(x, y));
    this.stage.onHover = (point) => {
      const repoId = point ? this.pick(point.x, point.y) : null;
      if (repoId === this.hovered) return;
      this.hovered = repoId;
      this.stage.setCursor(repoId ? "pointer" : "");
      this.drawOverlay();
      this.onHoverChange(repoId);
    };
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

  panBy(dx: number, dy: number) {
    this.stage.panBy(dx, dy);
  }

  /** Outlines the selected building (null clears it). Does not move the camera. */
  setSelected(repoId: string | null) {
    this.selected = repoId;
    this.drawOverlay();
  }

  /** Centers the camera on a building's sprite. */
  focus(repoId: string) {
    const item = this.objects.find((o) => o.pickId === repoId);
    if (!item || !this.textures) return;
    const { width, height } = this.textures.mask(item.textureKey);
    const origin = spriteOrigin(item, width, height);
    this.stage.centerOn(origin.x + Math.floor(width / 2), origin.y + Math.floor(height / 2));
  }

  /** The building with a visible pixel at a 1× world point, if any. */
  pick(x: number, y: number): string | null {
    const textures = this.textures;
    if (!textures) return null;
    return pickAt(this.objects, { x, y }, (key) => textures.mask(key));
  }

  setScene(scene: CityScene) {
    if (!this.stage.ready) return;
    const previous = this.scene;
    this.scene = scene;
    // Sprites go first: they reference the textures that may be replaced below.
    this.stage.clear();
    if (
      !this.textures ||
      previous?.catalog !== scene.catalog ||
      previous.tile !== scene.tile ||
      previous.assets !== scene.assets
    ) {
      this.textures?.destroy();
      this.textures = new CityTextures(scene.catalog, scene.tile, scene.assets);
    }
    const textures = this.textures;
    const { tile } = scene;
    const list = buildRenderList(scene.model, scene.orientation, tile);

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
      const origin = spriteOrigin(item, sprite.texture.width, sprite.texture.height);
      sprite.position.set(origin.x, origin.y);
      this.stage.objectLayer.addChild(sprite);
    }
    this.objects = list.objects;
    this.drawOverlay();

    const { minX, minY, maxX, maxY } = scene.model.bounds;
    const center = worldToScreen(
      rotatePoint({ x: (minX + maxX + 1) / 2, y: (minY + maxY + 1) / 2 }, scene.orientation),
      tile,
    );
    // Rotating keeps the city centered; a different city recenters too.
    this.stage.centerOn(Math.round(center.x), Math.round(center.y));
    this.stage.setCenterClamp(groundClamp(scene));
    // The old hover target may now be anywhere; the next mouse move picks again.
    if (this.hovered !== null) {
      this.hovered = null;
      this.stage.setCursor("");
      this.drawOverlay();
      this.onHoverChange(null);
    }
  }

  /** Redraws the hover and selection outlines; the selection wins when both apply. */
  private drawOverlay() {
    const layer = this.stage.overlayLayer;
    layer.removeChildren().forEach((c) => c.destroy());
    const textures = this.textures;
    if (!textures) return;
    const outlines: [string | null, Rgb][] = [
      [this.hovered !== this.selected ? this.hovered : null, HOVER_COLOR],
      [this.selected, SELECTED_COLOR],
    ];
    for (const [repoId, color] of outlines) {
      const item = repoId && this.objects.find((o) => o.pickId === repoId);
      if (!item) continue;
      const { width, height } = textures.mask(item.textureKey);
      const origin = spriteOrigin(item, width, height);
      const sprite = new Sprite(textures.outline(item.textureKey, color));
      sprite.position.set(origin.x - 1, origin.y - 1);
      layer.addChild(sprite);
    }
  }

  destroy() {
    this.stage.destroy();
    this.textures?.destroy();
  }
}

/**
 * Keeps the canvas center over the ground diamond: the center is clamped in view
 * tile space, where the ground is a rectangle, so the city can never leave the view.
 */
function groundClamp({ model, orientation, tile }: CityScene) {
  const { minX, minY, maxX, maxY } = model.bounds;
  const a = rotatePoint({ x: minX, y: minY }, orientation);
  const b = rotatePoint({ x: maxX + 1, y: maxY + 1 }, orientation);
  const lo = { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y) };
  const hi = { x: Math.max(a.x, b.x), y: Math.max(a.y, b.y) };
  return (point: { x: number; y: number }) => {
    const view = screenToWorld(point, tile);
    const x = Math.min(hi.x, Math.max(lo.x, view.x));
    const y = Math.min(hi.y, Math.max(lo.y, view.y));
    return x === view.x && y === view.y ? point : worldToScreen({ x, y }, tile);
  };
}
