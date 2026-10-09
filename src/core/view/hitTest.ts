import type { RenderItem } from "./renderList";

/** Which pixels of a sprite are solid. Art has hard alpha (ART_DIRECTION.md), so 0 or 1. */
export interface HitMask {
  readonly width: number;
  readonly height: number;
  /** Row-major, one byte per pixel: 1 = opaque. */
  readonly opaque: Uint8Array;
}

/**
 * Top-left corner, in 1× screen pixels, of an object sprite of the given size: its
 * bottom-center sits on the item's anchor. Whole pixels, so the renderer and hit
 * testing always agree on where every pixel is.
 */
export function spriteOrigin(
  item: Pick<RenderItem, "screenX" | "screenY">,
  width: number,
  height: number,
): { x: number; y: number } {
  return { x: item.screenX - Math.floor(width / 2), y: item.screenY - height };
}

/**
 * The `pickId` of the front-most pickable object with an opaque pixel under
 * `point` (1× screen pixels), or null. `objects` is in draw order (back to front),
 * as `buildRenderList` returns it (ARCHITECTURE.md §7.4). Items without a `pickId`,
 * such as trees, are ignored: a click on a tree reaches the building behind it.
 */
export function pickAt(
  objects: readonly RenderItem[],
  point: { x: number; y: number },
  maskFor: (textureKey: string) => HitMask | undefined,
): string | null {
  for (let i = objects.length - 1; i >= 0; i--) {
    const item = objects[i]!;
    if (item.pickId === undefined) continue;
    const mask = maskFor(item.textureKey);
    if (!mask) continue;
    const origin = spriteOrigin(item, mask.width, mask.height);
    const px = Math.floor(point.x - origin.x);
    const py = Math.floor(point.y - origin.y);
    if (px < 0 || py < 0 || px >= mask.width || py >= mask.height) continue;
    if (mask.opaque[py * mask.width + px]) return item.pickId;
  }
  return null;
}
