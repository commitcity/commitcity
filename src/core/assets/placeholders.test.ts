import { describe, expect, it } from "vitest";
import type { BuildingManifest } from "./manifest";
import { PLACEHOLDER_MANIFESTS, withPlaceholders } from "./placeholders";

const real = (id: string, footprint: 1 | 2 | 3 | 4, variants: BuildingManifest["variants"]) => ({
  ...PLACEHOLDER_MANIFESTS[0]!,
  id,
  footprint,
  variants,
});

describe("withPlaceholders", () => {
  it("keeps every placeholder when there is no real art", () => {
    expect(withPlaceholders([])).toEqual(PLACEHOLDER_MANIFESTS);
  });

  it("drops a footprint's placeholders once real art covers both variants", () => {
    const art = [real("a", 2, ["default"]), real("b", 2, ["abandoned"]), real("c", 3, ["default"])];
    const result = withPlaceholders(art);
    expect(result.slice(0, 3)).toEqual(art);
    const footprints = new Set(result.slice(3).map((m) => m.footprint));
    expect([...footprints].sort()).toEqual([1, 3, 4]);
  });
});
