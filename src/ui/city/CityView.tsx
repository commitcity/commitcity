"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { PLACEHOLDER_CATALOG } from "@/core/assets";
import { generateCity } from "@/core/generation";
import { parseCityInput } from "@/core/model";
import { type Orientation, TILE_32 } from "@/core/view";
import type { CityRenderer } from "@/renderer/city/CityRenderer";
import tiny from "../../../fixtures/tiny.json";
import medium from "../../../fixtures/medium.json";
import large from "../../../fixtures/large.json";
import edgeCases from "../../../fixtures/edge-cases.json";
import { type CityParams, FIXTURES, type FixtureName } from "./params";

const ORIENTATIONS: Orientation[] = [0, 1, 2, 3];

const FIXTURE_DATA: Record<FixtureName, unknown> = {
  tiny,
  medium,
  large,
  "edge-cases": edgeCases,
};

/** Dev-only page for milestone 3.1: a fixture city drawn with placeholder sprites. */
export function CityView({ initial }: { initial: CityParams }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<CityRenderer | null>(null);
  const [ready, setReady] = useState(false);
  const [fixture, setFixture] = useState<FixtureName>(initial.fixture);
  const [orientation, setOrientation] = useState<Orientation>(initial.orientation);
  const [zoom, setZoom] = useState(0);
  const [stats, setStats] = useState({ fps: 0, sprites: 0 });

  const model = useMemo(
    () => generateCity(parseCityInput(FIXTURE_DATA[fixture]), PLACEHOLDER_CATALOG),
    [fixture],
  );

  useEffect(() => {
    let cancelled = false;
    let renderer: CityRenderer | null = null;
    const initialZoom = initial.zoom;

    void import("@/renderer/city/CityRenderer").then(async ({ CityRenderer }) => {
      if (cancelled || !hostRef.current) return;
      renderer = new CityRenderer();
      renderer.onZoomChange = setZoom;
      await renderer.init(hostRef.current);
      if (cancelled) return;
      if (initialZoom) renderer.setZoom(initialZoom);
      setZoom(renderer.getZoom());
      rendererRef.current = renderer;
      setReady(true);
    });

    return () => {
      cancelled = true;
      renderer?.destroy();
      rendererRef.current = null;
    };
    // Mount once; later changes to `initial` are ignored on purpose.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!ready) return;
    rendererRef.current?.setScene({
      model,
      catalog: PLACEHOLDER_CATALOG,
      orientation,
      tile: TILE_32,
    });
  }, [ready, model, orientation]);

  useEffect(() => {
    const id = window.setInterval(() => {
      const r = rendererRef.current;
      if (r) setStats({ fps: Math.round(r.fps), sprites: r.spriteCount });
    }, 500);
    return () => window.clearInterval(id);
  }, []);

  return (
    <div style={{ position: "fixed", inset: 0, fontFamily: "monospace", fontSize: 13 }}>
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
          zoom <button onClick={() => rendererRef.current?.setZoom(zoom - 1)}>-</button> {zoom}{" "}
          <button onClick={() => rendererRef.current?.setZoom(zoom + 1)}>+</button>
        </span>
        <span data-testid="city-stats">
          {model.buildings.length} buildings · {stats.fps} fps · {stats.sprites} sprites
        </span>
      </div>
    </div>
  );
}
