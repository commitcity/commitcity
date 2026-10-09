import { describe, expect, it } from "vitest";
import tiny from "../../../fixtures/tiny.json";
import { PLACEHOLDER_CATALOG } from "@/core/assets";
import { generateCity } from "@/core/generation";
import { type CityModel, parseCityInput } from "@/core/model";
import { isBehind } from "./depth";
import { rotateFootprint } from "./orientation";
import { TILE_32, footprintAnchor, screenToWorld } from "./projection";
import { buildRenderList, buildingKey, parseBuildingKey, roadKey, roadMask } from "./renderList";
import type { Orientation } from "./types";

const ORIENTATIONS: Orientation[] = [0, 1, 2, 3];
const city = generateCity(parseCityInput(tiny), PLACEHOLDER_CATALOG);

/** A hand-made city: a plus-shaped road crossing and two buildings. */
const plus: CityModel = {
  generatorVersion: 0,
  catalogVersion: "test",
  bounds: { minX: -3, minY: -3, maxX: 3, maxY: 3 },
  ground: [],
  roads: [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 2, y: 0 },
    { x: -1, y: 0 },
    { x: 0, y: 1 },
    { x: 0, y: -1 },
  ],
  buildings: [
    {
      repoId: "big",
      manifestId: "placeholder-brick-2",
      origin: { x: 1, y: 1 },
      footprint: 2,
      family: "brick",
      facing: 1,
      level: 2,
      variant: "default",
      isAnnex: false,
    },
  ],
  decorations: [{ x: 3, y: 1, kind: "tree", variant: 0, repoId: "big" }],
  aggregates: [],
};

describe("buildRenderList", () => {
  it.each(ORIENTATIONS)("keeps every item of the tiny city at orientation %i", (o) => {
    const list = buildRenderList(city, o, TILE_32);
    expect(list.ground).toHaveLength(city.ground.length);
    expect(list.roads).toHaveLength(city.roads.length);
    expect(list.objects).toHaveLength(city.buildings.length + city.decorations.length);
    expect(
      list.objects
        .filter((i) => i.pickId)
        .map((i) => i.pickId)
        .sort(),
    ).toEqual(city.buildings.map((b) => b.repoId).sort());
  });

  it.each(ORIENTATIONS)(
    "anchors buildings at their rotated front vertex at orientation %i",
    (o) => {
      const list = buildRenderList(city, o, TILE_32);
      for (const b of city.buildings) {
        const item = list.objects.find((i) => i.pickId === b.repoId)!;
        const anchor = footprintAnchor(
          rotateFootprint({ ...b.origin, size: b.footprint }, o),
          TILE_32,
        );
        expect([item.screenX, item.screenY]).toEqual([anchor.x, anchor.y]);
      }
    },
  );

  it.each(ORIENTATIONS)("draws objects back to front at orientation %i", (o) => {
    const list = buildRenderList(city, o, TILE_32);
    const footprints = list.objects.map((item) => {
      const size = item.pickId
        ? city.buildings.find((b) => b.repoId === item.pickId)!.footprint
        : 1;
      // Recover the view footprint from the anchor: the front vertex is (x + size, y + size).
      const front = screenToWorld({ x: item.screenX, y: item.screenY }, TILE_32);
      return { x: front.x - size, y: front.y - size, size };
    });
    footprints.forEach((a, i) =>
      footprints.forEach((b, j) => {
        if (isBehind(a, b)) expect(i, `${i} must be drawn before ${j}`).toBeLessThan(j);
      }),
    );
    list.objects.forEach((item, i) => expect(item.depth).toBe(i));
  });

  it.each(ORIENTATIONS)("rotates building views with the map at orientation %i", (o) => {
    const item = buildRenderList(plus, o, TILE_32).objects.find((i) => i.pickId === "big")!;
    expect(parseBuildingKey(item.textureKey)).toEqual({
      manifestId: "placeholder-brick-2",
      view: (1 + o) % 4,
      variant: "default",
      level: 2,
    });
  });

  it("matches the stored render list of the tiny city in all four orientations", () => {
    const summary = ORIENTATIONS.map((o) => {
      const list = buildRenderList(city, o, TILE_32);
      return {
        orientation: o,
        objects: list.objects.map((i) => `${i.textureKey} @${i.screenX},${i.screenY}`),
        roadShapes: [...new Set(list.roads.map((r) => r.textureKey))].sort(),
      };
    });
    expect(summary).toMatchSnapshot();
  });
});

describe("road auto-tiling", () => {
  const masks = (o: Orientation) => {
    const list = buildRenderList(plus, o, TILE_32);
    return list.roads.map((r) => {
      const t = screenToWorld({ x: r.screenX, y: r.screenY }, TILE_32);
      return `${t.x},${t.y}:${r.textureKey}`;
    });
  };

  it("connects a crossing, straights, and dead ends at orientation 0", () => {
    expect(masks(0).sort()).toEqual(
      [
        `0,0:${roadKey(0b1111)}`,
        `1,0:${roadKey(0b0101)}`,
        `2,0:${roadKey(0b0100)}`,
        `-1,0:${roadKey(0b0001)}`,
        `0,1:${roadKey(0b1000)}`,
        `0,-1:${roadKey(0b0010)}`,
      ].sort(),
    );
  });

  it("keeps the same number of each shape in every orientation", () => {
    const shapeCounts = (o: Orientation) => {
      const counts = new Map<number, number>();
      for (const entry of masks(o)) {
        const mask = Number(entry.split("road/")[1]);
        const bits = [0, 1, 2, 3].filter((b) => mask & (1 << b)).length;
        counts.set(bits, (counts.get(bits) ?? 0) + 1);
      }
      return [...counts.entries()].sort();
    };
    for (const o of ORIENTATIONS) expect(shapeCounts(o)).toEqual(shapeCounts(0));
  });

  it("reads neighbors in view space", () => {
    const roads = new Set(["1,0", "0,-1"]);
    expect(roadMask({ x: 0, y: 0 }, roads)).toBe(0b1001);
  });

  it("gives every road in a generated city at least one neighbor", () => {
    for (const r of buildRenderList(city, 0, TILE_32).roads)
      expect(r.textureKey).not.toBe(roadKey(0));
  });
});

describe("building keys", () => {
  it("round-trips through parseBuildingKey", () => {
    const key = {
      manifestId: "placeholder-civic-4",
      view: 3 as const,
      variant: "abandoned",
      level: 3,
    };
    expect(parseBuildingKey(buildingKey(key))).toEqual(key);
    expect(parseBuildingKey("ground/grass/0")).toBeNull();
  });
});
