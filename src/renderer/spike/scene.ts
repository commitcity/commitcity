import {
  type Footprint,
  type Orientation,
  type Side,
  type TileSize,
  footprintAnchor,
  inverseOrientation,
  rotateFootprint,
  rotatePoint,
  rotateSide,
  rotateTile,
  sortByDepth,
  worldToScreen,
} from "@/core/view";

/** A hand-written or generated test scene. Not the real CityModel. */
export interface SpikeScene {
  name: string;
  size: number;
  roads: [number, number][];
  buildings: SpikeBuilding[];
}

export interface SpikeBuilding {
  id: string;
  x: number;
  y: number;
  size: number;
  storeys: number;
}

export interface GroundItem {
  kind: "grass" | "road";
  /** Screen position of the tile's top vertex at 1×. */
  screenX: number;
  screenY: number;
}

export interface BuildingItem {
  id: string;
  size: number;
  heightPx: number;
  /** World sides shown as the left and right walls in this orientation. */
  leftSide: Side;
  rightSide: Side;
  /** Screen position of the footprint's front vertex (the sprite anchor) at 1×. */
  anchorX: number;
  anchorY: number;
}

export interface SpikeRenderList {
  ground: GroundItem[];
  buildings: BuildingItem[];
  /** Screen position of the scene center, for the camera. */
  centerX: number;
  centerY: number;
}

/** One storey is 8 px at the 32 × 16 tile size (ART_DIRECTION.md §3). */
const STOREY_PX_AT_32 = 8;

export function buildRenderList(
  scene: SpikeScene,
  orientation: Orientation,
  tile: TileSize,
): SpikeRenderList {
  const roads = new Set(scene.roads.map(([x, y]) => `${x},${y}`));
  const ground: GroundItem[] = [];
  for (let x = 0; x < scene.size; x++) {
    for (let y = 0; y < scene.size; y++) {
      const view = rotateTile({ x, y }, orientation);
      const screen = worldToScreen(view, tile);
      ground.push({
        kind: roads.has(`${x},${y}`) ? "road" : "grass",
        screenX: screen.x,
        screenY: screen.y,
      });
    }
  }

  const back = inverseOrientation(orientation);
  const leftSide = rotateSide(1, back);
  const rightSide = rotateSide(0, back);
  const storeyPx = (STOREY_PX_AT_32 * tile.width) / 32;

  const sorted = sortByDepth(
    scene.buildings.map((b) => ({
      id: b.id,
      building: b,
      footprint: rotateFootprint({ x: b.x, y: b.y, size: b.size }, orientation),
    })),
  );
  const buildings = sorted.map(({ id, building, footprint }): BuildingItem => {
    const anchor = footprintAnchor(footprint as Footprint, tile);
    return {
      id,
      size: building.size,
      heightPx: building.storeys * storeyPx,
      leftSide,
      rightSide,
      anchorX: anchor.x,
      anchorY: anchor.y,
    };
  });

  const half = scene.size / 2;
  const center = worldToScreen(rotatePoint({ x: half, y: half }, orientation), tile);
  return { ground, buildings, centerX: Math.round(center.x), centerY: Math.round(center.y) };
}
