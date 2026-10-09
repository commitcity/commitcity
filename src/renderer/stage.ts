import { Application, Container, TextureSource } from "pixi.js";

export const MIN_ZOOM = 1;
export const MAX_ZOOM = 8;

/** How far (CSS px) a press may move and still count as a tap. */
const TAP_SLOP = 6;
/** Accumulated wheel delta (px) per zoom step. */
const WHEEL_STEP = 60;

/**
 * A PixiJS canvas with a pixel-perfect camera, shared by every renderer. The
 * canvas is sized in device pixels and the zoom is a whole number of device pixels
 * per art pixel, so art pixels stay square on any display (ARCHITECTURE.md §7.3).
 * Drag pans, the wheel or a pinch zooms around the pointer, and the camera is
 * always rounded to whole device pixels. A press that barely moves is a tap.
 */
export class PixelStage {
  readonly groundLayer = new Container();
  readonly roadLayer = new Container();
  readonly objectLayer = new Container();
  /** Hover and selection outlines, above everything else (ARCHITECTURE.md §7.1). */
  readonly overlayLayer = new Container();
  onZoomChange: (zoom: number) => void = () => {};
  /** A tap or click, in 1× world pixels. */
  onTap: (x: number, y: number) => void = () => {};
  /** The mouse moved over the canvas (1× world pixels), or left it (null). Not for touch. */
  onHover: (point: { x: number; y: number } | null) => void = () => {};

  private readonly app = new Application();
  private readonly world = new Container();
  private resizeObserver: ResizeObserver | null = null;
  private dpr = 1;
  private zoom = 2;
  /** Screen position (device px) of the world origin. Always integers. */
  private camX = 0;
  private camY = 0;
  private autoPan = false;
  private autoPanTime = 0;
  private autoPanBase = { x: 0, y: 0 };
  /** Moves a 1× world point at the canvas center to the nearest allowed one. */
  private clampCenter: ((p: { x: number; y: number }) => { x: number; y: number }) | null = null;
  /** Pointers currently pressed, in client (CSS) pixels. */
  private readonly pointers = new Map<number, { x: number; y: number }>();
  /** The press that may still become a tap: where it started, and whether it moved too far. */
  private press: { pointerId: number; x: number; y: number; moved: boolean } | null = null;
  private pinch: { distance: number; zoom: number } | null = null;
  private wheelDelta = 0;
  private destroyed = false;

  /** Resolves to false if the stage was destroyed while starting. */
  async init(parent: HTMLElement): Promise<boolean> {
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
      return false;
    }
    const canvas = this.app.canvas;
    canvas.style.display = "block";
    canvas.style.imageRendering = "pixelated";
    canvas.style.touchAction = "none";
    parent.appendChild(canvas);

    this.world.addChild(this.groundLayer, this.roadLayer, this.objectLayer, this.overlayLayer);
    this.app.stage.addChild(this.world);

    this.resizeObserver = new ResizeObserver(() => this.resize(parent));
    this.resizeObserver.observe(parent);
    this.resize(parent);

    canvas.addEventListener("pointerdown", this.onPointerDown);
    canvas.addEventListener("pointermove", this.onPointerMove);
    canvas.addEventListener("pointerup", this.onPointerUp);
    canvas.addEventListener("pointercancel", this.onPointerUp);
    canvas.addEventListener("pointerleave", this.onPointerLeave);
    canvas.addEventListener("wheel", this.onWheel, { passive: false });
    this.app.ticker.add(this.onTick);
    return true;
  }

  get ready(): boolean {
    return !this.destroyed && Boolean(this.app.renderer);
  }

  get fps(): number {
    return this.app.ticker?.FPS ?? 0;
  }

  get spriteCount(): number {
    return (
      this.groundLayer.children.length +
      this.roadLayer.children.length +
      this.objectLayer.children.length
    );
  }

  getZoom(): number {
    return this.zoom;
  }

  /** Removes and destroys every sprite (textures are owned by their caches). */
  clear() {
    for (const layer of [this.groundLayer, this.roadLayer, this.objectLayer, this.overlayLayer]) {
      layer.removeChildren().forEach((c) => c.destroy());
    }
  }

  /** Puts a 1× screen point at the center of the canvas. */
  centerOn(x: number, y: number) {
    this.camX = Math.round(this.app.screen.width / 2 - x * this.zoom);
    this.camY = Math.round(this.app.screen.height / 2 - y * this.zoom);
    this.autoPanBase = { x: this.camX, y: this.camY };
    this.applyCamera();
  }

  /**
   * Camera bounds: `clamp` maps the world point (1× pixels) under the canvas center
   * to the nearest point the center may show. Null lets the camera go anywhere.
   */
  setCenterClamp(clamp: ((p: { x: number; y: number }) => { x: number; y: number }) | null) {
    this.clampCenter = clamp;
    this.applyCamera();
  }

  /** Moves the view by a distance in CSS pixels. */
  panBy(dx: number, dy: number) {
    this.camX += Math.round(dx * this.dpr);
    this.camY += Math.round(dy * this.dpr);
    this.applyCamera();
  }

  setCursor(cursor: string) {
    if (this.app.renderer) this.app.canvas.style.cursor = cursor;
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

  setAutoPan(enabled: boolean) {
    this.autoPan = enabled;
    this.autoPanTime = 0;
    this.autoPanBase = { x: this.camX, y: this.camY };
  }

  isAutoPanning(): boolean {
    return this.autoPan;
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
      canvas.removeEventListener("pointerleave", this.onPointerLeave);
      canvas.removeEventListener("wheel", this.onWheel);
      this.app.destroy(true, { children: true });
    }
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
    if (this.clampCenter && this.app.renderer) {
      const cx = this.app.screen.width / 2;
      const cy = this.app.screen.height / 2;
      const center = { x: (cx - this.camX) / this.zoom, y: (cy - this.camY) / this.zoom };
      const allowed = this.clampCenter(center);
      if (allowed.x !== center.x || allowed.y !== center.y) {
        this.camX = Math.round(cx - allowed.x * this.zoom);
        this.camY = Math.round(cy - allowed.y * this.zoom);
        this.autoPanBase = { x: this.camX, y: this.camY };
      }
    }
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

  /** Client (CSS) coordinates to device pixels on the canvas. */
  private toCanvas(clientX: number, clientY: number) {
    const rect = this.app.canvas.getBoundingClientRect();
    return { x: (clientX - rect.left) * this.dpr, y: (clientY - rect.top) * this.dpr };
  }

  /** Client (CSS) coordinates to 1× world pixels. */
  private toWorld(clientX: number, clientY: number) {
    const p = this.toCanvas(clientX, clientY);
    return { x: (p.x - this.camX) / this.zoom, y: (p.y - this.camY) / this.zoom };
  }

  private pinchState() {
    const [a, b] = [...this.pointers.values()];
    if (!a || !b) return null;
    return {
      distance: Math.hypot(a.x - b.x, a.y - b.y),
      center: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
    };
  }

  private readonly onPointerDown = (e: PointerEvent) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    // Dragging the canvas must not select the page's text.
    e.preventDefault();
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    this.app.canvas.setPointerCapture(e.pointerId);
    if (this.pointers.size === 1) {
      this.press = { pointerId: e.pointerId, x: e.clientX, y: e.clientY, moved: false };
    } else {
      // A second finger turns the gesture into a pinch; it is no longer a tap.
      this.press = null;
      const state = this.pinchState();
      if (state) this.pinch = { distance: state.distance, zoom: this.zoom };
    }
  };

  private readonly onPointerMove = (e: PointerEvent) => {
    const last = this.pointers.get(e.pointerId);
    if (!last) {
      if (e.pointerType === "mouse") this.onHover(this.toWorld(e.clientX, e.clientY));
      return;
    }
    const before = this.pinchState();
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (this.press?.pointerId === e.pointerId) {
      const far = Math.hypot(e.clientX - this.press.x, e.clientY - this.press.y) > TAP_SLOP;
      if (far) this.press.moved = true;
      if (!this.press.moved) return;
    }

    if (this.pinch && before) {
      const after = this.pinchState()!;
      // Pan with the midpoint, then zoom one step at a time as the fingers spread.
      this.panBy(after.center.x - before.center.x, after.center.y - before.center.y);
      const steps = Math.round(Math.log2(after.distance / this.pinch.distance) * 2);
      const anchor = this.toCanvas(after.center.x, after.center.y);
      this.setZoom(this.pinch.zoom + steps, anchor.x, anchor.y);
      return;
    }
    if (this.pointers.size === 1) this.panBy(e.clientX - last.x, e.clientY - last.y);
  };

  private readonly onPointerUp = (e: PointerEvent) => {
    if (!this.pointers.delete(e.pointerId)) return;
    if (this.pointers.size < 2) this.pinch = null;
    const press = this.press;
    if (press?.pointerId === e.pointerId) {
      this.press = null;
      if (!press.moved && e.type === "pointerup") {
        const p = this.toWorld(e.clientX, e.clientY);
        this.onTap(p.x, p.y);
      }
    }
  };

  private readonly onPointerLeave = (e: PointerEvent) => {
    if (e.pointerType === "mouse" && this.pointers.size === 0) this.onHover(null);
  };

  private readonly onWheel = (e: WheelEvent) => {
    e.preventDefault();
    // A mouse wheel notch is about 100 px; a trackpad sends many small deltas, and
    // a trackpad pinch arrives as small wheel deltas with ctrlKey. Accumulate them
    // so both zoom one integer step at a time.
    const scale = e.deltaMode === 1 ? 33 : e.deltaMode === 2 ? 400 : 1;
    this.wheelDelta += e.deltaY * scale * (e.ctrlKey ? 4 : 1);
    if (Math.abs(this.wheelDelta) < WHEEL_STEP) return;
    const step = this.wheelDelta < 0 ? 1 : -1;
    this.wheelDelta = 0;
    const p = this.toCanvas(e.clientX, e.clientY);
    this.setZoom(this.zoom + step, p.x, p.y);
  };
}
