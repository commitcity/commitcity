import type { Family, Variant } from "@/core/assets";

/**
 * A side of a footprint: 0 = +x, 1 = +y, 2 = -x, 3 = -y. Same numbering as `Side`
 * in `src/core/view`, so the view can rotate it by adding the orientation.
 */
export type Facing = 0 | 1 | 2 | 3;

export type Footprint = 1 | 2 | 3 | 4;

/**
 * The complete, orientation-independent description of a city (ARCHITECTURE.md
 * §4.3). World coordinates are integer tiles; (0, 0) is the city center.
 */
export interface CityModel {
  generatorVersion: number;
  catalogVersion: string;
  /** Inclusive tile bounds of the ground. */
  bounds: { minX: number; minY: number; maxX: number; maxY: number };
  ground: GroundTile[];
  roads: RoadTile[];
  buildings: Building[];
  decorations: Decoration[];
  aggregates: Aggregate[];
}

export interface Building {
  repoId: string;
  manifestId: string;
  /** Back (top) corner of the footprint. */
  origin: { x: number; y: number };
  footprint: Footprint;
  family: Family;
  /** Side that faces the road. */
  facing: Facing;
  level: number;
  variant: Variant;
  isAnnex: boolean;
}

/** Road shapes are not stored; the view layer derives them from neighbors. */
export interface RoadTile {
  x: number;
  y: number;
}

export type GroundKind = "grass" | "dirt" | "pavement" | "water";

export interface GroundTile {
  x: number;
  y: number;
  kind: GroundKind;
  variant: number;
}

export interface Decoration {
  x: number;
  y: number;
  kind: string;
  variant: number;
  /** Repository whose lot the decoration belongs to. */
  repoId: string;
}

export interface Aggregate {
  origin: { x: number; y: number };
  repoIds: string[];
}
