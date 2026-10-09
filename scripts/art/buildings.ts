// Building art for the brick and modern families (ART_DIRECTION.md §4, §5, §9). Run: pnpm art
//
// Every building is a stack of boxes on a paved lot. A box is a diamond roof raised
// over two walls; walls follow the 2:1 grid, so windows step down with them.
import { join } from "node:path";
import { diamondTop } from "../../src/core/assets";
import {
  COLORS,
  CREDITS,
  Canvas,
  type Hex,
  RAMPS,
  eachDiamondPixel,
  noise,
  writeFolder,
} from "./kit";

const TILE_W = 32;
const TILE_H = 16;

type Family = "brick" | "modern";

/** Colors for one look; the abandoned variant swaps in a faded set. */
interface Style {
  outline: Hex;
  leftWall: Hex;
  rightWall: Hex;
  /** A row of a slightly different tone between floors; omitted for plain walls. */
  leftBand?: Hex;
  rightBand?: Hex;
  roof: Hex;
  roofEdge: Hex;
  roofShadow: Hex;
  lot: Hex;
  lotJoint: Hex;
}

const STYLES: Record<Family, Record<"default" | "abandoned", Style>> = {
  brick: {
    default: {
      outline: RAMPS.brick[0],
      leftWall: RAMPS.brick[2],
      rightWall: RAMPS.brick[1],
      leftBand: RAMPS.brick[3],
      rightBand: RAMPS.brick[2],
      roof: RAMPS.concrete[3],
      roofEdge: RAMPS.concrete[4],
      roofShadow: RAMPS.concrete[2],
      lot: COLORS.sidewalk,
      lotJoint: COLORS.sidewalkJoint,
    },
    abandoned: {
      outline: RAMPS.dirt[0],
      leftWall: RAMPS.sand[1],
      rightWall: RAMPS.sand[0],
      leftBand: RAMPS.sand[2],
      rightBand: RAMPS.sand[1],
      roof: RAMPS.concrete[2],
      roofEdge: RAMPS.concrete[3],
      roofShadow: RAMPS.concrete[1],
      lot: RAMPS.dirt[2],
      lotJoint: RAMPS.dirt[1],
    },
  },
  modern: {
    default: {
      outline: RAMPS.glass[0],
      leftWall: RAMPS.glass[3],
      rightWall: RAMPS.glass[1],
      leftBand: RAMPS.concrete[5],
      rightBand: RAMPS.concrete[3],
      roof: RAMPS.concrete[3],
      roofEdge: RAMPS.concrete[5],
      roofShadow: RAMPS.concrete[2],
      lot: COLORS.sidewalk,
      lotJoint: COLORS.sidewalkJoint,
    },
    abandoned: {
      outline: RAMPS.concrete[0],
      leftWall: RAMPS.concrete[2],
      rightWall: RAMPS.concrete[1],
      leftBand: RAMPS.concrete[3],
      rightBand: RAMPS.concrete[2],
      roof: RAMPS.concrete[2],
      roofEdge: RAMPS.concrete[3],
      roofShadow: RAMPS.concrete[1],
      lot: RAMPS.dirt[2],
      lotJoint: RAMPS.dirt[1],
    },
  },
};

/** A box standing on a diamond `inset` px in from each side of the footprint, `lift` px up. */
interface Box {
  inset: number;
  lift: number;
  height: number;
}

/** Where a box sits on the canvas: its base diamond's box corner and width. */
function boxFrame(c: Canvas, box: Box) {
  const w = c.width - 2 * box.inset;
  const diamond = c.width / 2;
  return { w, ox: box.inset, baseY: c.height - diamond + box.inset / 2 - box.lift };
}

/** Wall pixel under `box` at column `x` (canvas) and row `r` counted up from the base. */
function wallY(c: Canvas, box: Box, x: number, r: number): number {
  const { w, ox, baseY } = boxFrame(c, box);
  return baseY + w / 2 - 1 - diamondTop(x - ox, w) - r;
}

function drawBox(c: Canvas, box: Box, style: Style, floorHeight: number) {
  const { w, ox, baseY } = boxFrame(c, box);
  const roofY = baseY - box.height;
  for (let i = 0; i < w; i++) {
    const x = ox + i;
    const left = i < w / 2;
    const corner = i === 0 || i === w - 1;
    for (let r = 0; r < box.height; r++) {
      const y = wallY(c, box, x, r);
      const band = r > 0 && r % floorHeight === 0 && r < box.height - 1;
      let color = left ? style.leftWall : style.rightWall;
      if (band) color = (left ? style.leftBand : style.rightBand) ?? color;
      if (corner || r === 0) color = style.outline;
      c.set(x, y, color);
    }
  }
  eachDiamondPixel(
    w,
    (x, y, { y: ly, top, bottom }) => {
      const edge = ly === top || ly === bottom;
      const upper = ly === top && x - ox < w - 1 && x - ox > 0;
      c.set(x, y, edge ? (upper ? style.roofEdge : style.outline) : style.roof);
    },
    ox,
    roofY,
  );
  // Parapet: a one pixel inner shadow along the far roof edges.
  eachDiamondPixel(
    w - 4,
    (x, y, { y: ly, top }) => {
      if (ly === top) c.set(x, y, style.roofShadow);
    },
    ox + 2,
    roofY + 1,
  );
}

/** A small box on the roof (AC unit, plant room), `size` px wide, centered on (cx, groundY). */
function roofBlock(c: Canvas, cx: number, groundY: number, size: number, height: number, s: Style) {
  const half = size / 2;
  const ox = cx - half;
  const baseY = groundY - Math.floor(half / 2);
  for (let i = 0; i < size; i++) {
    const bottom = baseY + half - 1 - diamondTop(i, size);
    for (let r = 0; r < height; r++)
      c.set(ox + i, bottom - r, r === 0 ? s.outline : i < half ? s.leftWall : s.rightWall);
  }
  eachDiamondPixel(
    size,
    (x, y, { y: ly, top, bottom }) =>
      c.set(x, y, ly === bottom ? s.outline : ly === top ? s.roofEdge : s.roof),
    ox,
    baseY - height,
  );
}

/** The paved lot under the building, with joints like the pavement tiles. */
function drawLot(c: Canvas, style: Style, abandoned: boolean, seed: string) {
  const diamond = c.width / 2;
  eachDiamondPixel(
    c.width,
    (x, y, { x: lx, y: ly }) => {
      const joint = (lx + 2 * ly) % 16 === 0 || (((lx - 2 * ly) % 16) + 16) % 16 === 0;
      c.set(x, y, joint ? style.lotJoint : style.lot);
    },
    0,
    c.height - diamond,
  );
  if (!abandoned) return;
  // Weeds pushing through the cracks.
  eachDiamondPixel(
    c.width,
    (x, y) => {
      const n = noise(seed, "weed", x, y);
      if (n < 0.05) {
        c.set(x, y, RAMPS.dry[2]);
        c.set(x, y - 1, RAMPS.dry[1]);
      } else if (n < 0.08) c.set(x, y, RAMPS.foliage[1]);
    },
    0,
    c.height - diamond,
  );
}

interface Facade {
  family: Family;
  abandoned: boolean;
  floors: number;
  floorHeight: number;
  seed: string;
}

/** Windows on both walls of a box, one row per floor, 2 px wide with 2 px spacing (§7). */
function drawWindows(c: Canvas, box: Box, f: Facade) {
  const { w, ox } = boxFrame(c, box);
  const half = w / 2;
  for (let i = 0; i < w; i++) {
    const left = i < half;
    const u = left ? i : w - 1 - i;
    // Leave the corners solid; windows come in pairs of columns that share a step.
    if (u < 2 || u > half - 3 || u % 4 > 1) continue;
    const x = ox + i;
    const pane = Math.floor(u / 4);
    for (let floor = 0; floor < f.floors; floor++) {
      const n = noise(f.seed, left ? "l" : "r", pane, floor);
      const glass = f.family === "modern";
      // Brick shops keep the ground floor for doors and awnings.
      if (!glass && floor === 0) continue;
      const bottom = floor * f.floorHeight + (glass ? 1 : 2);
      const rows = glass ? f.floorHeight - 1 : 3;
      for (let r = 0; r < rows; r++) {
        const y = wallY(c, box, x, bottom + r);
        let color: Hex;
        if (f.abandoned) {
          if (n < 0.45) color = r === 1 ? COLORS.deadWoodDark : COLORS.board;
          else if (n < 0.7) color = RAMPS.concrete[0];
          else color = left ? RAMPS.glass[1] : RAMPS.glass[0];
        } else if (glass) {
          const lit = n < 0.18;
          color = left
            ? lit
              ? COLORS.litWindow
              : r === rows - 1
                ? RAMPS.glass[4]
                : RAMPS.glass[3]
            : lit
              ? COLORS.litWindow
              : RAMPS.glass[1];
          // Mullions every other pane give the curtain wall a rhythm.
          if (u % 4 === 1 && r === 0 && !lit) color = left ? RAMPS.glass[2] : RAMPS.glass[0];
        } else {
          const lit = n < 0.3;
          color = lit
            ? COLORS.litWindow
            : left
              ? r === rows - 1
                ? RAMPS.glass[3]
                : RAMPS.glass[2]
              : COLORS.darkWindow;
        }
        c.set(x, y, color);
      }
    }
  }
}

/** Ground floor of a brick building: shop windows under an awning, and a door. */
function drawShopfront(c: Canvas, box: Box, f: Facade) {
  const { w, ox } = boxFrame(c, box);
  const half = w / 2;
  const awning = f.abandoned ? [RAMPS.sand[0], RAMPS.sand[1]] : [RAMPS.roofTiles[1], COLORS.curb];
  for (let i = 1; i < half - 1; i++) {
    const x = ox + i;
    const door = i >= half - 6 && i < half - 4;
    for (let r = 1; r <= 4; r++) {
      const y = wallY(c, box, x, r);
      if (door) c.set(x, y, f.abandoned ? COLORS.board : RAMPS.brick[0]);
      else if (r <= 3)
        c.set(x, y, f.abandoned ? (r === 2 ? COLORS.deadWoodDark : COLORS.board) : RAMPS.glass[2]);
    }
    // Striped awning, one row, lit from above.
    c.set(x, wallY(c, box, x, 5), awning[Math.floor(i / 2) % 2]!);
  }
}

/** Glass lobby along the bottom of a modern building's left wall. */
function drawLobby(c: Canvas, box: Box, f: Facade) {
  const { w, ox } = boxFrame(c, box);
  const half = w / 2;
  for (let i = 2; i < half - 2; i++) {
    const x = ox + i;
    for (let r = 1; r < f.floorHeight; r++) {
      const color = f.abandoned
        ? r % 2
          ? COLORS.board
          : RAMPS.concrete[1]
        : i % 4 === 0
          ? RAMPS.concrete[5]
          : r === f.floorHeight - 1
            ? RAMPS.glass[4]
            : COLORS.litWindow;
      c.set(x, wallY(c, box, x, r), color);
    }
  }
}

interface Plan {
  family: Family;
  footprint: number;
  level: number;
}

const FLOORS: Record<Family, number[][]> = {
  // [footprint][level - 1]
  brick: [[], [2, 3, 4], [3, 4, 6], [3, 5, 7], [4, 6, 8]],
  modern: [[], [3, 5, 7], [5, 8, 12], [6, 10, 14], [8, 12, 16]],
};

const FLOOR_HEIGHT: Record<Family, number> = { brick: 6, modern: 5 };

function building(plan: Plan, abandoned: boolean): Canvas {
  const { family, footprint, level } = plan;
  const style = STYLES[family][abandoned ? "abandoned" : "default"];
  const width = footprint * TILE_W;
  const c = new Canvas(width, footprint * TILE_H + 320);
  const seed = `${family}:${footprint}:${level}`;
  drawLot(c, style, abandoned, seed);

  const floors = FLOORS[family][footprint]![level - 1]!;
  const fh = FLOOR_HEIGHT[family];
  const facade: Facade = { family, abandoned, floors, floorHeight: fh, seed };
  const inset = 4;
  // Taller levels on bigger lots step back: a podium with a slimmer tower on top.
  const setback = footprint >= 2 && level === 3 ? Math.ceil(floors / 3) : 0;
  const boxes: { box: Box; floors: number }[] = [];
  if (setback) {
    boxes.push({ box: { inset, lift: 0, height: setback * fh + 2 }, floors: setback });
    const towerInset = inset + 4 * footprint;
    boxes.push({
      box: { inset: towerInset, lift: setback * fh + 2, height: (floors - setback) * fh + 2 },
      floors: floors - setback,
    });
  } else boxes.push({ box: { inset, lift: 0, height: floors * fh + 2 }, floors });

  for (const { box, floors: n } of boxes) {
    drawBox(c, box, style, fh);
    drawWindows(c, box, { ...facade, floors: n });
  }
  const base = boxes[0]!.box;
  if (family === "brick") drawShopfront(c, base, facade);
  else drawLobby(c, base, facade);

  // Roof details on the top box: AC units for brick, a plant room and antenna for towers.
  const top = boxes[boxes.length - 1]!.box;
  const { w, ox, baseY } = boxFrame(c, top);
  const roofCenterY = baseY - top.height + w / 4;
  const cx = ox + w / 2;
  if (family === "brick") {
    const units = Math.max(1, footprint);
    for (let i = 0; i < units; i++) {
      const dx = Math.round((noise(seed, "ac", i) - 0.5) * (w / 3));
      const dy = Math.round((noise(seed, "acy", i) - 0.5) * (w / 8));
      roofBlock(c, cx + dx - (dx % 2), roofCenterY + dy, 4, 3, {
        ...style,
        leftWall: RAMPS.concrete[4],
        rightWall: RAMPS.concrete[3],
        roofEdge: RAMPS.concrete[5],
        outline: RAMPS.concrete[1],
      });
    }
    if (footprint >= 2 && level >= 2)
      roofBlock(c, cx - w / 6 - ((w / 6) % 2), roofCenterY - 1, 8, 6, style);
  } else {
    const size = Math.max(8, Math.floor(w / 3 / 4) * 4);
    roofBlock(c, cx, roofCenterY + 1, size, fh + 1, {
      ...style,
      leftWall: RAMPS.concrete[4],
      rightWall: RAMPS.concrete[3],
      roofEdge: RAMPS.concrete[5],
      outline: RAMPS.concrete[1],
    });
    if (level === 3 && !abandoned) {
      const antennaBase = roofCenterY - fh;
      for (let r = 1; r <= 6 + footprint * 2; r++) c.set(cx, antennaBase - r, RAMPS.concrete[1]);
      c.set(cx, antennaBase - 7 - footprint * 2, COLORS.flowerPink);
    }
  }
  return c.cropTop(footprint * TILE_H);
}

const SIZE_NAMES = ["", "small", "medium", "large", "block"];
const root = join("assets", "buildings");
let count = 0;
for (const family of ["brick", "modern"] as const) {
  for (let footprint = 1; footprint <= 4; footprint++) {
    for (let level = 1; level <= 3; level++) {
      const plan = { family, footprint, level };
      const id = `${family}-${SIZE_NAMES[footprint]}-l${level}`;
      writeFolder({
        dir: join(root, id),
        manifest: {
          id,
          family,
          footprint,
          levels: [level],
          views: [0],
          symmetric: false,
          variants: ["default", "abandoned"],
          ...CREDITS,
        },
        files: {
          "view-0.png": building(plan, false),
          "view-0.abandoned.png": building(plan, true),
        },
      });
      count++;
    }
  }
}
console.log(`✓ Drew ${count} buildings`);
