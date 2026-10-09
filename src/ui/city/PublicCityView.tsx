"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { CityInput } from "@/core/model";
import type { Orientation } from "@/core/view";
import { InfoPanel } from "./InfoPanel";
import { type ViewParams, viewQuery } from "./params";
import { useCity } from "./useCity";

/** The public city of one GitHub account, at `/u/<login>`. */
export function PublicCityView({ input, initial }: { input: CityInput; initial: ViewParams }) {
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
  } = useCity(input, initial);

  useEffect(() => {
    const query = viewQuery({ orientation, repo: selected?.name ?? null });
    window.history.replaceState(null, "", query ? `?${query}` : window.location.pathname);
  }, [orientation, selected]);

  const rotate = (step: number) => setOrientation((o) => ((o + step + 4) % 4) as Orientation);

  return (
    <div className="city">
      <div ref={hostRef} className="city-canvas" />
      <header className="city-bar">
        <Link href="/" className="brand">
          CommitCity
        </Link>
        <h1>
          <a href={`https://github.com/${encodeURIComponent(input.owner)}`}>{input.owner}</a>
        </h1>
        <span className="city-meta">
          {buildingCount} {buildingCount === 1 ? "building" : "buildings"} ·{" "}
          <Updated at={input.snapshotAt} />
        </span>
        <span className="city-controls">
          <button onClick={() => rotate(-1)} aria-label="Rotate left (Q)">
            ⟲
          </button>
          <button onClick={() => rotate(1)} aria-label="Rotate right (E)">
            ⟳
          </button>
          <button onClick={() => setZoom(zoom - 1)} aria-label="Zoom out (-)">
            −
          </button>
          <button onClick={() => setZoom(zoom + 1)} aria-label="Zoom in (+)">
            +
          </button>
        </span>
        <span className="city-hint" aria-live="polite">
          {hovered ? hovered.name : "Drag to move · click a building"}
        </span>
      </header>
      {input.repos.length === 0 && (
        <p className="city-empty">
          {input.owner} has no public repositories yet, so the city is still an empty field.
        </p>
      )}
      {selected && <InfoPanel owner={input.owner} repo={selected} onClose={() => select(null)} />}
    </div>
  );
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** "updated 3 hours ago", from the time GitHub was read. */
function Updated({ at }: { at: string }) {
  // Relative time depends on the viewer's clock, so it is computed after hydration.
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    tick();
    const id = window.setInterval(tick, MINUTE);
    return () => window.clearInterval(id);
  }, []);

  const time = Date.parse(at);
  return (
    <time dateTime={at} title={new Date(time).toUTCString()}>
      updated {now === null ? "recently" : ago(now - time)}
    </time>
  );
}

export function ago(ms: number): string {
  const unit = (n: number, name: string) => `${n} ${name}${n === 1 ? "" : "s"} ago`;
  if (ms < MINUTE) return "just now";
  if (ms < HOUR) return unit(Math.floor(ms / MINUTE), "minute");
  if (ms < DAY) return unit(Math.floor(ms / HOUR), "hour");
  return unit(Math.floor(ms / DAY), "day");
}
