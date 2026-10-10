"use client";

import { setSound, useSoundOn } from "./sound";

/** An icon button that turns the interface sounds on and off. */
export function SoundToggle({ className = "" }: { className?: string }) {
  const on = useSoundOn();
  const label = on ? "Turn sounds off" : "Turn sounds on";
  return (
    <button
      type="button"
      className={`ui-button ui-button--icon ${className}`}
      onClick={() => setSound(!on)}
      aria-pressed={on}
      aria-label={label}
      title={label}
      data-cuelume-toggle
    >
      <span className={`ui-icon ui-icon--sound-${on ? "on" : "off"}`} aria-hidden="true" />
    </button>
  );
}
