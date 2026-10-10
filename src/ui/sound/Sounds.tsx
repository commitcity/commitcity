"use client";

import { useEffect } from "react";
import { startSounds } from "./sound";

/** Mounted once in the root layout: turns on the page's interaction sounds. */
export function Sounds() {
  useEffect(startSounds, []);
  return null;
}
