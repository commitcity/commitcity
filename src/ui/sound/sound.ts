"use client";

import { bind, play, setEnabled, setVolume, type SoundName } from "cuelume";
import { useSyncExternalStore } from "react";

/** Interface sounds, synthesized by cuelume. The viewer's on/off choice is remembered. */
const STORAGE_KEY = "commitcity:sound";
/** Interaction sounds stay in the background. */
const VOLUME = 0.5;

let on = true;
let started = false;
const listeners = new Set<() => void>();

function read(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) !== "off";
  } catch {
    return true;
  }
}

/** Wires up every `data-cuelume-*` attribute on the page and applies the saved choice. */
export function startSounds() {
  if (started) return;
  started = true;
  on = read();
  setVolume(VOLUME);
  setEnabled(on);
  bind();
  listeners.forEach((l) => l());
}

export function setSound(value: boolean) {
  on = value;
  setEnabled(value);
  try {
    window.localStorage.setItem(STORAGE_KEY, value ? "on" : "off");
  } catch {
    // Private windows may refuse storage; the choice still holds for this page.
  }
  listeners.forEach((l) => l());
}

/** Plays a cue for an outcome no element announces, such as a rejected form. */
export function cue(sound: SoundName) {
  play(sound);
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

/** Whether sounds are on; true on the server and before the saved choice is read. */
export function useSoundOn(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => on,
    () => true,
  );
}
