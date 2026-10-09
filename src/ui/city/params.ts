import type { Orientation } from "@/core/view";

export const FIXTURES = ["tiny", "medium", "large", "edge-cases"] as const;
export type FixtureName = (typeof FIXTURES)[number];

const ORIENTATIONS: Orientation[] = [0, 1, 2, 3];

export interface CityParams {
  fixture: FixtureName;
  orientation: Orientation;
  zoom: number | null;
  /** Name of the selected repository. */
  repo: string | null;
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
    repo: get("repo") || null,
  };
}

/** The query string for the current view, so the URL can be shared. */
export function cityQuery(params: Omit<CityParams, "zoom">): string {
  const query = new URLSearchParams({ fixture: params.fixture });
  if (params.orientation !== 0) query.set("o", String(params.orientation));
  if (params.repo) query.set("repo", params.repo);
  return query.toString();
}

/** Settings of the public city page: everything but the fixture. */
export type ViewParams = Omit<CityParams, "fixture">;

export function parseViewParams(query: Record<string, string | string[] | undefined>): ViewParams {
  const { orientation, zoom, repo } = parseCityParams(query);
  return { orientation, zoom, repo };
}

/** The query string of the public city page for the current view. */
export function viewQuery(params: Omit<ViewParams, "zoom">): string {
  const query = new URLSearchParams();
  if (params.orientation !== 0) query.set("o", String(params.orientation));
  if (params.repo) query.set("repo", params.repo);
  return query.toString();
}
