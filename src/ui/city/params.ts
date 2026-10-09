import type { Orientation } from "@/core/view";

export const FIXTURES = ["tiny", "medium", "large", "edge-cases"] as const;
export type FixtureName = (typeof FIXTURES)[number];

const ORIENTATIONS: Orientation[] = [0, 1, 2, 3];

export interface CityParams {
  fixture: FixtureName;
  orientation: Orientation;
  zoom: number | null;
}

/** Reads the initial settings from the query string, so screenshots are reproducible. */
export function parseCityParams(query: Record<string, string | string[] | undefined>): CityParams {
  const get = (key: string) => {
    const value = query[key];
    return Array.isArray(value) ? value[0] : value;
  };
  const fixture = get("fixture");
  const o = Number(get("o"));
  const zoom = Number(get("zoom"));
  return {
    fixture: FIXTURES.includes(fixture as FixtureName) ? (fixture as FixtureName) : "medium",
    orientation: (ORIENTATIONS.includes(o as Orientation) ? o : 0) as Orientation,
    zoom: Number.isInteger(zoom) && zoom > 0 ? zoom : null,
  };
}
