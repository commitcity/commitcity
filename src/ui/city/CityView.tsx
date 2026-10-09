"use client";

import { useEffect, useMemo, useState } from "react";
import { parseCityInput } from "@/core/model";
import type { Orientation } from "@/core/view";
import tiny from "../../../fixtures/tiny.json";
import medium from "../../../fixtures/medium.json";
import large from "../../../fixtures/large.json";
import edgeCases from "../../../fixtures/edge-cases.json";
import { InfoPanel } from "./InfoPanel";
import { type CityParams, FIXTURES, type FixtureName, cityQuery } from "./params";
import { useCity } from "./useCity";

const ORIENTATIONS: Orientation[] = [0, 1, 2, 3];

const FIXTURE_DATA: Record<FixtureName, unknown> = {
  tiny,
  medium,
  large,
  "edge-cases": edgeCases,
};

/**
 * Dev page for milestones 3.1 and 3.2: a fixture city with hover, selection,
 * an info panel, and the selection in the URL.
 */
export function CityView({ initial }: { initial: CityParams }) {
  const [fixture, setFixture] = useState<FixtureName>(initial.fixture);
  const input = useMemo(() => parseCityInput(FIXTURE_DATA[fixture]), [fixture]);
  const {
    hostRef,
    buildingCount,
    orientation,
    setOrientation,
    zoom,
    setZoom,
    selected,
    select,
    hovered,
    stats,
  } = useCity(input, initial);

  useEffect(() => {
    const query = cityQuery({ fixture, orientation, repo: selected?.name ?? null });
    window.history.replaceState(null, "", `?${query}`);
  }, [fixture, orientation, selected]);

  return (
    <div
      className="ui"
      style={{ position: "fixed", inset: 0, fontFamily: "monospace", fontSize: 13 }}
    >
      <div ref={hostRef} style={{ position: "absolute", inset: 0 }} />
      <div
        data-testid="city-controls"
        style={{
          position: "absolute",
          top: 8,
          left: 8,
          display: "flex",
          flexWrap: "wrap",
          gap: 8,
          alignItems: "center",
          maxWidth: "calc(100% - 16px)",
          padding: 8,
          background: "rgba(0, 0, 0, 0.7)",
          color: "#fff",
        }}
      >
        <label>
          fixture{" "}
          <select value={fixture} onChange={(e) => setFixture(e.target.value as FixtureName)}>
            {FIXTURES.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </label>
        <span>
          orientation{" "}
          {ORIENTATIONS.map((o) => (
            <button key={o} onClick={() => setOrientation(o)} disabled={o === orientation}>
              {o}
            </button>
          ))}
        </span>
        <span>
          zoom <button onClick={() => setZoom(zoom - 1)}>-</button> {zoom}{" "}
          <button onClick={() => setZoom(zoom + 1)}>+</button>
        </span>
        <span data-testid="city-stats">
          {buildingCount} buildings · {stats.fps} fps · {stats.sprites} sprites
        </span>
        <span data-testid="city-hover" style={{ color: "#bbb" }}>
          {hovered ? hovered.name : "arrows pan · +/- zoom · q/e rotate · n/p next"}
        </span>
      </div>
      {selected && <InfoPanel owner={input.owner} repo={selected} onClose={() => select(null)} />}
    </div>
  );
}
