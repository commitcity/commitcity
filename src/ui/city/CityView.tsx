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
import { InfoPanel } from "./InfoPanel";
import { type CityParams, FIXTURES, type FixtureName, cityQuery } from "./params";

const ORIENTATIONS: Orientation[] = [0, 1, 2, 3];
/** Keyboard pan step, in CSS pixels. */
const PAN_STEP = 64;

const FIXTURE_DATA: Record<FixtureName, unknown> = {
  tiny,
  medium,
  large,
  "edge-cases": edgeCases,
};

/**
 * Dev page for milestones 3.1 and 3.2: a fixture city drawn with placeholder
 * sprites, with hover, selection, an info panel, and the selection in the URL.
 * State lives here; the camera lives in the renderer (ARCHITECTURE.md §8).
 */
export function CityView({ initial }: { initial: CityParams }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<CityRenderer | null>(null);
  const [ready, setReady] = useState(false);
  const [fixture, setFixture] = useState<FixtureName>(initial.fixture);
  const [orientation, setOrientation] = useState<Orientation>(initial.orientation);
  const [zoom, setZoom] = useState(0);
  const [stats, setStats] = useState({ fps: 0, sprites: 0 });
  const [hovered, setHovered] = useState<string | null>(null);

  const input = useMemo(() => parseCityInput(FIXTURE_DATA[fixture]), [fixture]);
  const model = useMemo(() => generateCity(input, PLACEHOLDER_CATALOG), [input]);
  const repos = useMemo(() => new Map(input.repos.map((r) => [r.id, r])), [input]);

  const [selected, setSelected] = useState<string | null>(
    () => input.repos.find((r) => r.name === initial.repo)?.id ?? null,
  );
  // Center on a building selected by the URL once the city is on screen.
  const focusPending = useRef(selected !== null);
  const shownModel = useRef<typeof model | null>(null);

  useEffect(() => {
    let cancelled = false;
    let renderer: CityRenderer | null = null;
    const initialZoom = initial.zoom;

    void import("@/renderer/city/CityRenderer").then(async ({ CityRenderer }) => {
      if (cancelled || !hostRef.current) return;
      renderer = new CityRenderer();
      renderer.onZoomChange = setZoom;
      renderer.onHoverChange = setHovered;
      renderer.onTap = setSelected;
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
    const renderer = rendererRef.current;
    if (!ready || !renderer) return;
    const rotated = shownModel.current === model;
    shownModel.current = model;
    renderer.setScene({ model, catalog: PLACEHOLDER_CATALOG, orientation, tile: TILE_32 });
    // Keep the selection in view: on load from the URL, and after a rotation.
    if (selected && (focusPending.current || rotated)) renderer.focus(selected);
    focusPending.current = false;
    // `selected` is read only to keep it in view.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, model, orientation]);

  useEffect(() => {
    if (ready) rendererRef.current?.setSelected(selected);
  }, [ready, selected]);

  const selectedRepo = selected ? repos.get(selected) : undefined;

  useEffect(() => {
    const query = cityQuery({ fixture, orientation, repo: selectedRepo?.name ?? null });
    window.history.replaceState(null, "", `?${query}`);
  }, [fixture, orientation, selectedRepo]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (target?.closest("input, select, textarea")) return;
      const renderer = rendererRef.current;
      if (!renderer) return;

      const cycle = (step: number) => {
        const ids = model.buildings.map((b) => b.repoId);
        if (ids.length === 0) return;
        const index = selected ? ids.indexOf(selected) : -1;
        const next = ids[(index + step + ids.length) % ids.length]!;
        setSelected(next);
        renderer.focus(next);
      };
      const handlers: Record<string, () => void> = {
        ArrowUp: () => renderer.panBy(0, PAN_STEP),
        ArrowDown: () => renderer.panBy(0, -PAN_STEP),
        ArrowLeft: () => renderer.panBy(PAN_STEP, 0),
        ArrowRight: () => renderer.panBy(-PAN_STEP, 0),
        "+": () => renderer.setZoom(renderer.getZoom() + 1),
        "=": () => renderer.setZoom(renderer.getZoom() + 1),
        "-": () => renderer.setZoom(renderer.getZoom() - 1),
        q: () => setOrientation((o) => ((o + 3) % 4) as Orientation),
        e: () => setOrientation((o) => ((o + 1) % 4) as Orientation),
        n: () => cycle(1),
        p: () => cycle(-1),
        Escape: () => setSelected(null),
      };
      const handler = handlers[e.key.length === 1 ? e.key.toLowerCase() : e.key];
      if (!handler) return;
      e.preventDefault();
      handler();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [model, selected]);

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
          <select
            value={fixture}
            onChange={(e) => {
              setSelected(null);
              setFixture(e.target.value as FixtureName);
            }}
          >
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
        <span data-testid="city-hover" style={{ color: "#bbb" }}>
          {hovered ? repos.get(hovered)?.name : "arrows pan · +/- zoom · q/e rotate · n/p next"}
        </span>
      </div>
      {selectedRepo && (
        <InfoPanel owner={input.owner} repo={selectedRepo} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}
