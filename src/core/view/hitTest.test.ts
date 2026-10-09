import { describe, expect, it } from "vitest";
import edgeCases from "../../../fixtures/edge-cases.json";
import medium from "../../../fixtures/medium.json";
import { PLACEHOLDER_CATALOG } from "@/core/assets";
import { generateCity } from "@/core/generation";
import { type Building, type CityModel, parseCityInput } from "@/core/model";
import { type HitMask, pickAt, spriteOrigin } from "./hitTest";
import { TILE_32 } from "./projection";
import { type RenderItem, buildRenderList, parseBuildingKey } from "./renderList";
import type { Orientation } from "./types";

const ORIENTATIONS: Orientation[] = [0, 1, 2, 3];

/** A box like the placeholder sprites: a 2:1 roof diamond on top of two walls. */
function boxMask(footprint: number, wallHeight: number): HitMask {
  const width = footprint * TILE_32.width;
  const depth = footprint * TILE_32.height;
  const height = depth + wallHeight;
  const opaque = new Uint8Array(width * height);
  for (let x = 0; x < width; x++) {
    const half = width / 2;
    const top = Math.ceil((x < half ? half - 1 - x : x - half) / 2);
    for (let y = top; y < height - top; y++) opaque[y * width + x] = 1;
  }
  return { width, height, opaque };
}

const masks = new Map<string, HitMask>();

/** Building masks from their keys; any other key is a fully opaque 32 × 40 block. */
function maskFor(key: string): HitMask {
  let mask = masks.get(key);
  if (!mask) {
    mask = drawMask(key);
    masks.set(key, mask);
  }
  return mask;
}

function drawMask(key: string): HitMask {
  const building = parseBuildingKey(key);
  if (!building) return { width: 32, height: 40, opaque: new Uint8Array(32 * 40).fill(1) };
  const footprint = Number(building.manifestId.split("-").at(-1));
  return boxMask(footprint, building.level * footprint * 8);
}

/** Paints every object back to front and records which pickable one owns each pixel. */
function paint(objects: readonly RenderItem[]) {
  const owner = new Map<string, string>();
  for (const item of objects) {
    if (item.pickId === undefined) continue;
    const mask = maskFor(item.textureKey);
    const origin = spriteOrigin(item, mask.width, mask.height);
    for (let y = 0; y < mask.height; y++)
      for (let x = 0; x < mask.width; x++)
        if (mask.opaque[y * mask.width + x])
          owner.set(`${origin.x + x},${origin.y + y}`, item.pickId);
  }
  return owner;
}

function building(repoId: string, x: number, y: number, footprint: 1 | 2, level: number): Building {
  return {
    repoId,
    manifestId: `placeholder-brick-${footprint}`,
    origin: { x, y },
    footprint,
    family: "brick",
    facing: 0,
    level,
    variant: "default",
    isAnnex: false,
  };
}

/** A small building against the right wall of a tall one, and a tree in front of both. */
const hardCase: CityModel = {
  generatorVersion: 0,
  catalogVersion: "test",
  bounds: { minX: 0, minY: 0, maxX: 4, maxY: 4 },
  ground: [],
  roads: [],
  buildings: [building("tall", 0, 0, 2, 3), building("small", 2, 0, 1, 1)],
  decorations: [{ x: 2, y: 2, kind: "tree", variant: 0, repoId: "tall" }],
  aggregates: [],
};

describe("pickAt", () => {
  it("returns null on empty space", () => {
    const { objects } = buildRenderList(hardCase, 0, TILE_32);
    expect(pickAt(objects, { x: 10_000, y: 10_000 }, maskFor)).toBeNull();
  });

  it("picks the building in front where two overlap", () => {
    const { objects } = buildRenderList(hardCase, 0, TILE_32);
    const small = objects.find((o) => o.pickId === "small")!;
    // Just above the small building's front vertex: inside both sprites' boxes.
    expect(pickAt(objects, { x: small.screenX, y: small.screenY - 2 }, maskFor)).toBe("small");
  });

  it("falls through transparent pixels to the building behind", () => {
    const { objects } = buildRenderList(hardCase, 0, TILE_32);
    const small = objects.find((o) => o.pickId === "small")!;
    const mask = maskFor(small.textureKey);
    const origin = spriteOrigin(small, mask.width, mask.height);
    // The small sprite's top-left corner is transparent and covers the tall wall.
    expect(mask.opaque[0]).toBe(0);
    expect(pickAt(objects, origin, maskFor)).toBe("tall");
  });

  it("ignores decorations, so a tree never hides a building", () => {
    const { objects } = buildRenderList(hardCase, 0, TILE_32);
    const tree = objects.find((o) => o.textureKey.startsWith("decoration/"))!;
    const hit = pickAt(objects, { x: tree.screenX, y: tree.screenY - 1 }, maskFor);
    expect(hit === null || hit === "tall" || hit === "small").toBe(true);
  });

  const cities = {
    "hard case": hardCase,
    medium: generateCity(parseCityInput(medium), PLACEHOLDER_CATALOG),
    "edge cases": generateCity(parseCityInput(edgeCases), PLACEHOLDER_CATALOG),
  };
  for (const [name, model] of Object.entries(cities)) {
    it(`agrees with the drawn image on every pixel (${name}, all orientations)`, () => {
      for (const orientation of ORIENTATIONS) {
        const { objects } = buildRenderList(model, orientation, TILE_32);
        const owner = paint(objects);
        let mismatches = 0;
        for (const [key, expected] of owner) {
          const [x, y] = key.split(",").map(Number) as [number, number];
          if (pickAt(objects, { x: x + 0.5, y: y + 0.5 }, maskFor) !== expected) mismatches++;
        }
        expect(mismatches, `orientation ${orientation}`).toBe(0);
        expect(owner.size).toBeGreaterThan(0);
      }
    });
  }
});
