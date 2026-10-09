import { describe, expect, it } from "vitest";
import edgeCases from "../../../fixtures/edge-cases.json";
import large from "../../../fixtures/large.json";
import medium from "../../../fixtures/medium.json";
import tiny from "../../../fixtures/tiny.json";
import { type CityInput, type RepoInput, parseCityInput } from "@/core/model";
import { createRandom } from "@/core/random";
import { formatLotGrid } from "./debug";
import { sortRepos } from "./order";
import { type LotAssignment, placeRepos } from "./placement";

const FIXTURES: Record<string, CityInput> = {
  tiny: parseCityInput(tiny),
  medium: parseCityInput(medium),
  large: parseCityInput(large),
  "edge-cases": parseCityInput(edgeCases),
};

function positions(assignments: LotAssignment[]): Map<string, string> {
  return new Map(assignments.map((a) => [a.repoId, `${a.lot.origin.x},${a.lot.origin.y}`]));
}

function expectSamePositions(before: CityInput, after: CityInput, ids: Iterable<string>) {
  const a = positions(placeRepos(before));
  const b = positions(placeRepos(after));
  for (const id of ids) expect(b.get(id), id).toBe(a.get(id));
}

function shuffled<T>(items: readonly T[], seed: string): T[] {
  const random = createRandom(seed);
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = random.int(0, i);
    [copy[i], copy[j]] = [copy[j]!, copy[i]!];
  }
  return copy;
}

describe("sortRepos", () => {
  it("orders by creation time, then by id", () => {
    const ids = sortRepos(FIXTURES["edge-cases"]!.repos).map((r) => r.id);
    expect(ids.indexOf("R_edge_same_time_a")).toBe(ids.indexOf("R_edge_same_time_b") - 1);
    expect(ids[0]).toBe("R_edge_archived");
  });

  it("compares instants, not strings", () => {
    const repo = (id: string, createdAt: string) => ({
      ...FIXTURES.tiny!.repos[0]!,
      id,
      createdAt,
    });
    const ids = sortRepos([
      repo("b", "2020-01-01T00:00:00.500Z"),
      repo("a", "2020-01-01T00:00:00Z"),
    ]);
    expect(ids.map((r) => r.id)).toEqual(["a", "b"]);
  });
});

describe("placeRepos", () => {
  it.each(Object.entries(FIXTURES))(
    "is deterministic and ignores input order (%s)",
    (name, input) => {
      const first = placeRepos(input);
      expect(placeRepos(input)).toEqual(first);
      expect(placeRepos({ ...input, repos: shuffled(input.repos, name) })).toEqual(first);
    },
  );

  it("gives every repository its own lot", () => {
    const assignments = placeRepos(FIXTURES.large!);
    expect(new Set(assignments.map((a) => a.lot.index)).size).toBe(assignments.length);
    expect(new Set(assignments.map((a) => a.repoId)).size).toBe(assignments.length);
  });

  it("puts the oldest repository in the first lot", () => {
    const input = FIXTURES.medium!;
    const oldest = sortRepos(input.repos)[0]!;
    expect(placeRepos(input)[0]).toMatchObject({ repoId: oldest.id, lot: { index: 0 } });
  });

  it("keeps every position when a newer repository is added", () => {
    for (const [name, input] of Object.entries(FIXTURES)) {
      const newest = Math.max(...input.repos.map((r) => Date.parse(r.createdAt)));
      const added: RepoInput = {
        ...input.repos[0]!,
        id: `R_new_${name}`,
        createdAt: new Date(newest + 1000).toISOString(),
      };
      expectSamePositions(
        input,
        { ...input, repos: [...input.repos, added] },
        input.repos.map((r) => r.id),
      );
    }
  });

  it("keeps every position when stars, commits, or archiving change", () => {
    const input = FIXTURES.large!;
    const random = createRandom("mutations");
    const changed: CityInput = {
      ...input,
      repos: input.repos.map((r) => ({
        ...r,
        stars: random.int(0, 50_000),
        commitCount: random.chance(0.2) ? null : random.int(0, 10_000),
        isArchived: random.chance(0.5),
        isFork: random.chance(0.5),
        primaryLanguage: random.pick(["Go", "Rust", null]),
        pushedAt: null,
      })),
    };
    expectSamePositions(
      input,
      changed,
      input.repos.map((r) => r.id),
    );
  });

  it("supports timelapse: the city at any date is a subset with the same positions", () => {
    const input = FIXTURES.large!;
    const today = positions(placeRepos(input));
    const dates = sortRepos(input.repos).map((r) => r.createdAt);
    for (const date of [dates[0]!, dates[50]!, dates[160]!, dates[dates.length - 1]!]) {
      const cutoff = Date.parse(date);
      const past = placeRepos({
        ...input,
        repos: input.repos.filter((r) => Date.parse(r.createdAt) <= cutoff),
      });
      for (const [id, position] of positions(past)) expect(position, id).toBe(today.get(id));
    }
  });

  it("returns an empty list for an account with no repositories", () => {
    expect(placeRepos({ ...FIXTURES.tiny!, repos: [] })).toEqual([]);
  });
});

describe("formatLotGrid", () => {
  it("prints the tiny fixture", () => {
    expect(formatLotGrid(placeRepos(FIXTURES.tiny!))).toMatchInlineSnapshot(`
      "0 1
      . ."
    `);
  });

  it("prints the medium fixture", () => {
    expect(formatLotGrid(placeRepos(FIXTURES.medium!))).toMatchSnapshot();
  });

  it("prints an empty city", () => {
    expect(formatLotGrid([])).toBe("(empty)");
  });
});
