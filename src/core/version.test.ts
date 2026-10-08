import { describe, expect, it } from "vitest";
import { GENERATOR_VERSION } from "./version";

describe("GENERATOR_VERSION", () => {
  it("is a non-negative integer", () => {
    expect(Number.isInteger(GENERATOR_VERSION)).toBe(true);
    expect(GENERATOR_VERSION).toBeGreaterThanOrEqual(0);
  });
});
