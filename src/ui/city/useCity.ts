"use client";

import { type RefObject, useEffect, useMemo, useRef, useState } from "react";
import { createCatalog, withPlaceholders } from "@/core/assets";
import { generateCity } from "@/core/generation";
import type { CityInput, RepoInput } from "@/core/model";
import { type Orientation, TILE_32 } from "@/core/view";
import type { CityRenderer } from "@/renderer/city/CityRenderer";
import { type LoadedAssets, loadAssets } from "@/renderer/city/loadAssets";

/** Written by `pnpm pack-assets` (runs before `dev` and `build`). */
const CATALOG_URL = "/generated/assets/catalog.json";
/** Keyboard pan step, in CSS pixels. */
const PAN_STEP = 64;
/** Backdrop drift: how far the camera wanders from its start, in CSS pixels, and how slowly. */
const DRIFT_RADIUS = 96;
const DRIFT_PERIOD_MS = 60_000;

export interface CityStart {
  orientation: Orientation;
  zoom: number | null;
  /** Name of the repository to select and center on. */
  repo: string | null;
  /**
   * A backdrop city: no keyboard controls, and the camera drifts slowly unless
   * the viewer prefers reduced motion. Pointer input is left to the page's CSS.
   */
  passive?: boolean;
}

export interface City {
  hostRef: RefObject<HTMLDivElement | null>;
  input: CityInput;
  buildingCount: number;
  orientation: Orientation;
  setOrientation: (o: Orientation | ((o: Orientation) => Orientation)) => void;
  zoom: number;
  setZoom: (zoom: number) => void;
  selected: RepoInput | null;
  select: (repoId: string | null) => void;
  hovered: RepoInput | null;
  stats: { fps: number; sprites: number };
}

/**
 * Generates and draws a city into `hostRef`, with hover, selection, rotation,
 * zoom and keyboard controls. Shared by the dev page and the public page.
 * State lives here; the camera lives in the renderer (ARCHITECTURE.md §8).
 */
export function useCity(input: CityInput, start: CityStart): City {
  const passive = start.passive ?? false;
  const hostRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<CityRenderer | null>(null);
  const [ready, setReady] = useState(false);
  const [orientation, setOrientation] = useState<Orientation>(start.orientation);
  const [zoom, setZoomState] = useState(0);
  const [stats, setStats] = useState({ fps: 0, sprites: 0 });
  const [hovered, setHovered] = useState<string | null>(null);

  // Undefined while loading; null when no artist assets have been packed.
  const [assets, setAssets] = useState<LoadedAssets | null | undefined>(undefined);
  const catalog = useMemo(
    () => createCatalog(withPlaceholders(assets?.packed.buildings ?? [])),
    [assets],
  );
  const model = useMemo(() => generateCity(input, catalog), [input, catalog]);
  const repos = useMemo(() => new Map(input.repos.map((r) => [r.id, r])), [input]);

  const [selected, setSelected] = useState<string | null>(
    () => input.repos.find((r) => r.name === start.repo)?.id ?? null,
  );
  // A new city starts without a selection.
  const [shownInput, setShownInput] = useState(input);
  if (shownInput !== input) {
    setShownInput(input);
    setSelected(null);
  }
  // Center on a building selected by the URL once the city is on screen.
  const focusPending = useRef(selected !== null);
  const shownModel = useRef<typeof model | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadAssets(CATALOG_URL)
      .catch((error: unknown) => {
        console.error("Artist assets failed to load; drawing placeholders.", error);
        return null;
      })
      .then((loaded) => {
        if (!cancelled) setAssets(loaded);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    let renderer: CityRenderer | null = null;
    const initialZoom = start.zoom;

    void import("@/renderer/city/CityRenderer").then(async ({ CityRenderer }) => {
      if (cancelled || !hostRef.current) return;
      renderer = new CityRenderer();
      renderer.onZoomChange = setZoomState;
      renderer.onHoverChange = setHovered;
      renderer.onTap = setSelected;
      await renderer.init(hostRef.current);
      if (cancelled) return;
      if (initialZoom) renderer.setZoom(initialZoom);
      setZoomState(renderer.getZoom());
      rendererRef.current = renderer;
      setReady(true);
    });

    return () => {
      cancelled = true;
      renderer?.destroy();
      rendererRef.current = null;
    };
    // Mount once; later changes to `start` are ignored on purpose.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const renderer = rendererRef.current;
    if (!ready || !renderer || assets === undefined) return;
    const rotated = shownModel.current === model;
    shownModel.current = model;
    renderer.setScene({ model, catalog, orientation, tile: TILE_32, assets });
    // Keep the selection in view: on load from the URL, and after a rotation.
    if (selected && (focusPending.current || rotated)) renderer.focus(selected);
    focusPending.current = false;
    // `selected` is read only to keep it in view.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, model, orientation, assets, catalog]);

  useEffect(() => {
    if (ready) rendererRef.current?.setSelected(selected);
  }, [ready, selected]);

  useEffect(() => {
    if (passive) return;
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
  }, [model, selected, passive]);

  useEffect(() => {
    if (!passive || !ready) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    // The camera follows a slow ellipse; pans are whole pixels, so keep the remainder.
    let frame = 0;
    let shown = { x: 0, y: 0 };
    const t0 = performance.now();
    const tick = (now: number) => {
      const angle = ((now - t0) / DRIFT_PERIOD_MS) * 2 * Math.PI;
      const x = Math.round(DRIFT_RADIUS * Math.sin(angle));
      const y = Math.round((DRIFT_RADIUS / 2) * Math.sin(2 * angle));
      if (x !== shown.x || y !== shown.y) rendererRef.current?.panBy(x - shown.x, y - shown.y);
      shown = { x, y };
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [passive, ready]);

  useEffect(() => {
    const id = window.setInterval(() => {
      const r = rendererRef.current;
      if (r) setStats({ fps: Math.round(r.fps), sprites: r.spriteCount });
    }, 500);
    return () => window.clearInterval(id);
  }, []);

  return {
    hostRef,
    input,
    buildingCount: model.buildings.length,
    orientation,
    setOrientation,
    zoom,
    setZoom: (z) => rendererRef.current?.setZoom(z),
    selected: (selected && repos.get(selected)) || null,
    select: setSelected,
    hovered: (hovered && repos.get(hovered)) || null,
    stats,
  };
}
