import { describe, expect, it } from "vitest";
import {
  inverseOrientation,
  rotateFootprint,
  rotatePoint,
  rotateSide,
  rotateTile,
} from "./orientation";
import type { Footprint, Orientation, Side } from "./types";

const ORIENTATIONS: Orientation[] = [0, 1, 2, 3];

function tilesOf(footprint: Footprint): string[] {
  const tiles: string[] = [];
  for (let dx = 0; dx < footprint.size; dx++) {
    for (let dy = 0; dy < footprint.size; dy++) {
      tiles.push(`${footprint.x + dx},${footprint.y + dy}`);
    }
  }
  return tiles.sort();
}

describe("rotatePoint", () => {
  it("turns +x into +y, then -x, then -y", () => {
    expect(ORIENTATIONS.map((o) => rotatePoint({ x: 1, y: 0 }, o))).toEqual([
      { x: 1, y: 0 },
      { x: 0, y: 1 },
      { x: -1, y: 0 },
      { x: 0, y: -1 },
    ]);
  });

  it("is undone by the inverse orientation", () => {
    const point = { x: 5, y: -3 };
    for (const o of ORIENTATIONS) {
      expect(rotatePoint(rotatePoint(point, o), inverseOrientation(o))).toEqual(point);
    }
  });
});

describe("rotateTile", () => {
  it("maps the four tiles around the origin onto each other", () => {
    expect(ORIENTATIONS.map((o) => rotateTile({ x: 0, y: 0 }, o))).toEqual([
      { x: 0, y: 0 },
      { x: -1, y: 0 },
      { x: -1, y: -1 },
      { x: 0, y: -1 },
    ]);
  });
});

describe("rotateFootprint", () => {
  const building: Footprint = { x: 3, y: 1, size: 3 };

  it.each(ORIENTATIONS)("covers the rotated tiles at orientation %i", (o) => {
    const rotated = rotateFootprint(building, o);
    const expected = tilesOf(building)
      .map((key) => {
        const [x, y] = key.split(",").map(Number) as [number, number];
        const t = rotateTile({ x, y }, o);
        return `${t.x},${t.y}`;
      })
      .sort();
    expect(tilesOf(rotated)).toEqual(expected);
  });

  it("returns the new back corner for each orientation", () => {
    expect(ORIENTATIONS.map((o) => rotateFootprint(building, o))).toEqual([
      { x: 3, y: 1, size: 3 },
      { x: -4, y: 3, size: 3 },
      { x: -6, y: -4, size: 3 },
      { x: 1, y: -6, size: 3 },
    ]);
  });

  it("comes back to the start after four steps", () => {
    let footprint = building;
    for (let i = 0; i < 4; i++) footprint = rotateFootprint(footprint, 1);
    expect(footprint).toEqual(building);
  });
});

describe("rotateSide", () => {
  it("adds the orientation modulo 4", () => {
    const sides: Side[] = [0, 1, 2, 3];
    expect(sides.map((s) => rotateSide(s, 3))).toEqual([3, 0, 1, 2]);
  });

  it("agrees with rotatePoint on side normals", () => {
    const normals = [
      { x: 1, y: 0 },
      { x: 0, y: 1 },
      { x: -1, y: 0 },
      { x: 0, y: -1 },
    ];
    for (const o of ORIENTATIONS) {
      for (let s = 0; s < 4; s++) {
        expect(rotatePoint(normals[s]!, o)).toEqual(normals[rotateSide(s as Side, o)]);
      }
    }
  });
});
