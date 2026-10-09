import { describe, expect, it } from "vitest";
import { hash128, hash53 } from "./hash";
import { createRandom } from "./prng";
import { repoSeed, repoStream } from "./streams";

describe("hash53", () => {
  it("matches the reference cyrb53 values", () => {
    expect(hash53("a")).toBe(7929297801672961);
    expect(hash53("b")).toBe(8684336938537663);
    expect(hash53("revenge")).toBe(4051478007546757);
    expect(hash53("revenue")).toBe(8309097637345594);
  });

  it("changes with the seed", () => {
    expect(hash53("revenue", 1)).not.toBe(hash53("revenue"));
  });

  it("stays below 2^53", () => {
    for (const text of ["", "x", "commitcity", "日本語 🏙️"]) {
      expect(Number.isSafeInteger(hash53(text))).toBe(true);
      expect(hash53(text)).toBeGreaterThanOrEqual(0);
    }
  });
});

describe("hash128", () => {
  it("returns four unsigned 32-bit words", () => {
    for (const word of hash128("commitcity")) {
      expect(Number.isInteger(word) && word >= 0 && word < 2 ** 32).toBe(true);
    }
  });
});

describe("createRandom", () => {
  it("matches the stored sequence for a known seed", () => {
    // Changing this sequence changes every generated city: bump GENERATOR_VERSION.
    const random = createRandom("commitcity");
    expect(Array.from({ length: 6 }, () => random.nextUint32())).toEqual([
      2315552853, 2117975924, 1505250856, 3129326042, 3389711163, 26628453,
    ]);
  });

  it("gives the same sequence for the same seed", () => {
    const a = createRandom("same");
    const b = createRandom("same");
    for (let i = 0; i < 100; i++) expect(a.next()).toBe(b.next());
  });

  it("returns floats in [0, 1) with a sensible mean", () => {
    const random = createRandom("distribution");
    let sum = 0;
    for (let i = 0; i < 10_000; i++) {
      const value = random.next();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
      sum += value;
    }
    expect(sum / 10_000).toBeCloseTo(0.5, 1);
  });

  it("returns integers within inclusive bounds and hits both ends", () => {
    const random = createRandom("ints");
    const seen = new Set<number>();
    for (let i = 0; i < 1_000; i++) {
      const value = random.int(-2, 3);
      expect(Number.isInteger(value) && value >= -2 && value <= 3).toBe(true);
      seen.add(value);
    }
    expect([...seen].sort((a, b) => a - b)).toEqual([-2, -1, 0, 1, 2, 3]);
  });

  it("rejects invalid ranges and empty picks", () => {
    const random = createRandom("errors");
    expect(() => random.int(3, 2)).toThrow(RangeError);
    expect(() => random.int(0.5, 2)).toThrow(RangeError);
    expect(() => random.pick([])).toThrow(RangeError);
  });

  it("picks every element of an array", () => {
    const random = createRandom("pick");
    const seen = new Set<string>();
    for (let i = 0; i < 200; i++) seen.add(random.pick(["a", "b", "c"]));
    expect(seen.size).toBe(3);
  });
});

describe("repository streams", () => {
  it("builds the seed from the owner and the repository id", () => {
    expect(repoSeed("octocat", "R_1")).toBe("octocat:R_1");
  });

  it("is unaffected by other repositories and by draw order", () => {
    const alone = repoStream("octocat", "R_1", "building");
    const expected = Array.from({ length: 5 }, () => alone.nextUint32());

    // Interleave draws from other repositories and purposes.
    const other = repoStream("octocat", "R_2", "building");
    const decoration = repoStream("octocat", "R_1", "decoration");
    const again = repoStream("octocat", "R_1", "building");
    const actual: number[] = [];
    for (let i = 0; i < 5; i++) {
      other.nextUint32();
      decoration.nextUint32();
      actual.push(again.nextUint32());
    }
    expect(actual).toEqual(expected);
  });

  it("differs between repositories, owners, and purposes", () => {
    const first = (owner: string, id: string, purpose: string) =>
      repoStream(owner, id, purpose).nextUint32();
    const base = first("octocat", "R_1", "building");
    expect(first("octocat", "R_2", "building")).not.toBe(base);
    expect(first("hubot", "R_1", "building")).not.toBe(base);
    expect(first("octocat", "R_1", "decoration")).not.toBe(base);
  });
});
