import type { CityModel } from "@/core/model";
import { type DepthItem, sortByDepth } from "./depth";
import { rotateFootprint, rotateSide, rotateTile } from "./orientation";
import { footprintAnchor, worldToScreen } from "./projection";
import type { Footprint, Orientation, Side, TileSize } from "./types";

/** One sprite to draw (ARCHITECTURE.md §4.4). Lists are already in draw order. */
export interface RenderItem {
  layer: "ground" | "road" | "object";
  /** Which texture to draw; see the key helpers below for the formats. */
  textureKey: string;
  /**
   * Integer screen pixels at 1×. Ground and road items: the tile's top vertex.
   * Objects: the footprint's front vertex, where the sprite's bottom-center goes.
   */
  screenX: number;
  screenY: number;
  /** Draw order within the layer, from back to front. */
  depth: number;
  /** Repository id for hit testing; buildings only. */
  pickId?: string;
}

export interface RenderList {
  ground: RenderItem[];
  roads: RenderItem[];
  objects: RenderItem[];
}

/** Neighbor bits in view space: 1 = +x, 2 = +y, 4 = -x, 8 = -y (same order as `Side`). */
export type RoadMask = number;

const SIDE_OFFSETS: readonly { x: number; y: number }[] = [
  { x: 1, y: 0 },
  { x: 0, y: 1 },
  { x: -1, y: 0 },
  { x: 0, y: -1 },
];

/**
 * CityModel + orientation → sorted render list. Pure: the renderer only creates
 * sprites for these items and never sorts or projects anything itself.
 */
export function buildRenderList(
  model: CityModel,
  orientation: Orientation,
  tile: TileSize,
): RenderList {
  const flat = <T extends { x: number; y: number }>(items: readonly T[]) =>
    items
      .map((item) => ({ item, view: rotateTile(item, orientation) }))
      .sort((a, b) => a.view.y - b.view.y || a.view.x - b.view.x);

  const ground = flat(model.ground).map(({ item, view }, depth): RenderItem => {
    const screen = worldToScreen(view, tile);
    return {
      layer: "ground",
      textureKey: `ground/${item.kind}/${item.variant}`,
      screenX: screen.x,
      screenY: screen.y,
      depth,
    };
  });

  const roadTiles = flat(model.roads);
  const roadSet = new Set(roadTiles.map(({ view }) => `${view.x},${view.y}`));
  const roads = roadTiles.map(({ view }, depth): RenderItem => {
    const screen = worldToScreen(view, tile);
    return {
      layer: "road",
      textureKey: roadKey(roadMask(view, roadSet)),
      screenX: screen.x,
      screenY: screen.y,
      depth,
    };
  });

  interface ObjectEntry extends DepthItem {
    textureKey: string;
    pickId?: string;
  }
  const entries: ObjectEntry[] = [
    ...model.buildings.map((b): ObjectEntry => ({
      id: `b:${b.repoId}`,
      footprint: rotateFootprint({ ...b.origin, size: b.footprint }, orientation),
      textureKey: buildingKey({
        manifestId: b.manifestId,
        view: rotateSide(b.facing, orientation),
        variant: b.variant,
        level: b.level,
      }),
      pickId: b.repoId,
    })),
    ...model.decorations.map((d): ObjectEntry => ({
      id: `d:${d.x},${d.y}`,
      footprint: rotateFootprint({ x: d.x, y: d.y, size: 1 }, orientation),
      textureKey: `decoration/${d.kind}/${d.variant}`,
    })),
  ];
  const objects = sortByDepth(entries).map((entry, depth): RenderItem => {
    const anchor = footprintAnchor(entry.footprint as Footprint, tile);
    const item: RenderItem = {
      layer: "object",
      textureKey: entry.textureKey,
      screenX: anchor.x,
      screenY: anchor.y,
      depth,
    };
    if (entry.pickId !== undefined) item.pickId = entry.pickId;
    return item;
  });

  return { ground, roads, objects };
}

/** Which of the four view-space neighbors are also roads. */
export function roadMask(view: { x: number; y: number }, roads: ReadonlySet<string>): RoadMask {
  let mask = 0;
  SIDE_OFFSETS.forEach((offset, side) => {
    if (roads.has(`${view.x + offset.x},${view.y + offset.y}`)) mask |= 1 << side;
  });
  return mask;
}

export function roadKey(mask: RoadMask): string {
  return `road/${mask}`;
}

export interface BuildingKey {
  manifestId: string;
  /** View of the sprite: the facing side in view space (ART_DIRECTION.md §8). */
  view: Side;
  variant: string;
  level: number;
}

/** `building/<manifestId>/view-<view>/<variant>/level-<level>` */
export function buildingKey(key: BuildingKey): string {
  return `building/${key.manifestId}/view-${key.view}/${key.variant}/level-${key.level}`;
}

export function parseBuildingKey(textureKey: string): BuildingKey | null {
  const match = /^building\/([^/]+)\/view-([0-3])\/([^/]+)\/level-(\d+)$/.exec(textureKey);
  if (!match) return null;
  return {
    manifestId: match[1]!,
    view: Number(match[2]) as Side,
    variant: match[3]!,
    level: Number(match[4]),
  };
}
