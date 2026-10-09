import type { Orientation } from "@/core/view";

export type SceneName = "hard-cases" | "benchmark";

const ORIENTATIONS: Orientation[] = [0, 1, 2, 3];

export interface SpikeParams {
  scene: SceneName;
  orientation: Orientation;
  tile: 32 | 64;
  zoom: number | null;
  autoPan: boolean;
}

/** Reads the initial settings from the query string, so screenshots are reproducible. */
export function parseSpikeParams(
  query: Record<string, string | string[] | undefined>,
): SpikeParams {
  const get = (key: string) => {
    const value = query[key];
    return Array.isArray(value) ? value[0] : value;
  };
  const o = Number(get("o"));
  const zoom = Number(get("zoom"));
  return {
    scene: get("scene") === "benchmark" ? "benchmark" : "hard-cases",
    orientation: (ORIENTATIONS.includes(o as Orientation) ? o : 0) as Orientation,
    tile: get("tile") === "64" ? 64 : 32,
    zoom: Number.isInteger(zoom) && zoom > 0 ? zoom : null,
    autoPan: get("pan") === "1",
  };
}
