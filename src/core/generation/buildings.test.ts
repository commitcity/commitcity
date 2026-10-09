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
  chooseManifest,
  createBuilding,
  familyFromLanguage,
  footprintFromStars,
  levelFromCommits,
} from "./buildings";
import { lotAt } from "./spiral";

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

describe("createBuilding", () => {
  const build = (overrides: Partial<RepoInput>, lotIndex = 0) =>
    createBuilding(
      "owner",
      { ...repo, ...overrides },
      lotAt(lotIndex),
      PLACEHOLDER_CATALOG,
      createRandom("b"),
    );

  it("turns forks into annexes one size smaller", () => {
    expect(build({ isFork: true, stars: 150 })).toMatchObject({ isAnnex: true, footprint: 2 });
    expect(build({ isFork: true, stars: 0 })).toMatchObject({ isAnnex: true, footprint: 1 });
  });

  it("marks archived repositories as abandoned", () => {
    expect(build({ isArchived: true }).variant).toBe("abandoned");
    expect(build({}).variant).toBe("default");
  });

  it("stands in the lot's outer corner and faces a bordering road", () => {
    for (let index = 0; index < 4; index++) {
      const lot = lotAt(index);
      const b = build({ stars: 150 }, index);
      expect(b.origin.x).toBe(lot.cell.x === 1 ? lot.origin.x + 1 : lot.origin.x);
      expect(b.origin.y).toBe(lot.cell.y === 1 ? lot.origin.y + 1 : lot.origin.y);
      const roadSides = [lot.cell.x === 1 ? 0 : 2, lot.cell.y === 1 ? 1 : 3];
      expect(roadSides).toContain(b.facing);
    }
  });
});
