"use client";

import Link from "next/link";
import { type PointerEvent, useEffect, useRef, useState } from "react";
import type { CityInput } from "@/core/model";
import type { Orientation } from "@/core/view";
import { cue } from "@/ui/sound/sound";
import { SoundToggle } from "@/ui/sound/SoundToggle";
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

  // Picking a building is announced; the selection read from the URL on load is not.
  const shownSelection = useRef(selected?.id ?? null);
  useEffect(() => {
    const id = selected?.id ?? null;
    if (id !== null && id !== shownSelection.current) cue("select");
    shownSelection.current = id;
  }, [selected]);

  const rotate = (step: number) => setOrientation((o) => ((o + step + 4) % 4) as Orientation);

  // The tooltip follows the pointer without re-rendering the page.
  const tipRef = useRef<HTMLDivElement>(null);
  const cityRef = useRef<HTMLDivElement>(null);
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    tipRef.current?.style.setProperty("--x", `${e.clientX}px`);
    tipRef.current?.style.setProperty("--y", `${e.clientY}px`);
  };
  // A press on the city itself grabs it: the cursor becomes a fist until release.
  const grab = (on: boolean) => cityRef.current?.classList.toggle("grabbing", on);

  return (
    <div
      ref={cityRef}
      className="city ui"
      onPointerMove={onPointerMove}
      onPointerDown={(e) => grab(e.target instanceof HTMLCanvasElement)}
      onPointerUp={() => grab(false)}
      onPointerCancel={() => grab(false)}
    >
      <div ref={hostRef} className="city-canvas" />
      <header className="city-bar ui-panel">
        <Link href="/" className="city-brand" data-cuelume-navigate>
          CommitCity
        </Link>
        <h1>
          <a href={`https://github.com/${encodeURIComponent(input.owner)}`}>{input.owner}</a>
        </h1>
        <p className="city-meta">
          {buildingCount} {buildingCount === 1 ? "building" : "buildings"} ·{" "}
          <Updated at={input.snapshotAt} />
        </p>
        <p className="city-hint">Drag to move · click a building</p>
      </header>
      <nav className="city-controls ui-panel" aria-label="View">
        <IconButton icon="rotate-left" label="Rotate left (Q)" onClick={() => rotate(-1)} />
        <IconButton icon="rotate-right" label="Rotate right (E)" onClick={() => rotate(1)} />
        <IconButton icon="minus" label="Zoom out (-)" onClick={() => setZoom(zoom - 1)} />
        <IconButton icon="plus" label="Zoom in (+)" onClick={() => setZoom(zoom + 1)} />
        <SoundToggle />
      </nav>
      <div ref={tipRef} className="city-tip ui-tip" hidden={!hovered} aria-live="polite">
        {hovered?.name}
      </div>
      {input.repos.length === 0 && (
        <p className="city-empty ui-note ui-paper">
          {input.owner} has no public repositories yet, so the city is still an empty field.
        </p>
      )}
      {selected && <InfoPanel owner={input.owner} repo={selected} onClose={() => select(null)} />}
    </div>
  );
}

function IconButton({
  icon,
  label,
  onClick,
}: {
  icon: string;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className="ui-button ui-button--icon"
      onClick={onClick}
      aria-label={label}
      title={label}
      data-cuelume-tap
    >
      <span className={`ui-icon ui-icon--${icon}`} aria-hidden="true" />
    </button>
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
