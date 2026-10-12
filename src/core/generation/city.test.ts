import { describe, expect, it } from "vitest";
import edgeCases from "../../../fixtures/edge-cases.json";
import large from "../../../fixtures/large.json";
import medium from "../../../fixtures/medium.json";
import tiny from "../../../fixtures/tiny.json";
import { PLACEHOLDER_CATALOG, PLACEHOLDER_MANIFESTS, createCatalog } from "@/core/assets";
import { type CityInput, type CityModel, parseCityInput } from "@/core/model";
import { hash53 } from "@/core/random";
import { GENERATOR_VERSION } from "@/core/version";
import { generateCity } from "./city";
import { findCollisions } from "./invariants";

const FIXTURES: Record<string, CityInput> = {
  tiny: parseCityInput(tiny),
  medium: parseCityInput(medium),
  large: parseCityInput(large),
  "edge-cases": parseCityInput(edgeCases),
};

/** A compact, reviewable snapshot: every building, counts, and a digest of the rest. */
function summary(model: CityModel) {
  return {
    generatorVersion: model.generatorVersion,
    catalogVersion: model.catalogVersion,
    bounds: model.bounds,
    counts: {
      ground: model.ground.length,
      dirt: model.ground.filter((g) => g.kind === "dirt").length,
      roads: model.roads.length,
      buildings: model.buildings.length,
      decorations: model.decorations.length,
    },
    digest: hash53(JSON.stringify(model)).toString(16),
    buildings: model.buildings.map(
      (b) =>
        `${b.repoId} ${b.manifestId} @${b.origin.x},${b.origin.y} level ${b.level} facing ${b.facing}` +
        `${b.variant === "abandoned" ? " abandoned" : ""}${b.isAnnex ? " annex" : ""}`,
    ),
  };
}

describe("generateCity", () => {
  it.each(Object.keys(FIXTURES))("has no colliding occupants (%s)", (name) => {
    expect(findCollisions(generateCity(FIXTURES[name]!, PLACEHOLDER_CATALOG))).toEqual([]);
  });

  it.each(Object.keys(FIXTURES))("is deterministic and matches its snapshot (%s)", (name) => {
    const model = generateCity(FIXTURES[name]!, PLACEHOLDER_CATALOG);
    expect(generateCity(FIXTURES[name]!, PLACEHOLDER_CATALOG)).toEqual(model);
    expect(summary(model)).toMatchSnapshot();
  });

  it("stamps the generator and catalog versions", () => {
    const model = generateCity(FIXTURES.tiny!, PLACEHOLDER_CATALOG);
    expect(model.generatorVersion).toBe(GENERATOR_VERSION);
    expect(model.catalogVersion).toBe(PLACEHOLDER_CATALOG.version);
  });

  it("covers every road and building with ground", () => {
    const model = generateCity(FIXTURES.medium!, PLACEHOLDER_CATALOG);
    const ground = new Set(model.ground.map((g) => `${g.x},${g.y}`));
    for (const r of model.roads) expect(ground.has(`${r.x},${r.y}`)).toBe(true);
    for (const b of model.buildings) expect(ground.has(`${b.origin.x},${b.origin.y}`)).toBe(true);
  });

  it("keeps existing buildings and decorations when a newer repository is added", () => {
    const input = FIXTURES.medium!;
    const before = generateCity(input, PLACEHOLDER_CATALOG);
    const after = generateCity(
      {
        ...input,
        repos: [
          ...input.repos,
          { ...input.repos[0]!, id: "R_new", createdAt: "2026-09-30T00:00:00Z" },
        ],
      },
      PLACEHOLDER_CATALOG,
    );
    for (const building of before.buildings) expect(after.buildings).toContainEqual(building);
    // Nature only gives way where the new building or its road now stands.
    const added = after.buildings.find((b) => b.repoId === "R_new")!;
    const taken = new Set(after.roads.map((r) => `${r.x},${r.y}`));
    for (let dx = 0; dx < added.footprint; dx++)
      for (let dy = 0; dy < added.footprint; dy++)
        taken.add(`${added.origin.x + dx},${added.origin.y + dy}`);
    for (const decoration of before.decorations)
      if (!taken.has(`${decoration.x},${decoration.y}`))
        expect(after.decorations).toContainEqual(decoration);
  });

  it("turns some blocks of a large city into parks, but not a village", () => {
    const parks = (model: CityModel) =>
      new Set(model.decorations.filter((d) => d.repoId.startsWith("park:")).map((d) => d.repoId));
    expect(parks(generateCity(FIXTURES.large!, PLACEHOLDER_CATALOG)).size).toBeGreaterThan(0);
    expect(parks(generateCity(FIXTURES.tiny!, PLACEHOLDER_CATALOG)).size).toBe(0);
  });

  it("builds a village of wooden houses for a handful of repositories", () => {
    const model = generateCity(FIXTURES.tiny!, PLACEHOLDER_CATALOG);
    expect(model.buildings.map((b) => b.family)).toEqual(["village", "village"]);
    // The two houses face each other across the main street.
    const [a, b] = model.buildings;
    expect(a!.facing).toBe(1);
    expect(b!.facing).toBe(3);
  });

  it("stands every building against a road, facing it", () => {
    for (const input of Object.values(FIXTURES)) {
      const model = generateCity(input, PLACEHOLDER_CATALOG);
      const roads = new Set(model.roads.map((r) => `${r.x},${r.y}`));
      for (const b of model.buildings) {
        const { x, y } = b.origin;
        const f = b.footprint;
        const front =
          b.facing === 0
            ? { x: x + f, y }
            : b.facing === 1
              ? { x, y: y + f }
              : b.facing === 2
                ? { x: x - 1, y }
                : { x, y: y - 1 };
        expect(roads.has(`${front.x},${front.y}`)).toBe(true);
      }
    }
  });

  it("never repeats a drawing right next door", () => {
    const catalog = createCatalog(
      ["a", "b", "c"].flatMap((name) =>
        PLACEHOLDER_MANIFESTS.map((m) => ({ ...m, id: `${m.id}-${name}` })),
      ),
    );
    const model = generateCity(FIXTURES.large!, catalog);
    for (const [i, a] of model.buildings.entries()) {
      for (const b of model.buildings.slice(i + 1)) {
        const touching =
          a.origin.x <= b.origin.x + b.footprint &&
          b.origin.x <= a.origin.x + a.footprint &&
          a.origin.y <= b.origin.y + b.footprint &&
          b.origin.y <= a.origin.y + a.footprint;
        if (touching && a.footprint === b.footprint && a.family === b.family)
          expect(a.manifestId).not.toBe(b.manifestId);
      }
    }
  });

  it("never puts a building, road or decoration on water", () => {
    for (const input of Object.values(FIXTURES)) {
      const model = generateCity(input, PLACEHOLDER_CATALOG);
      const water = new Set(
        model.ground.filter((g) => g.kind === "water").map((g) => `${g.x},${g.y}`),
      );
      for (const d of model.decorations) expect(water.has(`${d.x},${d.y}`)).toBe(false);
      for (const r of model.roads) expect(water.has(`${r.x},${r.y}`)).toBe(false);
      for (const b of model.buildings)
        for (let dx = 0; dx < b.footprint; dx++)
          for (let dy = 0; dy < b.footprint; dy++)
            expect(water.has(`${b.origin.x + dx},${b.origin.y + dy}`)).toBe(false);
    }
  });

  it("generates the 320-repository fixture in under 50 ms", () => {
    const input = FIXTURES.large!;
    for (let i = 0; i < 3; i++) generateCity(input, PLACEHOLDER_CATALOG);
    const times: number[] = [];
    for (let i = 0; i < 5; i++) {
      const start = performance.now();
      generateCity(input, PLACEHOLDER_CATALOG);
      times.push(performance.now() - start);
    }
    times.sort((a, b) => a - b);
    expect(times[2]).toBeLessThan(50);
  });

  it("changes only a minority of buildings when a manifest is added", () => {
    const input = FIXTURES.large!;
    const before = generateCity(input, PLACEHOLDER_CATALOG);
    const added = {
      ...PLACEHOLDER_MANIFESTS[0]!,
      id: "new-brick-office",
      family: "brick" as const,
      footprint: 2 as const,
    };
    const after = generateCity(input, createCatalog([...PLACEHOLDER_MANIFESTS, added]));

    const changed = before.buildings.filter(
      (b, i) => b.manifestId !== after.buildings[i]!.manifestId,
    );
    expect(changed.length).toBeGreaterThan(0);
    expect(changed.length / before.buildings.length).toBeLessThan(0.5);
    // Only buildings the new manifest fits can switch, and only to it.
    for (const b of changed) {
      expect(b).toMatchObject({ family: "brick", footprint: 2 });
      expect(after.buildings.find((a) => a.repoId === b.repoId)!.manifestId).toBe(
        "new-brick-office",
      );
    }
    // Everything except the manifest choice stays put.
    expect(after.buildings.map((b) => ({ ...b, manifestId: "" }))).toEqual(
      before.buildings.map((b) => ({ ...b, manifestId: "" })),
    );
  });

  it("builds an empty city for an account with no repositories", () => {
    const model = generateCity({ ...FIXTURES.tiny!, repos: [] }, PLACEHOLDER_CATALOG);
    expect(model.buildings).toEqual([]);
    expect(model.roads).toEqual([]);
    expect(model.ground.length).toBeGreaterThan(0);
  });
});
