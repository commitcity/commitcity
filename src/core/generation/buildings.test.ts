import { describe, expect, it } from "vitest";
import {
  type BuildingManifest,
  PLACEHOLDER_CATALOG,
  PLACEHOLDER_MANIFESTS,
  createCatalog,
} from "@/core/assets";
import type { RepoInput } from "@/core/model";
import { createRandom } from "@/core/random";
import {
  buildingTraits,
  chooseManifest,
  createBuilding,
  designOf,
  familyFromLanguage,
  modelOf,
  footprintFromStars,
  levelFromCommits,
} from "./buildings";

const repo: RepoInput = {
  id: "R_1",
  name: "repo",
  description: null,
  createdAt: "2024-01-01T00:00:00Z",
  pushedAt: null,
  primaryLanguage: "TypeScript",
  stars: 0,
  commitCount: 10,
  isFork: false,
  isArchived: false,
};

describe("mapping thresholds", () => {
  it("maps stars to footprints on a log scale", () => {
    expect([0, 9, 10, 99, 100, 999, 1000, 98_000].map(footprintFromStars)).toEqual([
      1, 1, 2, 2, 3, 3, 4, 4,
    ]);
  });

  it("maps commits to levels, with unknown counts at level 1", () => {
    expect([null, 0, 49, 50, 499, 500, 15_000].map(levelFromCommits)).toEqual([
      1, 1, 1, 2, 2, 3, 3,
    ]);
  });

  it("maps known languages through the table", () => {
    const random = createRandom("unused");
    expect(familyFromLanguage("TypeScript", random)).toBe("modern");
    expect(familyFromLanguage("Rust", random)).toBe("industrial");
    expect(familyFromLanguage("Python", random)).toBe("brick");
    expect(familyFromLanguage("Dockerfile", random)).toBe("residential");
  });

  it("draws unknown and missing languages from the repository's stream", () => {
    const pick = (language: string | null, seed: string) =>
      familyFromLanguage(language, createRandom(seed));
    expect(pick("Brainfuck", "a")).toBe(pick("Brainfuck", "a"));
    expect(pick(null, "a")).toBe(pick(null, "a"));
    const families = new Set(Array.from({ length: 50 }, (_, i) => pick(null, `seed-${i}`)));
    expect(families.size).toBeGreaterThan(1);
  });
});

describe("chooseManifest", () => {
  const wanted = { family: "brick", footprint: 2, level: 2, variant: "default" } as const;

  it("picks the placeholder for the family and footprint", () => {
    expect(chooseManifest(PLACEHOLDER_CATALOG, "o:R_1", wanted).id).toBe("placeholder-brick-2");
  });

  it("relaxes the family first, then the level, but never the footprint", () => {
    const only = (m: Partial<BuildingManifest>) =>
      createCatalog([{ ...PLACEHOLDER_MANIFESTS[0]!, id: "only", ...m }]);
    expect(chooseManifest(only({ family: "civic", footprint: 2 }), "s", wanted).id).toBe("only");
    expect(
      chooseManifest(only({ family: "civic", footprint: 2, levels: [3] }), "s", wanted).id,
    ).toBe("only");
    expect(() => chooseManifest(only({ footprint: 3 }), "s", wanted)).toThrow(/footprint 2/);
  });

  it("prefers an exact family match over a better hash score elsewhere", () => {
    const catalog = createCatalog([
      ...PLACEHOLDER_MANIFESTS,
      { ...PLACEHOLDER_MANIFESTS[0]!, id: "civic-extra", family: "civic", footprint: 2 },
    ]);
    for (let i = 0; i < 50; i++) {
      expect(chooseManifest(catalog, `o:R_${i}`, wanted).family).toBe("brick");
    }
  });
});

describe("buildingTraits", () => {
  const traits = (overrides: Partial<RepoInput>, village = false) =>
    buildingTraits({ ...repo, ...overrides }, createRandom("b"), village);

  it("turns forks into annexes one size smaller", () => {
    expect(traits({ isFork: true, stars: 150 })).toMatchObject({ isAnnex: true, footprint: 2 });
    expect(traits({ isFork: true, stars: 0 })).toMatchObject({ isAnnex: true, footprint: 1 });
  });

  it("marks archived repositories as abandoned", () => {
    expect(traits({ isArchived: true }).variant).toBe("abandoned");
    expect(traits({}).variant).toBe("default");
  });

  it("draws every building of a village from the village family", () => {
    expect(traits({}, true).family).toBe("village");
    expect(traits({ primaryLanguage: "Rust" }, true).family).toBe("village");
    expect(traits({}).family).toBe("modern");
  });

  it("never picks the village family for an unknown language", () => {
    for (let i = 0; i < 200; i++)
      expect(familyFromLanguage(null, createRandom(`v${i}`))).not.toBe("village");
  });
});

describe("createBuilding", () => {
  const traits = buildingTraits({ ...repo, stars: 150 }, createRandom("b"));
  const placement = { origin: { x: 3, y: -2 }, facing: 1 as const };

  it("stands where it was placed and faces that road", () => {
    const b = createBuilding("owner", repo, traits, placement, PLACEHOLDER_CATALOG);
    expect(b).toMatchObject({ origin: { x: 3, y: -2 }, facing: 1, footprint: 3 });
  });

  it("steers away from penalised drawings while another fits", () => {
    const catalog = createCatalog([
      ...PLACEHOLDER_MANIFESTS,
      { ...PLACEHOLDER_MANIFESTS[0]!, id: "modern-a", family: "modern", footprint: 3 },
      { ...PLACEHOLDER_MANIFESTS[0]!, id: "modern-b", family: "modern", footprint: 3 },
    ]);
    const free = createBuilding("owner", repo, traits, placement, catalog).manifestId;
    const other = createBuilding("owner", repo, traits, placement, catalog, (m) =>
      m.id === free ? 1 : 0,
    ).manifestId;
    expect(other).not.toBe(free);
    expect(catalog.buildings.find((m) => m.id === other)).toMatchObject({
      family: "modern",
      footprint: 3,
    });
  });
});

describe("designOf and modelOf", () => {
  it("strip the level, then the colours", () => {
    expect(designOf("brick-store-plum-brown-l2")).toBe("brick-store-plum-brown");
    expect(modelOf("brick-store-plum-brown-l2")).toBe("brick-store");
  });
});
