import { describe, expect, it } from "vitest";
import edgeCases from "../../../fixtures/edge-cases.json";
import large from "../../../fixtures/large.json";
import medium from "../../../fixtures/medium.json";
import tiny from "../../../fixtures/tiny.json";
import { CityInputError, type RepoInput, parseCityInput } from "./input";

const FIXTURES = { tiny, medium, large, "edge-cases": edgeCases };

function validRepo(overrides: Partial<Record<keyof RepoInput, unknown>> = {}) {
  return {
    id: "R_1",
    name: "repo",
    description: null,
    createdAt: "2024-01-31T12:00:00Z",
    pushedAt: null,
    primaryLanguage: "TypeScript",
    stars: 0,
    commitCount: null,
    isFork: false,
    isArchived: false,
    ...overrides,
  };
}

function city(repos: unknown[]) {
  return { owner: "octocat", snapshotAt: "2026-10-01T00:00:00Z", repos };
}

function errorPath(value: unknown): string | undefined {
  try {
    parseCityInput(value);
    return undefined;
  } catch (error) {
    if (error instanceof CityInputError) return error.path;
    throw error;
  }
}

describe("fixtures", () => {
  it.each(Object.entries(FIXTURES))("%s validates against CityInput", (_, fixture) => {
    expect(() => parseCityInput(fixture)).not.toThrow();
  });

  it("cover the sizes the roadmap asks for", () => {
    expect(tiny.repos).toHaveLength(2);
    expect(medium.repos.length).toBeGreaterThanOrEqual(25);
    expect(large.repos.length).toBeGreaterThan(300);
  });

  it("include the edge cases", () => {
    const repos = parseCityInput(edgeCases).repos;
    expect(repos.some((r) => r.isFork)).toBe(true);
    expect(repos.some((r) => r.isArchived)).toBe(true);
    expect(repos.some((r) => r.primaryLanguage === null)).toBe(true);
    expect(repos.some((r) => r.commitCount === null)).toBe(true);
    const createdAt = repos.map((r) => r.createdAt);
    expect(new Set(createdAt).size).toBeLessThan(createdAt.length);
  });
});

describe("parseCityInput", () => {
  it("accepts a valid input and returns it", () => {
    const input = city([validRepo()]);
    expect(parseCityInput(input)).toBe(input);
  });

  it("accepts an empty repository list", () => {
    expect(() => parseCityInput(city([]))).not.toThrow();
  });

  it.each([
    ["a non-object", "not a city", "$"],
    ["a missing owner", { snapshotAt: "2026-10-01T00:00:00Z", repos: [] }, "$.owner"],
    ["an empty owner", { owner: "", snapshotAt: "2026-10-01T00:00:00Z", repos: [] }, "$.owner"],
    [
      "a local-time snapshot",
      { owner: "o", snapshotAt: "2026-10-01T00:00:00", repos: [] },
      "$.snapshotAt",
    ],
    [
      "repos that are not an array",
      { owner: "o", snapshotAt: "2026-10-01T00:00:00Z", repos: {} },
      "$.repos",
    ],
    ["an unknown field", { ...city([]), extra: 1 }, "$.extra"],
  ])("rejects %s", (_, value, path) => {
    expect(errorPath(value)).toBe(path);
  });

  it.each([
    ["negative stars", { stars: -1 }, "stars"],
    ["fractional stars", { stars: 1.5 }, "stars"],
    ["a string commit count", { commitCount: "12" }, "commitCount"],
    ["a date without time", { createdAt: "2024-01-31" }, "createdAt"],
    ["an impossible date", { createdAt: "2024-13-40T00:00:00Z" }, "createdAt"],
    ["an invalid pushedAt", { pushedAt: "yesterday" }, "pushedAt"],
    ["an empty language", { primaryLanguage: "" }, "primaryLanguage"],
    ["a non-boolean fork flag", { isFork: "no" }, "isFork"],
    ["a missing field", { isArchived: undefined }, "isArchived"],
  ])("rejects a repository with %s", (_, overrides, field) => {
    const repo: Record<string, unknown> = validRepo(overrides);
    for (const [key, value] of Object.entries(repo)) if (value === undefined) delete repo[key];
    expect(errorPath(city([repo]))).toBe(`$.repos[0].${field}`);
  });

  it("rejects duplicate repository ids", () => {
    expect(errorPath(city([validRepo(), validRepo()]))).toBe("$.repos[1].id");
  });

  it("names the field in the error message", () => {
    expect(() => parseCityInput(city([validRepo({ stars: -1 })]))).toThrow(
      "$.repos[0].stars: expected a non-negative integer",
    );
  });
});
