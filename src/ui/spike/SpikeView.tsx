"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { type Orientation, TILE_32, TILE_64 } from "@/core/view";
import hardCases from "../../../fixtures/spike/hard-cases.json";
import type { SpikeRenderer } from "@/renderer/spike/SpikeRenderer";
import { createBenchmarkScene } from "@/renderer/spike/benchmark";
import type { SpikeScene } from "@/renderer/spike/scene";
import type { SceneName, SpikeParams } from "./params";

const ORIENTATIONS: Orientation[] = [0, 1, 2, 3];

/** Dev-only page for milestone 1.1. Not part of the product UI. */
export function SpikeView({ initial }: { initial: SpikeParams }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<SpikeRenderer | null>(null);
  const [ready, setReady] = useState(false);
  const [sceneName, setSceneName] = useState<SceneName>(initial.scene);
  const [orientation, setOrientation] = useState<Orientation>(initial.orientation);
  const [tileWidth, setTileWidth] = useState<32 | 64>(initial.tile);
  const [autoPan, setAutoPan] = useState(initial.autoPan);
  const [zoom, setZoom] = useState(0);
  const [stats, setStats] = useState({ fps: 0, sprites: 0 });

  const scene: SpikeScene = useMemo(
    () => (sceneName === "benchmark" ? createBenchmarkScene() : (hardCases as SpikeScene)),
    [sceneName],
  );

  useEffect(() => {
    let cancelled = false;
    let renderer: SpikeRenderer | null = null;
    const initialZoom = initial.zoom;

    void import("@/renderer/spike/SpikeRenderer").then(async ({ SpikeRenderer }) => {
      if (cancelled || !hostRef.current) return;
      renderer = new SpikeRenderer();
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
    rendererRef.current?.setSettings({
      scene,
      orientation,
      tile: tileWidth === 64 ? TILE_64 : TILE_32,
    });
  }, [ready, scene, orientation, tileWidth]);

  useEffect(() => {
    if (ready) rendererRef.current?.setAutoPan(autoPan);
  }, [ready, autoPan]);

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
        data-testid="spike-controls"
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
          scene{" "}
          <select value={sceneName} onChange={(e) => setSceneName(e.target.value as SceneName)}>
            <option value="hard-cases">hard cases</option>
            <option value="benchmark">benchmark (300)</option>
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
          tile{" "}
          {([32, 64] as const).map((w) => (
            <button key={w} onClick={() => setTileWidth(w)} disabled={w === tileWidth}>
              {w}×{w / 2}
            </button>
          ))}
        </span>
        <span>
          zoom <button onClick={() => rendererRef.current?.setZoom(zoom - 1)}>-</button> {zoom}{" "}
          <button onClick={() => rendererRef.current?.setZoom(zoom + 1)}>+</button>
        </span>
        <label>
          <input type="checkbox" checked={autoPan} onChange={(e) => setAutoPan(e.target.checked)} />{" "}
          auto-pan
        </label>
        <span data-testid="spike-stats">
          {stats.fps} fps · {stats.sprites} sprites
        </span>
      </div>
    </div>
  );
}
