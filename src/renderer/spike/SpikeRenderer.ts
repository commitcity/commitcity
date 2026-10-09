import { Application, Container, Sprite, TextureSource } from "pixi.js";
import type { Orientation, TileSize } from "@/core/view";
import { buildingTexture, clearPlaceholderCache, groundTexture } from "./placeholders";
import { type SpikeScene, buildRenderList } from "./scene";

export interface SpikeSettings {
  scene: SpikeScene;
  orientation: Orientation;
  tile: TileSize;
}

export const MIN_ZOOM = 1;
export const MAX_ZOOM = 8;

/**
 * Renders a spike scene with PixiJS. The canvas is sized in device pixels and the
 * zoom is an integer number of device pixels per art pixel, so every art pixel maps
 * to a whole block of screen pixels on any display (ARCHITECTURE.md §7.3).
 */
export class SpikeRenderer {
  private readonly app = new Application();
  private readonly world = new Container();
  private readonly groundLayer = new Container();
  private readonly objectLayer = new Container();
  private settings: SpikeSettings | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private dpr = 1;
  private zoom = 2;
  /** Camera: screen position (device px) of the world origin. Always integers. */
  private camX = 0;
  private camY = 0;
  private autoPan = false;
  private autoPanTime = 0;
  private autoPanBase = { x: 0, y: 0 };
  private drag: { pointerId: number; x: number; y: number } | null = null;
  private destroyed = false;

  onZoomChange: (zoom: number) => void = () => {};

  async init(parent: HTMLElement) {
    TextureSource.defaultOptions.scaleMode = "nearest";
    this.dpr = window.devicePixelRatio || 1;
    this.zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.round(2 * this.dpr)));
    await this.app.init({
      width: 1,
      height: 1,
      resolution: 1,
      autoDensity: false,
      antialias: false,
      roundPixels: true,
      background: "#1b2632",
      preference: "webgl",
    });
    if (this.destroyed) {
      this.app.destroy(true);
      return;
    }
    const canvas = this.app.canvas;
    canvas.style.display = "block";
    canvas.style.imageRendering = "pixelated";
    canvas.style.touchAction = "none";
    parent.appendChild(canvas);

    this.world.addChild(this.groundLayer, this.objectLayer);
    this.app.stage.addChild(this.world);

    this.resizeObserver = new ResizeObserver(() => this.resize(parent));
    this.resizeObserver.observe(parent);
    this.resize(parent);

    canvas.addEventListener("pointerdown", this.onPointerDown);
    canvas.addEventListener("pointermove", this.onPointerMove);
    canvas.addEventListener("pointerup", this.onPointerUp);
    canvas.addEventListener("pointercancel", this.onPointerUp);
    canvas.addEventListener("wheel", this.onWheel, { passive: false });
    this.app.ticker.add(this.onTick);
  }

  get fps(): number {
    return this.app.ticker?.FPS ?? 0;
  }

  get spriteCount(): number {
    return this.groundLayer.children.length + this.objectLayer.children.length;
  }

  setSettings(settings: SpikeSettings) {
    const previous = this.settings;
    this.settings = settings;
    if (previous && previous.tile.width !== settings.tile.width) clearPlaceholderCache();
    this.rebuild(previous?.scene !== settings.scene || previous?.tile !== settings.tile);
  }

  setZoom(zoom: number, anchorX?: number, anchorY?: number) {
    const next = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.round(zoom)));
    if (next === this.zoom) return;
    const ax = anchorX ?? this.app.screen.width / 2;
    const ay = anchorY ?? this.app.screen.height / 2;
    // Keep the world point under the anchor fixed.
    this.camX = Math.round(ax - ((ax - this.camX) * next) / this.zoom);
    this.camY = Math.round(ay - ((ay - this.camY) * next) / this.zoom);
    this.zoom = next;
    this.autoPanBase = { x: this.camX, y: this.camY };
    this.applyCamera();
    this.onZoomChange(next);
  }

  getZoom() {
    return this.zoom;
  }

  setAutoPan(enabled: boolean) {
    this.autoPan = enabled;
    this.autoPanTime = 0;
    this.autoPanBase = { x: this.camX, y: this.camY };
  }

  destroy() {
    this.destroyed = true;
    this.resizeObserver?.disconnect();
    if (this.app.renderer) {
      const canvas = this.app.canvas;
      canvas.removeEventListener("pointerdown", this.onPointerDown);
      canvas.removeEventListener("pointermove", this.onPointerMove);
      canvas.removeEventListener("pointerup", this.onPointerUp);
      canvas.removeEventListener("pointercancel", this.onPointerUp);
      canvas.removeEventListener("wheel", this.onWheel);
      this.app.destroy(true, { children: true });
    }
    clearPlaceholderCache();
  }

  private rebuild(recenter: boolean) {
    if (!this.settings || !this.app.renderer) return;
    const { scene, orientation, tile } = this.settings;
    const list = buildRenderList(scene, orientation, tile);

    this.groundLayer.removeChildren().forEach((c) => c.destroy());
    this.objectLayer.removeChildren().forEach((c) => c.destroy());

    for (const g of list.ground) {
      const sprite = new Sprite(groundTexture(g.kind, tile));
      sprite.x = g.screenX - tile.width / 2;
      sprite.y = g.screenY;
      this.groundLayer.addChild(sprite);
    }
    for (const b of list.buildings) {
      const sprite = new Sprite(buildingTexture(b.size, b.heightPx, b.leftSide, b.rightSide, tile));
      // Bottom-center anchor, applied in whole pixels.
      sprite.x = b.anchorX - sprite.texture.width / 2;
      sprite.y = b.anchorY - sprite.texture.height;
      this.objectLayer.addChild(sprite);
    }

    // Keep the scene center on screen when rotating; recenter fully on scene change.
    if (recenter || !this.autoPan) {
      this.camX = Math.round(this.app.screen.width / 2 - list.centerX * this.zoom);
      this.camY = Math.round(this.app.screen.height / 2 - list.centerY * this.zoom);
      this.autoPanBase = { x: this.camX, y: this.camY };
    }
    this.applyCamera();
  }

  private resize(parent: HTMLElement) {
    if (!this.app.renderer) return;
    const rect = parent.getBoundingClientRect();
    const width = Math.max(1, Math.round(rect.width * this.dpr));
    const height = Math.max(1, Math.round(rect.height * this.dpr));
    this.app.renderer.resize(width, height);
    this.app.canvas.style.width = `${width / this.dpr}px`;
    this.app.canvas.style.height = `${height / this.dpr}px`;
    this.applyCamera();
  }

  private applyCamera() {
    this.world.scale.set(this.zoom);
    this.world.position.set(Math.round(this.camX), Math.round(this.camY));
  }

  private readonly onTick = () => {
    if (!this.autoPan) return;
    this.autoPanTime += this.app.ticker.deltaMS / 1000;
    const radius = 200 * this.dpr;
    this.camX = Math.round(this.autoPanBase.x + Math.cos(this.autoPanTime) * radius);
    this.camY = Math.round(this.autoPanBase.y + Math.sin(this.autoPanTime) * radius * 0.5);
    this.applyCamera();
  };

  private readonly onPointerDown = (e: PointerEvent) => {
    this.drag = { pointerId: e.pointerId, x: e.clientX, y: e.clientY };
    this.app.canvas.setPointerCapture(e.pointerId);
  };

  private readonly onPointerMove = (e: PointerEvent) => {
    if (!this.drag || e.pointerId !== this.drag.pointerId) return;
    this.camX += Math.round((e.clientX - this.drag.x) * this.dpr);
    this.camY += Math.round((e.clientY - this.drag.y) * this.dpr);
    this.drag = { pointerId: e.pointerId, x: e.clientX, y: e.clientY };
    this.autoPanBase = { x: this.camX, y: this.camY };
    this.applyCamera();
  };

  private readonly onPointerUp = (e: PointerEvent) => {
    if (this.drag?.pointerId === e.pointerId) this.drag = null;
  };

  private readonly onWheel = (e: WheelEvent) => {
    e.preventDefault();
    const rect = this.app.canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) * this.dpr;
    const y = (e.clientY - rect.top) * this.dpr;
    this.setZoom(this.zoom + (e.deltaY < 0 ? 1 : -1), x, y);
  };
}
